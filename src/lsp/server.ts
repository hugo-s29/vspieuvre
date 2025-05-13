import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItem,
    TextDocumentPositionParams,
    DefinitionParams,
    DidChangeTextDocumentParams,
    Diagnostic,
    Range,
    DiagnosticSeverity,
} from 'vscode-languageserver/node';

import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { LSPPieuvreProver } from './lsp-prover';
import { hash } from 'crypto';
import { keywordCompletionItems, keywords } from './keywords';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

type IVarTypeResult =
    | { kind: 'ok'; type: string }
    | { kind: 'mismatch'; type: string; expected: string }
    | { kind: 'error'; message: string }
    | { kind: 'unknown' };

interface ISentenceData {
    hash: string;
    sentence: string;
    result: Map<string, IVarTypeResult[]>;
    range: Range;
}

let lastProcessedVersion: number | null = null;
let lastData: ISentenceData[] = [];

connection.onInitialize((_) => {
    console.log('LSP Initialized');

    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
            },
            definitionProvider: true,
            hoverProvider: true,
        },
    };
});

let prover: LSPPieuvreProver | undefined;

connection.onNotification(
    'workspace/preferences',
    ({
        bin,
        flags,
        showLog,
    }: {
        bin: string;
        flags: string[];
        showLog: boolean;
    }) => {
        prover?.stop();
        prover = new LSPPieuvreProver(bin, flags, showLog);
        prover.start();
    },
);

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
        }

        return keywordCompletionItems;
    },
);

connection.onDefinition((params: DefinitionParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    return null;
});

//@ts-ignore
connection.onHover(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    try {
        await update(document);

        const text = document.getText();

        const posOffset = getOffsetFromPosition(text, params.position);
        const sentence = getSurroundingSentence(text, posOffset);
        const offset = posOffset - sentence.start;

        const word = getWordAtOffset(sentence.sentence, offset);
        if (!word) return null;

        const kw = keywords.get(word);
        if (kw) {
            return {
                contents: {
                    kind: 'markdown',
                    value: kw.documentation!,
                },
            };
        }

        const res = lastData[sentence.index].result.get(word);

        if (!res) return null;

        const type = getTypeOfWord(word, sentence.sentence, res, offset);
        if (!type) return null;

        return {
            contents: {
                kind: 'markdown',
                value:
                    type.kind === 'ok'
                        ? '```pieuvre\n' + type.type + '\n```'
                        : 'No idea',
            },
        };
    } catch {
        return null;
    }
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => item);

connection.onDidChangeTextDocument(
    async (params: DidChangeTextDocumentParams) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        try {
            await update(document);
        } catch (e) {
            console.error(e);
        }

        return null;
    },
);

connection.onExit(async () => {
    await prover?.stop();
});

async function update(document: TextDocument) {
    if (document.version === lastProcessedVersion) {
        console.log('update: version unchanged, skipping');
        return;
    }
    console.log('update: version changed');

    await prover?.untilStarted();

    if (!prover)
        throw 'The "workspace/preferences" notification should have happened before this.';

    const currentPartialData = getSentences(document).map((data) => ({
        ...data,
        hash: hash('sha256', data.sentence, 'base64'),
    }));

    let undoIndex = 0;

    for (
        let i = 0;
        i < Math.min(lastData.length, currentPartialData.length);
        i++
    ) {
        if (lastData[i].hash !== currentPartialData[i].hash) {
            break;
        }
        undoIndex++;
    }

    while (lastData.length > undoIndex) {
        await prover.sendCommand('[UNDO]', lastData.pop()!.sentence);
    }

    const newData = currentPartialData.slice(undoIndex);

    const diagnostics: Diagnostic[] = [];

    for (const data of newData) {
        try {
            const result = await getTypeofSentence(data.sentence);
            lastData.push({ ...data, result });

            const words = [...data.sentence.matchAll(/\b\w+\b/g)];

            for (const [x, l] of result.entries()) {
                const xs = words.filter((y) => y[0] == x);

                for (let i = 0; i < l.length; i++) {
                    if (l[i].kind == 'unknown') {
                        const start =
                            xs[i].index + document.offsetAt(data.range.start);
                        const end = start + x.length;
                        const range = Range.create(
                            document.positionAt(start),
                            document.positionAt(end),
                        );

                        diagnostics.push({
                            message: `Unknown variable ${x}`,
                            range,
                            severity: DiagnosticSeverity.Error,
                        });
                    }
                }
            }
        } catch (e: any) {
            diagnostics.push({
                message: e.toString(),
                range: data.range,
                severity: DiagnosticSeverity.Error,
            });
        }
    }

    console.log(diagnostics);
    connection.sendDiagnostics({ uri: document.uri, diagnostics });

    lastProcessedVersion = document.version;
}

