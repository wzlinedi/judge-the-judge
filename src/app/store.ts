// The session state and its named actions (contracts/core-api.md, Application state).
// Actions never change the old state: they return the next one. Derived values are never stored.
import type { CheckConfiguration, Evaluation } from '../core/model';
import type { Difference } from '../core/evaluation/recompute';
import type { Ports, SaveResult, SaveTarget } from './ports/types';

export type StepId = 'judge' | 'cases' | 'run' | 'results' | 'help';

export const DEFAULT_CHECKS: CheckConfiguration = {
  rules: [
    { measure: 'detection_rate', comparison: 'at_least', value: 0.8 },
    { measure: 'false_positive_rate', comparison: 'at_most', value: 0.1 },
    { measure: 'case_detection_rate', comparison: 'at_least', value: 0.8 },
    { measure: 'clean_case_false_positive_rate', comparison: 'at_most', value: 0.1 },
  ],
};

export const DEFAULT_METRIC = {
  id: 'accuracy',
  parameters: { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 },
};

export interface AppState {
  step: StepId;
  evaluation: Evaluation;
  /** The one unsaved flag (FR-051). Not stored in any file. */
  unsaved: boolean;
  /** Replies saved since the last "Save evaluation" (FR-059). */
  repliesSinceSave: number;
  /** Remembered file names, shown in the header; the handles live in the ports. */
  testProjectFile: string | null;
  evaluationFile: string | null;
  /** True once a file was loaded or saved, so the indicator can say "All changes saved". */
  hasFile: boolean;
  /** The case open in the case window of Run, if any. */
  openCase: string | null;
  /** "Edit the judge and run again" opened the judge prompt for the next run; it closes with the first new reply (FR-074). */
  judgeOpen: boolean;
  /**
   * What a loaded evaluation file said differently from what recomputing it gives (SC-003). It belongs to that one
   * evaluation: once any change makes a new evaluation, it no longer applies (see `recomputeDifferences`).
   */
  loadCheck: { evaluation: Evaluation; differences: Difference[] } | null;
}

/** The differences found on load, while the work is still exactly what was loaded. */
export function recomputeDifferences(state: Pick<AppState, 'evaluation' | 'loadCheck'>): Difference[] {
  return state.loadCheck !== null && state.loadCheck.evaluation === state.evaluation ? state.loadCheck.differences : [];
}

export function emptyEvaluation(): Evaluation {
  return {
    judge_set: { prompt: '', reply_mapping: { finding_text: {} }, error_rules: [], error_catalog: [] },
    dataset: { name: 'Untitled test cases', finalized: false, cases: [] },
    metric: structuredClone(DEFAULT_METRIC),
    checks: structuredClone(DEFAULT_CHECKS),
    model_note: '',
    replies: {},
    decisions: {},
  };
}

export function createState(): AppState {
  return { step: 'judge', evaluation: emptyEvaluation(), unsaved: false, repliesSinceSave: 0, testProjectFile: null, evaluationFile: null, hasFile: false, openCase: null, judgeOpen: false, loadCheck: null };
}

export function goToStep(state: AppState, step: StepId): AppState {
  return { ...state, step };
}

/** The judge prompt and the judged text are fixed once the test cases are finalized, except between "Edit the judge and run again" and the first new reply (FR-053, FR-074). */
export function promptLocked(state: Pick<AppState, 'evaluation' | 'judgeOpen'>): boolean {
  const { dataset, replies } = state.evaluation;
  return dataset.finalized && !(state.judgeOpen && Object.keys(replies).length === 0);
}

/** Any change to the work: the one place that sets the unsaved flag. */
export function edit(state: AppState, change: (evaluation: Evaluation) => Evaluation): AppState {
  return { ...state, evaluation: change(state.evaluation), unsaved: true };
}

export function setPrompt(state: AppState, prompt: string): AppState {
  return edit(state, (e) => ({ ...e, judge_set: { ...e.judge_set, prompt } }));
}

/** A threshold changed on the Results step (the only thing that step changes). */
export function setThresholds(state: AppState, checks: CheckConfiguration): AppState {
  return edit(state, (e) => ({ ...e, checks }));
}

/** Check settings loaded from a file with "Load check settings". */
export function loadCheckSettings(state: AppState, checks: CheckConfiguration): AppState {
  return edit(state, (e) => ({ ...e, checks }));
}

/** A reply was saved: it counts towards the reminder and is unsaved work. */
export function recordReplySaved(state: AppState): AppState {
  return { ...state, unsaved: true, repliesSinceSave: state.repliesSinceSave + 1 };
}

