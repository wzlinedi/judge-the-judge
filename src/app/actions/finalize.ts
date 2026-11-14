// "Finalize test cases" and "Edit test cases" (FR-052, FR-053).
import { finalizeSummary } from '../../core/cases/finalize';
import { edit, type AppState } from '../store';

export interface FinalizeEdit {
  state: AppState;
  /** One plain sentence for the user, when there is something to say. */
  note?: string;
}

const hasReplies = (state: AppState): boolean => Object.keys(state.evaluation.replies).length > 0;

/** Fixes the judge prompt and the cases' fields for the evaluation; refused when there is nothing to fix. The summary is shown first by the interface. */
export function finalize(state: AppState): FinalizeEdit {
  if (state.evaluation.dataset.finalized) return { state, note: 'The test cases are already finalized.' };
  const summary = finalizeSummary(state.evaluation);
  if (!summary.allowed) return { state, note: summary.refusal ?? 'The test cases cannot be finalized yet.' };
  return { state: edit(state, (e) => ({ ...e, dataset: { ...e.dataset, finalized: true } })), note: 'The test cases are finalized. The judge prompt and the fields of every case are now fixed.' };
}

/** Opens the test cases and the prompt again, only while no reply exists. Nothing is lost and both remembered files are kept, because it corrects the same test. */
export function editTestCases(state: AppState): FinalizeEdit {
  if (!state.evaluation.dataset.finalized) return { state, note: 'The test cases are not finalized, so they are already open.' };
  if (hasReplies(state)) {
    return { state, note: 'Reopen test cases is no longer possible: the first reply is entered. Use "Run again with a new judge…" or "New evaluation" to change the test.' };
  }
  const next = edit(state, (e) => ({ ...e, dataset: { ...e.dataset, finalized: false } }));
  return {
    state: state.step === 'run' || state.step === 'results' ? { ...next, step: 'cases', openCase: null } : next,
    note: 'The test cases are open again. Finalize them again before entering replies.',
  };
}
