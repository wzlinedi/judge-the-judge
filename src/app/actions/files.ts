// The file actions of the File menu and the Run step (FR-004, FR-020, FR-051, FR-073, FR-076).
// Each returns the next state and what to tell the user; nothing here touches the page.
import { testCasesVersion } from '../../core/cases/version';
import { computeResults } from '../../core/evaluation/results';
import { differenceNote, recompute } from '../../core/evaluation/recompute';
import { resumePoint } from '../../core/evaluation/resume';
import { readEvaluation, writeEvaluation } from '../../core/io/evaluation-file';
import { readTestProject, writeTestProject } from '../../core/io/test-project-file';
import { judgeVersion } from '../../core/judge/version';
import type { Problem } from '../../core/model';
import { metricFor, registerEmbeddedMetric, sessionRegistry } from '../metrics';
import { findMetric } from '../../core/metrics/registry';
import type { Ports } from '../ports/types';
import {
  applyLoadedEvaluation, applyLoadedTestProject,
  saveEvaluation as storeSaveEvaluation, saveEvaluationAs as storeSaveEvaluationAs,
  saveTestProject as storeSaveTestProject, saveTestProjectAs as storeSaveTestProjectAs,
  type ActionResult, type AppState,
} from '../store';

/** What the actions need from the page: the clock and the tool version (the core has neither). */
export interface FileEnv {
  now(): string;
  toolVersion: string;
}

export interface LoadResult {
  state: AppState;
  outcome: 'loaded' | 'cancelled' | 'invalid';
  /** Said to the user: what is wrong, or the notes of a file that loaded. */
  message?: string;
  /** The problems of an invalid file, each with its place. */
  problems?: Problem[];
  notes: string[];
}

const serializeEvaluation = (env: FileEnv) => async (state: AppState): Promise<string> =>
  writeEvaluation(state.evaluation, computeResults(state.evaluation, metricFor(state.evaluation.metric.id)), {
    now: env.now(),
    toolVersion: env.toolVersion,
    judgeVersion: await judgeVersion(state.evaluation.judge_set),
    testCasesVersion: await testCasesVersion(state.evaluation.dataset.cases),
  });

const serializeTestProject = (env: FileEnv) => async (state: AppState): Promise<string> =>
  writeTestProject(state.evaluation, { toolVersion: env.toolVersion, testCasesVersion: await testCasesVersion(state.evaluation.dataset.cases) });

export const saveEvaluation = (state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> => storeSaveEvaluation(state, ports, serializeEvaluation(env));
export const saveEvaluationAs = (state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> => storeSaveEvaluationAs(state, ports, serializeEvaluation(env));
export const saveTestProject = (state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> => storeSaveTestProject(state, ports, serializeTestProject(env));
export const saveTestProjectAs = (state: AppState, ports: Ports, env: FileEnv): Promise<ActionResult> => storeSaveTestProjectAs(state, ports, serializeTestProject(env));

function describeProblems(problems: readonly Problem[]): string {
  return problems
    .map((p) => (p.line !== undefined ? `${p.message} (line ${p.line}, column ${p.column ?? 1})` : p.path !== undefined ? `${p.message} (${p.path})` : p.message))
    .join(' ');
}

function joinNotes(notes: readonly string[], lead: string): string | undefined {
  return notes.length > 0 ? `${lead} ${notes.join(' ')}` : undefined;
}

/** Where the loaded work continues: the first step with unfinished work (FR-073). The case window opens only on Continue. */
function atResumePoint(state: AppState): AppState {
  const point = resumePoint(state.evaluation, metricFor(state.evaluation.metric.id));
  return { ...state, step: point.step, openCase: null };
}

export async function loadEvaluation(state: AppState, ports: Ports, _env?: FileEnv): Promise<LoadResult> {
  const picked = await ports.opener.open();
  if (!picked) return { state, outcome: 'cancelled', notes: [] };
  const read = readEvaluation(picked.text);
  if (!read.ok) return { state, outcome: 'invalid', message: describeProblems(read.problems), problems: read.problems, notes: [] };
  ports.evaluationTarget.useLoaded(picked.handle);
  // Recomputing is how a file is audited: the numbers it stored must follow from what it holds (SC-003).
  const { evaluation } = read.value;
  const checked = recompute(read.value, metricFor(evaluation.metric.id), {
    judgeVersion: await judgeVersion(evaluation.judge_set),
    testCasesVersion: await testCasesVersion(evaluation.dataset.cases),
  });
  const next = atResumePoint(applyLoadedEvaluation(state, evaluation, ports, checked.differences));
  const warning = differenceNote(checked.differences);
  const notes = warning === null ? read.notes : [...read.notes, warning];
  return { state: next, outcome: 'loaded', message: joinNotes(notes, 'The evaluation was loaded.'), notes };
}

export async function loadTestProject(state: AppState, ports: Ports, _env?: FileEnv): Promise<LoadResult> {
  const picked = await ports.opener.open();
  if (!picked) return { state, outcome: 'cancelled', notes: [] };
  const read = readTestProject(picked.text, (id) => findMetric(sessionRegistry(), id) !== undefined);
  if (!read.ok) return { state, outcome: 'invalid', message: describeProblems(read.problems), problems: read.problems, notes: [] };
  registerEmbeddedMetric(read.value.evaluation.metric);
  ports.testProjectTarget.useLoaded(picked.handle);
  const next = atResumePoint(applyLoadedTestProject(state, read.value.evaluation, ports));
  return { state: next, outcome: 'loaded', message: joinNotes(read.notes, 'The test project was loaded.'), notes: read.notes };
}
