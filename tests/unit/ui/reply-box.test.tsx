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
const saveAnyway = () => within(win()).queryByRole('button', { name: 'Save as text anyway' });
const json = '{"claims": []}';

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

  it('has no Save reply: a reply that is readable JSON is saved as soon as it is in the box', async () => {
    open(noReplies());
    expect(within(win()).queryByRole('button', { name: 'Save reply' })).toBeNull();
    expect(saveAnyway()).toBeNull();
    type(json);
    await waitFor(() => expect(within(win()).getByText('1 not saved')).toBeTruthy());
    expect(box().value).toBe(json);
    expect(saveAnyway()).toBeNull();
  });

  it('says "This is not JSON" with the place of the problem, and offers Save as text anyway as the primary action', () => {
    open(noReplies());
    type('{\n  "claims": [\n    1,,\n  ]\n}');
    expect(within(win()).getByText(/Line 3, column \d+: This is not JSON\./)).toBeTruthy();
    expect(saveAnyway()?.classList.contains('primary')).toBe(true);
    expect(within(win()).getByRole('button', { name: 'Copy prompt' }).classList.contains('primary')).toBe(false);
    expect(win().querySelectorAll('button.primary:not([disabled])')).toHaveLength(1);
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
  });

  it('does not save text that is not JSON by itself, and keeps it until Save as text anyway', async () => {
    open(noReplies());
    type('It seems fine to me.');
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
    fireEvent.click(saveAnyway() as HTMLElement);
    await waitFor(() => expect(within(win()).getByText('1 not saved')).toBeTruthy());
    expect(box().value).toBe('It seems fine to me.');
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
