// The prompt that asks the user's LLM for ONE case with injected errors (FR-040, FR-043).
// The tool never calls an LLM: the user copies this text, runs it and pastes the answer back.
import { findVariables } from '../judge/variables';
import type { JudgeSet, TestCase } from '../model';

export type PreparedDifficulty = 'obvious' | 'subtle' | 'llm';

/** One row of the list of errors to prepare. */
export interface ErrorToPrepare {
  category: string;
  difficulty: PreparedDifficulty;
  /** What should be wrong; may be empty. */
  description: string;
}

export interface InjectErrorsInput {
  judgeSet: JudgeSet;
  /** The clean case the errors go into; without one the LLM writes the whole case. */
  base?: Pick<TestCase, 'fields' | 'name'> | undefined;
  errors: readonly ErrorToPrepare[];
  /** The user's own instructions; they come first. */
  instructions: string;
}

const count = (n: number) => `${n} expected ${n === 1 ? 'error' : 'errors'}`;

export function injectErrorsPrompt({ judgeSet, base, errors, instructions }: InjectErrorsInput): string {
  const variables = findVariables(judgeSet.prompt);
  const judged = judgeSet.judged_text ?? variables[variables.length - 1];
  const parts: string[] = [];

  if (instructions.trim() !== '') parts.push(instructions.trim(), '');

  parts.push(
    `I am testing an LLM judge. Write ONE test case for it that contains ${count(errors.length)} that I choose below.`,
    '',
    'This is the prompt of the judge. Every {{variable}} in it is filled with one field of the test case:',
    '"""',
    judgeSet.prompt,
    '"""',
  );
  if (judged) parts.push('', `The judged text is "${judged}": it is the text the judge evaluates. The errors go into the judged text.`);

  if (base) {
    parts.push('', 'This is the base case. Keep it as it is, except for the places the errors need:', JSON.stringify(base.fields, null, 2));
  } else {
    parts.push('', 'There is no base case: write the whole case, a value for every variable, with the errors in its judged text.');
  }

  parts.push(
    '',
    'The two difficulty levels:',
    '- obvious: a reader who compares the text with the other fields notices the error at once.',
    '- subtle: the error is small and needs a careful comparison, for example one changed number or one changed name.',
    'Keep the difficulty given for each error. Where it says to choose, pick obvious or subtle yourself and write it in the answer.',
  );

  parts.push('', 'The errors to put in:');
  errors.forEach((row, i) => {
    const entry = judgeSet.error_catalog.find((c) => c.name === row.category);
    parts.push(`Error ${i + 1}`);
    if (entry) {
      parts.push(`- Category: ${entry.name}${entry.description ? `: ${entry.description}` : ''}`);
      if (entry.example) parts.push(`- For example: ${entry.example}`);
    } else {
      parts.push(`- Category: ${row.category === '' ? '(none given)' : row.category} (a new category: describe in the description what it means)`);
    }
    parts.push(`- Difficulty: ${row.difficulty === 'llm' ? 'choose the difficulty yourself (obvious or subtle)' : row.difficulty}`);
    if (row.description.trim() !== '') parts.push(`- What should be wrong: ${row.description.trim()}`);
  });

  parts.push(
    '',
    'Rules:',
    '- The errors must be realistic: the kind of mistake a writer or a model really makes. Change only what an error needs and leave the rest of the text as it is.',
    '- Do not say in the text that anything was changed.',
    '- Give the fragment of each error exactly as it appears in the case, word for word, as short as possible while it still contains the error.',
    '- For an omission (something that is left out) the judged text has nothing to quote: give the fragment of another field that the judged text no longer covers.',
    '- Describe in "description" what was changed and why it is an error.',
  );

  const fieldsExample = Object.fromEntries(variables.map((v) => [v, '…text…']));
  const errorsExample = errors.map((row) => ({ category: row.category, fragment: '…exact fragment…', description: '…what is wrong…', difficulty: row.difficulty === 'llm' ? 'obvious or subtle' : row.difficulty }));
  parts.push(
    '',
    'Answer only with JSON in this form, with a non-empty text for every field and one expected error for each error above:',
    JSON.stringify({ name: 'a short name for the case', fields: fieldsExample, expected_errors: errorsExample }, null, 2),
  );
  return parts.join('\n');
}
