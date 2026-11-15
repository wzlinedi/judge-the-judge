// US7 on the Run step and in the case window of Run (FR-054 to FR-059, FR-084).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { RunStep } from '../../../src/ui/steps/run/RunStep';
import { createFakeClipboard, createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import type { TestProject } from '../../../src/core/model';
import { withoutTestRun } from '../../../src/core/cases/test-run';
import { accuracyMetric, sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const noReplies = (): TestProject => withRun(sampleProject(), { replies: {}, decisions: {}, reply_judge_version: undefined });
const stateOn = (evaluation: TestProject, extra: Partial<AppState> = {}): AppState => ({ ...createState(), step: 'run', project: evaluation, ...extra });
const renderApp = (ports: FakePorts, state: AppState) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={state} />);
const windowOf = () => screen.getByRole('dialog', { name: /^Case / });
const replyBox = () => within(windowOf()).getByRole('textbox', { name: 'Judge reply' }) as HTMLTextAreaElement;
const reply = '{"claims":[{"text":"Anna is a baker.","verdict":"supported","reason":"x"}]}';

describe('the Run step', () => {
  const evaluation = sampleProject();
  const props = {
    evaluation,
    reviewed: reviewEvaluation(evaluation, accuracyMetric),
    repliesSinceSave: 3,
    onOpen: vi.fn(),
    onAdd: vi.fn(),
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

  it('has no save button and no Evaluation file card: saving is in the page header (T242)', () => {
    render(<RunStep {...props} />);
    expect(screen.queryByRole('region', { name: 'Evaluation file' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Save evaluation/ })).toBeNull();
  });

  it('says how many replies are not saved to a file, and reminds the user to save from 25', () => {
    const { rerender } = render(<RunStep {...props} repliesSinceSave={24} />);
    expect(screen.getByText('24 replies not saved to a file')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<RunStep {...props} repliesSinceSave={25} />);
    const reminder = screen.getByRole('alert');
    expect(reminder.textContent).toMatch(/25 replies/);
    expect(reminder.textContent).toContain('Save test project');
  });

  // T263: four counts per case (FR-054), all 0 before the reply
  it('shows four counts per case: Expected errors, Additional findings, Added by hand and Items to decide', () => {
    render(<RunStep {...props} />);
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.slice(3, 8)).toEqual(['Expected errors', 'Additional findings', 'Added by hand', 'Status', 'Items to decide']);
    const rows = within(table).getAllByRole('row').slice(1);
    props.reviewed.forEach((r, i) => {
      const cells = within(rows[i]!).getAllByRole('cell').map((c) => c.textContent);
      const additional = r.effective?.additional ?? [];
      expect(cells[3]).toBe(String(r.testCase.expected_errors.length));
      expect(cells[4]).toBe(String(additional.filter((a) => a.added === undefined).length));
      expect(cells[5]).toBe(String(additional.filter((a) => a.added !== undefined).length));
    });
  });

  it('shows 0 in all counts of a case that has no reply yet, and counts hand-added findings apart from the judge\'s', () => {
    const base = sampleProject();
    const firstId = base.dataset.cases[0]!.id;
    const none: TestProject = withRun(base, { replies: {}, decisions: {}, reply_judge_version: undefined });
    render(<RunStep {...props} evaluation={none} reviewed={reviewEvaluation(none, accuracyMetric)} />);
    const row = within(screen.getByRole('table')).getAllByRole('row')[1]!;
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[0]).toBe(firstId);
    expect([cells[4], cells[5], cells[7]]).toEqual(['0', '0', '0']);
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

describe('a test run that has not started', () => {
  it('shows the Test run step with its actions disabled and says why (T306 b)', () => {
    renderApp(createFakePorts(), stateOn(withoutTestRun(noReplies())));
    expect((screen.getByLabelText('Model details') as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getAllByText('Start the test run first').length).toBeGreaterThan(0);
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

  it('puts the header in order: Previous, position, Next, status and the unsaved count, with no save button (T242)', () => {
    open(createFakePorts(), noReplies());
    const win = windowOf();
    for (const name of ['Previous case', 'Next case']) expect(within(win).getByRole('button', { name })).toBeTruthy();
    expect(within(win).queryByRole('button', { name: /^Save evaluation/ })).toBeNull();
    expect(within(win).getByText('1 of 2')).toBeTruthy();
    expect(within(win).getByText(/Not run/)).toBeTruthy();
    expect(within(win).getByText('0 not saved')).toBeTruthy();
  });

  it('saves the reply by the paste itself, shows the marks under it and counts it as not saved', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard(reply);
    open(ports);
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Paste reply' }));
    await waitFor(() => expect((windowOf().querySelector('.reply-read') as HTMLElement).textContent).toBe(JSON.stringify(JSON.parse(reply), null, 2)));
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

describe('changing a saved reply (T261, T293)', () => {
  const open = (caseId: string, ports = createFakePorts()) => renderApp(ports, stateOn(sampleProject(), { openCase: caseId }));
  const question = () => screen.findByRole('dialog', { name: 'Change the judge’s reply?' });
  const readOnly = () => windowOf().querySelector('.reply-read') as HTMLElement;
  const change = () => fireEvent.click(within(windowOf().querySelector('.reply-pane') as HTMLElement).getByRole('button', { name: 'Change reply' }));
  const save = () => fireEvent.click(within(windowOf().querySelector('.reply-pane') as HTMLElement).getByRole('button', { name: 'Save reply' }));

  it('asks first when Save reply is pressed, even when the case has only automatic decisions, and changes nothing on Cancel', async () => {
    open('1');
    const saved = readOnly().textContent;
    change();
    fireEvent.input(replyBox(), { target: { value: '{"claims": []}' } });
    expect(screen.queryByRole('dialog', { name: 'Change the judge’s reply?' })).toBeNull();
    save();
    const dialog = await question();
    expect(dialog.textContent).toMatch(/the results are counted from it/);
    expect(dialog.textContent).toMatch(/marked again from the changed text/);
    expect(dialog.textContent).not.toMatch(/you set/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Change the judge’s reply?' })).toBeNull();
    expect(replyBox().value).toBe('{"claims": []}');
    expect(within(windowOf()).getByText('0 not saved')).toBeTruthy();
    fireEvent.click(within(windowOf().querySelector('.reply-pane') as HTMLElement).getByRole('button', { name: 'Cancel' }));
    expect(readOnly().textContent).toBe(saved);
  });

  it('names the marks that are removed when the case has decisions by hand', async () => {
    open('2');
    change();
    fireEvent.input(replyBox(), { target: { value: '{"claims": []}' } });
    save();
    expect((await question()).textContent).toMatch(/The 2 marks you set .* are removed/);
  });

  it('after Change reply the change is saved and the read-only view returns; the next change asks again', async () => {
    open('2');
    change();
    fireEvent.input(replyBox(), { target: { value: '{"claims": []}' } });
    save();
    fireEvent.click(within(await question()).getByRole('button', { name: 'Change reply' }));
    await waitFor(() => expect(within(windowOf()).getByText('1 not saved')).toBeTruthy());
    expect(readOnly().textContent).toBe('{\n  "claims": []\n}');
    expect(screen.queryByText('The oven was never bought')).toBeNull();
    // the new reply holds no findings, so the automatic marks put every expected error as missed
    expect(within(windowOf()).getAllByText(/Fail/).length).toBeGreaterThan(0);
    change();
    fireEvent.input(replyBox(), { target: { value: '{"claims": [{"claim": "x"}]}' } });
    save();
    expect(await question()).toBeTruthy();
  });

  it('asks the same question for Paste reply over a saved reply', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('{"claims": []}');
    open('2', ports);
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Paste reply' }));
    fireEvent.click(within(await question()).getByRole('button', { name: 'Change reply' }));
    await waitFor(() => expect(readOnly().textContent).toBe('{\n  "claims": []\n}'));
  });

  it('changes nothing and does not ask when Save reply is pressed with the reply that is already saved', () => {
    open('1');
    const saved = readOnly().textContent;
    change();
    expect(replyBox().value).toBe(saved);
    save();
    expect(screen.queryByRole('dialog', { name: 'Change the judge’s reply?' })).toBeNull();
    expect(within(windowOf()).getByText('0 not saved')).toBeTruthy();
    expect(readOnly().textContent).toBe(saved);
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
  it('shows the count and, from 25, a reminder that names Save test project', () => {
    renderApp(createFakePorts(), stateOn(sampleProject(), { openCase: '1', repliesSinceSave: 25 }));
    const win = windowOf();
    expect(within(win).getByText('25 not saved')).toBeTruthy();
    expect(within(win).getByRole('alert').textContent).toContain('Save test project');
  });
});
