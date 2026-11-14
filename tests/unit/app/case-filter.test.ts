// The Test cases table: search, filters, sorting and the count (FR-025, FR-036; User Story 15).
import { describe, expect, it } from 'vitest';
import { caseRows, countText, DEFAULT_VIEW, filterCases, nextSort, type CaseRow, type CaseView } from '../../../src/app/case-filter';
import { createState, type AppState } from '../../../src/app/store';
import type { TestCase } from '../../../src/core/model';
import { sampleEvaluation } from '../../helpers/fixtures';

const error = { id: 'e1', description: 'A change', category: 'factual-error', fragment: 'Summary' };
const make = (id: string, name: string, over: Partial<TestCase> = {}): TestCase => ({
  id,
  name,
  fields: { source_text: `Source of ${name}`, summary: `Summary of ${name}` },
  expected_errors: [],
  ...over,
});

function stateWith(cases: TestCase[], replied: string[] = []): AppState {
  const base = sampleEvaluation();
  const replies = Object.fromEntries(replied.map((id) => [id, { reply: 'r', received: '2026-11-14T10:00:00Z' }]));
  return { ...createState(), evaluation: { ...base, replies: replies as never, decisions: {}, dataset: { ...base.dataset, cases } } };
}

const sample = (): AppState =>
  stateWith(
    [
      make('1', 'Alpha'),
      make('2', 'Beta', { expected_errors: [error] }),
      make('10', 'Gamma', { expected_errors: [error, { ...error, id: 'e2' }] }),
      make('3', 'Delta clean'),
      make('4', 'Epsilon', { expected_errors: [error], fields: { source_text: 'Contains the word zebra', summary: 'Summary' } }),
    ],
    ['2', '3'],
  );

const ids = (rows: CaseRow[]) => rows.map((r) => r.testCase.id);
const view = (over: Partial<CaseView> = {}): CaseView => ({ ...DEFAULT_VIEW, ...over });

describe('caseRows', () => {
  it('describes each case: whether it has a reply, and its warnings', () => {
    const rows = caseRows(sample());
    expect(ids(rows)).toEqual(['1', '2', '10', '3', '4']);
    expect(rows.map((r) => r.hasReply)).toEqual([false, true, false, true, false]);
    expect(rows.every((r) => Array.isArray(r.warnings))).toBe(true);
  });

  it('warns about identical fields, a repeated name and a missing field of the prompt', () => {
    const state = stateWith([make('1', 'Same'), make('2', 'same', { fields: make('1', 'Same').fields }), make('3', 'Other', { fields: { source_text: 'Only this' } })]);
    const rows = caseRows(state);
    expect(rows[0]!.warnings.join(' ')).toMatch(/Identical fields to case 2/);
    expect(rows[0]!.warnings.join(' ')).toMatch(/also used by case 2/);
    expect(rows[1]!.warnings.join(' ')).toMatch(/Identical fields to case 1/);
    expect(rows[2]!.warnings.join(' ')).toMatch(/No field for/);
  });
});

describe('filterCases', () => {
  const rows = caseRows(sample());

  it('shows everything for the default view, in the order of the test project', () => {
    expect(ids(filterCases(rows, DEFAULT_VIEW))).toEqual(['1', '2', '10', '3', '4']);
  });

  it('searches the name, ignoring case and surrounding spaces', () => {
    expect(ids(filterCases(rows, view({ search: '  GAMMA ' })))).toEqual(['10']);
  });

  it('searches the texts of the fields, not only the name', () => {
    expect(ids(filterCases(rows, view({ search: 'zebra' })))).toEqual(['4']);
  });

  it('finds nothing for a text no case has', () => {
    expect(filterCases(rows, view({ search: 'no such text' }))).toEqual([]);
  });

  it('filters by kind', () => {
    expect(ids(filterCases(rows, view({ kind: 'clean' })))).toEqual(['1', '3']);
    expect(ids(filterCases(rows, view({ kind: 'injected' })))).toEqual(['2', '10', '4']);
  });

  it('filters by reply', () => {
    expect(ids(filterCases(rows, view({ reply: 'with' })))).toEqual(['2', '3']);
    expect(ids(filterCases(rows, view({ reply: 'without' })))).toEqual(['1', '10', '4']);
  });

  it('filters to the cases with warnings', () => {
    const warned = stateWith([make('1', 'Same'), make('2', 'Same', { fields: make('1', 'Same').fields }), make('3', 'Unique')]);
    expect(ids(filterCases(caseRows(warned), view({ warnings: true })))).toEqual(['1', '2']);
  });

  it('combines the search and the filters: injected errors and without a reply', () => {
    expect(ids(filterCases(rows, view({ kind: 'injected', reply: 'without' })))).toEqual(['10', '4']);
    expect(ids(filterCases(rows, view({ kind: 'injected', reply: 'without', search: 'epsilon' })))).toEqual(['4']);
  });
});

