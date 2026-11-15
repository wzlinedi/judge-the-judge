// T254: the JSON of the expected errors of one case, checked as it is edited, and what saving it changes.
import { describe, expect, it } from 'vitest';
import { checkExpectedErrorsJson, expectedErrorsToJson, planExpectedErrors } from '../../../../src/core/cases/expected-errors';
import type { CaseDecisions, CaseJsonCheckContext, TestCase } from '../../../../src/core/model';
import { sampleEvaluation } from '../../../helpers/fixtures';

const e = sampleEvaluation();
const original = e.dataset.cases[1] as TestCase;
const ctx = (): CaseJsonCheckContext & { original: TestCase } => ({ mode: 'correct', variables: ['source_text', 'summary'], judgedText: 'summary', catalog: e.judge_set.error_catalog, existingCases: e.dataset.cases, original });
const list = () => JSON.parse(expectedErrorsToJson(original)) as Array<Record<string, unknown>>;
const check = (value: unknown) => checkExpectedErrorsJson(typeof value === 'string' ? value : JSON.stringify(value), ctx());
const decisions = (over: Partial<CaseDecisions> = {}): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '', ...over });

describe('expectedErrorsToJson', () => {
  it('is the list of the errors only, with their identifiers, so that an unchanged error can be told from a changed one', () => {
    const items = list();
    expect(items).toHaveLength(original.expected_errors.length);
    expect(items[0]).toMatchObject({ id: original.expected_errors[0]!.id, description: original.expected_errors[0]!.description });
    expect(Array.isArray(JSON.parse(expectedErrorsToJson(original)))).toBe(true);
  });
});

describe('checkExpectedErrorsJson', () => {
  it('accepts its own output and keeps the identifiers', () => {
    const r = check(list());
    expect(r.problems).toEqual([]);
    expect(r.errors?.map((x) => x.id)).toEqual(original.expected_errors.map((x) => x.id));
  });

  it('accepts a list, or an object with "expected_errors"', () => {
    expect(check({ expected_errors: list() }).problems).toEqual([]);
  });

  it('gives a new error the next free identifier, never one that another error keeps', () => {
    const items = list();
    const r = check([...items, { description: 'a new one', fragment: 'Anna is a doctor' }, { ...items[0], id: 'e9' }]);
    const ids = r.errors!.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, items.length)).toEqual(items.map((x) => x.id));
    expect(ids[items.length]).toMatch(/^e\d+$/);
    expect(ids.at(-1)).not.toBe('e9'); // an identifier that no error of the case had is not kept
  });

  it('a duplicate identifier is given to the first only', () => {
    const items = list();
    const r = check([items[0], { ...items[0], description: 'again' }]);
    expect(new Set(r.errors!.map((x) => x.id)).size).toBe(2);
  });

  it('reports unreadable JSON with its line and column, and a missing description with its path', () => {
    const bad = check('[ {');
    expect(bad.problems[0]).toMatchObject({ line: expect.any(Number), column: expect.any(Number) });
    expect(bad.errors).toBeUndefined();
    const no = check([{ category: 'factual-error' }]);
    expect(no.problems.map((p) => p.path)).toContain('expected_errors[0].description');
  });

  it('keeps source_fragment and warns about a fragment that is in no field', () => {
    const r = check([{ description: 'd', fragment: 'Anna is a doctor', source_fragment: 'Anna is a baker' }, { description: 'd2', fragment: 'nothing like it' }]);
    expect(r.problems).toEqual([]);
    expect(r.errors![0]).toMatchObject({ source_fragment: 'Anna is a baker' });
    expect(r.warnings.join(' ')).toMatch(/fragment/);
  });

  it('an empty list is fine: the case becomes a clean case', () => {
    expect(check([]).errors).toEqual([]);
  });
});

describe('planExpectedErrors', () => {
  const same = () => original.expected_errors;

  it('an unchanged list changes nothing', () => {
    expect(planExpectedErrors(original.expected_errors, same(), decisions())).toMatchObject({ changed: [], removed: [], added: 0, nothing: true, marksDropped: 0 });
  });

  it('names the changed, removed and added errors, and counts the marks set by hand that go with the changed and removed ones', () => {
    const [first, second] = original.expected_errors as [TestCase['expected_errors'][number], TestCase['expected_errors'][number]];
    const next = [{ ...first, difficulty: first.difficulty === 'subtle' ? ('obvious' as const) : ('subtle' as const) }, { id: 'e7', description: 'new' }];
    const plan = planExpectedErrors(original.expected_errors, next, decisions({ expected: { [first.id]: { state: 'found', source: 'manual' }, [second.id]: { state: 'missed', source: 'llm-approved' } } }));
    expect(plan).toMatchObject({ changed: [first.id], removed: [second.id], added: 1, nothing: false, marksDropped: 2 });
  });

  it('an unchanged error keeps its mark', () => {
    const [first] = original.expected_errors as [TestCase['expected_errors'][number]];
    const plan = planExpectedErrors(original.expected_errors, original.expected_errors, decisions({ expected: { [first.id]: { state: 'found', source: 'manual' } } }));
    expect(plan.marksDropped).toBe(0);
  });

});
