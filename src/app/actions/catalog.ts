// The error catalog of the test project (FR-015, FR-024). The tool never changes a category by itself.
import { addCategories, canRemoveCategory, parseCategoryList, renameCategory } from '../../core/cases/catalog';
import type { Category } from '../../core/model';
import { edit, type AppState } from '../store';

export interface CatalogEdit {
  state: AppState;
  note?: string;
}

const setCatalog = (state: AppState, catalog: Category[]): AppState => edit(state, (e) => ({ ...e, judge_set: { ...e.judge_set, error_catalog: catalog } }));

/** Typed or pasted: one category per line, optionally `name - description`. Names already present are skipped and reported. */
export function addCategoriesFromText(state: AppState, text: string): CatalogEdit {
  const result = addCategories(state.evaluation.judge_set.error_catalog, parseCategoryList(text));
  if (result.added.length === 0 && result.skipped.length === 0) return { state, note: 'Type one category per line.' };
  const parts: string[] = [];
  if (result.added.length > 0) parts.push(`Added: ${result.added.join(', ')}.`);
  if (result.skipped.length > 0) parts.push(`Already in the catalog: ${result.skipped.join(', ')}.`);
  return { state: result.added.length > 0 ? setCatalog(state, result.catalog) : state, note: parts.join(' ') };
}

export function setCategoryDetails(state: AppState, name: string, details: { description?: string; example?: string }): CatalogEdit {
  const catalog = state.evaluation.judge_set.error_catalog.map((c) => {
    if (c.name !== name) return c;
    const next: Category = { name };
    const description = details.description ?? c.description;
    const example = details.example ?? c.example;
    if (description) next.description = description;
    if (example) next.example = example;
    return next;
  });
  return { state: setCatalog(state, catalog) };
}

/** A rename applies to every expected error that uses the category, and gives a new test cases version. */
export function renameCategoryAction(state: AppState, from: string, to: string): CatalogEdit {
  const { judge_set, dataset } = state.evaluation;
  const result = renameCategory(judge_set.error_catalog, dataset.cases, from, to);
  if (!result.ok) return { state, note: result.reason };
  return {
    state: edit(state, (e) => {
      const { version: _stale, ...rest } = e.dataset;
      return { ...e, judge_set: { ...e.judge_set, error_catalog: result.catalog }, dataset: { ...rest, cases: result.cases } };
    }),
  };
}

export function removeCategory(state: AppState, name: string): CatalogEdit {
  const { judge_set, dataset, replies } = state.evaluation;
  const allowed = canRemoveCategory(judge_set.error_catalog, dataset.cases, replies, dataset.finalized, name);
  if (!allowed.allowed) return { state, note: allowed.reason };
  return { state: setCatalog(state, judge_set.error_catalog.filter((c) => c.name !== name)) };
}
