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
    // R8: the demo's case 14 lists "Victor and the creature" (partly matches E2); with E2 decided found, nothing is left to list
    const decided = structuredClone(demo);
    const decisions = decided.testRun!.decisions['14'] ?? { expected: {}, additional: {}, added_findings: [], approved: false, note: '' };
    decisions.expected['e2'] = { state: 'found', source: 'manual' };
    decided.testRun!.decisions['14'] = decisions;
    const clean = verificationPrompt(decided, reviewEvaluation(decided, accuracyMetric).find((x) => x.testCase.id === '14')!);
    expect(clean).toMatch(/no additional findings/i);
    const unreadable = verificationPrompt(demo, caseOf('10'));
    expect(unreadable).toContain('I looked at the summary and it seems fine to me.');
    expect(unreadable).toMatch(/could not be read/i);
  });
});

// R8 (code review 2026-11-16; FR-063, contracts/file-formats.md section 7): findings that only partly match an undecided
// expected error join the A list, and the prompt holds a code of its list.
describe('verificationPrompt: findings that wait for an undecided error (R8)', () => {
  /** Case 17 with a fourth expected error that the finding "Gandalf persuades Bilbo Baggins" only partly matches, and one finding added by hand. */
  const withWaiting = (decide?: 'found' | 'missed') => {
    const p = structuredClone(demo);
    p.dataset.cases.find((c) => c.id === '17')!.expected_errors.push({ id: 'x9', description: 'Gandalf is grey', fragment: 'Gandalf grey' } as never);
    const decisions = p.testRun!.decisions['17'] ?? { expected: {}, additional: {}, added_findings: [], approved: false, note: '' };
    decisions.added_findings.push({ text: 'A thing added by hand', state: 'real_error', source: 'manual' });
    if (decide) decisions.expected['x9'] = { state: decide, source: 'manual' };
    p.testRun!.decisions['17'] = decisions;
    const r = reviewEvaluation(p, accuracyMetric).find((x) => x.testCase.id === '17')!;
    return { p, r, prompt: verificationPrompt(p, r) };
  };
  const codeOf = (prompt: string) => /"list": "([0-9a-f]{6})"/.exec(prompt)?.[1];

  it('lists a finding that only partly matches an undecided E4 after the additional findings, with the error it resembles', () => {
    const { prompt } = withWaiting();
    expect(prompt).toMatch(/A1\. "A thing added by hand"/);
    expect(prompt).toMatch(/A2\. "Gandalf persuades Bilbo Baggins"[^\n]*\(partly matches E4\)/);
    expect(prompt.indexOf('A thing added by hand')).toBeLessThan(prompt.indexOf('(partly matches E4)'));
  });

  it('does not say there are no additional findings when only a waiting finding is listed', () => {
    const p = structuredClone(demo);
    p.dataset.cases.find((c) => c.id === '17')!.expected_errors.push({ id: 'x9', description: 'd', fragment: 'Gandalf grey' } as never);
    const prompt = verificationPrompt(p, reviewEvaluation(p, accuracyMetric).find((x) => x.testCase.id === '17')!);
    expect(prompt).toMatch(/A1\. "Gandalf persuades Bilbo Baggins"[^\n]*\(partly matches E4\)/);
    expect(prompt).not.toContain('There are no additional findings.');
  });

  it('asks for the code of the list in the answer and holds it: six hexadecimal characters', () => {
    const { prompt } = withWaiting();
    expect(codeOf(prompt)).toMatch(/^[0-9a-f]{6}$/);
    expect(prompt).toMatch(/repeat .*"list"/i);
  });

  it('gives the same code for the same list, and another code when a mark moves a finding between the lists', () => {
    const open = codeOf(withWaiting().prompt);
    expect(codeOf(withWaiting().prompt)).toBe(open);
    expect(codeOf(withWaiting('missed').prompt)).not.toBe(open); // the finding is now an additional finding
    expect(codeOf(withWaiting('found').prompt)).not.toBe(open); // the finding counts for E4 and leaves the list
  });

  it('lists nothing extra and gives a code also for a case with no waiting finding', () => {
    const plain = verificationPrompt(demo, caseOf('17'));
    expect(codeOf(plain)).toMatch(/^[0-9a-f]{6}$/);
    expect(plain).not.toContain('(partly matches');
  });
});
