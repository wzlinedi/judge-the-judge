// T229: one vertical layout for every way of adding a case (FR-040, FR-041, FR-083, FR-085, FR-090).
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';
import { withoutTestRun } from '../../../src/core/cases/test-run';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const draftState = (): AppState => {
  const e = sampleProject();
  return { ...createState(), step: 'cases', project: withoutTestRun(e) };
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

  it('a changed place that no expected error covers is not named anywhere (T286)', () => {
    start('Case with errors');
    fireEvent.change(within(win()).getByLabelText('Base case (optional)'), { target: { value: '1' } });
    fireEvent.input(box(), { target: { value: json('Anna is a doctor. She bought a third oven in 1998.', [doctor]) } });
    expect(within(win()).queryByRole('list', { name: 'Changed places not in the list' })).toBeNull();
    expect(within(win()).queryByText(/changed place/i)).toBeNull();
  });

  it('part 5 is a read-only list: nothing highlighted until Show the issue (T284), none for a fragment that is not found, which says "not found in the case"', () => {
    start('Case with errors');
    fireEvent.input(box(), { target: { value: json('Anna is a doctor.', [doctor, { ...doctor, fragment: 'Anna is a lawyer' }]) } });
    const list = within(win()).getByRole('list', { name: 'Expected errors' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(win().querySelectorAll('mark, .fragment-strong')).toHaveLength(0);
    expect(within(win()).getAllByRole('button', { name: 'Show the issue' })).toHaveLength(1);
    expect(within(list).getAllByText('not found in the case')).toHaveLength(1);
    expect(within(list).getAllByText('summary', { selector: 'dt' })).toHaveLength(1);
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

// T326 (FR-092, FR-093): the window of a test case is one page, top to bottom: the form, the JSON editor, the preview, the list of expected
// errors. An editor grows with its text. ("Error categories" collapsed or open is asserted in error-categories.test.tsx.)
describe('the test case window, top to bottom (T326)', () => {
  const follows = (a: Element, b: Element) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  it('From JSON: the form, the JSON editor, the preview of what is saved, then the list of expected errors', () => {
    start('From JSON');
    fireEvent.input(box(), { target: { value: json('Anna is a doctor. She bought a second oven in 1998.', [doctor]) } });
    const parts = [win().querySelector('.form-grid'), box(), win().querySelector('.check-status'), within(win()).getByRole('list', { name: 'Expected errors' })];
    for (const part of parts) expect(part).not.toBeNull();
    for (let i = 0; i < parts.length - 1; i += 1) follows(parts[i] as Element, parts[i + 1] as Element);
  });

  it('the JSON editor is a textarea that grows with its text (class grows), in From JSON and in Case with errors', () => {
    start('From JSON');
    expect(box().tagName).toBe('TEXTAREA');
    expect(box().classList.contains('grows')).toBe(true);
    cleanup();
    start('Case with errors');
    expect(box().classList.contains('grows')).toBe(true);
  });

  it('the prompt for the LLM is an editor that grows too', () => {
    start('Case with errors');
    const prompt = within(win()).getByLabelText('Prompt for your LLM') as HTMLTextAreaElement;
    expect(prompt.classList.contains('grows')).toBe(true);
  });
});
