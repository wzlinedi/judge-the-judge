// The test project card and the guidance of the Test cases step (FR-045, FR-046; User Story 10).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { saveCaseFromJson } from '../../../src/app/actions/cases';
import { createState, type AppState } from '../../../src/app/store';
import type { Evaluation, TestCase } from '../../../src/core/model';
import { CasesStep } from '../../../src/ui/steps/cases/CasesStep';
import { TestProjectCard } from '../../../src/ui/steps/cases/TestProjectCard';
import { sampleEvaluation, verdictEvaluation } from '../../helpers/fixtures';

const stateOf = (evaluation: Evaluation): AppState => ({ ...createState(), step: 'cases', evaluation });
const draft = (over: Partial<Evaluation> = {}): Evaluation => {
  const e = sampleEvaluation();
  return { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {}, ...over };
};
const clean = (id: string, text = `clean ${id}`): TestCase => ({ id, name: `c${id}`, fields: { source_text: text, summary: text }, expected_errors: [] });
const card = () => screen.getByRole('region', { name: 'Test project' });

describe('the test project card', () => {
  it('shows the name, the test cases version and the counts', async () => {
    render(<TestProjectCard state={stateOf(sampleEvaluation())} />);
    expect(card().textContent).toContain('Book summaries');
    await waitFor(() => expect(card().textContent).toMatch(/Test cases version [0-9a-f]{12}/));
    for (const text of ['2 test cases', '1 with injected errors', '1 clean', '2 with a reply']) expect(card().textContent).toContain(text);
  });

  it('shows the test-size summary: totals against the minimums, the groups, and the sentence', () => {
    render(<TestProjectCard state={stateOf(sampleEvaluation())} />);
    const size = within(card()).getByRole('group', { name: 'Test size' });
    expect(size.textContent).toContain('Injected errors: 2 of 30 (28 missing)');
    expect(size.textContent).toContain('Clean cases: 1 of 10 (9 missing)');
    expect(size.textContent).toContain('1 case with 2 errors');
    expect(size.textContent).toContain('A reliable answer needs at least 30 injected errors and 10 clean cases; until then the result is Inconclusive.');
  });

  it('says "met" for a total that reaches its minimum', () => {
    const cases = [...Array.from({ length: 10 }, (_, i): TestCase => ({ id: `e${i}`, name: `e${i}`, fields: { source_text: `s${i}`, summary: `m${i}` }, expected_errors: [1, 2, 3].map((n) => ({ id: `e${n}`, description: 'd', difficulty: 'subtle' as const })) })), ...Array.from({ length: 10 }, (_, i) => clean(`c${i}`))];
    render(<TestProjectCard state={stateOf(draft({ dataset: { name: 'p', finalized: false, cases } }))} />);
    const size = within(card()).getByRole('group', { name: 'Test size' });
    expect(size.textContent).toContain('Injected errors: 30 of 30 (met)');
    expect(size.textContent).toContain('Clean cases: 10 of 10 (met)');
    expect(size.textContent).toContain('10 cases with 3 errors');
  });

  it('counts cases with expected errors for a judge evaluated per case', () => {
    render(<TestProjectCard state={stateOf(verdictEvaluation())} />);
    const size = within(card()).getByRole('group', { name: 'Test size' });
    expect(size.textContent).toContain('Cases with expected errors: 3 of 30 (27 missing)');
    expect(size.textContent).toContain('at least 30 cases with expected errors and 10 clean cases');
  });

  it('warns about one kind of case only, saying why both are needed', () => {
    render(<TestProjectCard state={stateOf(draft({ dataset: { name: 'p', finalized: false, cases: [clean('1'), clean('2')] } }))} />);
    const warnings = within(card()).getByRole('list', { name: 'Warnings' });
    expect(warnings.textContent).toMatch(/no cases with injected errors/i);
    expect(warnings.textContent).toMatch(/detection rate cannot be computed/i);
  });

  it('flags duplicate texts', () => {
    render(<TestProjectCard state={stateOf(draft({ dataset: { name: 'p', finalized: false, cases: [clean('1', 'same'), clean('2', 'same')] } }))} />);
    expect(within(card()).getByRole('list', { name: 'Warnings' }).textContent).toMatch(/cases 1 and 2 have identical fields/i);
  });

  it('shows the warnings of replies that cannot be read automatically', () => {
    const e = draft();
    e.judge_set = { ...e.judge_set, error_rules: [] };
    render(<TestProjectCard state={stateOf(e)} />);
    expect(within(card()).getByRole('list', { name: 'Warnings' }).textContent).toMatch(/There is no error rule/);
  });

  it('shows no list of warnings when there is nothing to warn about', () => {
    render(<TestProjectCard state={stateOf(sampleEvaluation())} />);
    expect(within(card()).queryByRole('list', { name: 'Warnings' })).toBeNull();
  });

  it('shows the remaining capacity up to 500 cases', () => {
    render(<TestProjectCard state={stateOf(sampleEvaluation())} />);
    expect(card().textContent).toContain('498 more test cases can be added (500 at most).');
  });

  it('has no unsaved indicator of its own: the header has the one', () => {
    render(<TestProjectCard state={{ ...stateOf(sampleEvaluation()), unsaved: true }} />);
    expect(card().textContent).not.toMatch(/unsaved|saved/i);
  });
});

