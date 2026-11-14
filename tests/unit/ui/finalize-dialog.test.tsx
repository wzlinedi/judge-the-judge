// Finalizing in the interface: the summary and the confirmation, and the "what next" line before and after (FR-052, FR-053; User Story 11).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { nextAction } from '../../../src/app/selectors';
import { createState, type AppState, type StepId } from '../../../src/app/store';
import type { Evaluation } from '../../../src/core/model';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const stateOf = (step: StepId, over: { finalized?: boolean; replies?: boolean; prompt?: string } = {}): AppState => {
  const e = sampleEvaluation();
  const evaluation: Evaluation = {
    ...e,
    judge_set: { ...e.judge_set, ...(over.prompt !== undefined ? { prompt: over.prompt } : {}) },
    dataset: { ...e.dataset, finalized: over.finalized ?? false },
    replies: over.replies ? { '2': e.replies['2']! } : {},
    decisions: {},
  };
  return { ...createState(), step, evaluation };
};
const show = (state: AppState) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const bar = () => screen.getByRole('region', { name: 'What next' });
const barButtons = () => within(bar()).getAllByRole('button').map((b) => b.textContent);
const dialog = () => screen.getByRole('dialog', { name: 'Finalize the test cases?' });

describe('the "what next" line before finalizing', () => {
  it('offers Finalize test cases as the one primary action of Test cases', () => {
    expect(nextAction(stateOf('cases'), 'cases').action.label).toBe('Finalize test cases');
    show(stateOf('cases'));
    expect(barButtons()).toEqual(['Finalize test cases']);
    expect(within(bar()).getByRole('button', { name: 'Finalize test cases' }).className).toContain('primary');
  });
});

describe('the summary and the confirmation', () => {
  it('opens a summary with the counts, the balance, the test size and every warning, and changes nothing yet', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Finalize test cases' }));
    const d = dialog();
    expect(d.textContent).toContain('2 test cases: 1 with injected errors, 1 clean');
    expect(d.textContent).toContain('1 case with 2 errors');
    expect(within(d).getByRole('group', { name: 'Test size' }).textContent).toContain('Injected errors: 2 of 30 (28 missing)');
    expect(within(d).getByRole('list', { name: 'Warnings' }).textContent).toMatch(/Inconclusive/);
    expect(d.textContent).toMatch(/fixed/);
    expect(d.textContent).toMatch(/Edit test cases/);
    expect(barButtons()).toEqual(['Finalize test cases']);
  });

  it('Cancel closes it and the test cases stay open', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Finalize test cases' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Finalize the test cases?' })).toBeNull();
    expect(barButtons()).toEqual(['Finalize test cases']);
  });

  it('confirming fixes the test cases and the line then offers Continue, Edit test cases, and says what is fixed', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Finalize test cases' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Finalize test cases' }));
    expect(screen.queryByRole('dialog', { name: 'Finalize the test cases?' })).toBeNull();
    expect(barButtons()).toEqual(['Continue', 'Edit test cases']);
    expect(bar().textContent).toMatch(/finalized/);
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/finalized/);
  });

  it('with an empty judge prompt it says why and cannot be confirmed', () => {
    show(stateOf('cases', { prompt: '' }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Finalize test cases' }));
    expect(dialog().textContent).toMatch(/judge prompt is empty/i);
    expect((within(dialog()).getByRole('button', { name: 'Finalize test cases' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes it like Cancel', () => {
    show(stateOf('cases'));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Finalize test cases' }));
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Finalize the test cases?' })).toBeNull();
  });
});

describe('the "what next" line after finalizing', () => {
  it('Test cases: Continue, and Edit test cases while no reply exists; Add test case is already above the table', () => {
    const next = nextAction(stateOf('cases', { finalized: true }), 'cases');
    expect(next.action).toMatchObject({ label: 'Continue', go: 'run' });
    expect(next.others?.map((o) => o.label)).toEqual(['Edit test cases']);
    expect(nextAction(stateOf('cases', { finalized: true, replies: true }), 'cases').others ?? []).toEqual([]);
  });

  it('Judge: says what is fixed and what may still change, with Add test case and Edit test cases beside Continue', () => {
    const next = nextAction(stateOf('judge', { finalized: true }), 'judge');
    expect(next.sentence).toMatch(/fixed/);
    expect(next.detail).toMatch(/reply mapping and the error rules/);
    expect(next.others?.map((o) => o.label)).toEqual(['Add test case', 'Edit test cases']);
    expect(nextAction(stateOf('judge', { finalized: true, replies: true }), 'judge').others?.map((o) => o.label)).toEqual(['Add test case']);
  });

  it('Run: Add test case and Edit test cases beside the primary action; no Edit after the first reply', () => {
    expect(nextAction(stateOf('run', { finalized: true }), 'run').others?.map((o) => o.label)).toEqual(['Add test case', 'Edit test cases']);
    expect(nextAction(stateOf('run', { finalized: true, replies: true }), 'run').others?.map((o) => o.label)).toEqual(['Add test case']);
  });

  it('Results and the steps before finalizing have no extra actions', () => {
    expect(nextAction(stateOf('judge'), 'judge').others ?? []).toEqual([]);
    expect(nextAction(stateOf('results', { finalized: true }), 'results').others ?? []).toEqual([]);
  });

  it('Edit test cases opens the test cases again and the line offers Finalize test cases', () => {
    show(stateOf('cases', { finalized: true }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Edit test cases' }));
    expect(barButtons()).toEqual(['Finalize test cases']);
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/open again/i);
  });

  it('on Judge, Edit test cases makes the prompt editable again', () => {
    show(stateOf('judge', { finalized: true }));
    expect(screen.getByText(/The prompt is fixed/)).toBeTruthy();
    fireEvent.click(within(bar()).getByRole('button', { name: 'Edit test cases' }));
    expect(screen.queryByText(/The prompt is fixed/)).toBeNull();
  });

  it('on Run, Edit test cases goes back to Test cases', () => {
    show(stateOf('run', { finalized: true }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Edit test cases' }));
    expect(screen.getByRole('table', { name: 'Test cases' })).toBeTruthy();
  });

  it('on Judge and Run, Add test case opens the window to add a case', () => {
    show(stateOf('run', { finalized: true }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Add test case' }));
    expect(screen.getByRole('dialog', { name: 'Test case' })).toBeTruthy();
  });
});

describe('the test project card', () => {
  it('says that the test cases are finalized and what that fixes', () => {
    show(stateOf('cases', { finalized: true }));
    const card = screen.getByRole('region', { name: 'Test project' });
    expect(card.textContent).toMatch(/finalized/i);
  });
});
