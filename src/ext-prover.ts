import * as vscode from 'vscode';
import { PieuvreProver } from './prover';

export class ExtensionPieuvreProver extends PieuvreProver {
    protected outputChannel: vscode.OutputChannel;
    protected config: vscode.WorkspaceConfiguration;

    constructor() {
        super();
        this.outputChannel =
            vscode.window.createOutputChannel('Pieuvre Prover');
        this.config = vscode.workspace.getConfiguration('vspieuvre');
    }

    protected getPath(): string | undefined {
        return this.config.get<string>('pieuvre Binary.Path');
    }

    protected getFlags(): string[] {
        return this.config
            .get<string>('pieuvre Binary.Flags', '')
            .split(' ')
            .filter((x) => x.length > 0);
    }

    protected appendLog(log: string): void {
        this.outputChannel.append(log);
    }

    protected disposeLog(): void {
        this.outputChannel.dispose();
    }
    protected showError(err: string): void {
        vscode.window.showErrorMessage(err);
    }
    protected showInfo(info: string): void {
        vscode.window.showInformationMessage(info);
    }
}
