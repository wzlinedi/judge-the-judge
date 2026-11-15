// The always visible reply box of the case window of Run (FR-055, FR-056, FR-084, SC-037).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { Evaluation } from '../../../src/core/model';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const noReplies = (): Evaluation => ({ ...sampleEvaluation(), replies: {}, decisions: {}, reply_judge_version: undefined });
const open = (evaluation: Evaluation, caseId = '1') =>
  render(<App ports={createFakePorts()} env={env} fileEnv={fileEnv} initialState={{ ...createState(), step: 'run', evaluation, openCase: caseId } as AppState} />);
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
    open(sampleEvaluation(), '2');
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
