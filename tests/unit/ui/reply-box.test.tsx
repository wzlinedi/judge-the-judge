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
const saveButton = () => within(win()).getByRole('button', { name: 'Save reply' });

describe('the reply box', () => {
  it('is always visible, without a reply and with one, and never inside a collapsed section', () => {
    const view = open(noReplies());
    expect(box().value).toBe('');
    expect(box().closest('details')).toBeNull();
    view.unmount();
    open(sampleEvaluation(), '2');
    expect(box().value).toContain('Anna is a doctor.');
    expect(box().closest('details')).toBeNull();
  });

  it('is checked as the text changes: "Readable JSON", or the line and column of the problem', () => {
    open(noReplies());
    type('{"claims": [');
    expect(within(win()).getByText(/Line 1, column/)).toBeTruthy();
    type('{"claims": []}');
    expect(within(win()).getByText('Readable JSON')).toBeTruthy();
    type('{\n  "claims": [\n    1,,\n  ]\n}');
    expect(within(win()).getByText(/Line 3, column/)).toBeTruthy();
    expect(within(win()).queryByText('Readable JSON')).toBeNull();
  });

  it('reads JSON inside a code fence or other text as readable', () => {
    open(noReplies());
    type('Here is my answer:\n```json\n{"claims": []}\n```\nBye');
    expect(within(win()).getByText('Readable JSON')).toBeTruthy();
  });

  it('makes Save reply the primary button while the text differs from the saved reply', () => {
    open(sampleEvaluation(), '1');
    expect(saveButton().classList.contains('primary')).toBe(false);
    type(box().value + ' ');
    expect(saveButton().classList.contains('primary')).toBe(true);
    type(sampleEvaluation().replies['1']!.reply);
    expect(saveButton().classList.contains('primary')).toBe(false);
  });

  it('makes Save reply the primary button for a new text in an empty box, ahead of Copy prompt and Paste', () => {
    open(noReplies());
    expect(saveButton().classList.contains('primary')).toBe(false);
    type('{"claims": []}');
    expect(saveButton().classList.contains('primary')).toBe(true);
    expect(within(win()).getByRole('button', { name: 'Copy prompt' }).classList.contains('primary')).toBe(false);
    expect(win().querySelectorAll('button.primary:not([disabled])')).toHaveLength(1);
  });

  it('explains an empty box when Save reply is pressed, and changes nothing', async () => {
    open(noReplies());
    fireEvent.click(saveButton());
    expect(await within(win()).findByText(/The reply is empty/)).toBeTruthy();
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
  });

  it('keeps a reply that is not JSON with the problem shown, marks nothing automatically and makes Approve the primary action', async () => {
    open(noReplies());
    type('I looked at the summary and it seems fine to me.');
    expect(within(win()).getByText(/no JSON/i)).toBeTruthy();
    fireEvent.click(saveButton());
    await waitFor(() => expect(within(win()).getByText('1 not saved')).toBeTruthy());
    expect(box().value).toBe('I looked at the summary and it seems fine to me.');
    expect(within(win()).getByText(/Awaiting verification/)).toBeTruthy();
    expect(win().querySelector('[aria-pressed="true"]')).toBeNull();
    expect(within(win()).getByRole('button', { name: 'Approve' }).classList.contains('primary')).toBe(true);
    expect(within(win()).getByText(/could not be read/)).toBeTruthy();
  });

  it('keeps the text it was given when the check finds a problem, and saves nothing by itself', () => {
    open(noReplies());
    type('{"claims": [');
    expect(box().value).toBe('{"claims": [');
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
  });

  it('keeps a draft per case while the window stays on that case', () => {
    open(noReplies());
    type('draft one');
    expect(box().value).toBe('draft one');
  });
});