/** Writes the file text for the state; may be asynchronous because content versions are. */
export type Serializer = (state: AppState) => string | Promise<string>;

export interface ActionResult {
  state: AppState;
  outcome: SaveResult['status'];
  /** Said to the user when there is something to say. */
  message?: string;
}

const NO_LONGER_WRITABLE = 'The file can no longer be written (it was moved or removed). Your work is still here. Choose a file to save it again.';

async function write(target: SaveTarget, text: string, saveAs: boolean): Promise<SaveResult> {
  return saveAs ? target.saveAs(text) : target.save(text);
}

async function saveEvaluationWith(state: AppState, ports: Ports, serialize: Serializer, saveAs: boolean): Promise<ActionResult> {
  const result = await write(ports.evaluationTarget, await serialize(state), saveAs);
  if (result.status === 'saved') {
    return { state: { ...state, unsaved: false, repliesSinceSave: 0, evaluationFile: result.fileName, hasFile: true }, outcome: 'saved' };
  }
  if (result.status === 'no_longer_writable') {
    return { state: { ...state, evaluationFile: null }, outcome: result.status, message: NO_LONGER_WRITABLE };
  }
  return { state, outcome: result.status };
}

export function saveEvaluation(state: AppState, ports: Ports, serialize: Serializer): Promise<ActionResult> {
  return saveEvaluationWith(state, ports, serialize, false);
}

export function saveEvaluationAs(state: AppState, ports: Ports, serialize: Serializer): Promise<ActionResult> {
  return saveEvaluationWith(state, ports, serialize, true);
}

async function saveTestProjectWith(state: AppState, ports: Ports, serialize: Serializer, saveAs: boolean): Promise<ActionResult> {
  const result = await write(ports.testProjectTarget, await serialize(state), saveAs);
  if (result.status === 'saved') {
    const hasReplies = Object.keys(state.evaluation.replies).length > 0;
    // Only while no reply exists does the test project hold all the work (FR-051).
    const next = { ...state, testProjectFile: result.fileName, hasFile: true, unsaved: hasReplies ? state.unsaved : false };
    return hasReplies
      ? { state: next, outcome: 'saved', message: 'The test project was saved. Replies are kept only by "Save evaluation".' }
      : { state: next, outcome: 'saved' };
  }
  if (result.status === 'no_longer_writable') {
    return { state: { ...state, testProjectFile: null }, outcome: result.status, message: NO_LONGER_WRITABLE };
  }
  return { state, outcome: result.status };
}

export function saveTestProject(state: AppState, ports: Ports, serialize: Serializer): Promise<ActionResult> {
  return saveTestProjectWith(state, ports, serialize, false);
}

export function saveTestProjectAs(state: AppState, ports: Ports, serialize: Serializer): Promise<ActionResult> {
  return saveTestProjectWith(state, ports, serialize, true);
}

/** "Load test project": a new evaluation with these and no replies. Forgets the evaluation file (FR-076). */
export function applyLoadedTestProject(state: AppState, evaluation: Evaluation, ports: Ports): AppState {
  ports.evaluationTarget.forget();
  return {
    ...state,
    evaluation: { ...evaluation, replies: {}, decisions: {}, model_note: '', reply_judge_version: undefined, rules_corrected_after_replies: undefined },
    unsaved: false,
    repliesSinceSave: 0,
    evaluationFile: null,
    testProjectFile: ports.testProjectTarget.fileName,
    hasFile: true,
    judgeOpen: false,
  };
}

/** "Load evaluation": exactly the saved state. Forgets the test project file (FR-076). */
export function applyLoadedEvaluation(state: AppState, evaluation: Evaluation, ports: Ports, differences: Difference[] = []): AppState {
  ports.testProjectTarget.forget();
  return {
    ...state,
    evaluation,
    unsaved: false,
    repliesSinceSave: 0,
    testProjectFile: null,
    evaluationFile: ports.evaluationTarget.fileName,
    hasFile: true,
    judgeOpen: false,
    loadCheck: differences.length > 0 ? { evaluation, differences } : null,
  };
}

/** "Load example…" and "Start new evaluation" forget both files (FR-076). */
export function forgetBothFiles(ports: Ports): void {
  ports.testProjectTarget.forget();
  ports.evaluationTarget.forget();
}

export function startNewEvaluation(state: AppState, ports: Ports): AppState {
  forgetBothFiles(ports);
  return { ...createState(), step: 'judge' };
}
