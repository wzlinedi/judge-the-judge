// The test case window: the choice, From JSON, and the read-only view (FR-038, FR-078, FR-086, FR-090).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { caseToJson } from '../../../src/core/cases/case-json';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const withCases = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {} } };
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
    expect(within(windowOf()).getByRole('group', { name: 'Error 1' })).toBeTruthy();
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
    expect(within(windowOf()).getAllByRole('textbox')).toHaveLength(1);
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
    expect(view.querySelectorAll('mark').length).toBe(2);
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

  it('Show JSON shows the case JSON and Copy JSON; nothing can be edited', () => {
    show();
    open('Anna + 2 errors');
    const view = screen.getByRole('dialog', { name: /Anna \+ 2 errors/ });
    fireEvent.click(within(view).getByRole('button', { name: 'Show JSON' }));
    const box = within(view).getByRole('textbox', { name: 'Case JSON' }) as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(JSON.parse(box.value)).toEqual(JSON.parse(caseToJson(sampleEvaluation().dataset.cases[1]!)));
    expect(within(view).getByRole('button', { name: 'Copy JSON' })).toBeTruthy();
  });

  it('has no Clone button in the read-only view (T218)', () => {
    show();
    open('Anna + 2 errors');
    expect(within(screen.getByRole('dialog', { name: /Anna \+ 2 errors/ })).queryByRole('button', { name: 'Clone' })).toBeNull();
  });

  it('Edit expected errors is offered after finalizing for a case without a reply, and says why when there is a reply', () => {
    const s = withCases();
    const finalized: AppState = { ...s, evaluation: { ...s.evaluation, dataset: { ...s.evaluation.dataset, finalized: true } } };
    const { unmount } = show(finalized);
    open('Anna + 2 errors');
    expect(screen.getByRole('button', { name: 'Edit expected errors' })).toBeTruthy();
    unmount();
    const e = sampleEvaluation();
    show({ ...finalized, evaluation: { ...finalized.evaluation, replies: { '2': e.replies['2']! } } });
    open('Anna + 2 errors');
    expect(screen.queryByRole('button', { name: 'Edit expected errors' })).toBeNull();
    expect(within(screen.getByRole('dialog', { name: /Anna \+ 2 errors/ })).getByText(/has a reply/)).toBeTruthy();
  });

  it('Edit expected errors saves a changed difficulty and refuses a changed field', () => {
    const s = withCases();
    const finalized: AppState = { ...s, evaluation: { ...s.evaluation, dataset: { ...s.evaluation.dataset, finalized: true } } };
    show(finalized);
    open('Anna + 2 errors');
    fireEvent.click(screen.getByRole('button', { name: 'Edit expected errors' }));
    const box = within(windowOf()).getByLabelText('Case JSON') as HTMLTextAreaElement;
    const edited = JSON.parse(box.value);
    edited.fields.summary = 'changed';
    fireEvent.input(box, { target: { value: JSON.stringify(edited) } });
    expect(screen.getByText(/fields cannot change/i)).toBeTruthy();
    expect((within(windowOf()).getByRole('button', { name: 'Save case' }) as HTMLButtonElement).disabled).toBe(true);
    edited.fields.summary = JSON.parse(caseToJson(sampleEvaluation().dataset.cases[1]!)).fields.summary;
    edited.expected_errors[0].difficulty = 'subtle';
    fireEvent.input(box, { target: { value: JSON.stringify(edited) } });
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Save case' }));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});
