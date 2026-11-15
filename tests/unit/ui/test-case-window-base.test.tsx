// The test case window: the choice, From JSON, and the read-only view (FR-038, FR-078, FR-086, FR-090).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';
import { withoutTestRun } from '../../../src/core/cases/test-run';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const withCases = (): AppState => {
  const e = sampleProject();
  return { ...createState(), step: 'cases', project: withoutTestRun(e) };
};
const show = (state: AppState = withCases()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const windowOf = () => screen.getByRole('dialog', { name: 'Test case' });
const openChoice = () => fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
const paste = (value: string) => fireEvent.input(within(windowOf()).getByLabelText('Case JSON'), { target: { value } });
const valid = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'Fresh', fields: { source_text: 'Anna is a baker.', summary: 'Anna is a doctor.' }, expected_errors: [{ fragment: 'Anna is a doctor', description: 'Changed', category: 'factual-error' }], ...over });

describe('the choice', () => {
  it('offers three choices, all enabled, also when the test project has no case', () => {
    show({ ...createState(), step: 'cases' });
    openChoice();
    for (const name of ['From JSON', 'Clean case', 'Case with errors']) {
      expect((within(windowOf()).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('always shows Close without saving; it closes at once when nothing was typed', () => {
    show();
    openChoice();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Close without saving' }));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
  });

  it('Case with errors leads to part 1: the base and the errors to prepare', () => {
    show();
    openChoice();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Case with errors' }));
    expect(within(windowOf()).getByRole('button', { name: 'Close without saving' })).toBeTruthy();
    expect(within(windowOf()).getByLabelText('Base case (optional)')).toBeTruthy();
    expect(within(windowOf()).getByRole('row', { name: 'Error 1' })).toBeTruthy();
  });
});

describe('From JSON', () => {
  const start = () => {
    show();
    openChoice();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'From JSON' }));
  };
  const save = () => within(windowOf()).getByRole('button', { name: 'Save case' }) as HTMLButtonElement;

  it('has one JSON box; Save case is enabled only while the JSON is valid', () => {
    start();
    expect(within(windowOf()).getAllByRole('textbox')).toHaveLength(2); // the name (T239) and the JSON box
    expect(within(windowOf()).getByLabelText('Case JSON')).toBeTruthy();
    expect(save().disabled).toBe(true);
    paste('{ "name": ');
    expect(screen.getByText(/Line 1, column/)).toBeTruthy();
    expect(save().disabled).toBe(true);
    paste(valid());
    expect(save().disabled).toBe(false);
  });

  it('names the kind the case will have', () => {
    start();
    paste(valid());
    expect(within(windowOf()).getByText(/saved as a case with injected errors/i)).toBeTruthy();
    paste(valid({ expected_errors: [] }));
    expect(within(windowOf()).getByText(/saved as a clean case/i)).toBeTruthy();
  });

  it('shows the expected errors under the box; Save case adds the case and closes the window', () => {
    start();
    paste(valid());
    expect(within(windowOf()).getByText('“Anna is a doctor”')).toBeTruthy();
    fireEvent.click(save());
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('Fresh')).toBeTruthy();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('a taken name is a problem under the box and blocks Save case', () => {
    start();
    paste(valid({ name: 'Anna' }));
    expect(screen.getByText(/already used by case 1/)).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it('Close without saving asks first when something was pasted', () => {
    start();
    paste(valid());
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Close without saving' }));
    const ask = screen.getByRole('dialog', { name: 'Close without saving?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('dialog', { name: 'Test case' })).toBeTruthy();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Close without saving' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Close without saving?' })).getByRole('button', { name: 'Close without saving' }));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.queryByText('Fresh')).toBeNull();
  });
});

describe('the read-only view (Open)', () => {
  const open = (name: string) => fireEvent.click(within(screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement).getByRole('button', { name: 'Open' }));

  it('shows fields, expected errors, the full prompt in a dialog and the position, with Previous and Next case; no judge reply (T234)', () => {
    show();
    open('Anna + 2 errors');
    const view = screen.getByRole('dialog', { name: /Anna \+ 2 errors/ });
    expect(within(view).getByText('2 of 2')).toBeTruthy();
    expect(within(view).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    expect(within(view).getByRole('button', { name: 'Previous case' })).toBeTruthy();
    expect(within(view).queryByRole('textbox', { name: 'Complete judge prompt' })).toBeNull();
    expect(within(view).queryByLabelText('Judge’s reply')).toBeNull();
    expect(view.querySelectorAll('[data-error]').length).toBe(2);
    expect(view.querySelectorAll('mark').length).toBe(0); // nothing highlighted until Show the issue (T257)
    expect(within(view).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
    fireEvent.click(within(view).getByRole('button', { name: 'Show prompt' }));
    const prompt = screen.getByRole('dialog', { name: 'Complete judge prompt' });
    expect((within(prompt).getByRole('textbox', { name: 'Complete judge prompt' }) as HTMLTextAreaElement).value).toContain('Anna is a doctor.');
    expect(within(prompt).getAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
    fireEvent.click(within(prompt).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Complete judge prompt' })).toBeNull();
    fireEvent.click(within(view).getByRole('button', { name: 'Previous case' }));
    expect(screen.getByRole('dialog', { name: /Anna/ })).toBeTruthy();
  });

  it('T238: has no Show JSON and no Copy JSON; Show prompt opens a dialog of about 90% of the screen', () => {
    show();
    open('Anna + 2 errors');
    const view = screen.getByRole('dialog', { name: /Anna \+ 2 errors/ });
    expect(within(view).queryByRole('button', { name: 'Show JSON' })).toBeNull();
    expect(within(view).queryByRole('button', { name: 'Copy JSON' })).toBeNull();
    fireEvent.click(within(view).getByRole('button', { name: 'Show prompt' }));
    expect(screen.getByRole('dialog', { name: 'Complete judge prompt' }).classList.contains('dialog-wide')).toBe(true);
  });

  it('T262: Open has no Recreate the test case, and From JSON has no Show prompt', () => {
    show();
    open('Anna + 2 errors');
    const view = screen.getByRole('dialog', { name: /Anna \+ 2 errors/ });
    expect(within(view).queryByRole('button', { name: /Recreate/ })).toBeNull();
    expect(view.textContent).not.toMatch(/does not keep the prompt/);
  });

  it('has no Clone button in the read-only view (T218)', () => {
    show();
    open('Anna + 2 errors');
    expect(within(screen.getByRole('dialog', { name: /Anna \+ 2 errors/ })).queryByRole('button', { name: 'Clone' })).toBeNull();
  });
});

describe('"Test case name" (T239)', () => {
  const start = () => {
    show();
    openChoice();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'From JSON' }));
  };
  const save = () => within(windowOf()).getByRole('button', { name: 'Save case' }) as HTMLButtonElement;
  const field = () => within(windowOf()).getByLabelText('Test case name') as HTMLInputElement;
  const typeName = (value: string) => fireEvent.input(field(), { target: { value } });

  it('is filled with "Case N", N being the identifier the case will get, in From JSON', () => {
    start();
    expect(field().value).toBe(`Case ${Number(sampleProject().dataset.cases.at(-1)!.id) + 1}`);
  });

  it('takes the name of the pasted JSON while the user has not typed, and keeps what the user typed after that', () => {
    start();
    paste(valid());
    expect(field().value).toBe('Fresh');
    typeName('My own name');
    expect(field().value).toBe('My own name');
    paste(valid({ name: 'Another' }));
    expect(field().value).toBe('My own name');
  });

  it('saves the case under the typed name, also when the JSON has another', () => {
    start();
    typeName('Typed name');
    paste(valid());
    fireEvent.click(save());
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByRole('row', { name: /Typed name/ })).toBeTruthy();
  });

  it('is in Case with errors too, and a name typed there reaches the case', () => {
    show();
    openChoice();
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Case with errors' }));
    expect(field().value).toMatch(/^Case \d+$/);
    typeName('Prepared case');
    paste(valid({ name: 'From the LLM' }));
    fireEvent.click(save());
    expect(screen.getByRole('row', { name: /Prepared case/ })).toBeTruthy();
  });
});
