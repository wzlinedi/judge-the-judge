// The always visible reply box of the case window of Run (FR-055, FR-056, FR-084, SC-037).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const noReplies = (): TestProject => withRun(sampleProject(), { replies: {}, decisions: {}, reply_judge_version: undefined });
const open = (evaluation: TestProject, caseId = '1') =>
  render(<App ports={createFakePorts()} env={env} fileEnv={fileEnv} initialState={{ ...createState(), step: 'run', project: evaluation, openCase: caseId } as AppState} />);
const win = () => screen.getByRole('dialog', { name: /^Case / });
const box = () => within(win()).getByRole('textbox', { name: 'Judge reply' }) as HTMLTextAreaElement;
const type = (text: string) => fireEvent.input(box(), { target: { value: text } });
const saveAnyway = () => within(win()).queryByRole('button', { name: 'Keep as text' });
const json = '{"claims": []}';

describe('the reply box', () => {
  it('is always visible, without a reply and with one, and never inside a collapsed section', () => {
    const view = open(noReplies());
    expect(box().value).toBe('');
    expect(box().closest('details')).toBeNull();
    view.unmount();
    open(sampleProject(), '2');
    // a saved reply is read-only (T293), never behind a collapsed section
    expect(within(win()).queryByRole('textbox', { name: 'Judge reply' })).toBeNull();
    expect(win().querySelector('.reply-read')?.textContent).toContain('Anna is a doctor.');
    expect(win().querySelector('.reply-read')?.closest('details')).toBeNull();
  });

  it('is checked as the text changes: no message when it reads, or the line and column of the problem', () => {
    open(noReplies());
    type('{"claims": [');
    expect(within(win()).getByText(/Line 1, column/)).toBeTruthy();
    type('{"claims": []}');
    expect(within(win()).queryByText(/This is not JSON/)).toBeNull();
    expect(within(win()).queryByText('Readable JSON')).toBeNull();
    type('{\n  "claims": [\n    1,,\n  ]\n}');
    expect(within(win()).getByText(/Line 3, column/)).toBeTruthy();
  });

  it('reads JSON inside a code fence or other text as readable', () => {
    open(noReplies());
    type('Here is my answer:\n```json\n{"claims": []}\n```\nBye');
    expect(within(win()).queryByText(/This is not JSON/)).toBeNull();
  });

  it('has no Save reply: a reply that is readable JSON is saved as soon as it is in the box', async () => {
    open(noReplies());
    expect(within(win()).queryByRole('button', { name: 'Save reply' })).toBeNull();
    expect(saveAnyway()).toBeNull();
    type(json);
    await waitFor(() => expect(within(win()).getByText('1 not saved')).toBeTruthy());
    // the saved reply is shown read-only and formatted (T292, T293)
    expect(within(win()).queryByRole('textbox', { name: 'Judge reply' })).toBeNull();
    expect(win().querySelector('.reply-read')?.textContent).toBe(JSON.stringify(JSON.parse(json), null, 2));
    expect(saveAnyway()).toBeNull();
  });

  it('says "This is not JSON" with the place of the problem, and offers Keep as text as the primary action', () => {
    open(noReplies());
    type('{\n  "claims": [\n    1,,\n  ]\n}');
    expect(within(win()).getByText(/Line 3, column \d+: This is not JSON\./)).toBeTruthy();
    expect(saveAnyway()?.classList.contains('primary')).toBe(true);
    expect(within(win()).getByRole('button', { name: 'Copy prompt' }).classList.contains('primary')).toBe(false);
    expect(win().querySelectorAll('button.primary:not([disabled])')).toHaveLength(1);
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
  });

  it('does not save text that is not JSON by itself, and keeps it until Keep as text', async () => {
    open(noReplies());
    type('It seems fine to me.');
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
    fireEvent.click(saveAnyway() as HTMLElement);
    await waitFor(() => expect(within(win()).getByText('1 not saved')).toBeTruthy());
    expect(win().querySelector('.reply-read')?.textContent).toBe('It seems fine to me.');
    expect(win().querySelectorAll('[data-finding-block]')).toHaveLength(0);
    expect(saveAnyway()).toBeNull();
  });

  it('offers nothing for an empty box and for the saved reply', () => {
    open(noReplies());
    expect(saveAnyway()).toBeNull();
    type('   ');
    expect(saveAnyway()).toBeNull();
  });

  it('keeps a draft per case while the window stays on that case', () => {
    open(noReplies());
    type('draft one');
    expect(box().value).toBe('draft one');
  });
});

// R10 (code review 2026-11-16, Clarifications 2026-11-16): a reply that is pasted is saved at once; text typed one character at a time is
// saved when the box loses the focus, so a first "{}" or "1" does not save an empty reply.
describe('typing a reply by hand (R10)', () => {
  it('saves nothing while the text is typed one character at a time, even when it already is readable JSON', async () => {
    open(noReplies());
    type('{');
    type('{}');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(win().querySelector('.reply-read')).toBeNull();
    expect(box().value).toBe('{}');
    type('1');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(win().querySelector('.reply-read')).toBeNull();
  });

  it('saves the whole text when the box loses the focus and the text is readable JSON', async () => {
    open(noReplies());
    type('{}');
    type('{"claims": []}');
    fireEvent.blur(box());
    await waitFor(() => expect(win().querySelector('.reply-read')).not.toBeNull());
  });

  it('does not save text that is not JSON when the box loses the focus', async () => {
    open(noReplies());
    type('half a reply');
    fireEvent.blur(box());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(win().querySelector('.reply-read')).toBeNull();
  });

  it('saves a text that is put in by one change (a paste or a drop), at once', async () => {
    open(noReplies());
    type(json);
    await waitFor(() => expect(win().querySelector('.reply-read')).not.toBeNull());
  });

  it('asks before leaving the case with text that is readable JSON and not saved yet (FR-055)', () => {
    open(noReplies());
    type('{}');
    fireEvent.click(within(win()).getByRole('button', { name: 'Next case' }));
    expect(screen.getByRole('dialog', { name: 'The reply in the box is not saved' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard reply' })).toBeTruthy();
  });
});


// S4 (code review 2026-11-16): a reply above 200,000 characters is not saved, and the box says why.
const replyOfLength = (length: number) => {
  const frame = '{"claims": [], "note": ""}';
  return `{"claims": [], "note": "${'x'.repeat(length - frame.length)}"}`;
};

describe('a reply that is too long (S4)', () => {
  it('is not saved when it is pasted, and the box says how long it is and what the limit is', async () => {
    open(noReplies());
    type(replyOfLength(200_001));
    const length = box().value.length;
    expect(length).toBe(200_001);
    await waitFor(() => expect(within(win()).getByText('The reply is 200,001 characters; the tool keeps replies up to 200,000 characters.')).toBeTruthy());
    expect(win().querySelector('.reply-read')).toBeNull();
  });

  it('saves a reply of exactly 200,000 characters', async () => {
    open(noReplies());
    type(replyOfLength(200_000));
    await waitFor(() => expect(win().querySelector('.reply-read')).not.toBeNull());
  });
});
