// FR-077: highlights in the case views and in the case window of Run: always a number and a word beside the colour.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { MarkedFields } from '../../../src/ui/windows/case-window/MarkedFields';
import { fieldMarks } from '../../../src/ui/windows/case-window/marks';
import type { TestCase } from '../../../src/core/model';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { markFindings } from '../../../src/core/evaluation/finding-marks';
import { ErrorsPane } from '../../../src/ui/windows/case-window/DecidePane';
import { accuracyMetric, sampleProject, withRun } from '../../helpers/fixtures';

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
    const e = sampleProject();
    const reviewed = reviewEvaluation(e, accuracyMetric);
    const second = reviewed.find((r) => r.testCase.id === '2')!;
    const marks = markFindings(second);
    expect(marks.find((m) => m.text === 'Anna is a doctor.')).toMatchObject({ kind: 'clear', errorNumbers: [1] });
    expect(marks.find((m) => m.text === 'She bought a second oven in 2005.')).toMatchObject({ kind: 'clear', errorNumbers: [2] });
    const fake = { ...second, findings: [{ key: 'claims[]#1', text: 'Something else entirely', rules: [] }], review: { ...second.review!, expected: second.review!.expected.map((x) => ({ ...x, clear: [], partial: [] })), additional: [{ key: 'claims[]#1', text: 'Something else entirely', rules: [] }], partialOnly: [] } };
    expect(markFindings(fake)[0]).toMatchObject({ kind: 'none', label: 'no expected error' });
  });

  it('says so in one line when the reply cannot be read or the judge is evaluated per case', () => {
    const e = sampleProject();
    const bad = withRun(e, { replies: { ...e.testRun!.replies, '2': { prompt: 'p', reply: 'I think it is fine.' } } });
    const reviewed = reviewEvaluation(bad, accuracyMetric).find((r) => r.testCase.id === '2')!;
    expect(markFindings(reviewed)).toEqual([]);
  });
});

describe('the case window of Run', () => {
  it('each expected error says which words of the judge match it, and there is no list of the findings in the reply (T258)', () => {
    const e = sampleProject();
    const reviewed = reviewEvaluation(e, accuracyMetric).find((r) => r.testCase.id === '2')!;
    const noop = () => undefined;
    const { container, queryByRole } = render(<ErrorsPane reviewed={reviewed} effective={reviewed.effective!} onExpected={noop} onAdditional={noop} onApprove={noop} onShowInText={noop} judged={undefined} onRemove={noop} />);
    expect(queryByRole('list', { name: 'Findings in the reply' })).toBeNull();
    const says = [...container.querySelectorAll('[data-expected] .judge-says')].map((p) => p.textContent);
    expect(says).toContain('F1 · Judge: “Anna is a doctor.” (matches)');
    expect(says).toContain('F2 · Judge: “She bought a second oven in 2005.” (matches)');
  });
});

