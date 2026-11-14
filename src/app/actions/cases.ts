// The actions of the Test cases step (FR-017, FR-023, FR-025, FR-039, FR-053, FR-078, FR-089).
// Every change gives a new test cases version: the stored one is dropped and recomputed on save.
import { caseToJson, checkCaseJson } from '../../core/cases/case-json';
import { canChangeCase, markLate } from '../../core/cases/case-actions';
import { assignIdentifiers } from '../../core/cases/identifiers';
import { normalizeName } from '../../core/cases/validate';
import { findVariables } from '../../core/judge/variables';
import type { CaseJsonMode, Category, Problem, TestCase } from '../../core/model';
import { edit, type AppState } from '../store';

export interface CaseEdit {
  state: AppState;
  /** One plain sentence for the user, when there is something to say. */
  note?: string;
  /** The problems of the JSON that was refused. */
  problems?: Problem[];
}

export interface SaveOptions {
  mode: CaseJsonMode;
  /** The base picked in the window (`inject`). */
  base?: string;
  /** A name typed in the window. */
  name?: string;
  errorsToPrepare?: number;
}

const hasReplies = (state: AppState): boolean => Object.keys(state.evaluation.replies).length > 0;

function withCases(state: AppState, cases: TestCase[], catalog?: Category[]): AppState {
  return edit(state, (e) => {
    const { version: _stale, ...dataset } = e.dataset;
    return { ...e, dataset: { ...dataset, cases }, ...(catalog ? { judge_set: { ...e.judge_set, error_catalog: catalog } } : {}) };
  });
}

function contextOf(state: AppState) {
  const { judge_set, dataset } = state.evaluation;
  const variables = findVariables(judge_set.prompt);
  return { variables, judgedText: judge_set.judged_text, catalog: judge_set.error_catalog, existingCases: dataset.cases };
}

/** Checks the pasted JSON and, when it is valid, adds it as a new case (FR-041, FR-083, FR-090). */
export function saveCaseFromJson(state: AppState, text: string, options: SaveOptions): CaseEdit {
  const check = checkCaseJson(text, { ...contextOf(state), mode: options.mode, ...(options.base !== undefined ? { base: options.base } : {}), ...(options.name !== undefined ? { name: options.name } : {}), ...(options.errorsToPrepare !== undefined ? { errorsToPrepare: options.errorsToPrepare } : {}) });
  if (!check.case) return { state, problems: check.problems };
  const [saved] = assignIdentifiers([check.case], state.evaluation.dataset.cases);
  const added = markLate(saved as TestCase, hasReplies(state), 'added');

  const catalog = [...state.evaluation.judge_set.error_catalog];
  const fresh: string[] = [];
  for (const error of added.expected_errors) {
    if (error.category && !catalog.some((c) => c.name === error.category)) {
      catalog.push({ name: error.category });
      fresh.push(error.category);
    }
  }
  const next = withCases(state, [...state.evaluation.dataset.cases, added], fresh.length > 0 ? catalog : undefined);
  return fresh.length > 0 ? { state: next, problems: [], note: `Added to the catalog: ${fresh.join(', ')}.` } : { state: next, problems: [] };
}

export function renameCase(state: AppState, id: string, name: string): CaseEdit {
  const allowed = canChangeCase(state.evaluation.dataset.cases, state.evaluation.replies, state.evaluation.dataset.finalized, id, 'rename');
  if (!allowed.allowed) return { state, note: allowed.reason };
  const used = state.evaluation.dataset.cases.find((c) => c.id !== id && normalizeName(name) !== '' && normalizeName(c.name) === normalizeName(name));
  if (used) return { state, note: `The name "${name.trim()}" is already used by case ${used.id}.` };
  return { state: withCases(state, state.evaluation.dataset.cases.map((c) => (c.id === id ? { ...c, name: name.trim() } : c))) };
}

export function removeCase(state: AppState, id: string): CaseEdit {
  const allowed = canChangeCase(state.evaluation.dataset.cases, state.evaluation.replies, state.evaluation.dataset.finalized, id, 'remove');
  if (!allowed.allowed) return { state, note: allowed.reason };
  return { state: withCases(state, state.evaluation.dataset.cases.filter((c) => c.id !== id)) };
}

/** "Clone" is only a shortcut: it gives the case JSON with the name "… (copy)" made unique; nothing is added yet (FR-078). */
export function cloneCase(state: AppState, id: string): string | undefined {
  const original = state.evaluation.dataset.cases.find((c) => c.id === id);
  if (!original) return undefined;
  const names = new Set(state.evaluation.dataset.cases.map((c) => normalizeName(c.name)));
  const label = original.name.trim() === '' ? `Case ${original.id}` : original.name;
  let name = `${label} (copy)`;
  for (let n = 2; names.has(normalizeName(name)); n++) name = `${label} (copy ${n})`;
  const { base: _link, ...rest } = original;
  return caseToJson({ ...rest, name });
}

/** After finalizing, the expected errors of a case without a reply may be corrected through its JSON (FR-089). */
export function correctExpectedErrors(state: AppState, id: string, text: string): CaseEdit {
  const allowed = canChangeCase(state.evaluation.dataset.cases, state.evaluation.replies, state.evaluation.dataset.finalized, id, 'correct');
  if (!allowed.allowed) return { state, note: allowed.reason };
  const original = state.evaluation.dataset.cases.find((c) => c.id === id);
  if (!original) return { state, note: 'This case no longer exists.' };
  const check = checkCaseJson(text, { ...contextOf(state), mode: 'correct', original });
  if (!check.case) return { state, problems: check.problems };
  const corrected = markLate({ ...original, expected_errors: check.case.expected_errors }, hasReplies(state), 'corrected');
  return { state: withCases(state, state.evaluation.dataset.cases.map((c) => (c.id === id ? corrected : c))), problems: [] };
}
