// The actions of the Test cases step (FR-017, FR-023, FR-025, FR-039, FR-053, FR-078, FR-089).
// Every change gives a new test cases version: the stored one is dropped and recomputed on save.
import { checkCaseJson } from '../../core/cases/case-json';
import { checkExpectedErrorsJson, planExpectedErrors } from '../../core/cases/expected-errors';
import { canChangeCase, markLate } from '../../core/cases/case-actions';
import { assignIdentifiers } from '../../core/cases/identifiers';
import { normalizeName } from '../../core/cases/validate';
import { MAX_CASES } from '../../core/schemas/test-case';
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
  /** The prompt the case was made with, kept with it so that it can be recreated (T238). */
  generationPrompt?: string;
}

const hasReplies = (state: AppState): boolean => Object.keys(state.evaluation.replies).length > 0;

export function withCases(state: AppState, cases: TestCase[], catalog?: Category[]): AppState {
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
  if (state.evaluation.dataset.cases.length >= MAX_CASES) {
    return { state, problems: [{ message: `The test project already has ${MAX_CASES} test cases, the most it can hold. Remove a case before adding another.` }] };
  }
  const check = checkCaseJson(text, { ...contextOf(state), mode: options.mode, ...(options.base !== undefined ? { base: options.base } : {}), ...(options.name !== undefined ? { name: options.name } : {}), ...(options.errorsToPrepare !== undefined ? { errorsToPrepare: options.errorsToPrepare } : {}) });
  if (!check.case) return { state, problems: check.problems };
  const [saved] = assignIdentifiers([check.case], state.evaluation.dataset.cases);
  const withPrompt = options.generationPrompt !== undefined && options.generationPrompt !== '' ? { ...(saved as TestCase), generation_prompt: options.generationPrompt } : (saved as TestCase);
  const added = markLate(withPrompt, hasReplies(state), 'added');

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
  // A case made from the removed one keeps its content and loses `base`, so that no identifier points at nothing (T283).
  const kept = withCases(state, state.evaluation.dataset.cases.filter((c) => c.id !== id).map((c) => {
    if (c.base !== id) return c;
    const { base: _base, ...rest } = c;
    return rest;
  }));
  // The reply and the decisions of the case go with it (T234); with no reply left the run starts again from nothing.
  return {
    state: edit(kept, (e) => {
      const { [id]: _reply, ...replies } = e.replies;
      const { [id]: _decisions, ...decisions } = e.decisions;
      if (Object.keys(replies).length > 0) return { ...e, replies, decisions };
      const { reply_judge_version: _v, reply_counted_per: _c, rules_corrected_after_replies: _r, ...rest } = e;
      return { ...rest, replies, decisions };
    }),
  };
}

/** What removing a case takes with it besides the case: whether it has a reply and how many decisions were made for it. */
export function removalImpact(state: AppState, id: string): { hasReply: boolean; decisions: number } {
  const d = state.evaluation.decisions[id];
  const decisions = d ? Object.keys(d.expected).length + Object.keys(d.additional).length + d.added_findings.length : 0;
  return { hasReply: state.evaluation.replies[id] !== undefined, decisions };
}

/**
 * "Edit expected errors" (T254, FR-089): the list of the expected errors of a case, on every case and at every time. An error that keeps its
 * identifier and its words keeps its mark; the marks set for a changed or removed error go, and the case is marked again from its reply.
 * An error that a real-error mark made (T253) and is removed sets that finding to Ignored, so that it is not added again.
 */
export function saveExpectedErrors(state: AppState, id: string, text: string): CaseEdit {
  const allowed = canChangeCase(state.evaluation.dataset.cases, state.evaluation.replies, state.evaluation.dataset.finalized, id, 'correct');
  if (!allowed.allowed) return { state, note: allowed.reason };
  const original = state.evaluation.dataset.cases.find((c) => c.id === id);
  if (!original) return { state, note: 'This case no longer exists.' };
  const check = checkExpectedErrorsJson(text, { ...contextOf(state), mode: 'correct', original });
  if (!check.errors) return { state, problems: check.problems };
  const plan = planExpectedErrors(original.expected_errors, check.errors, state.evaluation.decisions[id]);
  if (plan.nothing) return { state, note: 'Nothing changed.' };

  const corrected = markLate({ ...original, expected_errors: check.errors }, hasReplies(state), 'corrected');
  const catalog = [...state.evaluation.judge_set.error_catalog];
  for (const error of corrected.expected_errors) if (error.category && !catalog.some((c) => c.name === error.category)) catalog.push({ name: error.category });
  const next = withCases(state, state.evaluation.dataset.cases.map((c) => (c.id === id ? corrected : c)), catalog.length > state.evaluation.judge_set.error_catalog.length ? catalog : undefined);

  const stored = state.evaluation.decisions[id];
  if (!stored) return { state: next, problems: [] };
  const decisions = structuredClone(stored);
  for (const gone of [...plan.changed, ...plan.removed]) delete decisions.expected[gone];
  return { state: edit(next, (e) => ({ ...e, decisions: { ...e.decisions, [id]: decisions } })), problems: [] };
}
