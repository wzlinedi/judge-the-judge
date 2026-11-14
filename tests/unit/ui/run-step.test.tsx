// US7 on the Run step and in the case window of Run (FR-054 to FR-059, FR-084).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { RunStep } from '../../../src/ui/steps/run/RunStep';
import { createFakeClipboard, createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import type { Evaluation } from '../../../src/core/model';
import { accuracyMetric, sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const noReplies = (): Evaluation => ({ ...sampleEvaluation(), replies: {}, decisions: {}, reply_judge_version: undefined });
const stateOn = (evaluation: Evaluation, extra: Partial<AppState> = {}): AppState => ({ ...createState(), step: 'run', evaluation, ...extra });
const renderApp = (ports: FakePorts, state: AppState) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={state} />);
const windowOf = () => screen.getByRole('dialog', { name: /^Case / });
const replyBox = () => within(windowOf()).getByRole('textbox', { name: 'Judge reply' }) as HTMLTextAreaElement;
const reply = '{"claims":[{"text":"Anna is a baker.","verdict":"supported","reason":"x"}]}';

describe('the Run step', () => {
  const evaluation = sampleEvaluation();
  const props = {
    evaluation,
    reviewed: reviewEvaluation(evaluation, accuracyMetric),
    fileName: null,
    repliesSinceSave: 3,
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onModelDetails: vi.fn(),
  };

  it('shows one summary line of the judge: judge version, test project name, test cases version, judged text', async () => {
    render(<RunStep {...props} />);
    const summary = screen.getByRole('region', { name: 'Judge being run' });
    await waitFor(() => expect(summary.textContent).toMatch(/Judge version [0-9a-f]{12}/));
    expect(summary.textContent).toMatch(/Test project Book summaries/);
    expect(summary.textContent).toMatch(/Test cases version [0-9a-f]{12}/);
    expect(summary.textContent).toMatch(/Judged text summary/);
    expect(summary.querySelectorAll('p')).toHaveLength(1);
  });

  it('does not repeat the prompt or the error rules in the summary', async () => {
    render(<RunStep {...props} />);
    const summary = screen.getByRole('region', { name: 'Judge being run' });
    await waitFor(() => expect(summary.textContent).toMatch(/Judge version [0-9a-f]{12}/));
    expect(summary.textContent).not.toContain('SUMMARY:');
    expect(summary.textContent).not.toContain('Contradicted or unsupported claim');
  });

  it('has a multi-line Model details box that keeps its lines', () => {
    render(<RunStep {...props} />);
    const box = screen.getByLabelText('Model details') as HTMLTextAreaElement;
    expect(box.tagName).toBe('TEXTAREA');
    expect(box.value).toBe('model X\ntemperature 0');
    fireEvent.input(box, { target: { value: 'model Y\ntemperature 1\ntop_p 0.9' } });
    expect(props.onModelDetails).toHaveBeenCalledWith('model Y\ntemperature 1\ntop_p 0.9');
  });

  it('has the Evaluation file card with Save evaluation and Save evaluation as', () => {
    render(<RunStep {...props} fileName="run.json" />);
    const card = screen.getByRole('region', { name: 'Evaluation file' });
    expect(within(card).getByRole('button', { name: 'Save evaluation' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Save evaluation as…' })).toBeTruthy();
    expect(card.textContent).toContain('run.json');
  });

  it('says how many replies are not saved to a file, and reminds the user to save from 25', () => {
    const { rerender } = render(<RunStep {...props} repliesSinceSave={24} />);
    expect(screen.getByText('24 replies not saved to a file')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<RunStep {...props} repliesSinceSave={25} />);
    const reminder = screen.getByRole('alert');
    expect(reminder.textContent).toMatch(/25 replies/);
    expect(reminder.textContent).toContain('Save evaluation');
  });

  it('says "1 reply" for one', () => {
    render(<RunStep {...props} repliesSinceSave={1} />);
    expect(screen.getByText('1 reply not saved to a file')).toBeTruthy();
  });
});

describe('the "what next" line on Run', () => {
  it('shows the progress, the new-conversation reminder and Continue', () => {
    renderApp(createFakePorts(), stateOn(noReplies()));
    const next = screen.getByRole('region', { name: 'What next' });
    expect(within(next).getByText('0 of 2 cases decided')).toBeTruthy();
    expect(next.textContent).toMatch(/new conversation/);
    expect(within(next).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });
});

describe('a test project that is not finalized', () => {
  it('has no Run step: it says what to do first', () => {
    const e = noReplies();
    renderApp(createFakePorts(), stateOn({ ...e, dataset: { ...e.dataset, finalized: false } }));
    expect(screen.getByText(/Run needs finalized test cases/)).toBeTruthy();
    expect(screen.queryByLabelText('Model details')).toBeNull();
  });
});

describe('the case window of Run, without a reply', () => {
  const open = (ports = createFakePorts(), evaluation = noReplies()) => renderApp(ports, stateOn(evaluation, { openCase: '1' }));

  it('shows "Judge reply" with only Paste reply above the always visible box: no steps, no Save reply, no "More actions" (T235)', () => {
    open();
    const win = windowOf();
    expect(within(win).getByRole('heading', { name: 'Judge reply', level: 4 })).toBeTruthy();
    expect(win.querySelector('ol.steps')).toBeNull();
    expect(win.querySelectorAll('details')).toHaveLength(0);
    expect(replyBox().value).toBe('');
    const pane = win.querySelector('.reply-pane') as HTMLElement;
    expect(within(pane).getAllByRole('button').map((b) => b.textContent)).toEqual(['Paste reply']);
    expect(within(win).queryByRole('button', { name: 'Save reply' })).toBeNull();
    expect(win.textContent).not.toMatch(/More actions|Readable JSON/);
  });

  it('part 1 has Show prompt, which opens the whole prompt with only Close, and Copy prompt (T235)', () => {
    open();
    const win = windowOf();
    const part = win.querySelector('.case-part') as HTMLElement;
    expect(within(part).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
    fireEvent.click(within(part).getByRole('button', { name: 'Show prompt' }));
    const dialog = screen.getByRole('dialog', { name: 'Complete judge prompt' });
    expect((within(dialog).getByRole('textbox', { name: 'Complete judge prompt' }) as HTMLTextAreaElement).value).toContain('SUMMARY');
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
  });

  it('makes Copy prompt the primary button until it was pressed for this case, then Paste reply', () => {
    open();
    const win = windowOf();
    const copy = within(win).getByRole('button', { name: 'Copy prompt' });
    const paste = within(win).getByRole('button', { name: 'Paste reply' });
    expect(copy.classList.contains('primary')).toBe(true);
    expect(paste.classList.contains('primary')).toBe(false);
    fireEvent.click(copy);
    expect(within(win).getByRole('button', { name: 'Copy prompt' }).classList.contains('primary')).toBe(false);
    expect(within(win).getByRole('button', { name: 'Paste reply' }).classList.contains('primary')).toBe(true);
  });

  it('puts the header in order: Previous, position, Next, status, the unsaved count, Save evaluation and Save evaluation as', () => {
    open(createFakePorts(), noReplies());
    const win = windowOf();
    for (const name of ['Previous case', 'Next case', 'Save evaluation', 'Save evaluation as…']) expect(within(win).getByRole('button', { name })).toBeTruthy();
    expect(within(win).getByText('1 of 2')).toBeTruthy();
    expect(within(win).getByText(/Not run/)).toBeTruthy();
    expect(within(win).getByText('0 not saved')).toBeTruthy();
  });

  it('saves the reply by the paste itself, shows the marks under it and counts it as not saved', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard(reply);
    open(ports);
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Paste reply' }));
    await waitFor(() => expect(replyBox().value).toBe(reply));
    expect(within(windowOf()).getByText('1 not saved')).toBeTruthy();
    expect(within(windowOf()).getByText(/Pass/)).toBeTruthy();
    expect(within(windowOf()).queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(within(windowOf()).getByText(/Marked \d+ of \d+/)).toBeTruthy();
  });

  it('explains an empty clipboard and changes nothing', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('');
    open(ports);
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Paste reply' }));
    expect(await within(windowOf()).findByText(/clipboard is empty/i)).toBeTruthy();
    expect(replyBox().value).toBe('');
    expect(within(windowOf()).getByText('0 not saved')).toBeTruthy();
  });

  it('points to the box when the clipboard is refused', async () => {
    const ports = createFakePorts();
    const clipboard = createFakeClipboard(reply);
    clipboard.refuse = true;
    ports.clipboard = clipboard;
    open(ports);
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Paste reply' }));
    expect(await within(windowOf()).findByText(/Paste the reply into the box with Ctrl\+V/)).toBeTruthy();
    expect(replyBox().value).toBe('');
  });
});

describe('replacing a reply', () => {
  const open = (caseId: string, ports = createFakePorts()) => renderApp(ports, stateOn(sampleEvaluation(), { openCase: caseId }));

  it('does not ask when the case has only automatic decisions', async () => {
    const ports = createFakePorts();
    open('1', ports);
    fireEvent.input(replyBox(), { target: { value: '{"claims": []}' } });
    await waitFor(() => expect(within(windowOf()).getByText('1 not saved')).toBeTruthy());
    expect(screen.queryByRole('dialog', { name: /Replace/ })).toBeNull();
    expect(replyBox().value).toBe('{"claims": []}');
  });

  it('asks when the case has decisions by hand, naming how many, and keeps everything on Cancel', async () => {
    open('2');
    fireEvent.input(replyBox(), { target: { value: '{"claims": []}' } });
    const question = await screen.findByRole('dialog', { name: /Replace this reply/ });
    expect(question.textContent).toMatch(/2 decisions/);
    fireEvent.click(within(question).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: /Replace this reply/ })).toBeNull();
    expect(within(windowOf()).getByText('0 not saved')).toBeTruthy();
    expect(replyBox().value).toBe('{"claims": []}');
  });

  it('replaces the reply after the question, which resets the case', async () => {
    open('2');
    fireEvent.input(replyBox(), { target: { value: '{"claims": []}' } });
    const question = await screen.findByRole('dialog', { name: /Replace this reply/ });
    fireEvent.click(within(question).getByRole('button', { name: 'Replace reply' }));
    await waitFor(() => expect(within(windowOf()).getByText('1 not saved')).toBeTruthy());
    expect(screen.queryByText('The oven was never bought')).toBeNull();
    // the new reply holds no findings, so the automatic marks put every expected error as missed
    expect(within(windowOf()).getAllByText(/Fail/).length).toBeGreaterThan(0);
  });

  it('asks the same question for a paste from the clipboard', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('pasted reply');
    open('2', ports);
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Paste reply' }));
    const question = await screen.findByRole('dialog', { name: /Replace this reply/ });
    fireEvent.click(within(question).getByRole('button', { name: 'Replace reply' }));
    await waitFor(() => expect(replyBox().value).toBe('pasted reply'));
  });

  it('changes nothing when the box gets the reply that is already saved', async () => {
    open('1');
    fireEvent.input(replyBox(), { target: { value: sampleEvaluation().replies['1']!.reply } });
    expect(within(windowOf()).getByText('0 not saved')).toBeTruthy();
  });
});

describe('moving or closing with a reply that was typed and not saved', () => {
  const open = () => renderApp(createFakePorts(), stateOn(noReplies(), { openCase: '1' }));
  const type = (text: string) => fireEvent.input(replyBox(), { target: { value: text } });
  const guard = () => screen.findByRole('dialog', { name: /not saved/ });

  it('asks before Next case, and stays on the case when the user cancels', async () => {
    open();
    type('half a reply');
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Next case' }));
    const question = await guard();
    fireEvent.click(within(question).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: /^Case 1/ })).toBeTruthy();
    expect(replyBox().value).toBe('half a reply');
  });

  it('moves on and drops the draft when the user discards it', async () => {
    open();
    type('half a reply');
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Next case' }));
    fireEvent.click(within(await guard()).getByRole('button', { name: 'Discard reply' }));
    expect(screen.getByRole('dialog', { name: /^Case 2/ })).toBeTruthy();
    expect(replyBox().value).toBe('');
  });

  it('asks on Alt + Right and on Close too', async () => {
    open();
    type('half a reply');
    fireEvent.keyDown(document, { key: 'ArrowRight', altKey: true });
    fireEvent.click(within(await guard()).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Close' }));
    fireEvent.click(within(await guard()).getByRole('button', { name: 'Discard reply' }));
    expect(screen.queryByRole('dialog', { name: /^Case 1/ })).toBeNull();
  });

  it('moves without asking when nothing was typed', () => {
    open();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Next case' }));
    expect(screen.getByRole('dialog', { name: /^Case 2/ })).toBeTruthy();
  });
});

describe('the reminder in the case window', () => {
  it('shows the count and, from 25, a reminder that names Save evaluation', () => {
    renderApp(createFakePorts(), stateOn(sampleEvaluation(), { openCase: '1', repliesSinceSave: 25 }));
    const win = windowOf();
    expect(within(win).getByText('25 not saved')).toBeTruthy();
    expect(within(win).getByRole('alert').textContent).toContain('Save evaluation');
  });
});
