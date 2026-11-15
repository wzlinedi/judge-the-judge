// Derived values for the interface, recomputed from state and never stored in it.
import { isStarted } from '../core/cases/test-run';
import type { ReviewedCase } from '../core/evaluation/results';
import { findVariables } from '../core/judge/variables';
import { labels } from '../ui/labels';
import type { AppState, StepId } from './store';

export const STEPS: ReadonlyArray<{ id: Exclude<StepId, 'help'>; number: number; name: string }> = [
  { id: 'judge', number: 1, name: 'Judge' },
  { id: 'cases', number: 2, name: 'Test cases' },
  { id: 'run', number: 3, name: 'Run' },
  { id: 'results', number: 4, name: 'Results' },
];

/** What a button of the "what next" line does, when it is not a plain move to another step. */
export type NextIntent = 'start';

export interface NextAction {
  sentence: string;
  detail?: string;
  /** A reminder that goes with the step (FR-058). */
  note?: string;
  action: { label: string; go?: StepId; openCase?: string; disabled?: boolean; intent?: NextIntent };
}

export interface StepGateInfo {
  sentence: string;
  action: { label: string; go: StepId };
}

/** The one indicator of unsaved changes (FR-051). */
export function saveIndicator(state: AppState): { text: string; kind: 'none' | 'unsaved' | 'saved' } {
  if (state.unsaved) return { text: 'Unsaved changes', kind: 'unsaved' };
  if (state.hasFile) {
    const file = state.testProjectFile;
    return { text: file ? `All changes saved (${file})` : 'All changes saved', kind: 'saved' };
  }
  return { text: 'Nothing to save yet', kind: 'none' };
}

/** A step that is not available yet shows one sentence and a button that leads to what is needed first. */
export function stepGate(state: AppState, step: StepId): StepGateInfo | null {
  if ((step === 'run' || step === 'results') && !isStarted(state.project)) {
    return {
      sentence: `${step === 'run' ? 'Run' : 'Results'} needs a started test run. Start the test run on the Test cases step first.`,
      action: { label: labels.goToTestCases, go: 'cases' },
    };
  }
  return null;
}

/** The case Continue opens on Run: the first awaiting verification, else the first without a reply (FR-073). */
export function caseToContinue(reviewed: readonly ReviewedCase[]): string | undefined {
  return (reviewed.find((r) => r.status === 'awaiting') ?? reviewed.find((r) => r.status === 'not_run'))?.testCase.id;
}

export const NEW_CONVERSATION = 'Run every prompt in a new conversation, so that one case cannot influence another.';

/** The "what next" line of a step (FR-001): a sentence, an optional second line and one primary action. */
export function nextAction(state: AppState, step: StepId = state.step, reviewed: readonly ReviewedCase[] = []): NextAction {
  const { judge_set, dataset } = state.project;
  const count = dataset.cases.length;
  switch (step) {
    case 'judge': {
      if (isStarted(state.project)) {
        return {
          sentence: 'The judge prompt and the test cases are fixed. Go on with the run.',
          detail: 'The reply mapping and the error rules can still be changed. Test cases can still be added on the Test cases step.',
          action: { label: labels.continue, go: 'run' },
        };
      }
      const needed: string[] = [];
      if (judge_set.prompt.trim() === '') needed.push('the judge prompt');
      else if (findVariables(judge_set.prompt).length === 0) needed.push('a {{variable}} in the prompt');
      const hasSample = (judge_set.sample_reply ?? '').trim() !== '';
      const blocking = needed.length > 0;
      if (!hasSample) needed.push('a sample reply');
      if (judge_set.error_rules.length === 0) needed.push('an error rule');
      if (needed.length === 0) return { sentence: 'The judge is ready. Next, prepare the test cases.', action: { label: labels.nextTestCases, go: 'cases' } };
      return {
        sentence: `Still missing: ${needed.join(', ')}.`,
        ...(blocking ? {} : { detail: 'You can go on, but every case will then need verification by hand.' }),
        action: { label: labels.nextTestCases, ...(blocking ? { disabled: true } : { go: 'cases' as const }) },
      };
    }
    case 'cases':
      if (isStarted(state.project)) {
        return {
          sentence: 'The test run has started. Go on with the run.',
          detail: `${count} test cases. The prompt and the fields are fixed; cases can still be added.`,
          action: { label: labels.continue, go: 'run' },
        };
      }
      if (count === 0) {
        return { sentence: 'Add your first test case with the button below, or import test cases from the File menu.', action: { label: labels.startTestRun, intent: 'start', disabled: true } };
      }
      return { sentence: 'Start the test run when the test cases are ready.', detail: `${count} test cases`, action: { label: labels.startTestRun, intent: 'start' } };
    case 'run': {
      const decided = reviewed.filter((r) => r.status === 'pass' || r.status === 'fail').length;
      const next = caseToContinue(reviewed);
      const detail = `${decided} of ${reviewed.length} cases decided`;
      if (next === undefined) return { sentence: 'Every case is decided. Read the results.', detail, action: { label: labels.nextResults, go: 'results' } };
      return { sentence: 'Continue with the next case that needs you.', detail, note: NEW_CONVERSATION, action: { label: labels.continue, openCase: next } };
    }
    case 'results':
      return { sentence: 'Read the result of the evaluation.', action: { label: labels.continue } };
    default:
      return { sentence: 'Help explains each step with examples.', action: { label: labels.continue, go: 'judge' } };
  }
}
