// The checks of the case view of "Case with errors" (FR-040, FR-041, FR-080, FR-085, SC-022, SC-035).
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
const button = (name: string) => within(win()).getByRole('button', { name }) as HTMLButtonElement;
const box = () => within(win()).getByLabelText('Case JSON') as HTMLTextAreaElement;
const source = 'Anna is a baker. She bought a second oven in 1998.';
const json = (summary: string, errors: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'Anna case', fields: { source_text: source, summary }, expected_errors: errors, ...over });
const doctor = { category: 'factual-error', fragment: 'Anna is a doctor', description: 'Profession changed', difficulty: 'obvious' };
const open = (state: AppState = draftState(), base: string | null = '1') => {
  render(<App ports={createFakePorts()} env={env} initialState={state} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
  fireEvent.click(button('Case with errors'));
  if (base) fireEvent.change(within(win()).getByLabelText('Base case (optional)'), { target: { value: base } });
};
const toCaseView = (text: string) => fireEvent.input(box(), { target: { value: text } });

describe('parts 4 and 5: live checks', () => {
  it('every change in the JSON shows at once in the list; there is no check line of text against list (T286)', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a second oven in 1998.', [doctor]));
    expect(within(win()).getByRole('list', { name: 'Expected errors' })).toBeTruthy();
    expect(within(win()).queryByText('Text and list agree')).toBeNull();
    fireEvent.input(box(), { target: { value: json('Anna is a lawyer. She bought a second oven in 1998.', [doctor]) } });
    expect(within(win()).queryByText(/not in the text/)).toBeNull();
    expect(within(win()).getByText('not found in the case', { selector: '.error-side.not-found dt' })).toBeTruthy();
  });

  it('a changed place that no expected error covers is not named and not marked (T286)', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a third oven in 1998.', [doctor]));
    expect(within(win()).queryByText(/changed place/)).toBeNull();
    expect(within(win()).queryByRole('list', { name: 'Changed places not in the list' })).toBeNull();
    expect(win().querySelectorAll('mark, .fragment-uncovered')).toHaveLength(0);
  });

  it('for an omission nothing more is said (T286)', () => {
    open();
    toCaseView(json('Anna is a baker.', [{ category: 'omission', fragment: 'She bought a second oven in 1998', description: 'The oven is left out' }]));
    expect(within(win()).queryByText('Text and list agree')).toBeNull();
    expect(within(win()).queryByRole('list', { name: 'Changed places not in the list' })).toBeNull();
  });

  it('a fragment that is not found is marked "not found in the case" in the list', () => {
    open();
    toCaseView(json('Anna is a doctor.', [{ ...doctor, fragment: 'Anna is a lawyer' }]));
    expect(within(win()).getByText('not found in the case', { selector: '.error-side.not-found dt' })).toBeTruthy();
  });

  it('while the JSON is invalid the list is not shown, the problem is under the box, and Save case is disabled', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a second oven in 1998.', [doctor]));
    fireEvent.input(box(), { target: { value: '{ "name": ' } });
    expect(within(win()).getByText(/Line 1, column/)).toBeTruthy();
    expect(within(win()).queryByRole('list', { name: 'Expected errors' })).toBeNull();
    expect(button('Save case').disabled).toBe(true);
    fireEvent.input(box(), { target: { value: json('Anna is a doctor. She bought a second oven in 1998.', [doctor]) } });
    expect(within(win()).getByRole('list', { name: 'Expected errors' })).toBeTruthy();
    expect(button('Save case').disabled).toBe(false);
  });
});

describe('saving', () => {
  it('a case that agrees is saved without a question', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a second oven in 1998.', [doctor]));
    fireEvent.click(button('Save case'));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('Anna case')).toBeTruthy();
  });

  it('"Save case" asks nothing about the list: a changed place no error covers and a fragment not in the text are saved at once (T286)', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a third oven in 1998.', [doctor, { ...doctor, fragment: 'she sold it' }]));
    fireEvent.click(button('Save case'));
    expect(screen.queryByRole('dialog', { name: 'Save with a mismatch?' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('Anna case')).toBeTruthy();
  });

  it('a case identical to its base is saved without a problem (T286)', () => {
    open();
    fireEvent.input(box(), { target: { value: json(source, [doctor]) } });
    expect(within(win()).queryByText(/identical to its base/)).toBeNull();
    expect(button('Save case').disabled).toBe(false);
    fireEvent.click(button('Save case'));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('Anna case')).toBeTruthy();
  });

  it('an expected error with no fragment shows "No fragment" and nothing else; no note about it or a missing category (T286)', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a second oven in 1998.', [doctor, { description: 'Tone of the whole text' }]));
    expect(within(win()).getByText('No fragment')).toBeTruthy();
    expect(within(win()).queryByText(/E2: no fragment/)).toBeNull();
    expect(within(win()).queryByText(/E2: no category/)).toBeNull();
    fireEvent.click(button('Save case'));
    expect(screen.queryByRole('dialog', { name: 'Save with a mismatch?' })).toBeNull();
  });

  it('a JSON with no expected errors is saved as a clean case, and the window says so before saving', () => {
    open();
    fireEvent.input(box(), { target: { value: json('Anna works as a baker. She bought a second oven in 1998.', []) } });
    expect(within(win()).getByText(/saved as a clean case/i)).toBeTruthy();
    fireEvent.click(button('Save case'));
    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes('Anna case'))!;
    expect(row.textContent).toContain('Clean');
  });
});

describe('the page says where the user is and what to do (T223, T229)', () => {
  it('has no "Part N of 3"; the headings are numbered and the answer is asked for under its own heading', () => {
    render(<App ports={createFakePorts()} env={env} initialState={draftState()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
    fireEvent.click(button('Case with errors'));
    expect(win().textContent).not.toMatch(/Part \d of 3/);
    expect(within(win()).getByRole('heading', { name: '4. Paste its answer' })).toBeTruthy();
    expect(within(win()).getByText(/Paste what your LLM returned into the box/)).toBeTruthy();
    expect(within(win()).getByRole('heading', { name: '5. Expected errors' })).toBeTruthy();
  });

  it('names the base case, not only its number', () => {
    open();
    toCaseView(json('Anna is a doctor. She bought a second oven in 1998.', [doctor], { base: '1' }));
    const baseName = sampleEvaluation().dataset.cases.find((c) => c.id === '1')!.name;
    expect(within(win()).getByText(new RegExp(`Base: 1 \\(${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`))).toBeTruthy();
  });
});
