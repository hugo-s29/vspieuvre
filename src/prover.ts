import { ChildProcess, spawn } from 'child_process';

class BinaryNotFoundError extends Error {
    constructor(binaryPath: string) {
        super(`Pieuvre binary not found at: ${binaryPath}`);
        this.name = 'BinaryNotFoundError';
        // Maintains proper stack trace in V8 (Node/Chrome)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BinaryNotFoundError);
        }
    }
}

interface WaitingCommand {
    kind: string;
    command: string;
    resolve: (r: string) => void;
    reject: (r: string) => void;
}

export abstract class PieuvreProver {
    private process: ChildProcess | null = null;
    private restartPromise: Promise<void> | null = null;

    protected abstract getPath(): string | undefined;
    protected abstract getFlags(): string[];

    protected abstract appendLog(_: string): void;
    protected abstract disposeLog(): void;
    protected abstract showError(_: string): void;
    protected abstract showInfo(_: string): void;

    public async start(): Promise<void> {
        const binaryPath = this.getPath();
        const flags = this.getFlags();

        try {
            if (!binaryPath) {
                throw new BinaryNotFoundError(
                    'Pieuvre binary path not configured',
                );
            }
            this.process = spawn(binaryPath, flags, { stdio: 'pipe' });

            this.process.stdout?.on('data', (data) => {
                this._stdoutBuffer += data.toString();
                this.appendLog(data.toString());
            });

            this.process.stderr?.on('data', (data) => {
                this.appendLog(`ERROR: ${data}`);
            });

            this.process.on('close', (code) => {
                this.appendLog(`Prover exited with code ${code}`);
            });

            await this.waitForTag('[PIEUVRE OK]');
            this.isProcessingCommand = false;
            this.hasStarted = true;
            this.unlockWaitingStarted(true);

            this.showInfo('Pieuvre prover started successfully');
        } catch (error) {
            this.unlockWaitingStarted(false);
            this.showError(`Failed to start Pieuvre: ${error}`);
        }
    }

    private hasStarted = false;
    private waitingStarted: {
        resolve: (_: unknown) => void;
        reject: (_: unknown) => void;
    }[] = [];

    public async untilStarted() {
        if (this.hasStarted) return;

        return new Promise((resolve, reject) => {
            this.waitingStarted.push({ resolve, reject });
        });
    }

    private unlockWaitingStarted(ok: boolean) {
        // As multiple things can happen at once, we need to do it sequentially
        // and not just use ".forEach"

        while (this.waitingStarted.length > 0) {
            const { resolve, reject } = this.waitingStarted.pop()!;
            if (ok) resolve(null);
            else reject(null);
        }
    }

    public async restart(): Promise<void> {
        if (this.restartPromise) return this.restartPromise;

        this.stop();

        this.restartPromise = this.start().then((_) => {
            this.restartPromise = null;
        });

        return this.restartPromise;
    }

    private isProcessingCommand: boolean = true; // (because of [PIEUVRE OK] at the beginning)
    private nextCommands: WaitingCommand[] = [];

    sendCommand(kind: string, command: string): Promise<string> {
        if (!this.process) throw new Error('Prover not initialized');

        return new Promise((resolve, reject) => {
            this.nextCommands.push({ kind, command, resolve, reject });
            this.processNextCommand();
        });
    }

    private processNextCommand() {
        if (this.isProcessingCommand || this.nextCommands.length === 0) {
            return; // Skip if already processing or no commands in the queue
        }

        const { kind, command, resolve, reject } = this.nextCommands[0];
        this.isProcessingCommand = true;

        this.process?.stdin?.write(
            `${kind}\n${command.replaceAll('\n', ' ')}\n`,
        );

        this.waitForTag('[BEGIN]', '[END]', '[ERROR]')
            .then((result) => {
                this.isProcessingCommand = false;
                resolve(result);
                this.nextCommands.shift();
                this.processNextCommand(); // Process the next command in the queue
            })
            .catch((error) => {
                this.isProcessingCommand = false;
                reject(error);
                this.nextCommands.shift();
                this.processNextCommand(); // Process the next command in the queue
            });
    }

    public cancelNextCommands() {
        // As multiple things can happen at once, we need to do it sequentially
        // and not just use ".forEach"

        let wasProcessing = this.isProcessingCommand;

        while (this.nextCommands.length > 0) {
            const cmd = this.nextCommands.pop()!;
            cmd.reject('Canceled');
        }

        return wasProcessing;
    }

    stop() {
        this.cancelNextCommands();
        this.process?.kill();
        this.disposeLog();
    }

    private _stdoutBuffer = '';

    waitForTag(
        beginTag: string,
        successTag: string = '',
        errorTag?: string,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const buffer = this._stdoutBuffer.trim();
                if (
                    buffer.startsWith(beginTag) &&
                    buffer.endsWith(successTag)
                ) {
                    clearInterval(checkInterval);
                    const res = buffer.substring(
                        beginTag.length,
                        this._stdoutBuffer.length - successTag.length - 1,
                    );
                    this._stdoutBuffer = '';
                    resolve(res.trim());
                } else if (
                    errorTag &&
                    buffer.startsWith(beginTag) &&
                    buffer.includes(errorTag)
                ) {
                    clearInterval(checkInterval);
                    const res = buffer
                        .substring(beginTag.length)
                        .replace(errorTag, '');
                    this._stdoutBuffer = '';
                    reject(res.trim());
                }
            }, 50);
        });
    }
}
