
import * as vscode from 'vscode';
import { PieuvreProver } from './prover';
import { ProofManager } from './proof-manager';
import { AnsiToHtml, createThemeAwareAnsiConverter } from './ansi'

// Global references
let proofPanel: vscode.WebviewPanel | undefined;
let prover: PieuvreProver;
let proofManager: ProofManager;
let ansiHtml: AnsiToHtml = createThemeAwareAnsiConverter();

export function activate(context: vscode.ExtensionContext) {
		prover = new PieuvreProver();

		prover.start().then(success => {
        if (success) {
            vscode.window.showInformationMessage('Pieuvre prover started successfully');
        }
    });

    
		proofManager = new ProofManager();
    
    // Track active document
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor?.document.languageId === 'pieuvre') {
            proofManager.setDocument(editor.document);
        }
    });
	
    // Register panel command
    context.subscriptions.push(
        vscode.commands.registerCommand('vspieuvre.showProofPanel', () => {
            if (proofPanel) {
                proofPanel.reveal(vscode.ViewColumn.Two);
                return;
            }

            proofPanel = createProofPanel(context);
        })
    );

    // Register step commands
    context.subscriptions.push(
        vscode.commands.registerCommand('vspieuvre.stepForward', async () => {
						const sentence = proofManager.getNextSentence();
            if (sentence) {
                const response = await prover.sendCommand(sentence.text);
                updateProofState(response);
              
                // Highlight in editor
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.selection = new vscode.Selection(
                        sentence.range.end, 
                        sentence.range.end
                    );
                    editor.revealRange(sentence.range);
                }
            } else {
                vscode.window.showInformationMessage('No more sentences to process!');
            }
        }),
        
        vscode.commands.registerCommand('vspieuvre.stepBack', async () => {
						proofManager.undoLastStep();
        		const response = await prover.sendCommand("undo.");
            updateProofState(response);
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('vspieuvre')) {
                vscode.window.showInformationMessage('Pieuvre configuration updated. Restart the prover to apply changes.');
            }
        })
    );


    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor?.document.languageId === 'pieuvre') {
                proofManager.setDocument(editor.document);
            }
        })
    );
}

function createProofPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        'proofPanel',
        '🐙 Proof View',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [context.extensionUri]
        }
    );

    // Set up message handler FIRST
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'step-forward':
                    await vscode.commands.executeCommand('vspieuvre.stepForward');
                    break;
                case 'step-back':
                    await vscode.commands.executeCommand('vspieuvre.stepBack');
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    // THEN set the HTML content
    panel.webview.html = getWebviewContent();

    // FINALLY store the reference
    proofPanel = panel;

    panel.onDidDispose(
        () => {
            proofPanel = undefined;
        },
        null,
        context.subscriptions
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
            position
        });
        proofPanel.webview.postMessage({
            goals: message
        });
    }
}

function getWebviewContent(): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="
            default-src 'none';
            script-src vscode-resource: 'unsafe-inline';
            style-src vscode-resource: 'unsafe-inline';
        ">
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 16px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .button-container {
                display: flex;
                gap: 8px;
                margin: 12px 0;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: 1px solid var(--vscode-button-border, transparent);
                padding: 6px 12px;
                border-radius: 2px;
                font-size: var(--vscode-font-size);
                cursor: pointer;
                transition: background-color 0.1s ease;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            button:active {
                background-color: var(--vscode-button-activeBackground);
            }
            button.secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            button.secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }
            .goal {
                background-color: var(--vscode-textBlockQuote-background);
                border-left: 3px solid var(--vscode-focusBorder);
                padding: 12px;
                margin: 16px 0;
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                white-space: pre-wrap;
            }
				    .status-indicator {
				        padding: 8px;
				        margin: 8px 0;
				        background: var(--vscode-statusBarItem-remoteBackground);
				        border-radius: 4px;
				        display: flex;
				        align-items: center;
				        gap: 8px;
				    }
				    .codicon {
				        font-family: 'codicon';
				    }        
				</style>
    </head>
    <body>
        <h2 style="margin-top: 0;">Proof State</h2>
        <div id="goals" class="goal">🐙</div>
        
        <div class="button-container">
            <button id="stepForward">▶ Step Forward</button>
            <button id="stepBack" class="secondary">◀ Step Back</button>
						<span id="positionIndicator">0/0 sentences processed</span>
				</div>

        <script>
            const vscode = acquireVsCodeApi();
            
            // Button handlers
            document.getElementById('stepForward').addEventListener('click', () => {
                vscode.postMessage({ command: 'step-forward' });
            });

            document.getElementById('stepBack').addEventListener('click', () => {
                vscode.postMessage({ command: 'step-back' });
            });

            // Handle updates from extension
            window.addEventListener('message', event => {
                const goalsElement = document.getElementById('goals');
                if (event.data.goals && goalsElement) {
                    goalsElement.innerHTML = event.data.goals;
                }
            });

				    function updatePosition(current, total) {
				        document.getElementById('positionIndicator').textContent = 
				            \`\${current}/\${total} sentences processed\`;
				    }
						window.addEventListener('message', event => {
						        if (event.data.position) {
						            updatePosition(
						                event.data.position.current,
						                event.data.position.total
						            );
						        }
						    });

            // Notify extension that webview is ready
            vscode.postMessage({ ready: true });
        </script>
			</body>
    </html>
    `;
}

export function deactivate() {
	prover.stop()
	proofManager.dispose()
}
