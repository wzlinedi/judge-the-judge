// The state and the checks behind the test case window for a case with injected errors (FR-040, FR-041, FR-080, FR-085).
// The pasted JSON is not part of the state until the case is saved.
import { normalizeCategoryName } from '../../core/cases/catalog';
import { textListCheck, type ListCheck } from '../../core/cases/text-list-check';
import { injectErrorsPrompt, type ErrorToPrepare, type PreparedDifficulty } from '../../core/generation/inject-errors-prompt';
import type { TestCase } from '../../core/model';
import type { AppState } from '../store';

/** One row of the list of errors to prepare. */
export interface ErrorRow {
  id: number;
  /** A name from the catalog, or a new name typed by the user. */
  category: string;
  isNew: boolean;
  difficulty: PreparedDifficulty;
  description: string;
}

export interface InjectDraft {
  /** The id of the clean case the errors go into; empty for none. */
  base: string;
  rows: ErrorRow[];
  instructions: string;
}

export const NEW_CATEGORY = '__new__';

export function newDraft(state: AppState): InjectDraft {
  return { base: '', rows: [newRow(state, [])], instructions: '' };
}

function newRow(state: AppState, rows: readonly ErrorRow[]): ErrorRow {
  const first = state.evaluation.judge_set.error_catalog[0]?.name;
  return { id: rows.reduce((max, r) => Math.max(max, r.id), 0) + 1, category: first ?? '', isNew: first === undefined, difficulty: 'llm', description: '' };
}

export const addRow = (state: AppState, draft: InjectDraft): InjectDraft => ({ ...draft, rows: [...draft.rows, newRow(state, draft.rows)] });
export const removeRow = (draft: InjectDraft, id: number): InjectDraft => ({ ...draft, rows: draft.rows.filter((r) => r.id !== id) });
export const updateRow = (draft: InjectDraft, id: number, patch: Partial<Omit<ErrorRow, 'id'>>): InjectDraft => ({ ...draft, rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

export const cleanCasesOf = (state: AppState): TestCase[] => state.evaluation.dataset.cases.filter((c) => c.expected_errors.length === 0);

/** The one prompt for the user's LLM, rebuilt from the base and the rows (FR-040). */
export function injectPrompt(state: AppState, draft: InjectDraft): string {
  const base = draft.base === '' ? undefined : state.evaluation.dataset.cases.find((c) => c.id === draft.base);
  const errors: ErrorToPrepare[] = draft.rows.map((r) => ({ category: r.isNew ? normalizeCategoryName(r.category) : r.category.trim(), difficulty: r.difficulty, description: r.description }));
  return injectErrorsPrompt({ judgeSet: state.evaluation.judge_set, base, errors, instructions: draft.instructions });
}

/** Whether the text and the list of a case agree, against the base case it names (FR-080). */
export function listCheckOf(state: AppState, testCase: Omit<TestCase, 'id'> & { id?: string }): ListCheck {
  const base = testCase.base !== undefined ? state.evaluation.dataset.cases.find((c) => c.id === testCase.base) : undefined;
  return textListCheck(testCase, base, state.evaluation.judge_set.judged_text);
}

/** What does not agree, one plain line each, for the question before saving (FR-080: only (a) and (b) ask). */
export function mismatchLines(list: ListCheck): string[] {
  const lines: string[] = [];
  for (const place of list.uncovered) {
    lines.push(place.end > place.start ? `A changed place is not in the list: “${place.text}” in ${place.field}.` : `Text of the base is gone from ${place.field} and no expected error covers it: “${(place.removed ?? '').slice(0, 80)}”.`);
  }
  for (const missing of list.notInText) lines.push(`E${missing.index + 1}: the fragment “${missing.fragment}” is not in the text.`);
  return lines;
}
