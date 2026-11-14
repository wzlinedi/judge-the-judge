// T229: one vertical layout for every way of adding a case (FR-040, FR-041, FR-083, FR-085, FR-090).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const draftState = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {} } };
};
const win = () => screen.getByRole('dialog', { name: 'Test case' });
const start = (choice: 'From JSON' | 'Clean case' | 'Case with errors', state: AppState = draftState()) => {
  render(<App ports={createFakePorts()} env={env} initialState={state} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
  fireEvent.click(within(win()).getByRole('button', { name: choice }));
};
const headings = () => within(win()).getAllByRole('heading', { level: 3 }).filter((h) => /^\d\. /.test(h.textContent ?? '')).map((h) => (h.textContent ?? '').replace(/^\d\. /, ''));
const source = 'Anna is a baker. She bought a second oven in 1998.';
const json = (summary: string, errors: unknown[], over: Record<string, unknown> = {}) => JSON.stringify({ name: 'Anna case', fields: { source_text: source, summary }, expected_errors: errors, ...over });
const doctor = { category: 'factual-error', fragment: 'Anna is a doctor', description: 'Profession changed', difficulty: 'obvious' };
const box = () => within(win()).getByLabelText('Case JSON') as HTMLTextAreaElement;
const save = () => within(win()).getByRole('button', { name: 'Save case' }) as HTMLButtonElement;

/** T233: the header holds the save button (named) and then Close without saving; there is no bottom bar. */
function expectOnePage(saveName: string) {
  const buttons = within(win().querySelector('.case-window-header') as HTMLElement).getAllByRole('button');
  expect(buttons.map((b) => b.textContent)).toEqual([saveName, 'Close without saving']);
  expect(win().querySelector('.case-window-footer')).toBeNull();
  expect(within(win()).queryByRole('button', { name: 'Next' })).toBeNull();
  expect(within(win()).queryByRole('button', { name: 'Back' })).toBeNull();
  expect(win().textContent).not.toMatch(/Part \d of 3/);
  expect(win().querySelector('.case-columns')).toBeNull();
}

describe('case with injected errors: five parts from top to bottom', () => {
  it('shows base, errors to prepare, prompt, answer and expected errors on one page, with the header holding Save case and Close', () => {
    start('Case with errors');
    expectOnePage('Save case');
    expect(headings()).toEqual(['Base case', 'Errors to prepare', 'Ask your LLM', 'Paste its answer', 'Expected errors']);
  });

  it('puts Save case in the header next to Close without saving, with the reason beside it (T233)', () => {
    start('Case with errors');
    const header = win().querySelector('.case-window-header') as HTMLElement;
    const save = within(header).getByRole('button', { name: 'Save case' });
    const close = within(header).getByRole('button', { name: 'Close without saving' });
    expect(save.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(header).getByText('Paste the answer of your LLM to save.')).toBeTruthy();
  });

  it('each numbered part is in its own frame, and the category description stands under the category of its row (T233, T249)', () => {
    start('Case with errors');
    const parts = win().querySelectorAll('.case-part');
    expect(parts).toHaveLength(5);
    const row = within(win()).getByRole('row', { name: 'Error 1' });
    const cell = within(row).getByLabelText('Category').closest('td') as HTMLElement;
    expect(cell.querySelector('.category-hint')).not.toBeNull();
  });

  it('puts the labels of a part in a column on the left and the fields on the right (T233)', () => {
    start('Case with errors');
    const grid = win().querySelector('.form-grid') as HTMLElement;
    const label = within(grid).getByText('Base case (optional)');
    expect(label.parentElement).toBe(grid);
    expect(within(grid).getByLabelText('Base case (optional)').closest('.form-grid')).toBe(grid);
  });

  it('says why Save case is disabled, and the reason goes when the JSON is valid', () => {
    start('Case with errors');
    expect(save().disabled).toBe(true);
    expect(save().getAttribute('aria-describedby')).toBe('save-why');
    expect(within(win()).getByText('Paste the answer of your LLM to save.')).toBeTruthy();
    fireEvent.input(box(), { target: { value: '{ "name": ' } });
    expect(within(win()).getByText('Fix the problems listed under the JSON to save.')).toBeTruthy();
    fireEvent.input(box(), { target: { value: json('Anna is a doctor. She bought a second oven in 1998.', [doctor]) } });
    expect(save().disabled).toBe(false);
    expect(save().getAttribute('aria-describedby')).toBeNull();
    expect(within(win()).queryByText(/to save\.$/)).toBeNull();
  });

  it('lays the errors out as a table: Category, Difficulty, Description, and Remove in each row (T249)', () => {
    start('Case with errors');
    const row = within(within(win()).getByRole('row', { name: 'Error 1' }));
    for (const label of ['Category', 'Difficulty', 'Description']) expect(row.getByLabelText(label)).toBeTruthy();
    expect(row.getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(row.getByLabelText('Category').closest('tr')).toBe(row.getByRole('button', { name: 'Remove' }).closest('tr'));
    expect(within(win()).getByRole('button', { name: 'Add error' })).toBeTruthy();
    expect(within(win()).queryByLabelText('Your own instructions (optional)')).toBeNull();
  });

  it('a changed place that no expected error covers is a warning under the JSON box', () => {
    start('Case with errors');
    fireEvent.change(within(win()).getByLabelText('Base case (optional)'), { target: { value: '1' } });
    fireEvent.input(box(), { target: { value: json('Anna is a doctor. She bought a third oven in 1998.', [doctor]) } });
    const warnings = within(win()).getByRole('list', { name: 'Changed places not in the list' });
    expect(within(warnings).getByText(/A changed place is not in the list: “third” in summary/)).toBeTruthy();
    expect(warnings.compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('part 5 is a read-only list: no fields with highlights, no Show the issue, "not in the text" for a fragment that is not found', () => {
    start('Case with errors');
    fireEvent.input(box(), { target: { value: json('Anna is a doctor.', [doctor, { ...doctor, fragment: 'Anna is a lawyer' }]) } });
    const list = within(win()).getByRole('list', { name: 'Expected errors' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(win().querySelectorAll('mark')).toHaveLength(0);
    expect(within(win()).queryByRole('button', { name: 'Show the issue' })).toBeNull();
    expect(within(list).getAllByText('not in the text')).toHaveLength(1);
    expect(within(list).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('keeps the JSON box and the errors to prepare when the base changes', () => {
    start('Case with errors');
    fireEvent.input(box(), { target: { value: json('Anna is a doctor. She bought a second oven in 1998.', [doctor]) } });
    fireEvent.change(within(win()).getByLabelText('Base case (optional)'), { target: { value: '1' } });
    expect(box().value).toContain('Anna case');
    expect(within(win()).getByRole('row', { name: 'Error 1' })).toBeTruthy();
  });

  it('Escape and Close without saving ask first when something was pasted', () => {
    start('Case with errors');
    fireEvent.input(box(), { target: { value: json('Anna is a doctor.', [doctor]) } });
    fireEvent.click(within(win()).getByRole('button', { name: 'Close without saving' }));
    expect(screen.getByRole('dialog', { name: 'Close without saving?' })).toBeTruthy();
  });
});

describe('clean case: name, prompt and answer', () => {
  it('has no errors to prepare and no expected errors', () => {
    start('Clean case');
    expectOnePage('Save case');
    expect(headings()).toEqual(['About the case', 'Ask your LLM', 'Paste its answer']);
    expect(within(win()).queryByRole('row', { name: 'Error 1' })).toBeNull();
    expect(within(win()).queryByRole('list', { name: 'Expected errors' })).toBeNull();
  });

  it('puts Save case in the header with the reason beside it (T233)', () => {
    start('Clean case');
    const header = win().querySelector('.case-window-header') as HTMLElement;
    const approve = within(header).getByRole('button', { name: 'Save case' }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(within(header).getByText('Paste the answer of your LLM to approve.')).toBeTruthy();
    expect(win().querySelectorAll('.case-part').length).toBe(3);
    expect(win().querySelector('.form-grid')).not.toBeNull();
  });
});

describe('From JSON: only the box and the expected errors', () => {
  it('has parts 1 and 2: the JSON and the expected errors', () => {
    start('From JSON');
    expectOnePage('Save case');
    expect(headings()).toEqual(['Paste the case JSON', 'Expected errors']);
    expect(within(win()).queryByLabelText('Base case (optional)')).toBeNull();
    expect(within(win()).queryByRole('button', { name: 'Copy prompt' })).toBeNull();
  });

  it('the list appears as the JSON is pasted, without a Next', () => {
    start('From JSON');
    expect(within(win()).getByText('Paste the JSON to see the expected errors here.')).toBeTruthy();
    fireEvent.input(box(), { target: { value: json('Anna is a doctor.', [doctor]) } });
    expect(within(within(win()).getByRole('list', { name: 'Expected errors' })).getAllByRole('listitem')).toHaveLength(1);
    expect(within(win()).getByText('Anna case')).toBeTruthy();
  });

  it('a JSON with no expected errors says it will be saved as a clean case', () => {
    start('From JSON');
    fireEvent.input(box(), { target: { value: json('Anna works as a baker.', []) } });
    expect(within(win()).getByText('No expected errors: this will be saved as a clean case.')).toBeTruthy();
    expect(within(win()).queryByRole('list', { name: 'Expected errors' })).toBeNull();
  });

  it('an invalid JSON says the list is not available yet, and Save case says what to fix', () => {
    start('From JSON');
    fireEvent.input(box(), { target: { value: '{ nope' } });
    expect(within(win()).getByText('The JSON is not valid yet, so there is no list to show.')).toBeTruthy();
    expect(within(win()).getByText('Fix the problems listed under the JSON to save.')).toBeTruthy();
  });
});

describe('Edit expected errors uses the From JSON layout', () => {
  it('shows the case JSON and the list, with Save case in the header', () => {
    const s = draftState();
    const finalized: AppState = { ...s, evaluation: { ...s.evaluation, dataset: { ...s.evaluation.dataset, finalized: true } } };
    render(<App ports={createFakePorts()} env={env} initialState={finalized} />);
    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes('Anna + 2 errors')) as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit expected errors' }));
    expectOnePage('Save case');
    expect(headings()).toEqual(['Case JSON', 'Expected errors']);
    expect(within(within(win()).getByRole('list', { name: 'Expected errors' })).getAllByRole('listitem')).toHaveLength(2);
    expect(within(win().querySelector('.case-window-header') as HTMLElement).getByRole('button', { name: 'Save case' })).toBeTruthy();
  });
});
