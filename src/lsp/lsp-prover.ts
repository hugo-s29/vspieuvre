import { PieuvreProver } from '../prover';

export class LSPPieuvreProver extends PieuvreProver {
    constructor(
        protected path: string,
        protected flags: string[],
        protected showDebugLog: boolean,
    ) {
        super();
    }

    protected getPath(): string | undefined {
        return this.path;
    }
    protected getFlags(): string[] {
        return this.flags;
    }
    protected appendLog(log: string): void {
        if (this.showDebugLog) console.log(log);
    }
    protected disposeLog(): void {}

    protected showError(err: string): void {
        console.error(err);
    }
    protected showInfo(info: string): void {
        console.info(info);
    }
}
