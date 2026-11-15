// FR-089 and T254: "Edit expected errors" is on every case, in the standard large dialog, with the JSON of the list only.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
/** Finalized; the clean case has a reply, the case with errors has none. */
const finalized = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, replies: { '1': e.replies['1']! }, decisions: {} } };
};
const show = (state = finalized()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const open = (name: string) => fireEvent.click(within(screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement).getByRole('button', { name: 'Open' }));
const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit expected errors' }));
const dialog = () => screen.getByRole('dialog', { name: 'Edit expected errors' });
const box = () => within(dialog()).getByLabelText('Expected errors') as HTMLTextAreaElement;
const save = () => within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('Edit expected errors', () => {
  it('is offered on every case, with or without a reply, finalized or not', () => {
    show();
    open('Anna + 2 errors');
    expect(screen.getByRole('button', { name: 'Edit expected errors' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    open('Anna');
    expect(screen.getByRole('button', { name: 'Edit expected errors' })).toBeTruthy();
    expect(screen.queryByText(/has a reply/)).toBeNull();
    const e = sampleEvaluation();
    const draft: AppState = { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {} } };
    show(draft);
  });

  it('opens the standard large dialog with the JSON of the list only, with identifiers, and Save and Cancel at the bottom', () => {
    show();
    open('Anna + 2 errors');
    edit();
    expect(dialog().classList.contains('dialog-wide')).toBe(true);
    const items = JSON.parse(box().value) as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveProperty('id');
    expect(box().value).not.toContain('source_text');
    expect(within(dialog().querySelector('.dialog-actions') as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Save']);
    expect(save().disabled).toBe(true);
    expect(within(dialog()).getByText('Change the JSON to save.')).toBeTruthy();
  });

  it('checks the JSON as it changes: a problem has its path and blocks Save; a valid change enables it', () => {
    show();
    open('Anna + 2 errors');
    edit();
    const items = JSON.parse(box().value);
    fireEvent.input(box(), { target: { value: JSON.stringify([{ ...items[0], description: '' }, items[1]]) } });
    expect(within(dialog()).getByText(/expected_errors\[0\]\.description/)).toBeTruthy();
    expect(save().disabled).toBe(true);
    fireEvent.input(box(), { target: { value: '[ {' } });
    expect(within(dialog()).getByText(/Line 1, column/)).toBeTruthy();
    items[1].difficulty = items[1].difficulty === 'subtle' ? 'obvious' : 'subtle';
    fireEvent.input(box(), { target: { value: JSON.stringify(items) } });
    expect(save().disabled).toBe(false);
  });

  it('saves a case without a reply at once, with no question, and closes', () => {
    show();
    open('Anna + 2 errors');
    edit();
    const items = JSON.parse(box().value);
    items[1].difficulty = items[1].difficulty === 'subtle' ? 'obvious' : 'subtle';
    fireEvent.input(box(), { target: { value: JSON.stringify(items) } });
    fireEvent.click(save());
    expect(screen.queryByRole('dialog', { name: 'Edit expected errors' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Save the expected errors?' })).toBeNull();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('for a case with a reply Save asks first: the marks of changed and removed errors are dropped, and Cancel keeps everything', () => {
    const e = sampleEvaluation();
    const withReply: AppState = { ...createState(), step: 'cases', evaluation: { ...e, decisions: { '2': { expected: { e1: { state: 'found', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' } } } };
    show(withReply);
    open('Anna + 2 errors');
    edit();
    const items = JSON.parse(box().value);
    items[0].difficulty = items[0].difficulty === 'subtle' ? 'obvious' : 'subtle';
    fireEvent.input(box(), { target: { value: JSON.stringify(items) } });
    fireEvent.click(save());
    const ask = screen.getByRole('dialog', { name: 'Save the expected errors?' });
    expect(ask.textContent).toContain('This case has a reply. 1 mark you set for changed or removed errors is dropped, the case is marked again from the reply, and the test cases version changes.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Save the expected errors?' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Edit expected errors' })).toBeTruthy();
    fireEvent.click(save());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save the expected errors?' })).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog', { name: 'Edit expected errors' })).toBeNull();
  });

  it('Cancel closes the dialog and changes nothing', () => {
    show();
    open('Anna + 2 errors');
    edit();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Edit expected errors' })).toBeNull();
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });
});