function getTransformed(text: string): string {
    return (
        text
            .replaceAll(
                /((Lemma|Proposition|Theorem|Goal).*?\.)(.|\n)*?(Qed|Admitted|Save .*?|Abort)\./g,
                '$1',
            )
            // Remove proof's content (as they depend heavily on the tactic system, the goal and everything)
            // that's a lot of work to try to "predict" the results without actually computing any expensive things
            .replaceAll(/Goal ((.|\n)*?)\./g, 'Axiom _ : $1.')
            .replaceAll(/(Lemma|Proposition|Theorem)/g, 'Axiom')
    );
}

function splitSentencesWithOffsets(
    text: string,
): { sentence: string; start: number; end: number }[] {
    const match =
        /(\s*(Lemma|Proposition|Theorem|Goal).*?\.(?:.|\n)*?(Qed\.|Admitted\.|Save .*?\.|Abort\.|\Z)\s*)|(\s*(.|\n)*?\.\s*)/g;

    const matches = [...text.matchAll(match)];

    let current = 0;
    return matches.map((m) => {
        const sentence = m[0];
        const start = current;
        current += sentence.length;
        const end = current;
        return { start, end, sentence };
    });
}

function getOffsetFromPosition(text: string, position: Position): number {
    const lines = text.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
        offset += lines[i].length + 1; // '\n'
    }
    return offset + position.character;
}

function getSurroundingSentence(text: string, offset: number) {
    const sentences = splitSentencesWithOffsets(text);

    for (let i = 0; i < sentences.length; i++) {
        const { start, end } = sentences[i];
        if (offset >= start && offset < end) {
            return { index: i, ...sentences[i] };
        }
    }

    throw 'You should have called updated first !';
}

function getWordAtOffset(text: string, offset: number): string | undefined {
    return [...text.matchAll(/\b\w+\b/g)].find(
        (m) => offset >= m.index! && offset <= m.index! + m[0].length,
    )?.[0];
}

function getTypeOfWord(
    word: string,
    sentence: string,
    result: IVarTypeResult[],
    offset: number,
) {
    const n = [...sentence.matchAll(/\b\w+\b/g)]
        .filter((m) => m[0] == word)
        .findIndex(
            (m) => offset >= m.index! && offset <= m.index! + m[0].length,
        );
    return result[n];
}

function getSentences(document: TextDocument) {
    return splitSentencesWithOffsets(document.getText()).map(
        ({ sentence, start, end }) => ({
            sentence,
            range: Range.create(
                document.positionAt(start),
                document.positionAt(end),
            ),
        }),
    );
}

async function getTypeofSentence(
    sentence: string,
): Promise<Map<string, IVarTypeResult[]>> {
    if (!prover)
        throw 'The "workspace/preferences" notification should have happened before this.';

    const res = await prover.sendCommand('[TYPES]', getTransformed(sentence));

    const groups: string[][] = [];
    let currentGroup: string[] = [];

    res.split('\n').forEach((line) => {
        if (line.startsWith('#')) {
            currentGroup.push(line);
            groups.push(currentGroup);
            currentGroup = [];
        } else {
            currentGroup.push(line);
        }
    });

    if (currentGroup.length > 0) groups.push(currentGroup);

    const map = new Map<string, IVarTypeResult[]>();

    for (const group of groups) {
        const last = group.pop()!;
        if (last.startsWith('#ok')) {
            const [v, rest] = group.shift()!.split(';');
            const vari = v.trim();
            const type = [rest, ...group].join('\n').trim();
            const res: IVarTypeResult = { kind: 'ok', type };
            const l = map.get(vari);
            if (!l) map.set(vari, [res]);
            else l.push(res);
        } else if (last.startsWith('#unknown')) {
            const [v, _] = group.shift()!.split(';');
            const vari = v.trim();
            const res: IVarTypeResult = { kind: 'unknown' };
            const l = map.get(vari);
            if (!l) map.set(vari, [res]);
            else l.push(res);
        }
    }

    return map;
}

documents.listen(connection);
connection.listen();
