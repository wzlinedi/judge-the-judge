// "Start test run" (FR-052, FR-053). There is no way back: the test run is never cleared or reopened.
import { startSummary } from '../../core/cases/start-summary';
import { emptyTestRun, isStarted } from '../../core/cases/test-run';
import { edit, type AppState } from '../store';

export interface StartEdit {
  state: AppState;
  /** One plain sentence for the user, when there is something to say. */
  note?: string;
}

/** Starts the test run: fixes the judge prompt and the fields of the cases; refused when there is nothing to judge. The summary is shown first by the interface. */
export function startTestRun(state: AppState): StartEdit {
  if (isStarted(state.project)) return { state, note: 'The test run has already started.' };
  const summary = startSummary(state.project);
  if (!summary.allowed) return { state, note: summary.refusal ?? 'The test run cannot be started yet.' };
  return { state: edit(state, (e) => ({ ...e, testRun: emptyTestRun() })), note: 'The test run has started. The judge prompt and the fields of every case are now fixed.' };
}
