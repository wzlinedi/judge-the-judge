// The parts of "Case with errors" on one page (FR-040, FR-041, FR-085, FR-090, SC-035, T229).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
export const draftState = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {} } };
};
const show = (state: AppState = draftState()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const win = () => screen.getByRole('dialog', { name: 'Test case' });
const button = (name: string) => within(win()).getByRole('button', { name }) as HTMLButtonElement;
const field = (label: string) => within(win()).getByLabelText(label) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const start = (state?: AppState) => {
  show(state);
  fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
  fireEvent.click(button('Case with errors'));
};
const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: 'Anna with errors',
    fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a doctor. She bought a second oven in 2005.' },
    expected_errors: [
      { category: 'factual-error', fragment: 'Anna is a doctor', description: 'Profession changed', difficulty: 'obvious' },
      { category: 'wrong-number', fragment: 'second oven in 2005', description: 'Year changed', difficulty: 'subtle' },
    ],
    ...over,
  });
const paste = (value: string) => fireEvent.input(field('Case JSON'), { target: { value } });

describe('parts 1 to 3: the base, the errors to prepare, the prompt', () => {
  it('offers an optional base with its fields, a list of errors to prepare, own instructions and the prompt', () => {
    start();
    const base = field('Base case (optional)') as HTMLSelectElement;
    expect(Array.from(base.options).map((o) => o.textContent)).toEqual(expect.arrayContaining(['None (the LLM writes the whole case)', 'Anna']));
    fireEvent.change(base, { target: { value: '1' } });
    expect(within(win()).getAllByText(/Anna is a baker\./).length).toBeGreaterThan(0);
    expect(within(win()).getByRole('group', { name: 'Error 1' })).toBeTruthy();
    expect(field('Your own instructions (optional)')).toBeTruthy();
    expect((field('Prompt for your LLM') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(button('Copy prompt')).toBeTruthy();
  });

  it('Add error and Remove change the rows, and the prompt is rebuilt each time', () => {
    start();
    const before = (field('Prompt for your LLM') as HTMLTextAreaElement).value;
    fireEvent.click(button('Add error'));
    expect(within(win()).getByRole('group', { name: 'Error 2' })).toBeTruthy();
    const two = (field('Prompt for your LLM') as HTMLTextAreaElement).value;
    expect(two).not.toBe(before);
    expect(two).toContain('Error 2');
    fireEvent.click(within(within(win()).getByRole('group', { name: 'Error 2' })).getByRole('button', { name: 'Remove' }));
    expect(within(win()).queryByRole('group', { name: 'Error 2' })).toBeNull();
    expect((field('Prompt for your LLM') as HTMLTextAreaElement).value).toBe(before);
  });

  it('a category is picked from the catalog or typed as a new name; a catalog entry brings its description and example', () => {
    start();
    const row = within(within(win()).getByRole('group', { name: 'Error 1' }));
    fireEvent.change(row.getByLabelText('Category'), { target: { value: 'wrong-number' } });
    const prompt = () => (field('Prompt for your LLM') as HTMLTextAreaElement).value;
    expect(prompt()).toContain('A number, year or amount that does not match the source.');
    fireEvent.change(row.getByLabelText('Category'), { target: { value: '__new__' } });
    fireEvent.input(row.getByLabelText('New category name'), { target: { value: 'tone-shift' } });
    expect(prompt()).toContain('tone-shift');
    expect(prompt()).toMatch(/new category/i);
  });

  it('a new category name is written the way the catalog writes it, and the window says so, and the prompt uses it', () => {
    start();
    const row = within(within(win()).getByRole('group', { name: 'Error 1' }));
    const prompt = () => (field('Prompt for your LLM') as HTMLTextAreaElement).value;
    fireEvent.change(row.getByLabelText('Category'), { target: { value: '__new__' } });
    fireEvent.input(row.getByLabelText('New category name'), { target: { value: ' Tone Shift ' } });
    expect(row.getByText('It is written in lower case with dashes: tone-shift.')).toBeTruthy();
    expect(prompt()).toContain('tone-shift');
    expect(prompt()).not.toContain('Tone Shift');
    fireEvent.input(row.getByLabelText('New category name'), { target: { value: 'tone-shift' } });
    expect(row.queryByText(/lower case with dashes:/)).toBeNull();
    expect(row.getByText(/describe it in Error categories/i)).toBeTruthy();
  });

  it('difficulty, what should be wrong, the base and own instructions all reach the prompt', () => {
    start();
    const prompt = () => (field('Prompt for your LLM') as HTMLTextAreaElement).value;
    const row = within(within(win()).getByRole('group', { name: 'Error 1' }));
    fireEvent.change(row.getByLabelText('Difficulty'), { target: { value: 'subtle' } });
    fireEvent.input(row.getByLabelText('What should be wrong'), { target: { value: 'Make the year wrong' } });
    fireEvent.input(field('Your own instructions (optional)'), { target: { value: 'Write in a formal register.' } });
    fireEvent.change(field('Base case (optional)'), { target: { value: '1' } });
    expect(prompt().startsWith('Write in a formal register.')).toBe(true);
    expect(prompt()).toMatch(/Difficulty: subtle/);
    expect(prompt()).toContain('Make the year wrong');
    expect(prompt()).toContain('Anna is a baker. She bought a second oven in 1998.');
  });

  it('works with no clean case at all: the base is optional', () => {
    start({ ...createState(), step: 'cases' });
    expect(within(win()).getByText(/no clean case/i)).toBeTruthy();
    expect((field('Prompt for your LLM') as HTMLTextAreaElement).value).toMatch(/write the whole case/i);
  });
});

describe('part 4: the JSON box', () => {
  const toBox = () => {
    start();
    fireEvent.change(field('Base case (optional)'), { target: { value: '1' } });
  };

  it('is one JSON box, checked as it changes, on the same page as the prompt', () => {
    toBox();
    expect(field('Prompt for your LLM')).toBeTruthy();
    paste('{ "name": ');
    expect(within(win()).getByText(/Line 1, column \d+/)).toBeTruthy();
    expect(button('Save case').disabled).toBe(true);
    paste(answer());
    expect(button('Save case').disabled).toBe(false);
  });

  it('keeps what was typed and pasted when the errors to prepare change (there is no Back)', () => {
    toBox();
    paste(answer());
    fireEvent.click(button('Add error'));
    expect((field('Base case (optional)') as HTMLSelectElement).value).toBe('1');
    expect((field('Case JSON') as HTMLTextAreaElement).value).toBe(answer());
  });

  it('accepts an answer whose number of errors differs from the list, with a note', () => {
    toBox();
    paste(answer());
    expect(within(win()).getByText(/2 expected errors; 1 was listed to prepare/)).toBeTruthy();
    expect(button('Save case').disabled).toBe(false);
  });
});

describe('part 5: the expected errors', () => {
  const toList = (json: string = answer()) => {
    start();
    fireEvent.change(field('Base case (optional)'), { target: { value: '1' } });
    paste(json);
  };

  it('is a read-only list in the order of the JSON with the check line and the name; the fields have no highlights', () => {
    toList();
    const list = within(win()).getByRole('list', { name: 'Expected errors' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain('E1');
    expect(items[0]!.textContent).toContain('Anna is a doctor');
    expect(items[1]!.textContent).toContain('E2');
    expect(win().querySelectorAll('mark')).toHaveLength(0);
    expect(within(win()).getByText('Text and list agree')).toBeTruthy();
    expect(within(win()).getByText('Anna with errors')).toBeTruthy();
  });

  it('has none of the removed controls, and the only editable controls are the ones of parts 1 to 4', () => {
    toList();
    for (const name of ['Modify', 'Edit by hand', 'Use selected text as fragment', 'Describe errors again', 'Compare with base', 'Save evaluation', 'Save test project', 'Show the issue']) {
      expect(within(win()).queryByRole('button', { name })).toBeNull();
    }
    expect(within(within(win()).getByRole('list', { name: 'Expected errors' })).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('Save case is enabled only while the JSON is valid', () => {
    start();
    expect(button('Save case').disabled).toBe(true);
    paste(answer());
    expect(button('Save case').disabled).toBe(false);
    paste('{ nope');
    expect(button('Save case').disabled).toBe(true);
  });

  it('Save case adds the case with its base, a new category joins the catalog, and the window closes', () => {
    toList(answer({ fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a doctor. She bought a second oven in 1998.' }, expected_errors: [{ category: 'tone-shift', fragment: 'Anna is a doctor', description: 'Tone', difficulty: 'obvious' }] }));
    fireEvent.click(button('Save case'));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('Anna with errors')).toBeTruthy();
    expect(screen.getAllByText(/tone-shift/).length).toBeGreaterThan(0);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});
