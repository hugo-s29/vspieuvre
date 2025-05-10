import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItem,
    TextDocumentPositionParams,
    DefinitionParams,
    DidChangeTextDocumentParams,
} from 'vscode-languageserver/node';

import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { LSPPieuvreProver } from './lsp-prover';
import { hash } from 'crypto';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

type IVarTypeResult =
    | { kind: 'ok'; type: string }
    | { kind: 'mismatch'; type: string; expected: string }
    | { kind: 'error'; message: string }
    | { kind: 'unknown' };

let lastProcessedVersion: number | null = null;
let lastData: {
    hash: string;
    sentence: string;
    result: Map<string, IVarTypeResult[]>;
}[] = [];

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
    ({ bin, flags }: { bin: string; flags: string[] }) => {
        prover?.stop();
        prover = new LSPPieuvreProver(bin, flags);
        prover.start();
    },
);

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            update(document);
        }
        return [];
    },
);

connection.onDefinition((params: DefinitionParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    update(document);

    return null;
});

connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    update(document);
    const sentence = getSurroundingSentence(document, params.position);
    const offset =
        getOffsetFromPosition(document.getText(), params.position) -
        sentence.start;

    const word = getWordAtOffset(sentence.sentence, offset);
    if (!word) return null;

    const res = lastData[sentence.index].result.get(word);

    if (!res) return null;

    const type = getTypeOfWord(word, sentence.sentence, res, offset);
    if (!type) return null;

    return {
        contents: {
            kind: 'plaintext',
            value: type.kind === 'ok' ? type.type : 'No idea',
        },
    };
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => item);

connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    update(document);

    return null;
});

async function update(document: TextDocument) {
    if (document.version === lastProcessedVersion) return;

    await prover?.untilStarted();

    if (!prover)
        throw 'The "workspace/preferences" notification should have happened before this.';

    const currentPartialData = getSentences(document).map((sentence) => ({
        hash: hash('sha256', sentence, 'base64'),
        sentence,
    }));

    let toUndo = lastData.length;

    const newData = [...currentPartialData];

    for (let i = 0; i < currentPartialData.length; i++) {
        if (lastData[i]?.hash === currentPartialData[i].hash) {
            newData.pop()!;
            toUndo--;
        }
    }

    for (let i = 0; i < toUndo; i++) {
        await prover.sendCommand('[UNDO]', lastData.pop()!.sentence);
    }

    for (const data of newData) {
        const result = await getTypeofSentence(data.sentence);
        lastData.push({ ...data, result });
    }

    lastProcessedVersion = document.version;
}

function getTransformed(text: string): string {
    return (
        text
            .replaceAll(
                /((Lemma|Proposition|Theorem|Goal).*?\.)(.|\n)*?(Qed|Admitted|Save .*?|Abort)\./gm,
                '$1',
            )
            // Remove proof's content (as they depend heavily on the tactic system, the goal and everything)
            // that's a lot of work to try to "predict" the results without actually computing any expensive things
            .replaceAll(/Goal ((.|\n)*?)\./gm, 'Axiom _ : $1.')
            .replaceAll(/(Lemma|Proposition|Theorem)/gm, 'Axiom')
    );
}

function splitSentencesWithOffsets(
    text: string,
): { sentence: string; start: number; end: number }[] {
    const results = [];
    let current = 0;

    const matchProof =
        /((Lemma|Proposition|Theorem|Goal).*?\.(?:.|\n)*?(Qed\.|Admitted\.|Save .*?\.|Abort\.|\Z))/gm;
    const matchSentence = /(.|\n)*?/gm;

    function matchTwo(text: string): RegExpExecArray | null {
        const proof = matchProof.exec(text);
        if (proof !== null) return proof;
        return matchSentence.exec(text);
    }

    let match;
    while ((match = matchTwo(text.substring(current)))) {
        const sentence = match[0];
        const start = match.index;
        const end = start + sentence.length;
        results.push({ sentence, start, end });
        current = end;
    }

    return results;
}

function getOffsetFromPosition(text: string, position: Position): number {
    const lines = text.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
        offset += lines[i].length + 1; // '\n'
    }
    return offset + position.character;
}

function getSurroundingSentence(document: TextDocument, position: Position) {
    const text = document.getText();
    const offset = getOffsetFromPosition(text, position);
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

function getSentences(document: TextDocument): string[] {
    const sentences = getTransformed(document.getText())
        .split('.')
        .map((x) => x + '.');

    sentences.pop();

    return sentences;
}

async function getTypeofSentence(
    sentence: string,
): Promise<Map<string, IVarTypeResult[]>> {
    if (!prover)
        throw 'The "workspace/preferences" notification should have happened before this.';

    const res = await prover.sendCommand('[TYPES]', sentence);

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
            const [vari, rest] = group.shift()!.split(';');
            const type = [rest, ...group].join('\n');
            const res: IVarTypeResult = { kind: 'ok', type };
            const l = map.get(vari);
            if (!l) map.set(vari, [res]);
            else l.push(res);
        }
    }

    return map;
}

connection.onExit(() => prover?.stop());

documents.listen(connection);
connection.listen();
