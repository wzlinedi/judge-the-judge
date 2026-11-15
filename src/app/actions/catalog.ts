// The error catalog of the test project (FR-015, FR-024). The tool never changes a category by itself.
import { markLate } from '../../core/cases/case-actions';
import { normalizeCategoryName, removeCategoryEverywhere, renameCategory } from '../../core/cases/catalog';
import { replyCount, updateTestRun } from '../../core/cases/test-run';
import type { CaseDecisions, Category } from '../../core/model';
import { edit, type AppState } from '../store';

export interface CatalogEdit {
  state: AppState;
  note?: string;
}

const setCatalog = (state: AppState, catalog: Category[]): AppState => edit(state, (e) => ({ ...e, judge_set: { ...e.judge_set, error_catalog: catalog } }));

/** "Add category": one new row of the table. The name is written in lower case with dashes; an empty or a taken name is refused (T248). */
export function addCategory(state: AppState, name: string, description: string): CatalogEdit {
  const catalog = state.project.judge_set.error_catalog;
  const normal = normalizeCategoryName(name);
  if (normal === '') return { state, note: 'Type a name for the category.' };
  if (catalog.some((c) => c.name === normal)) return { state, note: `The category "${normal}" is already in the catalog.` };
  const text = description.trim();
  return { state: setCatalog(state, [...catalog, text === '' ? { name: normal } : { name: normal, description: text }]) };
}

/** The description of a category, which also holds its examples (T248). */
export function setCategoryDetails(state: AppState, name: string, details: { description: string }): CatalogEdit {
  const catalog = state.project.judge_set.error_catalog.map((c) => (c.name !== name ? c : details.description === '' ? { name } : { name, description: details.description }));
  return { state: setCatalog(state, catalog) };
}

/** A rename applies to every expected error that uses the category, and gives a new test cases version. */
export function renameCategoryAction(state: AppState, from: string, to: string): CatalogEdit {
  const { judge_set, dataset } = state.project;
  const result = renameCategory(judge_set.error_catalog, dataset.cases, from, to);
  if (!result.ok) return { state, note: result.reason };
  return {
    state: edit(state, (e) => {
      const { version: _stale, ...rest } = e.dataset;
      return { ...e, judge_set: { ...e.judge_set, error_catalog: result.catalog }, dataset: { ...rest, cases: result.cases } };
    }),
  };
}

/**
 * "Remove" works for every category (T248). The expected errors that used it stay and lose the category, and so do the
 * findings added by hand; when a test case changes, the test cases version changes too.
 */
export function removeCategory(state: AppState, name: string): CatalogEdit {
  const { judge_set, dataset } = state.project;
  if (!judge_set.error_catalog.some((c) => c.name === name)) return { state, note: `There is no category "${name}".` };
  const result = removeCategoryEverywhere(judge_set.error_catalog, dataset.cases, name);
  if (result.uses === 0) return { state: setCatalog(state, result.catalog) };
  const late = replyCount(state.project) > 0;
  const cases = result.cases.map((c, i) => (c === dataset.cases[i] ? c : markLate(c, late, 'corrected')));
  const next = edit(state, (e) => {
    const { version: _stale, ...rest } = e.dataset;
    const stripped = (all: Record<string, CaseDecisions>): Record<string, CaseDecisions> => Object.fromEntries(
      Object.entries(all).map(([id, d]) => [
        id,
        d.added_findings.some((f) => f.category === name)
          ? {
              ...d,
              added_findings: d.added_findings.map((f) => {
                if (f.category !== name) return f;
                const { category: _gone, ...kept } = f;
                return kept;
              }),
            }
          : d,
      ]),
    );
    const renamed = { ...e, judge_set: { ...e.judge_set, error_catalog: result.catalog }, dataset: { ...rest, cases } };
    return updateTestRun(renamed, (run) => ({ ...run, decisions: stripped(run.decisions) }));
  });
  return { state: next, note: `Removed "${name}". The expected errors of ${result.uses} test ${result.uses === 1 ? 'case' : 'cases'} lost the category.` };
}
