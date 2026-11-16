// "Edit expected errors" (T254, FR-089): the JSON of the expected errors of one case, checked as it is edited, and what saving it changes.
import { extractJson } from '../judge/extract-json';
import { ownValue } from './test-run';
import type { CaseDecisions, CaseJsonCheckContext, ExpectedError, Problem } from '../model';
import { checkCaseJson } from './case-json';

/** The list of the errors with their identifiers: an error that keeps its identifier and its words is unchanged. */
export function expectedErrorsToJson(testCase: { expected_errors: readonly ExpectedError[] }): string {
  return JSON.stringify(
    testCase.expected_errors.map((e) => ({
      id: e.id,
      ...(e.category !== undefined ? { category: e.category } : {}),
      ...(e.fragment !== undefined ? { fragment: e.fragment } : {}),
      ...(e.source_fragment !== undefined ? { source_fragment: e.source_fragment } : {}),
      description: e.description,
      ...(e.difficulty !== undefined ? { difficulty: e.difficulty } : {}),
    })),
    null,
    2,
  );
}

export interface ExpectedErrorsCheck {
  problems: Problem[];
  warnings: string[];
  notes: string[];
  /** The list, when it is valid. */
  errors?: ExpectedError[];
}

/** The text is a list, or an object with "expected_errors". The name, the base and the fields of the case are not in it and cannot change. */
export function checkExpectedErrorsJson(text: string, context: CaseJsonCheckContext & { original: NonNullable<CaseJsonCheckContext['original']> }): ExpectedErrorsCheck {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { problems: [{ message: extracted.reason === 'empty' ? 'There is no text.' : extracted.message, ...(extracted.line !== undefined ? { line: extracted.line, column: extracted.column ?? 1 } : {}) }], warnings: [], notes: [] };
  }
  const value = extracted.value as unknown;
  const list = Array.isArray(value) ? value : value !== null && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)['expected_errors']) ? (value as Record<string, unknown>)['expected_errors'] : undefined;
  if (list === undefined) return { problems: [{ message: 'The JSON is not a list of expected errors: a list of objects with a "description" was expected.' }], warnings: [], notes: [] };
  const { original } = context;
  const wrapped = JSON.stringify({ name: original.name, ...(original.base !== undefined ? { base: original.base } : {}), fields: original.fields, expected_errors: list });
  const checked = checkCaseJson(wrapped, { ...context, mode: 'correct' });
  return { problems: checked.problems, warnings: checked.warnings, notes: checked.notes, ...(checked.case ? { errors: checked.case.expected_errors } : {}) };
}

export interface ExpectedErrorsPlan {
  /** Identifiers of errors that kept their identifier and changed their words. */
  changed: string[];
  removed: string[];
  added: number;
  /** Marks set by hand or by an opinion for a changed or removed error: they are dropped. */
  marksDropped: number;
  nothing: boolean;
}

const same = (a: ExpectedError, b: ExpectedError) =>
  a.description === b.description && a.category === b.category && a.fragment === b.fragment && a.source_fragment === b.source_fragment && a.difficulty === b.difficulty;

export function planExpectedErrors(before: readonly ExpectedError[], after: readonly ExpectedError[], decisions: CaseDecisions | undefined): ExpectedErrorsPlan {
  const was = new Map(before.map((e) => [e.id, e]));
  const now = new Map(after.map((e) => [e.id, e]));
  const changed = after.filter((e) => was.has(e.id) && !same(was.get(e.id) as ExpectedError, e)).map((e) => e.id);
  const removed = before.filter((e) => !now.has(e.id)).map((e) => e.id);
  const added = after.filter((e) => !was.has(e.id)).length;
  const marksDropped = [...changed, ...removed].filter((id) => ownValue(decisions?.expected, id) !== undefined).length;
  const reordered = before.length === after.length && before.some((e, i) => after[i]?.id !== e.id);
  return { changed, removed, added, marksDropped, nothing: changed.length === 0 && removed.length === 0 && added === 0 && !reordered };
}
