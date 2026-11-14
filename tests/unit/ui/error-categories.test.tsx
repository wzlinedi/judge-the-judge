// The "Error categories" section and "Load metric definition…" (FR-015, FR-087, Principle VI).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
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
const rowOf = (name: string) => screen.getByRole('listitem', { name }) as HTMLElement;

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
    expect(screen.queryByRole('list', { name: 'Categories' })).toBeNull();
  });

  it('opens and closes by a click and from the keyboard, and the choice is kept for the page session', () => {
    show();
    fireEvent.click(heading());
    expect(heading().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: 'Categories' })).toBeTruthy();
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

  it('shows the description and example, editable, and how many test cases use it', () => {
    open();
    const row = rowOf('factual-error');
    expect((within(row).getByLabelText('Description of factual-error') as HTMLInputElement).value).toMatch(/untrue/);
    expect(within(row).getByText('Used by 1 test case')).toBeTruthy();
    expect(within(rowOf('misattribution')).getByText('Used by 0 test cases')).toBeTruthy();
    fireEvent.input(within(row).getByLabelText('Example of factual-error'), { target: { value: 'a new example' } });
    expect((within(rowOf('factual-error')).getByLabelText('Example of factual-error') as HTMLInputElement).value).toBe('a new example');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('disables Remove for a used category with the reason beside it; an unused one is removed at once', () => {
    open();
    const used = rowOf('factual-error');
    expect((within(used).getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled).toBe(true);
    expect(used.textContent).toContain('Used by 1 test case. Remove that test case first, or rename the category.');
    fireEvent.click(within(rowOf('misattribution')).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('listitem', { name: 'misattribution' })).toBeNull();
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
    expect(screen.getByRole('listitem', { name: 'wrong-fact' })).toBeTruthy();
    expect(within(rowOf('wrong-fact')).getByText('Used by 1 test case')).toBeTruthy();
  });

  it('Add category adds one category per line and reports what was skipped', () => {
    open();
    fireEvent.input(screen.getByLabelText('Categories to add'), { target: { value: 'Tone - the wrong tone\nfactual-error' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(screen.getByRole('listitem', { name: 'tone' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/Added: tone\. Already in the catalog: factual-error/);
    expect((screen.getByLabelText('Categories to add') as HTMLTextAreaElement).value).toBe('');
  });
});

describe('Load metric definition…', () => {
  const bias = readFileSync('examples/metrics/bias-example.json', 'utf8');
  const openWindow = () => {
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Load example…' }));
    return screen.getByRole('dialog', { name: 'Load example…' });
  };

  it('adds a new example to the window, which starts a test project with a single field', async () => {
    const ports = createFakePorts();
    show(stateWith(), ports);
    let dialog = openWindow();
    ports.opener.next = { name: 'bias.json', text: bias };
    fireEvent.click(within(dialog).getByRole('button', { name: 'Load metric definition…' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Load example…' })).getByRole('button', { name: 'Bias' })).toBeTruthy());
    dialog = screen.getByRole('dialog', { name: 'Load example…' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bias' }));
    expect(screen.queryByRole('dialog', { name: 'Load example…' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /1\s*Judge/ }));
    expect((screen.getByLabelText('Judge prompt') as HTMLTextAreaElement).value).toContain('{{text}}');
  });

  it('shows the problems of an invalid file in the window and registers nothing', async () => {
    const ports = createFakePorts();
    show(stateWith(), ports);
    const dialog = openWindow();
    ports.opener.next = { name: 'bad.json', text: '{ "format": ' };
    fireEvent.click(within(dialog).getByRole('button', { name: 'Load metric definition…' }));
    const alert = await within(screen.getByRole('dialog', { name: 'Load example…' })).findByRole('alert');
    expect(alert.textContent).toMatch(/not readable JSON/);
    expect(within(screen.getByRole('dialog', { name: 'Load example…' })).queryByRole('button', { name: 'Bias' })).toBeNull();
  });

  it('asks before replacing a definition loaded earlier', async () => {
    const ports = createFakePorts();
    show(stateWith(), ports);
    for (let i = 0; i < 2; i++) {
      ports.opener.next = { name: 'bias.json', text: bias };
      fireEvent.click(within(screen.queryByRole('dialog', { name: 'Load example…' }) ?? openWindow()).getByRole('button', { name: 'Load metric definition…' }));
      await waitFor(() => expect(ports.opener.next).toBeNull());
    }
    const dialog = screen.getByRole('dialog', { name: 'Load example…' });
    expect(await within(dialog).findByText(/already loaded/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Load example…' })).queryByText(/already loaded/)).toBeNull());
  });
});
