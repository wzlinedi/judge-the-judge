// The prompt that asks the user's LLM for one clean case (FR-083). The tool never calls an LLM:
// the user copies this text, runs it and pastes the answer back.
import { findVariables } from '../judge/variables';
import type { JudgeSet, TestCase } from '../model';

export function cleanCasePrompt(judgeSet: JudgeSet, comment: string, likeCase?: Pick<TestCase, 'fields' | 'name'>): string {
  const variables = findVariables(judgeSet.prompt);
  const judged = judgeSet.judged_text ?? variables[variables.length - 1];
  const parts: string[] = [];

  parts.push(
    'I am testing an LLM judge. Write ONE clean test case for it: a case that contains no errors at all.',
    '',
    'This is the prompt of the judge. Every {{variable}} in it is filled with one field of the test case:',
    '"""',
    judgeSet.prompt,
    '"""',
  );
  if (judged) parts.push('', `The judged text is "${judged}": it is the text the judge evaluates. It must be correct and consistent with the other fields.`);

  if (judgeSet.error_catalog.length > 0) {
    parts.push('', 'The case must contain none of these errors:');
    for (const c of judgeSet.error_catalog) {
      parts.push(`- ${c.name}${c.description ? `: ${c.description}` : ''}`);
    }
  }

  if (comment.trim() !== '') parts.push('', 'Comment about what the case should be about:', comment);

  if (likeCase) {
    parts.push('', 'Use this existing case as a model for the kind and length of the text:', JSON.stringify(likeCase.fields, null, 2));
  }

  const fieldsExample = Object.fromEntries(variables.map((v) => [v, '…text…']));
  parts.push(
    '',
    'Answer only with JSON in this form, with a non-empty text for every field:',
    JSON.stringify({ name: 'a short name for the case', fields: fieldsExample, expected_errors: [] }, null, 2).replace('"expected_errors": []', '"expected_errors": []'),
  );
  return parts.join('\n');
}
