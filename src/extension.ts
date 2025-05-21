import * as path from 'path';
import * as vscode from 'vscode';
import { PieuvreProver } from './prover';
import { ProofManager } from './proof-manager';
import { AnsiToHtml, createThemeAwareAnsiConverter } from './ansi';
import webviewContent from './webview.html';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

// Global references
let proofPanel: vscode.WebviewPanel | undefined;
let prover: PieuvreProver;
let proofManager: ProofManager;
let ansiHtml: AnsiToHtml = createThemeAwareAnsiConverter();
let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    prover = new PieuvreProver();

    prover.start().then((success) => {
        if (success) {
            vscode.window.showInformationMessage(
                'Pieuvre prover started successfully',
            );
        }
    });

    proofManager = new ProofManager(prover);

    let serverModule = context.asAbsolutePath(path.join('dist', 'lsp.js'));
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
        },
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'pieuvre' }],
        synchronize: {
            fileEvents:
                vscode.workspace.createFileSystemWatcher('**/.clientrc'),
        },
    };

    client = new LanguageClient(
        'pieuvreLanguageServerClient',
        'Pieuvre (Language Server Client)',
        serverOptions,
        clientOptions,
    );

    context.subscriptions.push({ dispose: () => client.stop() });

    client
        .start()
        .then(() => vscode.window.showInformationMessage('LSP Client started'))
        .catch((err) => {
            console.error('LSP client failed to start:', err);
            vscode.window.showErrorMessage(
                'LSP client failed to start: ' + err.message,
            );
        });

    // Track active document
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document.languageId === 'pieuvre') {
            proofManager.setDocument(editor.document);
        }
    });

    // Register panel command
    context.subscriptions.push(
        vscode.commands.registerCommand('vspieuvre.showProofPanel', () => {
            if (proofPanel) {
                proofPanel.reveal(vscode.ViewColumn.Two, true);
                return;
            }

            proofPanel = createProofPanel(context);
        }),
    );

    // Register step commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vspieuvre.stepForward', async () => {
            vscode.commands.executeCommand('vspieuvre.showProofPanel');

            const editor = vscode.window.activeTextEditor;

            if (editor) {
                proofManager.setDocument(editor.document);
            }

            const sentence = proofManager.getNextSentence();
            if (editor && sentence) {
                try {
                    const response = await prover.sendCommand(sentence.text);
                    updateProofState(response);

                    // Highlight in editor
                    editor.selection = new vscode.Selection(
                        sentence.range.end,
                        sentence.range.end,
                    );
                    editor.revealRange(sentence.range);
                } catch (err: any) {
                    proofManager.updateDecorations(true);
                    proofManager.undoLastStep(false);
                    updateProofState(err.toString());

                    editor.selection = new vscode.Selection(
                        sentence.range.end,
                        sentence.range.end,
                    );
                    editor.revealRange(sentence.range);
                }
            } else {
                vscode.window.showInformationMessage(
                    'No more sentences to process!',
                );
            }
        }),

        vscode.commands.registerCommand('vspieuvre.stepBack', async () => {
            vscode.commands.executeCommand('vspieuvre.showProofPanel');

            const response = await prover.sendCommand('Undo.');
            updateProofState(response);
            proofManager.undoLastStep();
        }),

        vscode.commands.registerCommand('vspieuvre.restartProver', async () => {
            await prover.stop();
            prover = new PieuvreProver();
            const success = await prover.start();
            if (success) {
                vscode.window.showInformationMessage(
                    'Pieuvre prover restarted successfully',
                );
                // Optionally reset proof state
                proofManager.dispose();
                proofManager = new ProofManager(prover);
                updateProofState('🐙');
            } else {
                vscode.window.showErrorMessage(
                    'Failed to restart Pieuvre prover',
                );
            }
        }),
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('vspieuvre')) {
                vscode.window.showInformationMessage(
                    'Pieuvre configuration updated. Restart the prover to apply changes.',
                );
            }
        }),
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor?.document.languageId === 'pieuvre') {
                proofManager.setDocument(editor.document);
            }
        }),
    );
}

function createProofPanel(
    context: vscode.ExtensionContext,
): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'proofPanel',
        '🐙 Proof View',
        {
            viewColumn: vscode.ViewColumn.Two,
            preserveFocus: true,
        },
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [context.extensionUri],
        },
    );

    // Set up message handler FIRST
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'step-forward':
                    await vscode.commands.executeCommand(
                        'vspieuvre.stepForward',
                    );
                    break;
                case 'step-back':
                    await vscode.commands.executeCommand('vspieuvre.stepBack');
                    break;
                case 'restart-prover':
                    await vscode.commands.executeCommand(
                        'vspieuvre.restartProver',
                    );
                    break;
                case 'send-custom-command':
                    try {
                        const response = await prover.sendCommand(message.text);
                        updateProofState(response);
                    } catch (e: any) {
                        vscode.window.showErrorMessage(e.toString());
                    }
                    break;
            }
        },
        undefined,
        context.subscriptions,
    );

    // THEN set the HTML content
    panel.webview.html = webviewContent;

    // FINALLY store the reference
    proofPanel = panel;

    panel.onDidDispose(
        () => {
            proofPanel = undefined;
        },
        null,
        context.subscriptions,
    );

    return panel;
}

// In extension.ts activation
function updateProofState(response: string) {
    if (proofPanel) {
        const position = proofManager.getPositionStatus();
        const message = ansiHtml.convert(response);
        proofPanel.webview.postMessage({
            type: 'proof-update',
            content: message,
            position,
        });
        proofPanel.webview.postMessage({
            goals: message,
        });
    }
}

export function deactivate() {
    prover.stop();
    proofManager.dispose();
}