describe('sorting', () => {
  const rows = caseRows(sample());

  it('sorts by id as numbers, so 10 comes after 4', () => {
    expect(ids(filterCases(rows, view({ sort: { key: 'id', direction: 'asc' } })))).toEqual(['1', '2', '3', '4', '10']);
    expect(ids(filterCases(rows, view({ sort: { key: 'id', direction: 'desc' } })))).toEqual(['10', '4', '3', '2', '1']);
  });

  it('sorts by name, ignoring case', () => {
    expect(ids(filterCases(rows, view({ sort: { key: 'name', direction: 'asc' } })))).toEqual(['1', '2', '3', '4', '10']);
    expect(ids(filterCases(rows, view({ sort: { key: 'name', direction: 'desc' } })))).toEqual(['10', '4', '3', '2', '1']);
  });

  it('sorts by the number of expected errors, and by id among equal ones', () => {
    expect(ids(filterCases(rows, view({ sort: { key: 'errors', direction: 'desc' } })))).toEqual(['10', '2', '4', '1', '3']);
    expect(ids(filterCases(rows, view({ sort: { key: 'errors', direction: 'asc' } })))).toEqual(['1', '3', '2', '4', '10']);
  });

  it('sorts by kind: clean first, then injected errors', () => {
    expect(ids(filterCases(rows, view({ sort: { key: 'kind', direction: 'asc' } })))).toEqual(['1', '3', '2', '4', '10']);
  });

  it('does not change the rows it was given', () => {
    const before = ids(rows);
    filterCases(rows, view({ sort: { key: 'name', direction: 'desc' } }));
    expect(ids(rows)).toEqual(before);
  });

  it('cycles a column: ascending, descending, then the order of the test project', () => {
    const first = nextSort(DEFAULT_VIEW.sort, 'name');
    expect(first).toEqual({ key: 'name', direction: 'asc' });
    const second = nextSort(first, 'name');
    expect(second).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSort(second, 'name')).toBeNull();
    expect(nextSort(second, 'id')).toEqual({ key: 'id', direction: 'asc' });
  });
});

describe('the count', () => {
  it('says how many of all the cases are shown', () => {
    expect(countText(5, 5)).toBe('5 test cases');
    expect(countText(2, 5)).toBe('2 of 5 test cases');
    expect(countText(0, 5)).toBe('No test case matches. 5 test cases in all.');
    expect(countText(1, 1)).toBe('1 test case');
  });
});

describe('a test project of 500 cases', () => {
  it('is searched, filtered and sorted well within the 2 seconds of SC-018', () => {
    const cases = Array.from({ length: 500 }, (_, i) =>
      make(String(i + 1), `Case ${i + 1}`, { expected_errors: i % 2 === 0 ? [error] : [] }),
    );
    const state = stateWith(cases, cases.filter((_, i) => i % 3 === 0).map((c) => c.id));
    const start = performance.now();
    const rows = caseRows(state);
    const shown = filterCases(rows, view({ kind: 'injected', reply: 'without', sort: { key: 'name', direction: 'desc' } }));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(shown.length).toBe(cases.filter((_, i) => i % 2 === 0 && i % 3 !== 0).length);
  });
});
