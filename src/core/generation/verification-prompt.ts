// The prompt that asks the user's LLM for a second opinion on ONE case (FR-063). The tool never calls
// an LLM: the user copies this text, runs it and pastes the answer back.
import type { ReviewedCase } from '../evaluation/results';
import type { Evaluation } from '../model';

const fence = (text: string) => `"""\n${text}\n"""`;

export function verificationPrompt(evaluation: Evaluation, reviewed: ReviewedCase): string {
  const { testCase, effective, review } = reviewed;
  const { judge_set } = evaluation;
  const reply = evaluation.replies[testCase.id]?.reply ?? '';
  const judged = judge_set.judged_text;
  const parts: string[] = [];

  parts.push(
    'I am checking the result of an LLM judge for ONE test case. Judge each item on its own, using only the data of this case and the reply of the judge.',
    '',
    'This is what the judge was asked to do (its prompt, with {{variables}} that are filled with the fields of the case):',
    fence(judge_set.prompt),
    '',
    `CASE "${testCase.id}"${testCase.name ? `: ${testCase.name}` : ''}`,
    'Fields of the case:',
  );
  for (const [name, value] of Object.entries(testCase.fields)) {
    parts.push(`${name}${name === judged ? ' (the judged text)' : ''}:`, fence(String(value)));
  }

  parts.push('', 'EXPECTED ERRORS: errors that were written into the judged text on purpose. For each one, did the judge find it in its reply?');
  if (testCase.expected_errors.length === 0) parts.push('There are none: this is a clean case.');
  testCase.expected_errors.forEach((e, i) => {
    const meta = [e.category, e.difficulty].filter(Boolean).join(', ');
    parts.push(`E${i + 1}. ${e.description}${meta ? ` (${meta})` : ''}${e.fragment ? ` Fragment: "${e.fragment}"` : ''}`);
  });

  const additional = effective?.additional ?? [];
  parts.push('', 'ADDITIONAL FINDINGS: findings of the judge that match no expected error. For each one, is it a real error in the data (real: true) or a false positive (real: false)?');
  if (additional.length === 0) parts.push('There are no additional findings.');
  additional.forEach((a, i) => parts.push(`A${i + 1}. ${a.text === '' ? 'A finding about the whole reply' : `"${a.text}"`}${a.rules.length > 0 ? ` (rule: ${a.rules.join(', ')})` : ''}`));

  parts.push('', 'THE REPLY OF THE JUDGE:', fence(reply));
  if (review && !review.readable) parts.push('The reply could not be read automatically, so the list of additional findings above may be incomplete.');

  const categories = judge_set.error_catalog.map((c) => c.name);
  parts.push(
    '',
    'Answer only with JSON in this form. Name every item by its number (index counts from 1, in the order above). Give a short reason and the fragment of the data or of the reply that your answer rests on.',
    JSON.stringify(
      {
        opinion: {
          id: testCase.id,
          expected: [{ index: 1, found: true, reason: '…', fragment: '…' }],
          additional: [{ index: 1, real: false, reason: '…', fragment: '…' }],
          new: [{ text: '…', real: true, reason: '…', fragment: '…', category: '…', difficulty: 'obvious' }],
        },
      },
      null,
      2,
    ),
    '',
    '"found" is true when the judge found the expected error. "real" is true when the finding is a real error in the data and false when it is a false positive.',
    'Put in "new" every finding that the reply contains and that is not in the list above (for example when the reply is not JSON), each with its text, "real" true or false, a reason and, if you can, a category' +
      (categories.length > 0 ? ` (one of: ${categories.join(', ')}, or a new name)` : '') +
      ' and a difficulty ("obvious" or "subtle"). Leave "new" empty when there is none.',
  );
  return parts.join('\n');
}
