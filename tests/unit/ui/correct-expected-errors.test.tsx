// FR-089 and T254: "Edit expected errors" is on every case, in the standard large dialog, with the JSON of the list only.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleProject, withRun } from '../../helpers/fixtures';
import { withoutTestRun } from '../../../src/core/cases/test-run';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
/** Finalized; the clean case has a reply, the case with errors has none. */
const finalized = (): AppState => {
  const e = sampleProject();
  return { ...createState(), step: 'cases', project: withRun(e, { replies: { '1': e.testRun!.replies['1']! }, decisions: {} }) };
};
const show = (state = finalized()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const open = (name: string) => fireEvent.click(within(screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement).getByRole('button', { name: 'Open' }));
const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit expected errors' }));
const dialog = () => screen.getByRole('dialog', { name: 'Edit expected errors' });
const box = () => within(dialog()).getByLabelText('Expected errors') as HTMLTextAreaElement;
const save = () => within(dialog()).getByRole('button', { name: 'Save expected errors' }) as HTMLButtonElement;

describe('Edit expected errors', () => {
  it('is offered on every case, with or without a reply, finalized or not', () => {
    show();
    open('Anna + 2 errors');
    expect(screen.getByRole('button', { name: 'Edit expected errors' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    open('Anna');
    expect(screen.getByRole('button', { name: 'Edit expected errors' })).toBeTruthy();
    expect(screen.queryByText(/has a reply/)).toBeNull();
    const e = sampleProject();
    const draft: AppState = { ...createState(), step: 'cases', project: withoutTestRun(e) };
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
    expect(within(dialog().querySelector('.dialog-actions') as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Save expected errors']);
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

  const withReplyAndMarks = (marks: string[]): AppState => {
    const e = sampleProject();
    const expected = Object.fromEntries(marks.map((id) => [id, { state: 'found', source: 'manual' }]));
    return { ...createState(), step: 'cases', project: withRun(e, { decisions: { '2': { expected: expected as never, additional: {}, added_findings: [], approved: false, note: '' } } }) } as AppState;
  };
  const flipDifficulties = (count: number) => {
    const items = JSON.parse(box().value);
    for (let i = 0; i < count; i++) items[i].difficulty = items[i].difficulty === 'subtle' ? 'obvious' : 'subtle';
    fireEvent.input(box(), { target: { value: JSON.stringify(items) } });
    fireEvent.click(save());
    return screen.getByRole('dialog', { name: 'Save the expected errors?' });
  };

  it('leaves out the clause about dropped marks when none is dropped (T287)', () => {
    show(withReplyAndMarks([]));
    open('Anna + 2 errors');
    edit();
    expect(flipDifficulties(1).textContent).toContain('This case has a reply. The case is marked again from the reply, and the test cases version changes.');
    expect(screen.getByRole('dialog', { name: 'Save the expected errors?' }).textContent).not.toMatch(/\b0 marks|dropped/);
  });

  it('says how many marks are dropped when there are two (T287)', () => {
    show(withReplyAndMarks(['e1', 'e2']));
    open('Anna + 2 errors');
    edit();
    expect(flipDifficulties(2).textContent).toContain('This case has a reply. 2 marks you set for changed or removed errors are dropped, the case is marked again from the reply, and the test cases version changes.');
  });

  it('for a case with a reply Save asks first: the marks of changed and removed errors are dropped, and Cancel keeps everything', () => {
    const e = sampleProject();
    const withReply: AppState = { ...createState(), step: 'cases', project: withRun(e, { decisions: { '2': { expected: { e1: { state: 'found', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' } } }) };
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
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Save the expected errors?' })).getByRole('button', { name: 'Save expected errors' }));
    expect(screen.queryByRole('dialog', { name: 'Edit expected errors' })).toBeNull();
  });

  it('a list that leaves a changed place of the text uncovered is saved at once for a case without a reply: no check line, no question (T286)', () => {
    show();
    open('Anna + 2 errors');
    edit();
    const items = JSON.parse(box().value);
    fireEvent.input(box(), { target: { value: JSON.stringify(items.slice(0, 1)) } });
    expect(within(dialog()).queryByRole('list', { name: 'Changed places not in the list' })).toBeNull();
    expect(within(dialog()).queryByText(/Text and list agree|changed place/)).toBeNull();
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(screen.queryByRole('dialog', { name: 'Save the expected errors?' })).toBeNull();
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
