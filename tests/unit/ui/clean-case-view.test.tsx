// The clean case view (FR-083, FR-084, SC-021).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { metricFor } from '../../../src/app/metrics';
import { startFromMetric } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const initial = (): AppState => ({ ...startFromMetric(createState(), metricFor('accuracy'), createFakePorts()), step: 'cases' });
const windowOf = () => screen.getByRole('dialog', { name: 'Test case' });
const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'From LLM', fields: { source_text: 'A tidy source text about a baker.', summary: 'A tidy summary about a baker.' }, expected_errors: [], ...over });

function start() {
  render(<App ports={createFakePorts()} env={env} initialState={initial()} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
  fireEvent.click(within(windowOf()).getByRole('button', { name: 'Clean case' }));
}
const type = (label: string, value: string) => fireEvent.input(within(windowOf()).getByLabelText(label), { target: { value } });
const approve = () => within(windowOf()).getByRole('button', { name: 'Save case' }) as HTMLButtonElement;
const promptText = () => (within(windowOf()).getByRole('textbox', { name: 'Prompt for your LLM' }) as HTMLTextAreaElement).value;

describe('the prompt', () => {
  it('shows the full prompt with Copy prompt; there is no Comment box (T249)', () => {
    start();
    const before = promptText();
    expect(before).toContain('{{source_text}}');
    expect(before).toContain('factual-error');
    expect(within(windowOf()).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
    expect(within(windowOf()).queryByLabelText('Comment (optional)')).toBeNull();
    const like = within(windowOf()).getByLabelText('Like case (optional)') as HTMLSelectElement;
    expect(like.options[0]?.textContent).toBe('None');
    expect(like.options).toHaveLength(4);
    fireEvent.change(like, { target: { value: like.options[1]!.value } });
    expect(promptText()).toContain('Anna is a baker');
  });
});

describe('the answer', () => {
  it('is checked as it is pasted, with line and column; Save case stays disabled', () => {
    start();
    expect(approve().disabled).toBe(true);
    type('Answer of your LLM', '{\n "name": \n');
    expect(screen.getByText(/Line \d+, column \d+/)).toBeTruthy();
    expect(approve().disabled).toBe(true);
  });

  it('the disabled Save case says what is needed, and the sentence goes when the answer is valid', () => {
    start();
    expect(approve().getAttribute('aria-describedby')).toBe('clean-approve-why');
    expect(within(windowOf()).getByText('Paste the answer of your LLM to approve.')).toBeTruthy();
    type('Answer of your LLM', '{\n "name": \n');
    expect(within(windowOf()).getByText('Fix the problems listed under the answer to approve.')).toBeTruthy();
    type('Answer of your LLM', answer());
    expect(within(windowOf()).queryByText(/to approve\.$/)).toBeNull();
    expect(approve().getAttribute('aria-describedby')).toBeNull();
  });

  it('an answer with expected errors is a problem that points to From JSON', () => {
    start();
    type('Answer of your LLM', answer({ expected_errors: [{ description: 'x', fragment: 'tidy' }] }));
    expect(screen.getByText(/Use "From JSON"/)).toBeTruthy();
    expect(approve().disabled).toBe(true);
  });

  it('a missing variable is a problem with its path', () => {
    start();
    type('Answer of your LLM', answer({ fields: { source_text: 'only one' } }));
    expect(screen.getByText(/fields\.summary/)).toBeTruthy();
  });

  it('a valid answer shows its fields read-only and Save case saves under the typed name and closes', () => {
    start();
    type('Test case name', 'My clean case');
    type('Answer of your LLM', answer());
    expect(within(windowOf()).getByText('A tidy summary about a baker.')).toBeTruthy();
    expect(approve().disabled).toBe(false);
    fireEvent.click(approve());
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    expect(screen.getByText('My clean case')).toBeTruthy();
    expect(screen.getAllByText('Clean').length).toBeGreaterThanOrEqual(4);
  });

  it('with no typed name the name of the answer is used', () => {
    start();
    type('Answer of your LLM', answer());
    fireEvent.click(approve());
    expect(screen.getByText('From LLM')).toBeTruthy();
  });

  it('a taken name is a problem', () => {
    start();
    type('Test case name', 'short story, CLEAN');
    type('Answer of your LLM', answer());
    expect(screen.getByText(/already used by case 1/)).toBeTruthy();
    expect(approve().disabled).toBe(true);
  });

  it('Close without saving asks first once something was typed', () => {
    start();
    type('Test case name', 'x');
    fireEvent.click(within(windowOf()).getByRole('button', { name: 'Close without saving' }));
    expect(screen.getByRole('dialog', { name: 'Close without saving?' })).toBeTruthy();
  });
});

describe('what the fields do (T223 and T224, found by the T221 run)', () => {
  it('says what "Like case" does', () => {
    start();
    expect(windowOf().textContent).toMatch(/The prompt shows your LLM the texts of this case as an example, so that the new case has the same kind of text\./);
  });
});
