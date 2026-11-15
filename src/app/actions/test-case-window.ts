// The state and the checks behind the test case window for a case with injected errors (FR-040, FR-041, FR-080, FR-085).
// The pasted JSON is not part of the state until the case is saved.
import { normalizeCategoryName } from '../../core/cases/catalog';
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
  /** The case chosen in "Base case": a clean case, or a case with errors whose errors were copied (T262); empty for none. */
  from: string;
  /** The id of the clean case the errors go into; empty for none. */
  base: string;
  rows: ErrorRow[];
  /** The prompt as the user edited it (T262); while it is set, changes of the parts above no longer rebuild it. */
  prompt?: string;
}

export const NEW_CATEGORY = '__new__';

export function newDraft(state: AppState): InjectDraft {
  return { from: '', base: '', rows: [newRow(state, [])] };
}

function newRow(state: AppState, rows: readonly ErrorRow[]): ErrorRow {
  const first = state.evaluation.judge_set.error_catalog[0]?.name;
  return { id: rows.reduce((max, r) => Math.max(max, r.id), 0) + 1, category: first ?? '', isNew: first === undefined, difficulty: 'llm', description: '' };
}

export const addRow = (state: AppState, draft: InjectDraft): InjectDraft => ({ ...draft, rows: [...draft.rows, newRow(state, draft.rows)] });
export const removeRow = (draft: InjectDraft, id: number): InjectDraft => ({ ...draft, rows: draft.rows.filter((r) => r.id !== id) });
export const updateRow = (draft: InjectDraft, id: number, patch: Partial<Omit<ErrorRow, 'id'>>): InjectDraft => ({ ...draft, rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

export const cleanCasesOf = (state: AppState): TestCase[] => state.evaluation.dataset.cases.filter((c) => c.expected_errors.length === 0);

/** The cases "Base case" offers (T262): the clean cases, and the cases with errors, whose errors can be copied. */
export function baseCasesOf(state: AppState): { clean: TestCase[]; withErrors: TestCase[] } {
  const cases = state.evaluation.dataset.cases;
  return { clean: cases.filter((c) => c.expected_errors.length === 0), withErrors: cases.filter((c) => c.expected_errors.length > 0) };
}

/**
 * The choice in "Base case" (T262). A clean case is the base and the rows stay. A case with errors fills "Errors to prepare" with its
 * errors (still editable) and gives its own clean base, if it has one, as the base text; otherwise the LLM writes the whole case.
 */
export function startFrom(state: AppState, draft: InjectDraft, caseId: string): InjectDraft {
  const chosen = state.evaluation.dataset.cases.find((c) => c.id === caseId);
  if (!chosen) return { ...draft, from: '', base: '' };
  if (chosen.expected_errors.length === 0) return { ...draft, from: chosen.id, base: chosen.id };
  const catalog = state.evaluation.judge_set.error_catalog;
  const base = chosen.base !== undefined && cleanCasesOf(state).some((c) => c.id === chosen.base) ? chosen.base : '';
  const rows: ErrorRow[] = chosen.expected_errors.map((e, i) => {
    const category = e.category ?? catalog[0]?.name ?? '';
    return { id: i + 1, category, isNew: !catalog.some((c) => c.name === category), difficulty: e.difficulty ?? 'llm', description: e.description };
  });
  return { ...draft, from: chosen.id, base, rows };
}

/** The one prompt for the user's LLM, rebuilt from the base and the rows (FR-040). */
export function injectPrompt(state: AppState, draft: InjectDraft): string {
  const base = draft.base === '' ? undefined : state.evaluation.dataset.cases.find((c) => c.id === draft.base);
  const errors: ErrorToPrepare[] = draft.rows.map((r) => ({ category: r.isNew ? normalizeCategoryName(r.category) : r.category.trim(), difficulty: r.difficulty, description: r.description }));
  return injectErrorsPrompt({ judgeSet: state.evaluation.judge_set, base, errors });
}

/** The prompt in the box: the user's edit while there is one, otherwise the prompt built from the parts (T262). */
export const promptOf = (state: AppState, draft: InjectDraft): string => draft.prompt ?? injectPrompt(state, draft);
