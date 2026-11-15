// The prompt that asks the user's LLM for a second opinion on ONE case (FR-063, contracts/core-api.md).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reviewEvaluation } from '../../../../src/core/evaluation/results';
import { verificationPrompt } from '../../../../src/core/generation/verification-prompt';
import { readTestProject } from '../../../../src/core/io/test-project-file';
import { accuracyMetric } from '../../../helpers/fixtures';

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.project;
const reviewed = reviewEvaluation(demo, accuracyMetric);
const caseOf = (id: string) => reviewed.find((r) => r.testCase.id === id)!;

describe('verificationPrompt', () => {
  const r = caseOf('17');
  const prompt = verificationPrompt(demo, r);

  it('is about one case only: its identifier and fields, and no other case', () => {
    expect(prompt).toContain('"17"');
    expect(prompt).toContain(r.testCase.fields['summary'] as string);
    expect(prompt).toContain(r.testCase.fields['source_text'] as string);
    const other = caseOf('3').testCase.fields['summary'] as string;
    expect(prompt).not.toContain(other);
  });

  it('numbers the expected errors with their description and fragment', () => {
    r.testCase.expected_errors.forEach((e, i) => {
      expect(prompt).toContain(`E${i + 1}.`);
      expect(prompt).toContain(e.fragment as string);
    });
  });

  it('numbers the additional findings in the order of the case window, those added by hand included', () => {
    expect(prompt).toContain('A1.');
    expect(prompt).toContain('Gandalf persuades Bilbo Baggins');
    const withAdded = structuredClone(demo);
    withAdded.testRun!.decisions['17'] = { expected: {}, additional: {}, added_findings: [{ text: 'A thing added by hand', state: 'real_error', source: 'manual' }], approved: false, note: '' };
    const again = verificationPrompt(withAdded, reviewEvaluation(withAdded, accuracyMetric).find((x) => x.testCase.id === '17')!);
    expect(again).toContain('A2.');
    expect(again.indexOf('Gandalf persuades Bilbo Baggins')).toBeLessThan(again.indexOf('A thing added by hand'));
  });

  it('holds the received reply', () => {
    expect(prompt).toContain(demo.testRun!.replies['17']!.reply);
  });

  it('asks for the fixed JSON opinion with reason and fragment, and for findings that are not in the list', () => {
    for (const word of ['"opinion"', '"id": "17"', '"expected"', '"additional"', '"new"', '"index"', '"found"', '"real"', '"reason"', '"fragment"', '"category"', '"difficulty"']) {
      expect(prompt).toContain(word);
    }
    expect(prompt).toMatch(/each item on its own/i);
    expect(prompt).toMatch(/not in the list/i);
  });

  it('names the categories of the catalog for the new findings', () => {
    expect(prompt).toContain('factual-error');
  });

  it('says so when there is no additional finding or the reply could not be read', () => {
    const clean = verificationPrompt(demo, caseOf('14'));
    expect(clean).toMatch(/no additional findings/i);
    const unreadable = verificationPrompt(demo, caseOf('10'));
    expect(unreadable).toContain('I looked at the summary and it seems fine to me.');
    expect(unreadable).toMatch(/could not be read/i);
  });
});
