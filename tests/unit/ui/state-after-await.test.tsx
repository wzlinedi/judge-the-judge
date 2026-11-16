// R1, R2 (code review 2026-11-16; research.md 34, "State after an await"): an action that waits for a file or the clipboard must not
// write back the state it started with. What the user did in the meantime stays.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { saveReply } from '../../../src/app/actions/replies';
import type { TestProject } from '../../../src/core/model';
import { sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };

const noReplies = (): TestProject => withRun(sampleProject(), { replies: {}, decisions: {}, reply_judge_version: undefined });
const renderApp = (ports: FakePorts, state: Partial<AppState>) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={{ ...createState(), ...state } as AppState} />);

/** A promise that the test settles itself, to hold a port busy while the user acts. */
function gate() {
  let release!: () => void;
  const open = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { open, release };
}

const holdSave = (ports: FakePorts) => {
  const held = gate();
  const save = ports.testProjectTarget.save.bind(ports.testProjectTarget);
  ports.testProjectTarget.save = async (text) => {
    await held.open;
    return save(text);
  };
  return held;
};

const holdClipboard = (ports: FakePorts) => {
  const held = gate();
  const read = ports.clipboard.readText.bind(ports.clipboard);
  ports.clipboard.readText = async () => {
    await held.open;
    return read();
  };
  return held;
};

const modelDetails = () => screen.getByLabelText('Model details') as HTMLTextAreaElement;
const win = () => screen.getByRole('dialog', { name: /^Case / });

describe('Save test project', () => {
  it('keeps what the user changed while the file was written, and the indicator still says "Unsaved changes"', async () => {
    const ports = createFakePorts();
    const held = holdSave(ports);
    renderApp(ports, { step: 'run', project: sampleProject(), unsaved: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    fireEvent.input(modelDetails(), { target: { value: 'changed while saving' } });
    held.release();
    await waitFor(() => expect(ports.testProjectTarget.lastText).not.toBeNull());
    await waitFor(() => expect(screen.getByText('test-project.json')).toBeTruthy());
    expect(modelDetails().value).toBe('changed while saving');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.queryByText(/^All changes saved/)).toBeNull();
  });

  it('shows "All changes saved" when nothing changed while the file was written', async () => {
    const ports = createFakePorts();
    const held = holdSave(ports);
    renderApp(ports, { step: 'run', project: sampleProject(), unsaved: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    held.release();
    await waitFor(() => expect(screen.getByText('All changes saved (test-project.json)')).toBeTruthy());
  });
});

describe('Paste reply', () => {
  it('keeps the case the user moved to while the browser asked for the clipboard', async () => {
    const ports = createFakePorts();
    ports.clipboard.text = '{"claims": []}';
    const held = holdClipboard(ports);
    renderApp(ports, { step: 'run', project: noReplies(), openCase: '1' });
    fireEvent.click(within(win()).getByRole('button', { name: 'Paste reply' }));
    fireEvent.click(within(win()).getByRole('button', { name: 'Next case' }));
    await waitFor(() => expect(win().getAttribute('aria-label') ?? win().textContent).toContain('2'));
    held.release();
    await waitFor(() => expect(ports.clipboard.text).toBe('{"claims": []}'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(win().textContent).toContain('Anna + 2 errors');
    expect(win().textContent).not.toMatch(/Case 1\b/);
  });

  it('saves the reply in the case it was pasted in, even when the user moved on', async () => {
    const ports = createFakePorts();
    ports.clipboard.text = '{"claims": []}';
    const held = holdClipboard(ports);
    renderApp(ports, { step: 'run', project: noReplies(), openCase: '1' });
    fireEvent.click(within(win()).getByRole('button', { name: 'Paste reply' }));
    fireEvent.click(within(win()).getByRole('button', { name: 'Next case' }));
    held.release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.click(within(win()).getByRole('button', { name: 'Previous case' }));
    await waitFor(() => expect(win().querySelector('.reply-read')).not.toBeNull());
  });
});

describe('two replies that were being saved at the same time', () => {
  it('both stay, whichever ends first', async () => {
    const start: AppState = { ...createState(), step: 'run', project: noReplies() };
    const first = await saveReply(start, '1', '{"claims": []}');
    const second = await saveReply(start, '2', '{"claims": []}');
    const both = second.apply!(first.apply!(start));
    expect(Object.keys(both.project.testRun!.replies).sort()).toEqual(['1', '2']);
    expect(both.repliesSinceSave).toBe(2);
    const reverse = first.apply!(second.apply!(start));
    expect(Object.keys(reverse.project.testRun!.replies).sort()).toEqual(['1', '2']);
  });
});
