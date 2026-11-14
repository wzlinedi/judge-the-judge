// "Edit the judge and run again" (FR-074): the same finalized test cases, a judge that may change, and a run that starts empty.
import type { Ports } from '../ports/types';
import { edit, forgetBothFiles, type AppState } from '../store';

export interface RerunEdit {
  state: AppState;
  /** One plain sentence for the user, when there is something to say. */
  note?: string;
}

/**
 * Keeps the finalized test cases, the judge, the metric, the thresholds and the model details; clears the replies and decisions
 * and the marks that belong to them; opens the judge prompt until the first new reply. The changed judge is a new test, so both
 * remembered files are forgotten and the first saves of the new run ask for a file and never overwrite the earlier run (FR-076).
 * The interface asks about unsaved work first (guard.ts).
 */
export function editJudgeAndRunAgain(state: AppState, ports: Ports): RerunEdit {
  if (!state.evaluation.dataset.finalized) {
    return { state, note: 'There is no run to repeat yet. Finalize the test cases and enter the replies first.' };
  }
  forgetBothFiles(ports);
  const next = edit(state, (e) => {
    const { reply_judge_version: _version, reply_counted_per: _counted, rules_corrected_after_replies: _corrected, ...rest } = e;
    return {
      ...rest,
      replies: {},
      decisions: {},
      dataset: { ...e.dataset, cases: e.dataset.cases.map(({ changed_after_first_reply: _mark, ...testCase }) => testCase) },
    };
  });
  return {
    state: { ...next, step: 'judge', openCase: null, judgeOpen: true, repliesSinceSave: 0, testProjectFile: null, evaluationFile: null },
    note: 'The replies and decisions were cleared; the test cases are kept. Change the judge, then enter the replies of the new run. Saving asks for new files.',
  };
}
