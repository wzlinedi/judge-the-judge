// The unsaved-work guard (FR-051, FR-056).
import { decisionsOf, isStarted } from '../core/cases/test-run';
import type { TestProject } from '../core/model';
import type { AppState } from './store';

export type GuardedAction =
  | 'load-test-project'
  | 'load-example'
  | 'start-new-evaluation'
  | 'edit-test-cases';

/** Actions that would discard unsaved work. "Edit test cases" keeps everything, so it is not here. */
const DISCARDING: readonly GuardedAction[] = ['load-test-project', 'load-example', 'start-new-evaluation'];

export interface Guard {
  question: string;
  choices: ['Save test project first', 'Discard', 'Cancel'];
}

export function guardFor(state: AppState, action: GuardedAction): Guard | null {
  if (!state.unsaved || !DISCARDING.includes(action)) return null;
  return {
    question: 'You have unsaved changes. What do you want to do with them?',
    choices: ['Save test project first', 'Discard', 'Cancel'],
  };
}

/** Anything beyond an empty project: a prompt, test cases, error rules, a started test run, or a file that was loaded or saved (T343). */
export function hasWork(state: AppState): boolean {
  const { judge_set: judge, dataset } = state.project;
  return (
    judge.prompt.trim() !== '' ||
    dataset.cases.length > 0 ||
    judge.error_rules.length > 0 ||
    judge.error_catalog.length > 0 ||
    isStarted(state.project) ||
    state.hasFile
  );
}

export interface ReplaceQuestion {
  title: string;
  text: string;
  /** The name of the action, on the one `primary` button. */
  confirm: string;
}

const CONFIRM_NAMES: Partial<Record<GuardedAction, string>> = {
  'load-test-project': 'Load test project',
  'load-example': 'Load demo',
  'start-new-evaluation': 'New test project',
};

/**
 * The question before work is replaced (T343). Only when there is work but nothing unsaved: with unsaved changes
 * the "Unsaved changes" question comes alone, so two dialogs never stack.
 */
export function replaceQuestion(state: AppState, action: GuardedAction): ReplaceQuestion | null {
  const confirm = CONFIRM_NAMES[action];
  if (!confirm || state.unsaved || !hasWork(state)) return null;
  return {
    title: 'Replace the current work?',
    text: 'The judge, the test cases and the test run in the app will be reset. To keep them, choose Cancel and save the test project first.',
    confirm,
  };
}

/** Leaving or reloading the page triggers the browser's own warning only while there is unsaved work. */
export function shouldWarnBeforeUnload(state: AppState): boolean {
  return state.unsaved;
}

/** Installs the `beforeunload` warning; returns a function that removes it. */
export function installBeforeUnload(target: Pick<Window, 'addEventListener' | 'removeEventListener'>, getState: () => AppState): () => void {
  const handler = (event: BeforeUnloadEvent) => {
    if (shouldWarnBeforeUnload(getState())) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  target.addEventListener('beforeunload', handler as EventListener);
  return () => target.removeEventListener('beforeunload', handler as EventListener);
}

/** Replacing a reply asks only when its case has decisions set by hand or from an applied opinion. */
export function replaceNeedsQuestion(evaluation: TestProject, caseId: string): { ask: boolean; count: number } {
  const decisions = decisionsOf(evaluation)[caseId];
  if (!decisions) return { ask: false, count: 0 };
  const kept = (source: string) => source === 'manual' || source === 'llm-approved';
  const count =
    Object.values(decisions.expected).filter((d) => kept(d.source)).length +
    Object.values(decisions.additional).filter((d) => kept(d.source)).length +
    decisions.added_findings.filter((f) => kept(f.source)).length;
  return { ask: count > 0, count };
}
