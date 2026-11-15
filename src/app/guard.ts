// The unsaved-work guard (FR-051, FR-056).
import { decisionsOf } from '../core/cases/test-run';
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
