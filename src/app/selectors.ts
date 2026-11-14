// Derived values for the interface, recomputed from state and never stored in it.
import type { ReviewedCase } from '../core/evaluation/results';
import { MAX_CASES } from '../core/schemas/test-case';
import { findVariables } from '../core/judge/variables';
import type { AppState, StepId } from './store';

export const STEPS: ReadonlyArray<{ id: Exclude<StepId, 'help'>; number: number; name: string }> = [
  { id: 'judge', number: 1, name: 'Judge' },
  { id: 'cases', number: 2, name: 'Test cases' },
  { id: 'run', number: 3, name: 'Run' },
  { id: 'results', number: 4, name: 'Results' },
];

/** What a button of the "what next" line does, when it is not a plain move to another step. */
export type NextIntent = 'finalize' | 'add' | 'edit-cases';

export interface NextAction {
  sentence: string;
  detail?: string;
  /** A reminder that goes with the step (FR-058). */
  note?: string;
  action: { label: string; go?: StepId; openCase?: string; disabled?: boolean; intent?: NextIntent };
  /** Quieter buttons beside the primary action (FR-053): only after finalizing. */
  others?: Array<{ label: string; intent: NextIntent; disabled?: boolean }>;
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

/** The case Continue opens on Run: the first awaiting verification, else the first without a reply (FR-073). */
export function caseToContinue(reviewed: readonly ReviewedCase[]): string | undefined {
  return (reviewed.find((r) => r.status === 'awaiting') ?? reviewed.find((r) => r.status === 'not_run'))?.testCase.id;
}

/** After finalizing: cases may still be added (not on Test cases, which has the button above its table), and while no reply exists the test cases may be opened again (FR-053). */
function afterFinalizing(state: AppState, step: StepId): NextAction['others'] {
  const { dataset, replies } = state.evaluation;
  if (!dataset.finalized) return [];
  const others: NonNullable<NextAction['others']> = [];
  if (step !== 'cases') others.push({ label: 'Add test case', intent: 'add', disabled: dataset.cases.length >= MAX_CASES });
  if (Object.keys(replies).length === 0) others.push({ label: 'Edit test cases', intent: 'edit-cases' });
  return others;
}

export const NEW_CONVERSATION = 'Run every prompt in a new conversation, so that one case cannot influence another.';

/** The "what next" line of a step (FR-001): a sentence, an optional second line and one primary action. */
export function nextAction(state: AppState, step: StepId = state.step, reviewed: readonly ReviewedCase[] = []): NextAction {
  const { judge_set, dataset } = state.evaluation;
  const count = dataset.cases.length;
  switch (step) {
    case 'judge': {
      if (dataset.finalized) {
        return {
          sentence: 'The judge prompt and the test cases are fixed. Go on with the run.',
          detail: 'The reply mapping and the error rules can still be changed, and test cases can still be added.',
          action: { label: 'Continue', go: 'run' },
          others: afterFinalizing(state, 'judge'),
        };
      }
      const needed: string[] = [];
      if (judge_set.prompt.trim() === '') needed.push('the judge prompt');
      else if (findVariables(judge_set.prompt).length === 0) needed.push('a {{variable}} in the prompt');
      const hasSample = (judge_set.sample_reply ?? '').trim() !== '';
      const blocking = needed.length > 0;
      if (!hasSample) needed.push('a sample reply');
      if (judge_set.error_rules.length === 0) needed.push('an error rule');
      if (needed.length === 0) return { sentence: 'The judge is ready. Next, prepare the test cases.', action: { label: 'Next: Test cases', go: 'cases' } };
      return {
        sentence: `Still missing: ${needed.join(', ')}.`,
        ...(blocking ? {} : { detail: 'You can go on, but every case will then need verification by hand.' }),
        action: { label: 'Next: Test cases', ...(blocking ? { disabled: true } : { go: 'cases' as const }) },
      };
    }
    case 'cases':
      if (dataset.finalized) {
        return {
          sentence: 'The test cases are finalized. Go on with the run.',
          detail: `${count} test cases. The prompt and the fields are fixed; cases can still be added.`,
          action: { label: 'Continue', go: 'run' },
          others: afterFinalizing(state, 'cases'),
        };
      }
      if (count === 0) {
        return { sentence: 'Add your first test case, or import test cases from the File menu.', action: { label: 'Add test case', intent: 'add' } };
      }
      return { sentence: 'Finalize the test cases when they are ready.', detail: `${count} test cases`, action: { label: 'Finalize test cases', intent: 'finalize' } };
    case 'run': {
      const decided = reviewed.filter((r) => r.status === 'pass' || r.status === 'fail').length;
      const next = caseToContinue(reviewed);
      const detail = `${decided} of ${reviewed.length} cases decided`;
      const others = afterFinalizing(state, 'run');
      if (next === undefined) return { sentence: 'Every case is decided. Read the results.', detail, action: { label: 'Next: Results', go: 'results' }, others };
      return { sentence: 'Continue with the next case that needs you.', detail, note: NEW_CONVERSATION, action: { label: 'Continue', openCase: next }, others };
    }
    case 'results':
      return { sentence: 'Read the result of the evaluation.', action: { label: 'Continue' } };
    default:
      return { sentence: 'Help explains each step with examples.', action: { label: 'Continue', go: 'judge' } };
  }
}
