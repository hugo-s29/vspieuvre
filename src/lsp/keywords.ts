import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

export const keywordCompletionItems: CompletionItem[] = [
    // Keyword Control
    {
        label: 'Theorem',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a theorem',
    },
    {
        label: 'Proposition',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a proposition',
    },
    {
        label: 'Lemma',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a lemma',
    },
    {
        label: 'Proof',
        kind: CompletionItemKind.Operator,
        documentation: 'Starts a proof',
    },
    {
        label: 'Qed',
        kind: CompletionItemKind.Operator,
        documentation: 'Ends a proof',
    },
    {
        label: 'Definition',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a definition',
    },
    {
        label: 'Fixpoint',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a fixpoint',
    },
    {
        label: 'Variable',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a variable',
    },
    {
        label: 'Axiom',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines an axiom',
    },
    {
        label: 'Parameter',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a parameter',
    },
    {
        label: 'Hypothesis',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a hypothesis',
    },
    {
        label: 'Goal',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines a goal',
    },
    {
        label: 'Example',
        kind: CompletionItemKind.Operator,
        documentation: 'Defines an example',
    },
    {
        label: 'Print',
        kind: CompletionItemKind.Operator,
        documentation: 'Prints a statement',
    },
    {
        label: 'Check',
        kind: CompletionItemKind.Operator,
        documentation: 'Checks a statement',
    },
    {
        label: 'Undo',
        kind: CompletionItemKind.Operator,
        documentation: 'Undoes a statement',
    },

    // Keyword Operator
    {
        label: 'fun',
        kind: CompletionItemKind.Keyword,
        documentation: 'Defines a function',
    },
    {
        label: 'match',
        kind: CompletionItemKind.Keyword,
        documentation: 'Matches a pattern',
    },
    {
        label: 'with',
        kind: CompletionItemKind.Keyword,
        documentation: 'Used with match',
    },
    {
        label: 'end',
        kind: CompletionItemKind.Keyword,
        documentation: 'Ends a block',
    },
    {
        label: 'in',
        kind: CompletionItemKind.Keyword,
        documentation: 'Used in expressions',
    },
    {
        label: 'let',
        kind: CompletionItemKind.Keyword,
        documentation: 'Defines a local variable',
    },
    {
        label: 'if',
        kind: CompletionItemKind.Keyword,
        documentation: 'Conditional statement',
    },
    {
        label: 'then',
        kind: CompletionItemKind.Keyword,
        documentation: 'Used with if',
    },
    {
        label: 'else',
        kind: CompletionItemKind.Keyword,
        documentation: 'Used with if',
    },
    {
        label: 'fix',
        kind: CompletionItemKind.Keyword,
        documentation: 'Fixes a value',
    },
    {
        label: 'as',
        kind: CompletionItemKind.Keyword,
        documentation: 'Alias for a value',
    },
    {
        label: 'return',
        kind: CompletionItemKind.Keyword,
        documentation: 'Returns a value',
    },

    // Keyword Type
    {
        label: 'Type',
        kind: CompletionItemKind.Keyword,
        documentation: 'Type of types',
    },
    {
        label: 'Set',
        kind: CompletionItemKind.Keyword,
        documentation: 'Type of sets',
    },
    {
        label: 'Prop',
        kind: CompletionItemKind.Keyword,
        documentation: 'Type of propositions',
    },
    {
        label: 'forall',
        kind: CompletionItemKind.Keyword,
        documentation: 'Check if a property is true for all values',
    },
    {
        label: 'exists',
        kind: CompletionItemKind.Keyword,
        documentation: 'Check if a property is true for some value',
    },
    {
        label: '\\~',
        kind: CompletionItemKind.Keyword,
        documentation: 'Negation of a property',
    },

    // Storage Type
    {
        label: 'Inductive',
        kind: CompletionItemKind.Constructor,
        documentation: 'Defines an inductive type',
    },

    // Support Function
    {
        label: 'apply',
        kind: CompletionItemKind.Function,
        documentation: 'Applies a tactic',
    },
    {
        label: 'auto',
        kind: CompletionItemKind.Function,
        documentation: 'Automatically applies tactics',
    },
    {
        label: 'rewrite',
        kind: CompletionItemKind.Function,
        documentation: 'Rewrites a term',
    },
    {
        label: 'simpl',
        kind: CompletionItemKind.Function,
        documentation: 'Simplifies a term',
    },
    {
        label: 'reflexivity',
        kind: CompletionItemKind.Function,
        documentation: 'Proves reflexivity',
    },
    {
        label: 'intro',
        kind: CompletionItemKind.Function,
        documentation: 'Introduces a variable',
    },
    {
        label: 'intros',
        kind: CompletionItemKind.Function,
        documentation: 'Introduces multiple variables',
    },
    {
        label: 'destruct',
        kind: CompletionItemKind.Function,
        documentation: 'Destructs a term',
    },
    {
        label: 'induction',
        kind: CompletionItemKind.Function,
        documentation: 'Applies induction',
    },
    {
        label: 'case',
        kind: CompletionItemKind.Function,
        documentation: 'Case analysis',
    },
    {
        label: 'exact',
        kind: CompletionItemKind.Function,
        documentation: 'Exact match',
    },
    {
        label: 'elim',
        kind: CompletionItemKind.Function,
        documentation: 'Eliminates a term',
    },
    {
        label: 'inversion',
        kind: CompletionItemKind.Function,
        documentation: 'Inverts a term',
    },
    {
        label: 'compute',
        kind: CompletionItemKind.Function,
        documentation: 'Computes a term',
    },
    {
        label: 'assumption',
        kind: CompletionItemKind.Function,
        documentation: 'Assumption tactic',
    },
    {
        label: 'cut',
        kind: CompletionItemKind.Function,
        documentation: 'Cut tactic',
    },
    {
        label: 'try',
        kind: CompletionItemKind.Function,
        documentation: 'Try tactic',
    },
    {
        label: 'fail',
        kind: CompletionItemKind.Function,
        documentation: 'Fail tactic',
    },
    {
        label: 'assert',
        kind: CompletionItemKind.Function,
        documentation: 'Assert tactic',
    },
    {
        label: 'idtac',
        kind: CompletionItemKind.Function,
        documentation: 'Identity tactic',
    },
    {
        label: 'unfold',
        kind: CompletionItemKind.Function,
        documentation: 'Unfolds a term',
    },
];

export const keywords = new Map<string, CompletionItem>(
    keywordCompletionItems.map((obj) => [obj.label, obj]),
);
