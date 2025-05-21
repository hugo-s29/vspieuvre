import * as vscode from 'vscode';
import { PieuvreProver } from './prover';

export class ProofManager {
    public processedSentences: number[] = [];
    private sentences: { text: string; range: vscode.Range }[] = [];
    private document?: vscode.TextDocument;
    private decorationType: vscode.TextEditorDecorationType;
    private currentDecorationType: vscode.TextEditorDecorationType;
    private errorDecorationType: vscode.TextEditorDecorationType;
    private documentVersion: number = -1;
    private changeSubscription: vscode.Disposable;

    constructor(protected prover: PieuvreProver) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(100, 250, 100, 0.2)',
            borderRadius: '2px',
        });

        this.currentDecorationType =
            vscode.window.createTextEditorDecorationType({
                backgroundColor: 'rgba(100, 200, 255, 0.3)',
            });

        this.errorDecorationType = vscode.window.createTextEditorDecorationType(
            {
                backgroundColor: 'rgba(255, 0, 0, 0.3)',
            },
        );

        // Setup document change listener
        this.changeSubscription = vscode.workspace.onDidChangeTextDocument(
            (e) => {
                if (e.document === this.document) {
                    this.handleDocumentChange(e.document);
                }
            },
        );
    }

    public setDocument(doc: vscode.TextDocument): void {
        if (
            this.document?.uri.toString() === doc.uri.toString() &&
            this.documentVersion === doc.version
        ) {
            return;
        }

        this.document = doc;
        this.documentVersion = doc.version;
        this.processedSentences = [];
        this.sentences = this.getSentences(doc.getText());
        this.updateDecorations();
    }
    public getNextSentence(
        redecorate: boolean = true,
    ): { text: string; range: vscode.Range } | null {
        if (!this.document) return null;

        let n = this.processedSentences.length;
        this.processedSentences.push(n);
        if (n >= this.sentences.length) return null;
        if (redecorate) this.updateDecorations();
        return this.sentences[n];
    }

    public undoLastStep(redecorate: boolean = true): string | null {
        let undone = this.processedSentences.pop();

        if (undone !== undefined) {
            if (redecorate) this.updateDecorations();
            return this.sentences[undone].text;
        }

        return null;
    }

    public getPositionStatus(): { current: number; total: number } {
        return {
            current: this.processedSentences.length,
            total: this.sentences.length,
        };
    }

    private getRealDotBlockRanges(input: string): [number, number][] {
        const ranges: [number, number][] = [];
        let start = 0;

        while (start < input.length) {
            let depth = 0;

            while (start < input.length && input[start].trim() === '') start++;
            start--;
            let i = start;

            while (i < input.length) {
                const c = input[i];
                const next = input[i + 1];

                if (c.trim() === '') {
                    i++;
                } else if (c === '(' && next === '*') {
                    depth++;
                    i += 2;
                } else if (c === '*' && next === ')' && depth > 0) {
                    depth--;
                    i += 2;
                } else if (c === '.' && depth === 0) {
                    // Found a real dot
                    ranges.push([start, i + 1]); // Include the dot
                    start = i + 1;
                    break;
                } else {
                    i++;
                }
            }

            // If we reached the end without finding a real dot, stop
            if (i >= input.length) break;
        }

        return ranges;
    }

    private getSentences(
        text: string,
    ): { text: string; range: vscode.Range }[] {
        if (!this.document) return [];
        return this.getRealDotBlockRanges(text).map(([start, end]) => ({
            text: text.substring(start, end + 1),
            range: new vscode.Range(
                this.document!.positionAt(start),
                this.document!.positionAt(end),
            ),
        }));
    }

    private handleDocumentChange(doc: vscode.TextDocument): void {
        if (
            !this.document ||
            doc.uri.toString() !== this.document.uri.toString()
        ) {
            return;
        }

        // Only update if document actually changed
        if (doc.version <= this.documentVersion) {
            return;
        }

        this.documentVersion = doc.version;
        const oldSentences = this.sentences;
        this.sentences = this.getSentences(doc.getText());

        // Find the longest common prefix of processed sentences
        let commonPrefix = 0;
        for (
            ;
            commonPrefix < this.processedSentences.length &&
            commonPrefix < this.sentences.length;
            commonPrefix++
        ) {
            const oldIdx = this.processedSentences[commonPrefix];
            if (
                oldIdx >= oldSentences.length ||
                this.sentences[commonPrefix].text !== oldSentences[oldIdx].text
            ) {
                break;
            }
        }

        const toUndo = this.processedSentences.length - commonPrefix;

        for (let i = 0; i < toUndo; i++) {
            this.undoLastStep();
            this.prover.sendCommand('Undo.');
        }

        // Update processedSentences to match the new document
        this.processedSentences = [];
        for (let i = 0; i < commonPrefix; i++) {
            this.processedSentences.push(i);
        }

        this.document = doc;
        this.updateDecorations();
    }

    public updateDecorations(error: boolean = false): void {
        if (!this.document) return;

        const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document === this.document,
        );

        if (editor) {
            // Highlight all processed sentences
            const processedRanges = this.processedSentences
                .map((i) => this.sentences[i]?.range)
                .filter(Boolean) as vscode.Range[];

            if (error) processedRanges.pop();

            editor.setDecorations(this.decorationType, processedRanges);

            // Highlight current sentence
            const currentIndex =
                this.processedSentences.length > 0
                    ? this.processedSentences[
                          this.processedSentences.length - 1
                      ]
                    : null;

            const currentRange =
                currentIndex !== null
                    ? this.sentences[currentIndex]?.range
                    : null;

            editor.setDecorations(
                error ? this.errorDecorationType : this.currentDecorationType,
                currentRange ? [currentRange] : [],
            );
            editor.setDecorations(
                error ? this.currentDecorationType : this.errorDecorationType,
                [],
            );
        }
    }

    public dispose() {
        this.changeSubscription.dispose();
        this.decorationType.dispose();
        this.currentDecorationType.dispose();
        this.errorDecorationType.dispose();
    }
}
