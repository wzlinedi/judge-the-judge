// The Test cases table: the row of each case, and the search, filters, sorting and count that shape what is shown
// (FR-025, FR-036; User Story 15). Pure: the view is data, the functions return new lists.
import { testProjectFeedback } from '../core/cases/feedback';
import { repliesOf } from '../core/cases/test-run';
import { normalizeName } from '../core/cases/validate';
import { composePrompt } from '../core/judge/compose';
import type { TestCase } from '../core/model';
import type { AppState } from './store';

export type KindFilter = 'all' | 'clean' | 'injected';
export type ReplyFilter = 'all' | 'with' | 'without';
export type SortKey = 'id' | 'name' | 'kind' | 'errors';
export type SortDirection = 'asc' | 'desc';
export interface Sort {
  key: SortKey;
  direction: SortDirection;
}

/** What the user asked to see; the order of the test project when `sort` is null. */
export interface CaseView {
  search: string;
  kind: KindFilter;
  reply: ReplyFilter;
  /** Only the cases that have a warning. */
  warnings: boolean;
  sort: Sort | null;
}

export const DEFAULT_VIEW: CaseView = { search: '', kind: 'all', reply: 'all', warnings: false, sort: null };

export interface CaseRow {
  testCase: TestCase;
  hasReply: boolean;
  warnings: string[];
}

/** Every case with its reply state and warnings, computed once for the whole test project (not once per case). */
export function caseRows(state: AppState): CaseRow[] {
  const { dataset, judge_set } = state.project;
  const replies = repliesOf(state.project);
  const { duplicates } = testProjectFeedback(state.project);
  const twins = new Map<string, string>();
  for (const ids of duplicates) for (const id of ids) twins.set(id, ids.find((other) => other !== id) ?? id);
  const byName = new Map<string, string[]>();
  for (const c of dataset.cases) {
    const key = normalizeName(c.name);
    if (key !== '') byName.set(key, [...(byName.get(key) ?? []), c.id]);
  }
  return dataset.cases.map((testCase) => {
    const warnings: string[] = [];
    const twin = twins.get(testCase.id);
    if (twin !== undefined) warnings.push(`Identical fields to case ${twin}`);
    const missing = composePrompt(judge_set.prompt, testCase).missing;
    if (missing.length > 0) warnings.push(`No field for ${missing.join(', ')}`);
    const same = byName.get(normalizeName(testCase.name))?.find((id) => id !== testCase.id);
    if (same !== undefined) warnings.push(`The name “${testCase.name}” is also used by case ${same}`);
    return { testCase, hasReply: replies[testCase.id] !== undefined, warnings };
  });
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const isInjected = (c: TestCase) => c.expected_errors.length > 0;

function compare(a: CaseRow, b: CaseRow, key: SortKey): number {
  switch (key) {
    case 'id':
      return collator.compare(a.testCase.id, b.testCase.id);
    case 'name':
      return collator.compare(a.testCase.name, b.testCase.name);
    case 'kind':
      return Number(isInjected(a.testCase)) - Number(isInjected(b.testCase));
    case 'errors':
      return a.testCase.expected_errors.length - b.testCase.expected_errors.length;
  }
}

function matchesSearch(c: TestCase, needle: string): boolean {
  if (c.name.toLowerCase().includes(needle)) return true;
  return Object.values(c.fields).some((text) => text.toLowerCase().includes(needle));
}

/** The rows that match the search and every filter, in the requested order; the rows given are not changed. */
export function filterCases(rows: readonly CaseRow[], view: CaseView): CaseRow[] {
  const needle = view.search.trim().toLowerCase();
  const shown = rows.filter((row) => {
    if (needle !== '' && !matchesSearch(row.testCase, needle)) return false;
    if (view.kind === 'clean' && isInjected(row.testCase)) return false;
    if (view.kind === 'injected' && !isInjected(row.testCase)) return false;
    if (view.reply === 'with' && !row.hasReply) return false;
    if (view.reply === 'without' && row.hasReply) return false;
    if (view.warnings && row.warnings.length === 0) return false;
    return true;
  });
  const { sort } = view;
  if (sort === null) return shown;
  const sign = sort.direction === 'asc' ? 1 : -1;
  // Equal rows keep a stable order by id, whichever way the column runs.
  return [...shown].sort((a, b) => sign * compare(a, b, sort.key) || collator.compare(a.testCase.id, b.testCase.id));
}

/** A click on a column: ascending, then descending, then back to the order of the test project. */
export function nextSort(current: Sort | null, key: SortKey): Sort | null {
  if (current === null || current.key !== key) return { key, direction: 'asc' };
  return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}

export function isDefaultView(view: CaseView): boolean {
  return view.search.trim() === '' && view.kind === 'all' && view.reply === 'all' && !view.warnings;
}

/** "2 of 5 test cases", or all of them when nothing is hidden. */
export function countText(shown: number, total: number): string {
  const noun = (n: number) => `${n} test ${n === 1 ? 'case' : 'cases'}`;
  if (shown === total) return noun(total);
  if (shown === 0) return `No test case matches. ${noun(total)} in all.`;
  return `${shown} of ${noun(total)}`;
}
