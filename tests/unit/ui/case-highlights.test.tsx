// FR-077: highlights in the case views and in the case window of Run: always a number and a word beside the colour.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/preact';
import { MarkedFields } from '../../../src/ui/windows/case-window/MarkedFields';
import { fieldMarks } from '../../../src/ui/windows/case-window/marks';
import type { TestCase } from '../../../src/core/model';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { markFindings } from '../../../src/core/evaluation/finding-marks';
import { ErrorsPane } from '../../../src/ui/windows/case-window/DecidePane';
import { accuracyMetric, sampleEvaluation } from '../../helpers/fixtures';

const text = 'One two. Three four. Five six. Seven eight. Nine ten.';
const five: TestCase = {
  id: 'x', name: 'five', fields: { source_text: 'Source says: Eleven twelve.', summary: text },
  expected_errors: ['One two', 'Three four', 'Five six', 'Seven eight', 'Nine ten'].map((fragment, i) => ({ id: `e${i + 1}`, description: 'd', category: 'c', fragment })),
};

describe('fragments in the judged text', () => {
  it('highlights nothing until Show the issue points at an error (T257)', () => {
    const { container } = render(<MarkedFields testCase={five} judged="summary" effective={null} />);
    expect(container.querySelectorAll('.fragment, mark, sup')).toHaveLength(0);
    expect(container.querySelectorAll('[data-error]')).toHaveLength(5);
  });

  it('highlights the error that Show the issue points at with its number, E1 … E5', () => {
    const { container } = render(<MarkedFields testCase={five} judged="summary" effective={null} strong={['e1', 'e2', 'e3', 'e4', 'e5']} />);
    const marks = Array.from(container.querySelectorAll('.fragment-strong[data-error]'));
    expect(marks.map((m) => m.querySelector('sup')?.textContent)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5']);
  });

  it('puts a fragment of an omission into the field where it occurs', () => {
    const omission: TestCase = { ...five, expected_errors: [{ id: 'e1', description: 'left out', fragment: 'Eleven twelve' }] };
    const { container } = render(<MarkedFields testCase={omission} judged="summary" effective={null} strong="e1" />);
    expect(container.querySelector('.fragment-strong[data-error]')?.closest('section')?.textContent).toContain('source_text');
  });

  it('marks a fragment found only with another case (nearest match)', () => {
    const loose: TestCase = { ...five, expected_errors: [{ id: 'e1', description: 'd', fragment: 'one TWO' }] };
    expect(fieldMarks(loose, 'summary', 'summary', null).some((s) => s.error)).toBe(true);
  });

  it('does not mark a fragment that is not there, and never hides or changes the text', () => {
    const missing: TestCase = { ...five, expected_errors: [{ id: 'e1', description: 'd', fragment: 'nowhere' }] };
    const { container } = render(<MarkedFields testCase={missing} judged="summary" effective={null} />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain(text);
    const all = render(<MarkedFields testCase={five} judged="summary" effective={null} />);
    expect(all.container.querySelectorAll('.field-text')[1]?.textContent?.replace(/E\d/g, '')).toContain('One two. Three four.');
  });
});

describe('after a reply', () => {
  const effective = (states: Array<'found' | 'missed' | 'undecided' | 'ignored'>) => ({
    expected: states.map((state, i) => ({ id: `e${i + 1}`, state, source: 'automatic' as const, attached: 0 })), additional: [], approved: false, needsApproval: false, orphans: { expected: [], additional: [] },
  });

  it('each mark says found, missed, undecided or ignored in words as well as a sign', () => {
    const { container } = render(<MarkedFields testCase={five} judged="summary" effective={effective(['found', 'missed', 'undecided', 'ignored', 'found'])} strong={['e1', 'e2', 'e3', 'e4', 'e5']} />);
    const labels = Array.from(container.querySelectorAll('[data-error]')).map((m) => m.getAttribute('title'));
    expect(labels).toEqual(['E1 found', 'E2 missed', 'E3 undecided', 'E4 ignored', 'E5 found']);
    expect(container.querySelector('.fragment-found sup')?.textContent).toMatch(/E1 ✓/);
  });
});

describe('findings in the reply', () => {
  it('are marked matching, partly matching or matching no expected error', () => {
    const e = sampleEvaluation();
    const reviewed = reviewEvaluation(e, accuracyMetric);
    const second = reviewed.find((r) => r.testCase.id === '2')!;
    const marks = markFindings(second);
    expect(marks.find((m) => m.text === 'Anna is a doctor.')).toMatchObject({ kind: 'clear', errorNumbers: [1] });
    expect(marks.find((m) => m.text === 'She bought a second oven in 2005.')).toMatchObject({ kind: 'clear', errorNumbers: [2] });
    const fake = { ...second, findings: [{ key: 'claims[]#1', text: 'Something else entirely', rules: [] }], review: { ...second.review!, expected: second.review!.expected.map((x) => ({ ...x, clear: [], partial: [] })), additional: [{ key: 'claims[]#1', text: 'Something else entirely', rules: [] }], partialOnly: [] } };
    expect(markFindings(fake)[0]).toMatchObject({ kind: 'none', label: 'no expected error' });
  });

  it('says so in one line when the reply cannot be read or the judge is evaluated per case', () => {
    const e = sampleEvaluation();
    const bad = { ...e, replies: { ...e.replies, '2': { prompt: 'p', reply: 'I think it is fine.' } } };
    const reviewed = reviewEvaluation(bad, accuracyMetric).find((r) => r.testCase.id === '2')!;
    expect(markFindings(reviewed)).toEqual([]);
  });
});

describe('the case window of Run', () => {
  it('each expected error says which words of the judge match it, and there is no list of the findings in the reply (T258)', () => {
    const e = sampleEvaluation();
    const reviewed = reviewEvaluation(e, accuracyMetric).find((r) => r.testCase.id === '2')!;
    const noop = () => undefined;
    const { container, queryByRole } = render(<ErrorsPane reviewed={reviewed} effective={reviewed.effective!} onExpected={noop} onAdditional={noop} onApprove={noop} onShowInText={noop} judged={undefined} onRemove={noop} />);
    expect(queryByRole('list', { name: 'Findings in the reply' })).toBeNull();
    const says = [...container.querySelectorAll('[data-expected] .judge-says')].map((p) => p.textContent);
    expect(says).toContain('F1 · Judge: “Anna is a doctor.” (matches)');
    expect(says).toContain('F2 · Judge: “She bought a second oven in 2005.” (matches)');
  });
});