const step = (state: AppState) =>
  render(<CasesStep state={state} onAdd={vi.fn()} onOpen={vi.fn()} onEdit={vi.fn()} categoriesOpen={false} onToggleCategories={vi.fn()} onCatalogEdit={vi.fn()} />);

describe('the Test cases step', () => {
  it('puts the test project card between the error categories and the table', () => {
    step(stateOf(draft()));
    const names = [...document.querySelectorAll('.cases-step > *')].map((el) => el.getAttribute('aria-label') ?? el.className ?? el.tagName);
    const card = names.findIndex((n) => n === 'Test project');
    expect(card).toBeGreaterThan(0);
    expect(names.slice(card + 1).join(' ')).toMatch(/list-head|table/);
  });

  it('refuses to add beyond 500 cases: the button is disabled and the reason is beside it', () => {
    const many = Array.from({ length: 500 }, (_, i) => clean(String(i), `t${i}`));
    step(stateOf(draft({ dataset: { name: 'p', finalized: false, cases: many } })));
    expect((screen.getByRole('button', { name: 'Add test case…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(card().textContent).toContain('The limit of 500 test cases is reached. Remove a case before adding another.');
  });
});

describe('duplicates in the table', () => {
  it('flags each of two cases with identical fields in its Warnings cell', () => {
    step(stateOf(draft({ dataset: { name: 'p', finalized: false, cases: [clean('1', 'same'), clean('2', 'same'), clean('3', 'other')] } })));
    const rows = within(screen.getByRole('table', { name: 'Test cases' })).getAllByRole('row').slice(1);
    expect(rows[0]!.textContent).toContain('Identical fields to case 2');
    expect(rows[1]!.textContent).toContain('Identical fields to case 1');
    expect(rows[2]!.textContent).not.toContain('Identical fields');
  });
});

describe('adding beyond the limit', () => {
  it('is refused by the action with a clear message, and changes nothing', () => {
    const many = Array.from({ length: 500 }, (_, i) => clean(String(i), `t${i}`));
    const state = stateOf(draft({ dataset: { name: 'p', finalized: false, cases: many } }));
    const json = JSON.stringify({ name: 'One more', fields: { source_text: 'x', summary: 'y' }, expected_errors: [] });
    const edit = saveCaseFromJson(state, json, { mode: 'clean' });
    expect(edit.state).toBe(state);
    expect(edit.problems?.[0]?.message).toMatch(/500 test cases/);
  });
});

describe('help for a category where it is chosen', () => {
  const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };

  it('shows the description and the example of the chosen category in "Case with errors"', () => {
    const e = draft();
    render(<App ports={createFakePorts()} env={env} initialState={stateOf(e)} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Test case' })).getByRole('button', { name: 'Case with errors' }));
    const win = screen.getByRole('dialog', { name: 'Test case' });
    const first = e.judge_set.error_catalog[0]!;
    const row = within(win).getByRole('row', { name: 'Error 1' });
    expect(row.textContent).toContain(first.description as string);
    const second = e.judge_set.error_catalog[1]!;
    fireEvent.change(within(row).getByLabelText('Category'), { target: { value: second.name } });
    expect(within(win).getByRole('row', { name: 'Error 1' }).textContent).toContain(second.description as string);
  });

  it('shows no hint for a new category name', () => {
    render(<App ports={createFakePorts()} env={env} initialState={stateOf(draft())} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Test case' })).getByRole('button', { name: 'Case with errors' }));
    const win = screen.getByRole('dialog', { name: 'Test case' });
    fireEvent.change(within(win).getByLabelText('Category'), { target: { value: 'New category…' } });
    expect(within(win).queryByText(/Example:/)).toBeNull();
  });
});
