// The Test cases step: one table of all test cases (FR-017, FR-025, FR-039, FR-053, SC-034).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { nextAction } from '../../../src/app/selectors';
import { sampleProject, withRun } from '../../helpers/fixtures';
import { withoutTestRun } from '../../../src/core/cases/test-run';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const stateOf = (started = false, replies = false): AppState => {
  const e = sampleProject();
  return { ...createState(), step: 'cases', project: started ? withRun(e, { replies: replies ? { '2': e.testRun!.replies['2']! } : {}, decisions: {} }) : { ...withoutTestRun(e), dataset: e.dataset } };
};
const show = (state = stateOf()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const rowOf = (name: string) => screen.getAllByRole('row').find((r) => within(r).queryByText(name, { exact: false })) as HTMLElement;

describe('the table', () => {
  it('has the columns of FR-025 and one row per case with the kind in words', () => {
    show();
    const table = screen.getByRole('table', { name: 'Test cases' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Id', 'Name', 'Kind', 'Base', 'Expected errors', 'Categories', 'Warnings', 'Actions']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('Clean');
    expect(rows[1]!.textContent).toContain('Injected errors');
    expect(rows[1]!.textContent).toContain('added after first reply');
    expect(rows[1]!.textContent).toContain('factual-error');
  });

  it('puts Add test case above the table, and no details panel or menu in a row', () => {
    show();
    const add = screen.getByRole('button', { name: 'Add test case…' });
    const table = screen.getByRole('table', { name: 'Test cases' });
    expect(add.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows Open, Rename and Remove as visible buttons on every row', () => {
    show();
    for (const row of screen.getAllByRole('row').slice(1)) {
      expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(['Open', 'Rename', 'Remove']);
    }
  });

  it('shows a base case in its row', () => {
    const s = stateOf();
    const cases = s.project.dataset.cases.map((c) => (c.id === '2' ? { ...c, base: '1' } : c));
    show({ ...s, project: { ...s.project, dataset: { ...s.project.dataset, cases } } });
    expect(rowOf('Anna + 2 errors').textContent).toContain('Anna');
  });
});

describe('Open, Rename and Remove', () => {
  it('Open, and a click on the row, show the case read-only', () => {
    show();
    fireEvent.click(within(rowOf('Anna + 2 errors')).getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: /Anna \+ 2 errors/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(within(rowOf('Anna + 2 errors')).getByText('Injected errors'));
    expect(screen.getByRole('dialog', { name: /Anna \+ 2 errors/ })).toBeTruthy();
  });

  it('Rename asks for the new name and refuses a name another case has', () => {
    show();
    fireEvent.click(within(rowOf('Anna')).getAllByRole('button', { name: 'Rename' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Rename test case' });
    fireEvent.input(within(dialog).getByLabelText('New name'), { target: { value: ' anna + 2 ERRORS ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
    // the refusal is said inside the window that was acted in, where it is seen, and says that the name was not changed
    expect(within(dialog).getByRole('alert').textContent).toMatch(/already used by case 2.*not changed/i);
    expect(screen.getByRole('dialog', { name: 'Rename test case' })).toBeTruthy();
    fireEvent.input(within(dialog).getByLabelText('New name'), { target: { value: 'Bakery' } });
    expect(within(dialog).queryByRole('alert')).toBeNull(); // typing a new name takes the refusal away
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(screen.queryByRole('dialog', { name: 'Rename test case' })).toBeNull();
    expect(screen.getByText('Bakery')).toBeTruthy();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('Remove asks for confirmation first', () => {
    show();
    fireEvent.click(within(rowOf('Anna + 2 errors')).getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove test case' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
    fireEvent.click(within(rowOf('Anna + 2 errors')).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove test case' })).getByRole('button', { name: 'Remove' }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('Remove of a case with a reply says its reply and its decisions are removed with it (T234)', () => {
    show(stateOf(true, true));
    fireEvent.click(within(rowOf('Anna + 2 errors')).getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove test case' });
    expect(dialog.textContent).toMatch(/Its judge reply and its \d+ decisions? are removed with it, and the results change/);
  });

  it('Remove of a base case in use asks as for any case and does not refuse (T283)', () => {
    const s = stateOf();
    const cases = s.project.dataset.cases.map((c) => (c.id === '2' ? { ...c, base: '1' } : c));
    show({ ...s, project: { ...s.project, dataset: { ...s.project.dataset, cases } } });
    fireEvent.click(within(rowOf('Anna')).getAllByRole('button', { name: 'Remove' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Remove test case' });
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toBe('');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});

describe('after the start (FR-053)', () => {
  it('keeps Open, Rename, Remove and Add test case enabled, also for a case with a reply (T234)', () => {
    show(stateOf(true, true));
    expect((screen.getByRole('button', { name: 'Add test case…' }) as HTMLButtonElement).disabled).toBe(false);
    const withReply = rowOf('Anna + 2 errors');
    const without = rowOf('Anna');
    for (const row of [withReply, without]) {
      for (const name of ['Open', 'Rename', 'Remove']) expect((within(row).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });
});

describe('the "what next" line', () => {
  it('offers a disabled Start test run with no cases (Add test case is above the list, T228), and Start test run otherwise', () => {
    const empty = { ...createState(), step: 'cases' as const };
    expect(nextAction(empty, 'cases').action).toMatchObject({ label: 'Start test run', disabled: true });
    expect(nextAction(empty, 'cases').sentence).toMatch(/button below/);
    expect(nextAction(stateOf(), 'cases').action.label).toBe('Start test run');
  });

  it('shows an empty state with Add test case available when there are no cases', () => {
    render(<App ports={createFakePorts()} env={env} initialState={{ ...createState(), step: 'cases' }} />);
    expect(screen.getAllByRole('button', { name: 'Add test case…' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('table', { name: 'Test cases' })).toBeNull();
  });
});

describe('search, filters, sorting and the count (FR-025, User Story 15)', () => {
  const rowsShown = () => screen.getAllByRole('row').slice(1);
  const count = () => screen.getByRole('status', { name: 'Shown test cases' }).textContent;
  const type = (text: string) => fireEvent.input(screen.getByRole('searchbox', { name: 'Search test cases' }), { target: { value: text } });

  it('says how many cases there are, and shows them all at first', () => {
    show();
    expect(count()).toBe('2 test cases');
    expect(rowsShown()).toHaveLength(2);
  });

  it('searches the name and the texts of the fields, and says how many of all are shown', () => {
    show();
    type('doctor');
    expect(rowsShown()).toHaveLength(1);
    expect(rowsShown()[0]!.textContent).toContain('Anna + 2 errors');
    expect(count()).toBe('1 of 2 test cases');
    type('no such text');
    expect(rowsShown()).toHaveLength(0);
    expect(count()).toMatch(/No test case matches/);
  });

  it('filters by kind and by reply, together, and Clear search and filters shows every case again', () => {
    show(stateOf(false, true));
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'clean' } });
    expect(rowsShown().map((r) => r.textContent)).toEqual([expect.stringContaining('Anna')]);
    expect(rowsShown()[0]!.textContent).not.toContain('2 errors');
    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'with' } });
    expect(rowsShown()).toHaveLength(0);
    const clear = screen.getByRole('button', { name: 'Clear search and filters' });
    expect(clear.hasAttribute('disabled')).toBe(false);
    fireEvent.click(clear);
    expect(rowsShown()).toHaveLength(2);
    expect(clear.hasAttribute('disabled')).toBe(true);
  });

  it('keeps Open, Rename and Remove on the rows that are shown', () => {
    show();
    type('doctor');
    expect(within(rowsShown()[0]!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Open', 'Rename', 'Remove']);
  });

  it('sorts by a column: ascending, descending, then the original order, and says which way in aria-sort', () => {
    show();
    const header = () => screen.getByRole('columnheader', { name: /^Name/ });
    const names = () => rowsShown().map((r) => (r.querySelectorAll('td')[1] as HTMLElement).textContent);
    expect(names()).toEqual(['Anna', 'Anna + 2 errors']);
    fireEvent.click(within(header()).getByRole('button'));
    expect(header().getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(within(header()).getByRole('button'));
    expect(header().getAttribute('aria-sort')).toBe('descending');
    expect(names()).toEqual(['Anna + 2 errors', 'Anna']);
    fireEvent.click(within(header()).getByRole('button'));
    expect(header().hasAttribute('aria-sort')).toBe(false);
    expect(names()).toEqual(['Anna', 'Anna + 2 errors']);
  });
});
