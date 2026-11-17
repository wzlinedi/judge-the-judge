// T230: the case window of Run is one vertical page with three parts (FR-055, FR-056, FR-062 to FR-064).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { markProgress } from '../../../src/core/evaluation/mark-progress';
import { readTestProject } from '../../../src/core/io/test-project-file';
import type { TestProject } from '../../../src/core/model';
import { MarkedFields } from '../../../src/ui/windows/case-window/MarkedFields';
import { ReadOnlyCaseView } from '../../../src/ui/windows/case-window/ReadOnlyCaseView';
import { CaseWindowHarness } from '../../helpers/case-window-harness';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.project;

const open = (caseId: string, start: TestProject = demo) => {
  const seen: TestProject[] = [];
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
    expect(headings).toEqual(['Case', 'Marking', 'Verify the judge reply']);
  });

  it('uses the whole width of the screen, and "Show prompt" opens the standard large dialog with its button at the bottom (T247)', () => {
    open('14');
    expect(win().querySelector('.case-page')?.classList.contains('case-page-wide')).toBe(true);
    fireEvent.click(within(part(1)).getByRole('button', { name: 'Show prompt' }));
    const dialog = screen.getByRole('dialog', { name: 'Complete judge prompt' });
    expect(dialog.classList.contains('dialog-wide')).toBe(true);
    expect(within(dialog.querySelector('.dialog-actions') as HTMLElement).getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('part 1 holds every field of the case with the highlights of the expected errors, over the full width', () => {
    open('11');
    expect(within(part(1)).getByText(/Injected errors/)).toBeTruthy();
    expect(part(1).querySelectorAll('[data-error]')).toHaveLength(3);
    expect(part(1).querySelectorAll('.fragment')).toHaveLength(0); // only Show the issue highlights (T257)
    expect(part(1).querySelector('.case-half')).toBeNull();
    expect(part(1).querySelectorAll('.field-block').length).toBeGreaterThan(0);
  });

  it('part 2 is a row with Add finding, Second opinion…, the meter and the status of the case', () => {
    open('14');
    const bar = part(2).querySelector('.decide-bar') as HTMLElement;
    expect(within(bar).getByRole('button', { name: 'Add finding…' })).toBeTruthy();
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
    fireEvent.click(within(document.querySelector('[data-additional="claims[]#2"]') as HTMLElement).getByRole('button', { name: 'Genuine error' }));
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

  it('the left column has only Paste reply below the reply box; the prompt buttons are in part 1 (T235)', () => {
    open('11');
    const left = part(3).querySelectorAll<HTMLElement>('.case-half > section')[0] as HTMLElement;
    expect(left.querySelector('ol')).toBeNull();
    expect(left.querySelector('details')).toBeNull();
    expect(within(left).queryByRole('button', { name: 'Copy prompt' })).toBeNull();
    const paste = within(left).getByRole('button', { name: 'Paste reply' });
    const box = within(left).getByLabelText('Judge reply');
    expect(box.compareDocumentPosition(paste) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // T240: Paste reply is below the box
    expect(within(part(1)).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
    expect(within(part(1)).getByRole('button', { name: 'Show prompt' })).toBeTruthy();
  });

  it('the three parts are in frames', () => {
    open('11');
    for (const n of [1, 2, 3]) expect(part(n).classList.contains('case-part')).toBe(true);
  });

  it('the right column lists the expected errors and the additional errors with their marks (T252), and no list of the findings in the reply (T258)', () => {
    open('3');
    const right = part(3).querySelectorAll<HTMLElement>('.case-half > section')[1] as HTMLElement;
    expect(within(right).getByRole('list', { name: 'Additional errors' })).toBeTruthy();
    expect(within(right).queryByRole('list', { name: 'Findings in the reply' })).toBeNull();
    expect(within(right).getAllByRole('button', { name: 'Ignored' }).length).toBeGreaterThan(0);
  });

  it('before a reply is saved, marking is disabled with the reason (T290), the case says so, and its expected errors are already listed with no marks (T264)', () => {
    const e = structuredClone(demo);
    delete e.testRun!.replies['11'];
    delete e.testRun!.decisions['11'];
    open('11', e);
    expect((within(part(2)).getByRole('button', { name: 'Add finding…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(part(2)).getByText('Paste the judge’s reply first')).toBeTruthy();
    expect(within(part(2)).getByText(/Not run/)).toBeTruthy();
    const right = part(3).querySelectorAll<HTMLElement>('.case-half > section')[1] as HTMLElement;
    const list = within(right).getByRole('list', { name: 'Expected errors' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    const expected = demo.dataset.cases.find((c) => c.id === '11')!.expected_errors;
    expected.forEach((error, i) => expect(within(list).getAllByRole('listitem')[i]?.textContent).toContain(error.description));
    expect(within(right).queryAllByRole('button', { name: /Found|Missed|Ignored|Real error|False positive/ })).toHaveLength(0);
    expect(right.querySelectorAll('.judge-says')).toHaveLength(0);
    expect(within(right).getAllByRole('button', { name: 'Show the issue' }).length).toBeGreaterThan(0);
    expect(within(right).getByText('The judge’s findings and the marks appear when its reply is saved.')).toBeTruthy();
    expect(within(part(3)).queryByText('The errors appear here when the judge’s reply is saved.')).toBeNull();
  });

  it('a clean case without a reply says it has no expected errors (T264)', () => {
    const e = structuredClone(demo);
    delete e.testRun!.replies['3'];
    delete e.testRun!.decisions['3'];
    open('3', e);
    expect(within(part(3)).getByText('No expected errors.')).toBeTruthy();
    expect(within(part(3)).queryByRole('list', { name: 'Expected errors' })).toBeNull();
  });
});

describe('T240: where each finding is, and Show the issue', () => {
  const items = (label: string) => [...win().querySelectorAll<HTMLElement>(`ul[aria-label="${label}"] > li`)];

  it('every expected error shows both sides: the words of the source, then the words of the judged text, each with the name of its field (T251)', () => {
    open('11');
    const list = items('Expected errors');
    expect(list.length).toBeGreaterThan(0);
    for (const li of list) {
      const sides = [...li.querySelectorAll<HTMLElement>('.error-side')];
      expect(sides.map((s) => s.dataset['side'])).toEqual(['source', 'judged']);
      expect(sides.map((s) => s.querySelector('dt')?.textContent)).toEqual(['source_text', 'summary']);
      const meta = demo.dataset.cases.find((c) => c.id === '11')!.expected_errors.find((x) => x.id === li.dataset['expected'])!;
      expect(sides[0]?.querySelector('dd')?.textContent).toBe(`“${meta.source_fragment}”`);
      expect(sides[1]?.querySelector('dd')?.textContent).toBe(`“${meta.fragment}”`);
    }
  });

  it('an error without a source fragment shows one side only', () => {
    const e = structuredClone(demo);
    for (const x of e.dataset.cases.find((c) => c.id === '11')!.expected_errors) delete x.source_fragment;
    open('11', e);
    for (const li of items('Expected errors')) expect([...li.querySelectorAll<HTMLElement>('.error-side')].map((s) => s.dataset['side'])).toEqual(['judged']);
  });

  it('an additional error whose text is in a field names it and has the button; one that is in no field says so and has no button', () => {
    open('3');
    const found = items('Additional errors').filter((li) => li.querySelector('.error-side:not(.not-found)'));
    for (const li of found) expect(within(li).getByRole('button', { name: 'Show the issue' })).toBeTruthy();
    const lost = items('Additional errors').filter((li) => li.querySelector('.error-side.not-found'));
    for (const li of lost) {
      expect(li.querySelector('.error-side dt')?.textContent).toBe('not found in the case');
      expect(within(li).queryByRole('button', { name: 'Show the issue' })).toBeNull();
    }
    expect(found.length + lost.length).toBeGreaterThan(0);
  });

  it('Show the issue on an expected error highlights both passages strongly in part 1: the fragment in the judged text and the words of the source (T251)', () => {
    open('11');
    expect(part(1).querySelector('.fragment-strong')).toBeNull();
    const li = items('Expected errors').find((x) => within(x).queryByRole('button', { name: 'Show the issue' }))!;
    fireEvent.click(within(li).getByRole('button', { name: 'Show the issue' }));
    const strong = [...part(1).querySelectorAll<HTMLElement>('.fragment-strong')];
    expect(strong.map((m) => m.closest<HTMLElement>('[data-field]')?.dataset['field']).sort()).toEqual(['source_text', 'summary']);
    const meta = demo.dataset.cases.find((c) => c.id === '11')!.expected_errors.find((x) => x.id === li.dataset['expected'])!;
    expect(part(1).querySelector('[data-field="source_text"] mark[data-shown]')?.textContent).toBe(meta.source_fragment);
    expect(part(1).querySelector(`[data-field="summary"] [data-error="${meta.id}"]`)?.classList.contains('fragment-strong')).toBe(true);
  });

  it('a finding with no text has no field line and no button', () => {
    open('3');
    for (const li of items('Additional errors').filter((x) => /whole reply/.test(x.textContent ?? ''))) {
      expect(li.querySelector('.error-side')).toBeNull();
      expect(within(li).queryByRole('button', { name: 'Show the issue' })).toBeNull();
    }
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
    expect(seen.at(-1)?.testRun!.decisions['10']?.approved).toBe(true);
    expect(within(part(2)).getByText(/Pass/)).toBeTruthy();
    expect(within(win()).getByRole('button', { name: 'No more findings' }).getAttribute('aria-pressed')).toBe('true');
  });
});

// T330 (FR-055, FR-092; research.md, section 33.5): the header in the order of FR-092, and part 1 in two columns of fields
describe('the layout of the case window (T330)', () => {
  /** True when every element comes after the one before it in the DOM. */
  const inDomOrder = (items: Element[]) => items.every((el, i) => i === 0 || (items[i - 1] as Element).compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('(a) the header holds the case name, Previous case, the position, Next case, the box, the count not saved and Close, in this order', () => {
    open('12');
    const header = win().querySelector('.case-window-header') as HTMLElement;
    const items = [
      within(header).getByRole('heading', { name: /^Case 12 · Moby-Dick \+ 3 errors$/ }),
      within(header).getByRole('button', { name: 'Previous case' }),
      within(header).getByText(/^case \d+ of \d+$/),
      within(header).getByRole('button', { name: 'Next case' }),
      within(header).getByRole('checkbox', { name: 'Only cases awaiting verification' }),
      within(header).getByText(/^\d+ not saved$/),
      within(header).getByRole('button', { name: 'Close' }),
    ];
    expect(inDomOrder(items)).toBe(true);
    const buttons = within(header).getAllByRole('button');
    expect(buttons.at(-1)?.textContent).toBe('Close');
    expect(win().querySelector('.case-window-body')?.contains(header)).toBe(false);
  });

  it('(b) part 1 holds the other fields first and the judged field second, each in its own column', () => {
    open('12');
    const fields = part(1).querySelector('.case-fields') as HTMLElement;
    expect(fields).not.toBeNull();
    expect(fields.classList.contains('single')).toBe(false);
    expect([...fields.children].map((c) => c.className)).toEqual(['case-fields-others', 'case-fields-judged']);
    const names = (box: string) => [...fields.querySelectorAll(`.${box} [data-field]`)].map((f) => f.getAttribute('data-field'));
    expect(names('case-fields-others')).toEqual(['source_text']);
    expect(names('case-fields-judged')).toEqual(['summary']);
  });

  it('(b) the other fields keep the order of the case, and the judged field goes to the second column wherever it stands', () => {
    render(<MarkedFields testCase={{ fields: { summary: 'S', title: 'T', source_text: 'X' }, expected_errors: [] }} judged="summary" effective={null} columns />);
    const fields = document.querySelector('.case-fields') as HTMLElement;
    expect([...fields.querySelectorAll('.case-fields-others [data-field]')].map((f) => f.getAttribute('data-field'))).toEqual(['title', 'source_text']);
    expect([...fields.querySelectorAll('.case-fields-judged [data-field]')].map((f) => f.getAttribute('data-field'))).toEqual(['summary']);
  });

  it('(c) a case with only the judged field has one column: the class single and no other fields', () => {
    render(<MarkedFields testCase={{ fields: { summary: 'Only the summary.' }, expected_errors: [] }} judged="summary" effective={null} columns />);
    const fields = document.querySelector('.case-fields') as HTMLElement;
    expect(fields.classList.contains('single')).toBe(true);
    expect(fields.querySelector('.case-fields-others')).toBeNull();
    expect(fields.querySelector('.case-fields-judged [data-field="summary"]')).not.toBeNull();
  });

  it('(d) the read-only case view of Results has the same two columns of fields', () => {
    render(<ReadOnlyCaseView evaluation={demo} reviewed={reviewEvaluation(demo, accuracyMetric)} caseId="12" onNavigate={() => {}} onClose={() => {}} onOpenOnTestRun={() => {}} />);
    const view = screen.getByRole('dialog', { name: /^Case 12 / });
    const fields = view.querySelector('.case-part .case-fields') as HTMLElement;
    expect(fields).not.toBeNull();
    expect([...fields.children].map((c) => c.className)).toEqual(['case-fields-others', 'case-fields-judged']);
    expect(fields.querySelector('.case-fields-judged [data-field="summary"]')).not.toBeNull();
  });
});
