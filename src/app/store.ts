// The session state and its named actions (contracts/core-api.md, Application state).
// Actions never change the old state: they return the next one. Derived values are never stored.
import { isStarted, withoutTestRun } from '../core/cases/test-run';
import type { CheckConfiguration, TestProject } from '../core/model';
import checksDefaults from '../core/metrics/builtin/checks.default.json';
import type { Difference } from '../core/evaluation/recompute';
import type { Ports, SaveResult, SaveTarget } from './ports/types';
import { isFileTooLarge, saveTooLargeMessage } from '../core/schemas/limits';

export type StepId = 'judge' | 'cases' | 'run' | 'results' | 'help';

/** The thresholds a new test project starts with: they come from the bundled checks file, not from code. */
export const DEFAULT_CHECKS: CheckConfiguration = { rules: checksDefaults.rules as CheckConfiguration['rules'] };

export const DEFAULT_METRIC = {
  id: 'accuracy',
  parameters: { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 },
};

export interface AppState {
  step: StepId;
  project: TestProject;
  /** The one unsaved flag (FR-051). Not stored in any file. */
  unsaved: boolean;
  /** Replies saved since the last "Save test project" (FR-059). */
  repliesSinceSave: number;
  /** Remembered file names, shown in the header; the handles live in the ports. */
  testProjectFile: string | null;
  /** True once a file was loaded or saved, so the indicator can say "All changes saved". */
  hasFile: boolean;
  /** The case open in the case window of Run, if any. */
  openCase: string | null;
  /**
   * What a loaded test project said differently from what recomputing it gives (SC-003). It belongs to that one
   * result: once any change makes a new result, it no longer applies (see `recomputeDifferences`).
   */
  loadCheck: { project: TestProject; differences: Difference[] } | null;
}

/** The differences found on load, while the work is still exactly what was loaded. */
export function recomputeDifferences(state: Pick<AppState, 'project' | 'loadCheck'>): Difference[] {
  return state.loadCheck !== null && state.loadCheck.project === state.project ? state.loadCheck.differences : [];
}

export function emptyTestProject(): TestProject {
  return {
    judge_set: { prompt: '', reply_mapping: { finding_text: {} }, error_rules: [], error_catalog: [] },
    dataset: { name: 'Untitled test cases', cases: [] },
    metric: structuredClone(DEFAULT_METRIC),
    checks: structuredClone(DEFAULT_CHECKS),
  };
}

export function createState(): AppState {
  return { step: 'judge', project: emptyTestProject(), unsaved: false, repliesSinceSave: 0, testProjectFile: null, hasFile: false, openCase: null, loadCheck: null };
}

export function goToStep(state: AppState, step: StepId): AppState {
  return { ...state, step };
}

/** The judge prompt and the judged text are fixed once the test run has started, with no way back (FR-053). */
export function promptLocked(state: Pick<AppState, 'project'>): boolean {
  return isStarted(state.project);
}

/** Any change to the work: the one place that sets the unsaved flag. */
export function edit(state: AppState, change: (evaluation: TestProject) => TestProject): AppState {
  return { ...state, project: change(state.project), unsaved: true };
}

export function setPrompt(state: AppState, prompt: string): AppState {
  return edit(state, (e) => ({ ...e, judge_set: { ...e.judge_set, prompt } }));
}

/** A threshold changed on the Results step (the only thing that step changes). */
export function setThresholds(state: AppState, checks: CheckConfiguration): AppState {
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
  /** `too_large`: the file would be over the limit of the reader, so nothing was written (T416). */
  outcome: SaveResult['status'] | 'too_large';
  /** Said to the user when there is something to say. */
  message?: string;
  /**
   * What the action changes, applied to the state as it is when the action ends. A save waits for a file, so the user may have
   * changed the work meanwhile; the whole `state` above would write that change away (R1, research.md 34).
   */
  apply?: (current: AppState) => AppState;
}

const NO_LONGER_WRITABLE = 'The file can no longer be written (it was moved or removed). Your work is still here. Choose a file to save it again.';

async function write(target: SaveTarget, text: string, saveAs: boolean): Promise<SaveResult> {
  return saveAs ? target.saveAs(text) : target.save(text);
}

async function saveTestProjectWith(state: AppState, ports: Ports, serialize: Serializer, saveAs: boolean): Promise<ActionResult> {
  const text = await serialize(state);
  // a file the tool could not read back is not written; the work stays in the page (Clarifications 2026-11-17, T416)
  const bytes = new TextEncoder().encode(text).length;
  if (isFileTooLarge(bytes)) return { state, outcome: 'too_large', message: saveTooLargeMessage(bytes) };
  const result = await write(ports.testProjectTarget, text, saveAs);
  if (result.status === 'saved') {
    // The file holds all the work, with its test run when there is one: one indicator, one count (FR-051, FR-059).
    const saved = { ...state, unsaved: false, repliesSinceSave: 0, testProjectFile: result.fileName, hasFile: true };
    // The work is marked saved only when it is still the work that was written.
    const apply = (current: AppState): AppState =>
      current === state
        ? saved
        : { ...current, testProjectFile: result.fileName, hasFile: true, ...(current.project === state.project ? { unsaved: false, repliesSinceSave: 0 } : { unsaved: true }) };
    return { state: saved, outcome: 'saved', apply };
  }
  if (result.status === 'no_longer_writable') {
    return { state: { ...state, testProjectFile: null }, outcome: result.status, message: NO_LONGER_WRITABLE, apply: (current) => ({ ...current, testProjectFile: null }) };
  }
  return { state, outcome: result.status };
}

export function saveTestProject(state: AppState, ports: Ports, serialize: Serializer): Promise<ActionResult> {
  return saveTestProjectWith(state, ports, serialize, false);
}

export function saveTestProjectAs(state: AppState, ports: Ports, serialize: Serializer): Promise<ActionResult> {
  return saveTestProjectWith(state, ports, serialize, true);
}

/** What the user chose for a file that holds a test run (FR-076). */
export type LoadMode = 'with' | 'only';

/**
 * A loaded test project. 'with' keeps its test run and exactly the saved state; 'only' drops the test run and forgets the file,
 * so the first save asks for a new one. The caller has already made the loaded file the remembered one, or forgotten it.
 */
export function applyLoadedTestProject(state: AppState, project: TestProject, ports: Ports, mode: LoadMode, differences: Difference[] = []): AppState {
  if (mode === 'only') ports.testProjectTarget.forget();
  const loaded = mode === 'only' ? withoutTestRun(project) : project;
  return {
    ...state,
    project: loaded,
    unsaved: false,
    repliesSinceSave: 0,
    testProjectFile: ports.testProjectTarget.fileName,
    hasFile: true,
    loadCheck: differences.length > 0 ? { project: loaded, differences } : null,
  };
}

/** "Load demo…" and "New test project" forget the remembered file (FR-076). */
export function forgetFile(ports: Ports): void {
  ports.testProjectTarget.forget();
}

export function startNewTestProject(state: AppState, ports: Ports): AppState {
  forgetFile(ports);
  return { ...createState(), step: 'judge' };
}
