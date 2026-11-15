// The "Error categories" section (FR-015, FR-087, Principle VI).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { resetRegistry } from '../../../src/app/metrics';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
afterEach(() => resetRegistry());

const stateWith = (over: { finalized?: boolean; cases?: boolean } = {}): AppState => {
  const e = sampleEvaluation();
  return {
    ...createState(),
    step: 'cases',
    evaluation: { ...e, dataset: { ...e.dataset, finalized: over.finalized ?? false, cases: over.cases === false ? [] : e.dataset.cases }, replies: over.finalized ? e.replies : {}, decisions: {} },
  };
};
const show = (state = stateWith(), ports: FakePorts = createFakePorts()) => render(<App ports={ports} env={env} initialState={state} />);
const heading = () => screen.getByRole('button', { name: /Error categories/ });
const rowOf = (name: string) => screen.getByRole('row', { name }) as HTMLElement;

describe('placement and folding (FR-087)', () => {
  it('is on the Test cases step, before the table, and not on the Judge step', () => {
    const { unmount } = show();
    fireEvent.click(heading());
    expect(heading().compareDocumentPosition(screen.getByRole('table', { name: 'Test cases' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    show({ ...stateWith(), step: 'judge' });
    expect(screen.queryByText(/Error categories/)).toBeNull();
  });

  it('is open while the project has no test case, collapsed when it has cases, and says how many categories', () => {
    const empty = show(stateWith({ cases: false }));
    expect(heading().getAttribute('aria-expanded')).toBe('true');
    empty.unmount();
    show();
    expect(heading().getAttribute('aria-expanded')).toBe('false');
    expect(heading().textContent).toContain('5 categories');
    expect(screen.queryByRole('table', { name: 'Categories' })).toBeNull();
  });

  it('opens and closes by a click and from the keyboard, and the choice is kept for the page session', () => {
    show();
    fireEvent.click(heading());
    expect(heading().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('table', { name: 'Categories' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /1\s*Judge/ }));
    fireEvent.click(screen.getByRole('button', { name: /2\s*Test cases/ }));
    expect(heading().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(heading());
    expect(heading().getAttribute('aria-expanded')).toBe('false');
    expect(heading().tagName).toBe('BUTTON'); // a button: Enter and Space work natively
  });
});

describe('each category', () => {
  const open = (state = stateWith()) => {
    const view = show(state);
    fireEvent.click(heading());
    return view;
  };

  it('is a table with the columns Name, Description & examples, Used by and the buttons Rename and Remove; no Example (T248)', () => {
    open();
    const table = screen.getByRole('table', { name: 'Categories' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Name', 'Description & examples', 'Used by', 'Actions']);
    expect(within(rowOf('factual-error')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rename', 'Remove']);
    expect(screen.queryByRole('button', { name: 'Example' })).toBeNull();
  });

  it('shows the description with its examples in one multi-line cell, editable, and how many test cases use it', () => {
    open();
    const row = rowOf('factual-error');
    const cell = within(row).getByLabelText('Description and examples of factual-error') as HTMLTextAreaElement;
    expect(cell.tagName).toBe('TEXTAREA');
    expect(cell.placeholder).toMatch(/What this kind of error is/);
    expect(cell.value).toMatch(/untrue.*Example: /);
    expect(within(row).getByText('Used by 1 test case')).toBeTruthy();
    expect(within(rowOf('misattribution')).getByText('Used by 0 test cases')).toBeTruthy();
    fireEvent.input(cell, { target: { value: 'a new description' } });
    expect((within(rowOf('factual-error')).getByLabelText('Description and examples of factual-error') as HTMLTextAreaElement).value).toBe('a new description');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('Rename says first, in plain text above the buttons, how many expected errors in how many cases get the new name, and that the version changes (T294)', () => {
    open();
    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Rename' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename category' });
    const text = dialog.textContent ?? '';
    expect(text).toContain('1 expected error in 1 test case gets the new name. The test cases version changes.');
    expect(text).toContain('error analysis of Results uses the new name');
    const sentence = within(dialog).getByText(/gets the new name/);
    expect(sentence.closest('.muted')).toBeNull();
    // above the buttons of the dialog
    const buttons = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(sentence.compareDocumentPosition(buttons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Rename counts the expected errors and the cases separately, and says so when no case uses the category (T294)', () => {
    const s = stateWith();
    const cases = s.evaluation.dataset.cases.map((c) => (c.id === '2' ? { ...c, expected_errors: c.expected_errors.map((e) => ({ ...e, category: 'factual-error' })) } : c));
    show({ ...s, evaluation: { ...s.evaluation, dataset: { ...s.evaluation.dataset, cases } } });
    fireEvent.click(heading());
    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Rename' }));
    expect(screen.getByRole('dialog', { name: 'Rename category' }).textContent).toContain('2 expected errors in 1 test case get the new name.');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Rename category' })).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(rowOf('misattribution')).getByRole('button', { name: 'Rename' }));
    expect(screen.getByRole('dialog', { name: 'Rename category' }).textContent).toContain('No test case uses this category.');
  });

  it('Remove is enabled for every category: an unused one is removed at once, a used one asks first and then leaves its errors without the category (T248)', () => {
    open();
    fireEvent.click(within(rowOf('misattribution')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('row', { name: 'misattribution' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Remove category' })).toBeNull();

    const used = rowOf('factual-error');
    expect((within(used).getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(used).getByRole('button', { name: 'Remove' }));
    const ask = screen.getByRole('dialog', { name: 'Remove category' });
    expect(ask.textContent).toContain('1 test case use it. Their expected errors stay and lose the category. The test cases version changes.');
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('row', { name: 'factual-error' })).toBeTruthy();

    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove category' })).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('row', { name: 'factual-error' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toContain('The expected errors of 1 test case lost the category.');
    fireEvent.click(heading());
    expect(heading().textContent).toContain('3 categories');
  });

  it('after finalizing, a category in use can still be removed and renamed', () => {
    open(stateWith({ finalized: true }));
    expect(within(rowOf('factual-error')).getAllByRole('button').every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('Rename applies to the cases and refuses a taken name', () => {
    open();
    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Rename' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename category' });
    fireEvent.input(within(dialog).getByLabelText('New name'), { target: { value: 'Wrong Number' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/already in the catalog/);
    fireEvent.input(within(dialog).getByLabelText('New name'), { target: { value: 'Wrong Fact' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(screen.queryByRole('dialog', { name: 'Rename category' })).toBeNull();
    expect(screen.getByRole('row', { name: 'wrong-fact' })).toBeTruthy();
    expect(within(rowOf('wrong-fact')).getByText('Used by 1 test case')).toBeTruthy();
  });

  it('"Add category" appends one editable row to the table; "Add" puts it in the catalog and "Cancel" drops it (T248)', () => {
    open();
    expect(screen.queryByLabelText('Categories to add')).toBeNull();
    const add = screen.getByRole('button', { name: 'Add category' }) as HTMLButtonElement;
    fireEvent.click(add);
    expect(add.disabled).toBe(true);
    const row = rowOf('New category');
    expect(screen.getByRole('table', { name: 'Categories' }).querySelector('tbody tr:last-child')).toBe(row);
    fireEvent.input(within(row).getByLabelText('Name of the new category'), { target: { value: 'Wrong Tone' } });
    expect(row.textContent).toContain('It is written in lower case with dashes: wrong-tone.');
    fireEvent.input(within(rowOf('New category')).getByLabelText('Description and examples of the new category'), { target: { value: 'The tone does not fit. Example: slang in a formal letter.' } });
    fireEvent.click(within(rowOf('New category')).getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('row', { name: 'New category' })).toBeNull();
    expect((within(rowOf('wrong-tone')).getByLabelText('Description and examples of wrong-tone') as HTMLTextAreaElement).value).toBe('The tone does not fit. Example: slang in a formal letter.');
    expect(within(rowOf('wrong-tone')).getByText('Used by 0 test cases')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.click(within(rowOf('New category')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('row', { name: 'New category' })).toBeNull();
    expect(screen.getAllByRole('row')).toBeTruthy();
  });

  it('a new row with no name or a taken name is refused in the row, which stays open', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.click(within(rowOf('New category')).getByRole('button', { name: 'Add' }));
    expect(within(rowOf('New category')).getByRole('alert').textContent).toBe('Type a name for the category.');
    fireEvent.input(within(rowOf('New category')).getByLabelText('Name of the new category'), { target: { value: 'factual error' } });
    fireEvent.click(within(rowOf('New category')).getByRole('button', { name: 'Add' }));
    expect(within(rowOf('New category')).getByRole('alert').textContent).toBe('The category "factual-error" is already in the catalog.');
  });

  it('with no category yet, the button still adds the first row', () => {
    const e = stateWith({ cases: false });
    show({ ...e, evaluation: { ...e.evaluation, judge_set: { ...e.evaluation.judge_set, error_catalog: [] } } });
    expect(screen.getByText('There are no categories yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(rowOf('New category')).toBeTruthy();
  });

  it('counts "Used by" from the test cases: in the demo unsupported-claim is used by one case, number 15', () => {
    const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8')) as { dataset: { cases: Array<{ id: string; expected_errors: Array<{ category?: string }> }> } };
    expect(demo.dataset.cases.filter((c) => c.expected_errors.some((x) => x.category === 'unsupported-claim')).map((c) => c.id)).toEqual(['15']);
  });
});
