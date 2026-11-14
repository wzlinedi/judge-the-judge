// The "Error categories" section (FR-015, FR-087, Principle VI).
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

  it('is a table with the columns Name, Description, Used by and the buttons Example, Rename, Remove (T237)', () => {
    open();
    const table = screen.getByRole('table', { name: 'Categories' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Name', 'Description', 'Used by', 'Actions']);
    expect(within(rowOf('factual-error')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Example', 'Rename', 'Remove']);
    expect(within(table).queryByLabelText('Example of factual-error')).toBeNull();
  });

  it('shows the description, editable, and how many test cases use it', () => {
    open();
    const row = rowOf('factual-error');
    expect((within(row).getByLabelText('Description of factual-error') as HTMLInputElement).placeholder).toMatch(/What this kind of error is/);
    expect((within(row).getByLabelText('Description of factual-error') as HTMLInputElement).value).toMatch(/untrue/);
    expect(within(row).getByText('Used by 1 test case')).toBeTruthy();
    expect(within(rowOf('misattribution')).getByText('Used by 0 test cases')).toBeTruthy();
    fireEvent.input(within(row).getByLabelText('Description of factual-error'), { target: { value: 'a new description' } });
    expect((within(rowOf('factual-error')).getByLabelText('Description of factual-error') as HTMLInputElement).value).toBe('a new description');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('Example is disabled while no test case uses the category; otherwise it shows the cases one at a time with the fragment highlighted', () => {
    open();
    expect((within(rowOf('misattribution')).getByRole('button', { name: 'Example' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Example' }));
    const dialog = screen.getByRole('dialog', { name: 'Example: factual-error' });
    expect(within(dialog).getByRole('status', { name: 'Position' }).textContent).toMatch(/^case 2 · Anna \+ 2 errors \(1 of 1\)$/);
    expect(dialog.querySelectorAll('mark.fragment-strong').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('list', { name: 'Errors of this category' }).textContent).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Previous case' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Next case' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Example holds the short example for prompts, edited there and kept in the catalog', () => {
    open();
    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Example' }));
    const dialog = screen.getByRole('dialog', { name: 'Example: factual-error' });
    fireEvent.input(within(dialog).getByLabelText('Short example for prompts'), { target: { value: 'a new example' } });
    expect((within(screen.getByRole('dialog', { name: 'Example: factual-error' })).getByLabelText('Short example for prompts') as HTMLInputElement).value).toBe('a new example');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Example: factual-error' })).toBeNull();
  });

  it('Rename says first what it changes: the cases using the category, the version and the error analysis', () => {
    open();
    fireEvent.click(within(rowOf('factual-error')).getByRole('button', { name: 'Rename' }));
    const text = screen.getByRole('dialog', { name: 'Rename category' }).textContent ?? '';
    expect(text).toContain('The 1 test case using it is renamed too.');
    expect(text).toContain('The test cases version changes');
    expect(text).toContain('error analysis of Results uses the new name');
  });

  it('disables Remove for a used category with the reason beside it; an unused one is removed at once', () => {
    open();
    const used = rowOf('factual-error');
    expect((within(used).getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled).toBe(true);
    expect(used.textContent).toContain('Used by 1 test case. Remove that test case first, or rename the category.');
    fireEvent.click(within(rowOf('misattribution')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('row', { name: 'misattribution' })).toBeNull();
    fireEvent.click(heading());
    expect(heading().textContent).toContain('4 categories');
  });

  it('after finalizing, says a category with replies can be renamed', () => {
    open(stateWith({ finalized: true }));
    expect(rowOf('factual-error').textContent).toContain('Used by 1 test case. It can be renamed.');
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

  it('Add categories adds one category per line and reports what was skipped', () => {
    open();
    fireEvent.input(screen.getByLabelText('Categories to add'), { target: { value: 'Tone - the wrong tone\nfactual-error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add categories' }));
    expect(screen.getByRole('row', { name: 'tone' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/Added: tone\. Already in the catalog: factual-error/);
    expect((screen.getByLabelText('Categories to add') as HTMLTextAreaElement).value).toBe('');
  });
});
