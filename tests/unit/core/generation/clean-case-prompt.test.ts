// FR-083: the prompt that asks the user's LLM for one clean case.
import { describe, expect, it } from 'vitest';
import { cleanCasePrompt } from '../../../../src/core/generation/clean-case-prompt';
import { accuracyJudgeSet, sampleProject } from '../../../helpers/fixtures';

const set = accuracyJudgeSet();
const like = sampleProject().dataset.cases[0]!;

describe('cleanCasePrompt', () => {
  it('asks for one clean case in the case JSON layout with no expected errors', () => {
    const text = cleanCasePrompt(set);
    expect(text).toMatch(/ONE clean test case/i);
    expect(text).toContain('"expected_errors": []');
    expect(text).toContain('"fields"');
    expect(text).toContain('"name"');
  });

  it('contains the judge prompt with its variables and the judged text', () => {
    const text = cleanCasePrompt(set);
    expect(text).toContain(set.prompt);
    expect(text).toContain('{{source_text}}');
    expect(text).toMatch(/judged text.*summary/is);
    expect(text).toContain('"source_text"');
    expect(text).toContain('"summary"');
  });

  it('lists the catalog with descriptions so that the case contains none of its errors', () => {
    const text = cleanCasePrompt(set);
    for (const c of set.error_catalog) {
      expect(text).toContain(c.name);
      expect(text).toContain(c.description!);
    }
    expect(text).toMatch(/must contain none of these errors/i);
  });

  it('leaves out the catalog section when there is no category', () => {
    expect(cleanCasePrompt({ ...set, error_catalog: [] })).not.toMatch(/none of these errors/i);
  });

  it('uses the fields of the Like case as a model when one is picked', () => {
    const text = cleanCasePrompt(set, like);
    expect(text).toContain(like.fields['source_text']!);
    expect(text).toMatch(/model/i);
    expect(cleanCasePrompt(set)).not.toContain(like.fields['source_text']!);
  });

  it('is rebuilt from the same inputs identically, differs when the pick changes, and has no comment section (T249)', () => {
    expect(cleanCasePrompt(set, like)).toBe(cleanCasePrompt(set, like));
    expect(cleanCasePrompt(set, like)).not.toBe(cleanCasePrompt(set));
    expect(cleanCasePrompt(set, like)).not.toMatch(/comment/i);
  });
});