// T335 (SC-045; research.md, 33.6): the object of a finding stays marked until another item is pointed at, the case changes or the window
// closes; the passage in the fields keeps its mark for a moment only.
describe('the mark of a finding in the reply stays until the next pointing (T335)', () => {
  const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
  const pretty = (value: unknown) => JSON.stringify(value, null, 2);
  const project = (): TestProject => {
    const e = sampleProject();
    const claims = [{ text: 'Anna is a doctor.', verdict: 'contradicted', reason: 'x' }, { text: 'Anna is a baker.', verdict: 'supported', reason: 'y' }, { text: 'She bought a second oven in 2005.', verdict: 'unsupported', reason: 'z' }];
    return withRun(e, { replies: { ...e.testRun!.replies, '2': { prompt: 'p2', reply: pretty({ claims }) } }, decisions: {} });
  };
  const win = () => screen.getByRole('dialog', { name: /^Case / });
  const strong = () => [...win().querySelectorAll<HTMLElement>('.reply-read [data-finding-block].fragment-strong')].map((b) => b.dataset['findingBlock']);
  const line = (key: string) => win().querySelector(`.decide-pane [data-finding-line="${key}"]`) as HTMLElement;
  const block = (key: string) => win().querySelector(`.reply-read [data-finding-block="${key}"]`) as HTMLElement;
  const wait = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  let scrolled: Element[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    scrolled = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    render(<App ports={createFakePorts()} env={env} initialState={{ ...createState(), step: 'run', project: project(), openCase: '2' } as AppState} />);
  });
  afterEach(() => vi.useRealTimers());

  it('(a) a block pressed in the reply is marked strongly, and the mark is still there after 5 seconds', async () => {
    fireEvent.click(block('claims[]#1'));
    expect(strong()).toEqual(['claims[]#1']);
    await wait(5000);
    expect(strong()).toEqual(['claims[]#1']);
  });

  it('(b) pressing another block moves the strong mark to it', async () => {
    fireEvent.click(block('claims[]#1'));
    await wait(100);
    fireEvent.click(block('claims[]#3'));
    expect(strong()).toEqual(['claims[]#3']);
  });

  it('(c) "Show the issue" of an error the judge found marks its object for good, and scrolls the page to the passage in the fields', async () => {
    const card = line('claims[]#1').closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Show the issue' }));
    await wait(0);
    expect(strong()).toEqual(['claims[]#1']);
    // SC-045, SC-031 (owner's answer of 2026-11-16 in step 5): the page goes to the passage in the fields; the object in the reply is marked, not scrolled to
    expect(scrolled.at(-1)?.closest('.marked-fields')).not.toBeNull();
    expect(scrolled.some((el) => el.matches('[data-finding-block]'))).toBe(false);
    await wait(5000);
    expect(strong()).toEqual(['claims[]#1']);
    const css = readFileSync('src/ui/styles/components.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const own = css.match(/(?:^|\})\s*\.reply-read\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(own, 'the reply frame does not scroll; the page does').not.toMatch(/max-height\s*:|overflow(-x|-y)?\s*:/);
  });

  it('(d) a move to another case and Close clear the mark', async () => {
    const title = () => within(win()).getByRole('heading', { level: 2 }).textContent;
    // case 2 is the last case of the sample, so the move goes to case 1 and back with Next case
    fireEvent.click(block('claims[]#1'));
    fireEvent.click(within(win()).getByRole('button', { name: 'Previous case' }));
    await wait(0);
    expect(title()).not.toMatch(/^Case 2 /);
    fireEvent.click(within(win()).getByRole('button', { name: 'Next case' }));
    await wait(0);
    expect(title()).toMatch(/^Case 2 /);
    expect(strong()).toEqual([]);
    fireEvent.click(block('claims[]#1'));
    expect(strong()).toEqual(['claims[]#1']);
    fireEvent.click(within(win()).getByRole('button', { name: 'Close' }));
    await wait(0);
    expect(screen.queryByRole('dialog', { name: /^Case / })).toBeNull();
    const row = screen.getAllByRole('row').find((r) => (r.textContent ?? '').includes('Anna + 2 errors')) as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }));
    await wait(0);
    expect(title()).toMatch(/^Case 2 /);
    expect(strong()).toEqual([]);
  });

  it('(e) the passage in the fields marked by "Show the issue" clears after a moment', async () => {
    const card = line('claims[]#1').closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Show the issue' }));
    await wait(0);
    expect(win().querySelectorAll('.marked-fields .fragment-strong').length).toBeGreaterThan(0);
    await wait(2600);
    expect(win().querySelectorAll('.marked-fields .fragment-strong')).toHaveLength(0);
  });

  it('(f) the card of an error has no button that marks an object: the line of the judge is text, and "Show the issue" is the one way from the card (owner trial 2026-11-16)', () => {
    const decide = win().querySelector('.decide-pane') as HTMLElement;
    expect(decide.querySelectorAll('.judge-says button')).toHaveLength(0);
    expect(within(decide).queryByRole('button', { name: /^F\d · Judge/ })).toBeNull();
    expect(within(decide).queryByRole('button', { name: /in the reply$/ })).toBeNull();
    expect(line('claims[]#1').textContent).toMatch(/^F1 · Judge: “Anna is a doctor\.” \(matches\)$/);
    // the line still takes the mark when its block is pressed
    fireEvent.click(block('claims[]#1'));
    expect(line('claims[]#1').classList.contains('pointed')).toBe(true);
  });
});
