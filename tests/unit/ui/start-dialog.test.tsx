// Starting the test run in the interface: the summary and the confirmation, and the "what next" line before and after (FR-052, FR-053; User Story 11).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { nextAction } from '../../../src/app/selectors';
import { createState, type AppState, type StepId } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { MAX_CASES } from '../../../src/core/schemas/test-case';
import { withoutTestRun } from '../../../src/core/cases/test-run';
import { sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const stateOf = (step: StepId, over: { finalized?: boolean; replies?: boolean; prompt?: string } = {}): AppState => {
  const e = sampleProject();
  const started = over.finalized ? withRun(e, { replies: over.replies ? { '2': e.testRun!.replies['2']! } : {}, decisions: {} }) : withoutTestRun(e);
  const evaluation: TestProject = {
    ...started,
    judge_set: { ...e.judge_set, ...(over.prompt !== undefined ? { prompt: over.prompt } : {}) },
  };
  return { ...createState(), step, project: evaluation };
};
const show = (state: AppState) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const bar = () => screen.getByRole('region', { name: 'What next' });
const barButtons = () => within(bar()).getAllByRole('button').map((b) => b.textContent);
const barLabels = (next: ReturnType<typeof nextAction>) => [next.action.label];
const dialog = () => screen.getByRole('dialog', { name: 'Start the test run?' });

describe('the "what next" line before the start', () => {
  it('offers Start test run as the one primary action of Test cases', () => {
    expect(nextAction(stateOf('cases'), 'cases').action.label).toBe('Start test run');
    show(stateOf('cases'));
    expect(barButtons()).toEqual(['Start test run']);
    expect(within(bar()).getByRole('button', { name: 'Start test run' }).className).toContain('primary');
  });
});

describe('the summary and the confirmation', () => {
  it('opens a summary with the counts, the balance, the test size and every warning, and changes nothing yet', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Start test run' }));
    const d = dialog();
    expect(d.textContent).toContain('2 test cases: 1 with injected errors, 1 clean');
    expect(d.textContent).toContain('1 case with 2 errors');
    expect(within(d).getByRole('group', { name: 'Test size' }).textContent).toContain('Injected errors: 2 of 30 (28 missing)');
    expect(within(d).getByRole('list', { name: 'Warnings' }).textContent).toMatch(/Inconclusive/);
    expect(d.textContent).toMatch(/fixed/);
    expect(d.textContent).toMatch(/no way back/);
    expect(barButtons()).toEqual(['Start test run']);
  });

  it('Cancel closes it and the test cases stay open', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Start test run' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Start the test run?' })).toBeNull();
    expect(barButtons()).toEqual(['Start test run']);
  });

  it('confirming fixes the test cases and the line then offers Continue, and says what is fixed', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Start test run' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Start test run' }));
    expect(screen.queryByRole('dialog', { name: 'Start the test run?' })).toBeNull();
    expect(barButtons()).toEqual(['Continue']);
    expect(bar().textContent).toMatch(/started/);
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/started/);
  });

  it('with an empty judge prompt it says why and cannot be confirmed', () => {
    show(stateOf('cases', { prompt: '' }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Start test run' }));
    expect(dialog().textContent).toMatch(/judge prompt is empty/i);
    expect((within(dialog()).getByRole('button', { name: 'Start test run' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes it like Cancel', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Start test run' }));
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Start the test run?' })).toBeNull();
  });
});

describe('the "what next" line after the start', () => {
  it('Test cases and Judge offer Continue only: there is no way back', () => {
    expect(nextAction(stateOf('cases', { finalized: true }), 'cases').action).toMatchObject({ label: 'Continue', go: 'run' });
    expect(nextAction(stateOf('judge', { finalized: true }), 'judge').sentence).toMatch(/fixed/);
    expect(barLabels(nextAction(stateOf('run', { finalized: true }), 'run'))).toEqual(['Next: Results']);
  });

  it('on Run, Add test case stands above the table of cases, not in the bar, and opens the window (T228)', () => {
    show(stateOf('run', { finalized: true }));
    expect(within(bar()).queryByRole('button', { name: 'Add test case…' })).toBeNull();
    const cases = screen.getByRole('region', { name: 'Cases' });
    fireEvent.click(within(cases).getByRole('button', { name: 'Add test case…' }));
    expect(screen.getByRole('dialog', { name: 'Test case' })).toBeTruthy();
  });

  it('on Judge there is no Add test case button at all (T228)', () => {
    show(stateOf('judge', { finalized: true }));
    expect(screen.queryByRole('button', { name: 'Add test case…' })).toBeNull();
  });

  it('on Run the button above the cases is disabled at the limit of cases (T228, FR-053)', () => {
    const base = stateOf('run', { finalized: true });
    const one = base.project.dataset.cases[0]!;
    const cases = Array.from({ length: MAX_CASES }, (_, i) => ({ ...one, id: String(i + 1), name: `Case ${i + 1}` }));
    show({ ...base, project: { ...base.project, dataset: { ...base.project.dataset, cases } } });
    expect((within(screen.getByRole('region', { name: 'Cases' })).getByRole('button', { name: 'Add test case…' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('the test project card', () => {
  it('says that the test run has started and what that fixes', () => {
    show(stateOf('cases', { finalized: true }));
    const card = screen.getByRole('region', { name: 'Test project' });
    expect(card.textContent).toMatch(/test run has started/i);
  });
});
