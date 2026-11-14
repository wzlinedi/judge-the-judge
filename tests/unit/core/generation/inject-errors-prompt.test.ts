// FR-040, FR-043: the prompt that asks the user's LLM for one case with injected errors.
import { describe, expect, it } from 'vitest';
import { injectErrorsPrompt, type ErrorToPrepare } from '../../../../src/core/generation/inject-errors-prompt';
import { accuracyJudgeSet, sampleEvaluation } from '../../../helpers/fixtures';

const set = accuracyJudgeSet();
const base = sampleEvaluation().dataset.cases[0]!;
const rows: ErrorToPrepare[] = [
  { category: 'factual-error', difficulty: 'obvious', description: 'Change the profession.' },
  { category: 'wrong-number', difficulty: 'llm', description: '' },
];
const build = (over: Partial<Parameters<typeof injectErrorsPrompt>[0]> = {}) => injectErrorsPrompt({ judgeSet: set, base, errors: rows, ...over });

describe('injectErrorsPrompt', () => {
  it('asks for ONE case in the case JSON layout with one expected error per row', () => {
    const text = build();
    expect(text).toMatch(/ONE test case/);
    expect(text).toContain('"expected_errors"');
    expect(text).toContain('"fragment"');
    expect(text).toContain('"description"');
    expect(text).toContain('"name"');
    expect(text).toMatch(/2 expected errors/);
  });

  it('contains the judge prompt, the judged text, and every field of the base', () => {
    const text = build();
    expect(text).toContain(set.prompt);
    expect(text).toMatch(/judged text.*summary/is);
    for (const value of Object.values(base.fields)) expect(text).toContain(value);
    expect(text).toMatch(/errors go into the judged text/i);
  });

  it('without a base it asks for the whole case, a value for every variable', () => {
    const text = build({ base: undefined });
    expect(text).toMatch(/write the whole case/i);
    expect(text).not.toContain(base.fields['summary']!);
    expect(text).toContain('"source_text"');
    expect(text).toContain('"summary"');
  });

  it('gives each row its category with the catalog description (which holds its examples), difficulty and what should be wrong', () => {
    const text = build();
    const factual = set.error_catalog.find((c) => c.name === 'factual-error')!;
    expect(text).toContain(factual.description!);
    expect(factual.description).toContain('Example:');
    expect(text).toMatch(/Error 1[^]*factual-error[^]*obvious[^]*Change the profession\./);
    expect(text).toMatch(/Error 2[^]*wrong-number/);
  });

  it('a row left to the LLM says so; a new category has no description to quote', () => {
    const text = build({ errors: [{ category: 'tone-shift', difficulty: 'llm', description: '' }] });
    expect(text).toMatch(/choose the difficulty/i);
    expect(text).toContain('tone-shift');
    expect(text).toMatch(/new category/i);
  });

  it('explains the two difficulty levels and asks to keep the one given (FR-043)', () => {
    const text = build();
    expect(text).toMatch(/obvious/i);
    expect(text).toMatch(/subtle/i);
    expect(text).toMatch(/keep the difficulty/i);
  });

  it('asks for exact fragments and, for an omission, a fragment of another field', () => {
    const text = build();
    expect(text).toMatch(/exactly as it appears|word for word/i);
    expect(text).toMatch(/omission/i);
    expect(text).toMatch(/another field/i);
  });

  it('asks for source_fragment, the words of the source that each error contradicts, and says when to leave it out (T250)', () => {
    const text = build();
    expect(text).toMatch(/"source_fragment": "…exact words of the source it contradicts…"/);
    expect(text).toMatch(/Give in "source_fragment" the exact words of another field/);
    expect(text).toMatch(/Leave "source_fragment" out when/);
  });

  it('starts with what the case is for: there are no own instructions any more (T249)', () => {
    expect(build().startsWith('I am testing an LLM judge.')).toBe(true);
  });

  it('is rebuilt when a row or the base changes', () => {
    expect(build({ errors: [rows[0]!] })).not.toBe(build());
    expect(build({ base: undefined })).not.toBe(build());
    expect(build({ errors: [{ ...rows[0]!, difficulty: 'subtle' }, rows[1]!] })).not.toBe(build());
  });

  it('is the same text for the same input', () => {
    expect(build()).toBe(build());
  });
});
