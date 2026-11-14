// T230: the case window of Run is one vertical page with three parts (FR-055, FR-056, FR-062 to FR-064).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { markProgress } from '../../../src/core/evaluation/mark-progress';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import type { Evaluation } from '../../../src/core/model';
import { CaseWindowHarness } from '../../helpers/case-window-harness';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.evaluation;

const open = (caseId: string, start: Evaluation = demo) => {
  const seen: Evaluation[] = [];
  render(<CaseWindowHarness start={start} caseId={caseId} seen={(e) => seen.push(e)} />);
  return seen;
};
const win = () => screen.getByRole('dialog', { name: /^Case / });
const part = (n: number) => win().querySelectorAll<HTMLElement>('.case-part')[n - 1] as HTMLElement;
const meterOf = (id: string) => {
  const { marked, total } = markProgress(reviewEvaluation(demo, accuracyMetric).find((r) => r.testCase.id === id)!.effective!);
  return `Marked ${marked} of ${total}`;
};

describe('the case window of Run: three parts from top to bottom', () => {
  it('is one page: no side by side panes of the window, numbered parts', () => {
    open('14');
    expect(win().querySelector('.case-window-body > .case-page')).not.toBeNull();
    expect(win().querySelector('.case-columns')).toBeNull();
    const headings = [...win().querySelectorAll('.case-part > h3')].map((h) => (h.textContent ?? '').replace(/^\d\. /, ''));
    expect(headings).toEqual(['Case', 'Marking', 'Judge reply and errors']);
  });

  it('part 1 holds every field of the case with the highlights of the expected errors, over the full width', () => {
    open('11');
    expect(within(part(1)).getByText(/Injected errors/)).toBeTruthy();
    expect(part(1).querySelectorAll('mark.fragment')).toHaveLength(3);
    expect(part(1).querySelector('.case-half')).toBeNull();
    expect(part(1).querySelectorAll('.field-block').length).toBeGreaterThan(0);
  });

  it('part 2 is a row with Add finding, Second opinion…, the meter and the status of the case', () => {
    open('14');
    const bar = part(2).querySelector('.decide-bar') as HTMLElement;
    expect(within(bar).getByRole('button', { name: 'Add finding' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Second opinion…' })).toBeTruthy();
    expect(within(bar).getByText(meterOf('14'))).toBeTruthy();
    expect(within(bar).getByText(/Awaiting verification/)).toBeTruthy();
    expect(within(win().querySelector('.case-window-header') as HTMLElement).queryByText(/Awaiting verification/)).toBeNull();
  });

  it('part 2 has no Approve and no Next to the other buttons; a readable reply needs no approval', () => {
    open('14');
    expect(within(win()).queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(within(win()).queryByRole('button', { name: 'No more findings' })).toBeNull();
  });

  it('the meter counts a mark as soon as it is made, and the status follows', () => {
    open('3');
    const before = meterOf('3');
    expect(within(part(2)).getByText(before)).toBeTruthy();
    fireEvent.click(within(document.querySelector('[data-additional="claims[]#2"]') as HTMLElement).getByRole('button', { name: 'Real error' }));
    expect(within(part(2)).queryByText(before)).toBeNull();
    expect(within(part(2)).getByText(/Pass/)).toBeTruthy();
  });

  it('part 3 has two columns: "Judge reply" on the left and the errors on the right', () => {
    open('14');
    const half = part(3).querySelector('.case-half') as HTMLElement;
    const columns = half.querySelectorAll(':scope > section');
    expect(columns).toHaveLength(2);
    expect(within(columns[0] as HTMLElement).getByRole('heading', { name: 'Judge reply' })).toBeTruthy();
    expect(within(columns[1] as HTMLElement).getByRole('heading', { name: 'Errors' })).toBeTruthy();
  });

  it('the left column has only Paste reply from clipboard above the reply box; the prompt buttons are in part 1 (T235)', () => {
    open('11');
    const left = part(3).querySelectorAll<HTMLElement>('.case-half > section')[0] as HTMLElement;
    expect(left.querySelector('ol')).toBeNull();
    expect(left.querySelector('details')).toBeNull();
    expect(within(left).queryByRole('button', { name: 'Copy prompt' })).toBeNull();
    const paste = within(left).getByRole('button', { name: 'Paste reply from clipboard' });
    const box = within(left).getByLabelText('Judge reply');
    expect(paste.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(part(1)).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
    expect(within(part(1)).getByRole('button', { name: 'Show the full prompt' })).toBeTruthy();
  });

  it('the three parts are in frames', () => {
    open('11');
    for (const n of [1, 2, 3]) expect(part(n).classList.contains('case-part')).toBe(true);
  });

  it('the right column lists the expected errors, the additional findings and the findings in the reply, with their marks', () => {
    open('3');
    const right = part(3).querySelectorAll<HTMLElement>('.case-half > section')[1] as HTMLElement;
    expect(within(right).getByRole('list', { name: 'Additional findings' })).toBeTruthy();
    expect(within(right).getByRole('list', { name: 'Findings in the reply' })).toBeTruthy();
    expect(within(right).getAllByRole('button', { name: 'Ignore' }).length).toBeGreaterThan(0);
  });

  it('before a reply is saved, marking is not offered and the case says so', () => {
    const e = structuredClone(demo);
    delete e.replies['3'];
    delete e.decisions['3'];
    open('3', e);
    expect(within(part(2)).queryByRole('button', { name: 'Add finding' })).toBeNull();
    expect(within(part(2)).getByText(/Not run/)).toBeTruthy();
    expect(within(part(3)).getByText('The errors appear here when the judge’s reply is saved.')).toBeTruthy();
  });
});

describe('a reply that cannot be read', () => {
  it('shows its reason with a No more findings button next to it, and no Approve', () => {
    open('10');
    const message = part(3).querySelector('.unreadable-note') as HTMLElement;
    expect(message.textContent).toMatch(/could not be read/);
    expect(within(message).getByRole('button', { name: 'No more findings' })).toBeTruthy();
    expect(within(win()).queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('says that the case waits until the findings are added and confirmed', () => {
    open('10');
    expect(within(win()).getByText(/When you have added all of them, press No more findings/)).toBeTruthy();
  });

  it('No more findings is the primary action while the case awaits, and sets the approval', () => {
    const seen = open('10');
    const button = within(win()).getByRole('button', { name: 'No more findings' });
    expect(button.classList.contains('primary')).toBe(true);
    expect(within(part(2)).getByText(/Awaiting verification/)).toBeTruthy();
    fireEvent.click(button);
    expect(seen.at(-1)?.decisions['10']?.approved).toBe(true);
    expect(within(part(2)).getByText(/Pass/)).toBeTruthy();
    expect(within(win()).getByRole('button', { name: 'No more findings' }).getAttribute('aria-pressed')).toBe('true');
  });
});
