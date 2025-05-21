import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    DefinitionParams,
    DidChangeTextDocumentParams,
    Range,
    Diagnostic,
    Position,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { keywordCompletionItems, keywords } from './keywords';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

interface IDefinitionItem {
    completion: CompletionItem;
    lineNum: number;
    kind: string;
}

let definitions: Map<string, IDefinitionItem[]> = new Map();
let lastProcessedVersion: number | null = null;

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

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (document) {
            debouncedUpdateAndRevalidate(document);
        }

        const completionItems = [...keywordCompletionItems];

        // Add user-defined terms to completion items
        definitions.forEach((l) => {
            let lAfter = l.filter(
                ({ lineNum }) => lineNum <= textDocumentPosition.position.line,
            );
            if (lAfter && lAfter.length > 0) {
                completionItems.push(lAfter[lAfter.length - 1].completion);
            }
        });

        return completionItems;
    },
);

connection.onDefinition((params: DefinitionParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    debouncedUpdateAndRevalidate(document);

    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');

    const wordPattern = /\b\w+\b/g;
    const line = lines[position.line];
    const match = [...line.matchAll(wordPattern)].find(
        (m) =>
            position.character >= m.index! &&
            position.character <= m.index! + m[0].length,
    );

    if (match) {
        const word = match[0];

        const allDefinitions = definitions
            .get(word)
            ?.filter(({ lineNum }) => lineNum <= position.line);

        if (allDefinitions && allDefinitions.length > 0) {
            const definition = allDefinitions[allDefinitions.length - 1];

            return {
                uri: params.textDocument.uri,
                range: {
                    start: { line: definition.lineNum, character: 0 },
                    end: { line: definition.lineNum, character: 0 },
                },
            };
        }
    }

    return null;
});

connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    updateDefinitions(document);

    const position = params.position;
    const text = document.getText();
    const lines = text.split('\n');

    const wordPattern = /\b\w+\b/g;
    const line = lines[position.line];
    const match = [...line.matchAll(wordPattern)].find(
        (m) =>
            position.character >= m.index! &&
            position.character <= m.index! + m[0].length,
    );

    if (match && match.length > 0) {
        const word = match[0];

        // Some special logic to support shadowing
        const allDefinitions = definitions
            .get(word)
            ?.filter(({ lineNum }) => lineNum <= position.line);

        if (allDefinitions && allDefinitions.length > 0) {
            const definition = allDefinitions[allDefinitions.length - 1];
            return {
                contents: {
                    kind: 'markdown',
                    value: `**${word}**\n\nDefined on line ${definition.lineNum + 1} as a ${definition.kind}.`,
                },
            };
        }
    }

    return null;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => item);

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout); // Clear the previous timeout
        }
        timeout = setTimeout(() => {
            fn(...args);
            timeout = null; // Reset the timeout
        }, delay);
    };
}

const debouncedUpdateAndRevalidate = debounce(updateAndRevalidate, 300);

function updateAndRevalidate(document: TextDocument) {
    if (document.version === lastProcessedVersion) return;

    updateDefinitions(document);
    //validateVariableUsage(document);

    lastProcessedVersion = document.version;
}

connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    debouncedUpdateAndRevalidate(document);

    return null;
});

function updateDefinitions(document: TextDocument) {
    definitions.clear();
    const text = document.getText();
    const lines = text.split('\n');
    const definitionPattern =
        /^\s*(Definition|Lemma|Proposition|Fixpoint|Inductive|\|)\s+(\w+).+?:.*$/;

    lines.forEach((line, lineNum) => {
        const match = line.match(definitionPattern);

        if (match) {
            const kind = match[1] == '|' ? 'Inductive Constructor' : match[1];
            const name = match[2];
            const completion: CompletionItem = {
                label: name,
                kind: CompletionItemKind.Variable,
                documentation: `Definition of ${name} as "${kind}"`,
            };

            const allDefinitions = definitions.get(name);
            if (allDefinitions) {
                allDefinitions.push({ completion, lineNum, kind });
            } else {
                definitions.set(name, [{ completion, lineNum, kind }]);
            }
        }
    });
}

documents.listen(connection);
connection.listen();
