// T306 (b) to (d): the Test run step before the start, the lock notice on Judge, and the "what next" line (FR-052, FR-053).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState, type StepId } from '../../../src/app/store';
import { withoutTestRun } from '../../../src/core/cases/test-run';
import { sampleProject } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const stateOf = (step: StepId, started: boolean): AppState => ({ ...createState(), step, project: started ? sampleProject() : withoutTestRun(sampleProject()) });
const show = (state: AppState, ports = createFakePorts()) => render(<App ports={ports} env={env} initialState={state} />);

describe('the Test run step before the start (T306 b)', () => {
  it('shows its content with every action disabled and the reason beside each', () => {
    show(stateOf('run', false));
    expect(screen.queryByText(/needs a started test run/)).toBeNull();
    const main = screen.getByRole('main');
    expect((within(main).getByRole('button', { name: 'Add test case…' }) as HTMLButtonElement).disabled).toBe(true);
    const open = within(main).getAllByRole('button', { name: 'Open' }) as HTMLButtonElement[];
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((b) => b.disabled)).toBe(true);
    expect((within(main).getByLabelText('Model details') as HTMLTextAreaElement).disabled).toBe(true);
    expect(within(main).getAllByText('Start the test run first').length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the gate of Results', () => {
    show(stateOf('results', false));
    expect(screen.getByText(/Results needs a started test run/)).toBeTruthy();
  });

  it('enables the actions after the start', () => {
    show(stateOf('run', true));
    expect(screen.queryByText('Start the test run first')).toBeNull();
    expect((screen.getAllByRole('button', { name: 'Open' })[0] as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the Judge step after the start (T306 c)', () => {
  it('locks the prompt and the judged text, says how to test another prompt, and offers Load test project…', () => {
    show(stateOf('judge', true));
    const prompt = screen.getByRole('region', { name: 'Prompt and variables' });
    expect((within(prompt).getByLabelText('Judge prompt') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(prompt.textContent).toContain('The test run has started, so the prompt is fixed. To test another prompt, load the test project with “Load the test project only”.');
    fireEvent.click(within(prompt).getByRole('button', { name: 'Load test project…' }));
  });

  it('keeps the sample reply editable', () => {
    show(stateOf('judge', true));
    expect((screen.getByLabelText('Sample reply') as HTMLTextAreaElement).readOnly).toBe(false);
  });

  it('has no Load test project… button in the notice before the start', () => {
    show(stateOf('judge', false));
    expect(within(screen.getByRole('region', { name: 'Prompt and variables' })).queryByRole('button', { name: 'Load test project…' })).toBeNull();
  });
});

describe('the "what next" line (T306 d)', () => {
  it('says what is fixed and what can change, and never offers to reopen the test cases', () => {
    show(stateOf('judge', true));
    const next = screen.getByRole('region', { name: 'What next' });
    expect(next.textContent).toMatch(/fixed/);
    expect(next.textContent).toMatch(/can still be changed/);
    expect(document.body.textContent).not.toMatch(/Reopen test cases/);
  });
});
