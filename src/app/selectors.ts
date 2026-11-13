// Derived values for the interface, recomputed from state and never stored in it.
import type { AppState, StepId } from './store';

export const STEPS: ReadonlyArray<{ id: Exclude<StepId, 'help'>; number: number; name: string }> = [
  { id: 'judge', number: 1, name: 'Judge' },
  { id: 'cases', number: 2, name: 'Test cases' },
  { id: 'run', number: 3, name: 'Run' },
  { id: 'results', number: 4, name: 'Results' },
];

export interface NextAction {
  sentence: string;
  detail?: string;
  action: { label: string; go?: StepId; disabled?: boolean };
}

export interface StepGateInfo {
  sentence: string;
  action: { label: string; go: StepId };
}

/** The one indicator of unsaved changes (FR-051). */
export function saveIndicator(state: AppState): { text: string; kind: 'none' | 'unsaved' | 'saved' } {
  if (state.unsaved) return { text: 'Unsaved changes', kind: 'unsaved' };
  if (state.hasFile) {
    const file = state.evaluationFile ?? state.testProjectFile;
    return { text: file ? `All changes saved (${file})` : 'All changes saved', kind: 'saved' };
  }
  return { text: 'Nothing to save yet', kind: 'none' };
}

/** A step that is not available yet shows one sentence and a button that leads to what is needed first. */
export function stepGate(state: AppState, step: StepId): StepGateInfo | null {
  if ((step === 'run' || step === 'results') && !state.evaluation.dataset.finalized) {
    return {
      sentence: `${step === 'run' ? 'Run' : 'Results'} needs finalized test cases. Finalize them on the Test cases step first.`,
      action: { label: 'Go to Test cases', go: 'cases' },
    };
  }
  return null;
}

/** The "what next" line of a step (FR-001): a sentence, an optional second line and one primary action. */
export function nextAction(state: AppState, step: StepId = state.step): NextAction {
  const { judge_set, dataset } = state.evaluation;
  const count = dataset.cases.length;
  switch (step) {
    case 'judge':
      if (dataset.finalized) {
        return { sentence: 'The judge prompt and the test cases are fixed. Go on with the run.', action: { label: 'Continue', go: 'run' } };
      }
      if (judge_set.prompt.trim() === '') {
        return {
          sentence: 'Write the judge prompt, with a {{variable}} for each field of a test case.',
          action: { label: 'Next: Test cases', disabled: true },
        };
      }
      return { sentence: 'The judge is ready. Next, prepare the test cases.', action: { label: 'Next: Test cases', go: 'cases' } };
    case 'cases':
      if (dataset.finalized) {
        return { sentence: 'The test cases are finalized. Go on with the run.', detail: `${count} test cases`, action: { label: 'Continue', go: 'run' } };
      }
      if (count === 0) {
        return { sentence: 'Add your first test case, or import test cases from the File menu.', action: { label: 'Add test case' } };
      }
      return { sentence: 'Finalize the test cases when they are ready.', detail: `${count} test cases`, action: { label: 'Finalize test cases' } };
    case 'run':
      return { sentence: 'Run each test case: copy its prompt, run it in your LLM and paste the reply.', action: { label: 'Continue' } };
    case 'results':
      return { sentence: 'Read the result of the evaluation.', action: { label: 'Continue' } };
    default:
      return { sentence: 'Help explains each step with examples.', action: { label: 'Continue', go: 'judge' } };
  }
}
