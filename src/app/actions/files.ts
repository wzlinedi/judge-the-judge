// The file actions of the More menu and the Test run step (FR-004, FR-020, FR-051, FR-073, FR-076).
// Each returns the next state and what to tell the user; nothing here touches the page.
import { testCasesVersion } from '../../core/cases/version';
import { computeResults } from '../../core/evaluation/results';
import { acceptEarlierJudgeVersion, differenceNote, recompute } from '../../core/evaluation/recompute';
import { resumePoint } from '../../core/evaluation/resume';
import { readTestProject, writeTestProject, type LoadedTestProject, type TestProjectMeta } from '../../core/io/test-project-file';
import { judgeVersion, judgeVersionWithoutUnusable } from '../../core/judge/version';
import type { Problem } from '../../core/model';
import { FileTooLargeError } from '../../core/schemas/limits';
import { metricFor, registerEmbeddedMetric, sessionRegistry } from '../metrics';
import { findMetric } from '../../core/metrics/registry';
import type { FileHandleLike, Ports } from '../ports/types';
import {
  applyLoadedTestProject,
  saveTestProject as storeSaveTestProject, saveTestProjectAs as storeSaveTestProjectAs,
  type ActionResult, type AppState, type LoadMode,
} from '../store';

/** What the actions need from the page: the clock and the tool version (the core has neither). */
export interface FileEnv {
  now(): string;
  toolVersion: string;
}

export interface LoadResult {
  state: AppState;
  outcome: 'loaded' | 'cancelled' | 'invalid' | 'needs_choice';
  /** Said to the user: what is wrong, or the notes of a file that loaded. */
  message?: string;
  /** The problems of an invalid file, each with its place. */
  problems?: Problem[];
  notes: string[];
  /** Set with 'needs_choice': the file waits for "Load with the test run" or "Load the test project only". */
  pending?: PendingLoad;
}

const metaOf = async (env: FileEnv, state: AppState): Promise<TestProjectMeta> => ({
  now: env.now(),
  toolVersion: env.toolVersion,
  judgeVersion: await judgeVersion(state.project.judge_set),
  testCasesVersion: await testCasesVersion(state.project.dataset.cases),
});

/**
 * The whole test project, with its test run and its results when the test run has started: one file (FR-020).
 * Results that cannot be worked out are left out, so the save of the error panel still writes the work (code review finding 1,
 * FR-084); the load works them out again from the replies and decisions. `leftOut` receives the reason.
 */
const serialize = (env: FileEnv, leftOut: (reason: string) => void) => async (state: AppState): Promise<string> => {
  let results: ReturnType<typeof computeResults> | null = null;
  if (state.project.testRun) {
    try {
      results = computeResults(state.project, metricFor(state.project.metric.id));
    } catch (error) {
      leftOut(error instanceof Error ? error.message : String(error));
    }
  }
  return writeTestProject(state.project, results, await metaOf(env, state));
};

const resultsLeftOut = (reason: string): string =>
  `The test project was saved without its results, because they could not be worked out (${reason}). They are worked out again when the file is loaded.`;

