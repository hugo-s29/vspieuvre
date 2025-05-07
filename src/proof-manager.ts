// ProofManager.ts
import * as vscode from 'vscode';

export class ProofManager {
    private processedSentences: number[] = [];
    private sentences: {text: string, range: vscode.Range}[] = [];
    private document?: vscode.TextDocument;
    private decorationType: vscode.TextEditorDecorationType;
    private currentDecorationType: vscode.TextEditorDecorationType;
    private documentVersion: number = -1;
    private changeSubscription: vscode.Disposable;
    

    constructor() {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(100, 250, 100, 0.2)',
            borderRadius: '2px'
        });
        
        this.currentDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(100, 200, 255, 0.3)'
        });

        // Setup document change listener
        this.changeSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document === this.document) {
                this.handleDocumentChange(e.document);
            }
        });
      }

    public setDocument(doc: vscode.TextDocument): void {
        if (this.document?.uri.toString() === doc.uri.toString() && 
            this.documentVersion === doc.version) {
            return;
        }

        this.document = doc;
        this.documentVersion = doc.version;
        this.processedSentences = [];
        this.sentences = this.getSentences(doc.getText());
        this.updateDecorations();
    }

    public getNextSentence(): {text: string, range: vscode.Range} | null {
        if (!this.document) return null;

        let n = this.processedSentences.length;
        this.processedSentences.push(n);
        if (n >= this.sentences.length)
          return null;
        this.updateDecorations();
        return this.sentences[n];
    }

    public undoLastStep(): void {
        if (this.processedSentences.length > 0) {
            this.processedSentences.pop();
            this.updateDecorations();
        }
    }

    public getPositionStatus(): {current: number, total: number} {
        return {
            current: this.processedSentences.length,
            total: this.sentences.length
        };
    }

    private getSentences(text: string): {text: string, range: vscode.Range}[] {
        const sentenceRegex = /([^.\n]*(?:\n[^.\n]*)*\.)(?=\s|$)/g;
        const sentences: {text: string, range: vscode.Range}[] = [];
        let match;
        
        if (!this.document) return sentences;

        while ((match = sentenceRegex.exec(text)) !== null) {
            const startPos = this.document.positionAt(match.index);
            const endPos = this.document.positionAt(match.index + match[0].length);
            sentences.push({
                text: match[0],
                range: new vscode.Range(startPos, endPos)
            });
        }
        
        return sentences;
    }

    private updateDecorations(): void {
        if (!this.document) return;
        
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document === this.document
        );
        
        if (editor) {
            // Highlight all processed sentences
            const processedRanges = this.processedSentences
                .map(i => this.sentences[i]?.range)
                .filter(Boolean) as vscode.Range[];
            editor.setDecorations(this.decorationType, processedRanges);

            // Highlight current sentence
            const currentIndex = this.processedSentences.length > 0 
                ? this.processedSentences[this.processedSentences.length - 1]
                : null;
            const currentRange = currentIndex !== null 
                ? this.sentences[currentIndex]?.range 
                : null;
            
            editor.setDecorations(this.currentDecorationType, 
                currentRange ? [currentRange] : []
            );
        }
    }


    private handleDocumentChange(doc: vscode.TextDocument): void {
        if (!this.document || doc.uri.toString() !== this.document.uri.toString()) {
            return;
        }

        // Only update if document actually changed
        if (doc.version <= this.documentVersion) {
            return;
        }

        this.documentVersion = doc.version;
        const oldSentences = this.sentences;
        this.sentences = this.getSentences(doc.getText());

        // Re-map processed sentences to new positions
        const newProcessedSentences: number[] = [];
        const oldText = this.document.getText();
        const newText = doc.getText();

        for (const idx of this.processedSentences) {
            if (idx >= oldSentences.length) continue;
            
            const oldSentence = oldSentences[idx];
            const sentenceStart = oldSentence.range.start;
            const sentenceEnd = oldSentence.range.end;
            const offsetStart = this.document.offsetAt(sentenceStart);
            const offsetEnd = this.document.offsetAt(sentenceEnd);
            const sentenceText = oldText.slice(offsetStart, offsetEnd);

            // Find matching sentence in new document
            const newIdx = this.sentences.findIndex(s => 
                s.text === sentenceText &&
                newText.includes(sentenceText)
            );

            if (newIdx !== -1) {
                newProcessedSentences.push(newIdx);
            }
        }

        this.processedSentences = newProcessedSentences;
        this.document = doc;
        this.updateDecorations();
    }

    public dispose() {
        this.changeSubscription.dispose();
        this.decorationType.dispose();
        this.currentDecorationType.dispose();
    }
}
