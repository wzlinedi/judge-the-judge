// FR-077: highlights in the case views and in the case window of Run: always a number and a word beside the colour.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/preact';
import { MarkedFields } from '../../../src/ui/windows/case-window/MarkedFields';
import { fieldMarks } from '../../../src/ui/windows/case-window/marks';
import type { TestCase } from '../../../src/core/model';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { markFindings } from '../../../src/core/evaluation/finding-marks';
import { DecidePane } from '../../../src/ui/windows/case-window/DecidePane';
import { accuracyMetric, sampleEvaluation } from '../../helpers/fixtures';

const text = 'One two. Three four. Five six. Seven eight. Nine ten.';
const five: TestCase = {
  id: 'x', name: 'five', fields: { source_text: 'Source says: Eleven twelve.', summary: text },
  expected_errors: ['One two', 'Three four', 'Five six', 'Seven eight', 'Nine ten'].map((fragment, i) => ({ id: `e${i + 1}`, description: 'd', category: 'c', fragment })),
};

describe('fragments in the judged text', () => {
  it('highlights up to five expected errors with E1 … E5', () => {
    const { container } = render(<MarkedFields testCase={five} judged="summary" effective={null} uncovered={[]} />);
    const marks = Array.from(container.querySelectorAll('mark[data-error]'));
    expect(marks.map((m) => m.querySelector('sup')?.textContent)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5']);
  });

  it('puts a fragment of an omission into the field where it occurs', () => {
    const omission: TestCase = { ...five, expected_errors: [{ id: 'e1', description: 'left out', fragment: 'Eleven twelve' }] };
    const { container } = render(<MarkedFields testCase={omission} judged="summary" effective={null} uncovered={[]} />);
    expect(container.querySelector('mark[data-error]')?.closest('section')?.textContent).toContain('source_text');
  });

  it('marks a fragment found only with another case (nearest match)', () => {
    const loose: TestCase = { ...five, expected_errors: [{ id: 'e1', description: 'd', fragment: 'one TWO' }] };
    expect(fieldMarks(loose, 'summary', 'summary', null, []).some((s) => s.error)).toBe(true);
  });

  it('does not mark a fragment that is not there, and never hides or changes the text', () => {
    const missing: TestCase = { ...five, expected_errors: [{ id: 'e1', description: 'd', fragment: 'nowhere' }] };
    const { container } = render(<MarkedFields testCase={missing} judged="summary" effective={null} uncovered={[]} />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain(text);
    const all = render(<MarkedFields testCase={five} judged="summary" effective={null} uncovered={[]} />);
    expect(all.container.querySelectorAll('.field-text')[1]?.textContent?.replace(/E\d/g, '')).toContain('One two. Three four.');
  });

  it('a changed place that no error covers is marked in the warning colour with its words', () => {
    const { container } = render(<MarkedFields testCase={five} judged="summary" effective={null} uncovered={[{ field: 'source_text', start: 0, end: 6, text: 'Source' }]} />);
    const mark = container.querySelector('mark.fragment-uncovered')!;
    expect(mark.textContent).toContain('not in the list');
  });
});

describe('after a reply', () => {
  const effective = (states: Array<'found' | 'missed' | 'undecided' | 'ignored'>) => ({
    expected: states.map((state, i) => ({ id: `e${i + 1}`, state, source: 'automatic' as const, attached: 0 })), additional: [], approved: false, needsApproval: false, orphans: { expected: [], additional: [] },
  });

  it('each mark says found, missed, undecided or ignored in words as well as a sign', () => {
    const { container } = render(<MarkedFields testCase={five} judged="summary" effective={effective(['found', 'missed', 'undecided', 'ignored', 'found'])} uncovered={[]} />);
    const labels = Array.from(container.querySelectorAll('mark[data-error]')).map((m) => m.getAttribute('title'));
    expect(labels).toEqual(['E1 found', 'E2 missed', 'E3 undecided', 'E4 ignored', 'E5 found']);
    expect(container.querySelector('mark.fragment-found sup')?.textContent).toMatch(/E1 ✓/);
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
  it('lists the findings of the reply with the words matches error N, partial match, or no expected error', () => {
    const e = sampleEvaluation();
    const reviewed = reviewEvaluation(e, accuracyMetric).find((r) => r.testCase.id === '2')!;
    const noop = () => undefined;
    const { getByRole } = render(<DecidePane reviewed={reviewed} effective={reviewed.effective!} replyChanged={false} onExpected={noop} onAdditional={noop} onApprove={noop} onShowInText={noop} />);
    const list = getByRole('list', { name: 'Findings in the reply' });
    expect(list.textContent).toContain('matches error 1');
    expect(list.textContent).toContain('matches error 2');
    expect(list.querySelector('mark.finding-clear')).not.toBeNull();
  });
});