async function saveWith(save: typeof storeSaveTestProject, state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> {
  let reason: string | null = null;
  const result = await save(state, ports, serialize(env, (r) => (reason = r)));
  return reason !== null && result.outcome === 'saved' ? { ...result, message: resultsLeftOut(reason) } : result;
}

export const saveTestProject = (state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> => saveWith(storeSaveTestProject, state, ports, env);
export const saveTestProjectAs = (state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> => saveWith(storeSaveTestProjectAs, state, ports, env);

function describeProblems(problems: readonly Problem[]): string {
  return problems
    .map((p) => (p.line !== undefined ? `${p.message} (line ${p.line}, column ${p.column ?? 1})` : p.path !== undefined ? `${p.message} (${p.path})` : p.message))
    .join(' ');
}

/** A reader that throws (a text it was not made for) is reported like a file that is not valid; nothing changes (code review S3). */
export function unreadable(error: unknown): Problem {
  return { message: `The file could not be read: ${error instanceof Error ? error.message : String(error)}` };
}

function joinNotes(notes: readonly string[], lead: string): string | undefined {
  return notes.length > 0 ? `${lead} ${notes.join(' ')}` : undefined;
}

/** Where the loaded work continues: the first step with unfinished work (FR-073). The case window opens only on Continue. */
function atResumePoint(state: AppState): AppState {
  const point = resumePoint(state.project, metricFor(state.project.metric.id));
  return { ...state, step: point.step, openCase: null };
}

/** A file that holds a test run waits here until the user chooses how to load it; nothing is applied before (FR-076). */
export interface PendingLoad {
  read: LoadedTestProject;
  /** What the reader said about the file (for example an upgrade from version 1). */
  notes: string[];
  /** The handle of a file from the picker; a dropped file has none and is never remembered. */
  handle?: FileHandleLike;
  fileName: string;
}

export type LoadChoice = LoadMode;

/**
 * The order is: the picker, validation of the whole file, then the question when the file holds a test run.
 * The unsaved-work question comes before this call. An invalid file changes nothing and is explained here, before any question.
 */
export async function loadTestProject(state: AppState, ports: Ports, _env?: FileEnv): Promise<LoadResult> {
  let picked: Awaited<ReturnType<Ports['opener']['open']>> = null;
  try {
    picked = await ports.opener.open();
  } catch (error) {
    // the picker refuses a file above the size limit before its text is read (code review S4)
    if (!(error instanceof FileTooLargeError)) throw error;
    const problem = { message: error.message };
    return { state, outcome: 'invalid', message: problem.message, problems: [problem], notes: [] };
  }
  if (!picked) return { state, outcome: 'cancelled', notes: [] };
  const text = picked.text;
  let read: ReturnType<typeof readTestProject>;
  try {
    read = readTestProject(text, (id) => findMetric(sessionRegistry(), id) !== undefined);
  } catch (error) {
    const problem = unreadable(error);
    return { state, outcome: 'invalid', message: problem.message, problems: [problem], notes: [] };
  }
  if (!read.ok) return { state, outcome: 'invalid', message: describeProblems(read.problems), problems: read.problems, notes: [] };
  const metric = read.value.project.metric;
  registerEmbeddedMetric(metric);
  if (findMetric(sessionRegistry(), metric.id) === undefined) {
    const message = `This test project uses the metric "${metric.id}", which is not loaded, and the file has no definition of it.`;
    return { state, outcome: 'invalid', message, problems: [{ message }], notes: [] };
  }
  const pending: PendingLoad = { read: read.value, notes: read.notes, handle: picked.handle, fileName: picked.handle.name };
  if (read.value.hasTestRun) return { state, outcome: 'needs_choice', pending, notes: read.notes };
  return finishLoad(state, ports, pending, 'with');
}

/** Applies a file after the choice. A file with no test run is loaded as it is and its file is remembered. */
export async function finishLoad(state: AppState, ports: Ports, pending: PendingLoad, choice: LoadChoice): Promise<LoadResult> {
  const current = await judgeVersion(pending.read.project.judge_set);
  // a version stored before R3 agrees when it equals the version without the rules turned off (finding 8, FR-075)
  const read = acceptEarlierJudgeVersion(pending.read, current, await judgeVersionWithoutUnusable(pending.read.project.judge_set));
  const project = read.project;
  // A file with no test run is loaded as it is. A file with one is 'with' or 'only', as chosen: 'only' forgets the file.
  const mode: LoadMode = !read.hasTestRun || choice === 'with' ? 'with' : 'only';
  if (pending.handle !== undefined && mode === 'with') ports.testProjectTarget.useLoaded(pending.handle);
  else ports.testProjectTarget.forget();
  // Recomputing is how a file is audited: the numbers it stored must follow from what it holds (SC-003).
  const checked = mode === 'with' && read.hasTestRun
    ? recompute(read, metricFor(project.metric.id), {
        judgeVersion: current,
        testCasesVersion: await testCasesVersion(project.dataset.cases),
      })
    : null;
  const differences = checked?.differences ?? [];
  const next = atResumePoint(applyLoadedTestProject(state, project, ports, mode, differences));
  const warning = differenceNote(differences);
  const notes = warning === null ? pending.notes : [...pending.notes, warning];
  return { state: next, outcome: 'loaded', message: joinNotes(notes, 'The test project was loaded.'), notes };
}
