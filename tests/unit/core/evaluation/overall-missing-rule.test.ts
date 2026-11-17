// A measure in use with no threshold rule is checked against the bundled default, never passed unchecked (FR-068, T414).
// Before the fix a file from before per-case mode (only the two per-error rules) gave "Works" with 0 of 30 cases flagged,
// and `checks: {rules: []}` gave "Works" with 0 of 30 errors found.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { overallResult } from '../../../../src/core/evaluation/overall';
import type { Counters } from '../../../../src/core/evaluation/counters';
import type { MeasureValue } from '../../../../src/core/metrics/types';
import type { CheckConfiguration } from '../../../../src/core/model';
import { readTestProject } from '../../../../src/core/io/test-project-file';
import checksDefault from '../../../../src/core/metrics/builtin/checks.default.json';

const measure = (id: string, value: number): MeasureValue => ({ id, name: id, value, interval: null, better: id.includes('false') ? 'lower' : 'higher' });
const measures = Object.fromEntries(['detection_rate', 'false_positive_rate', 'case_detection_rate', 'clean_case_false_positive_rate'].map((id) => [id, measure(id, id.includes('false') ? 0 : 0)]));
const counters = { expected_total: 30, defective_cases_decided: 30, clean_cases_decided: 10, cases_awaiting: 0, cases_not_run: 0 } as Counters;
const minimum = { expected_errors: 30, clean_cases: 10 };
const perErrorRules = checksDefault.rules.filter((r) => r.measure === 'detection_rate' || r.measure === 'false_positive_rate') as CheckConfiguration['rules'];

describe('a measure in use with no rule (T414)', () => {
  it('per case, with only the two per-error rules: the case detection rate is checked against the default and fails', () => {
    const r = overallResult(counters, measures, { rules: perErrorRules }, minimum, 'per_case');
    expect(r.result).toBe('Does not work');
  });

  it('with no rule at all: the detection rate is checked against the default and fails', () => {
    const r = overallResult(counters, measures, { rules: [] }, minimum, 'per_expected_error');
    expect(r.result).toBe('Does not work');
  });
});

describe('loading a test project with missing rules (T414)', () => {
  const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8'));

  it.each([
    ['only the two per-error rules', perErrorRules],
    ['no rule', []],
  ])('%s: the missing rules come from the bundled default into the project, with one note', (_label, rules) => {
    const read = readTestProject(JSON.stringify({ ...demo, checks: { ...demo.checks, rules } }));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(read.value.project.checks.rules.map((r) => r.measure).sort()).toEqual(checksDefault.rules.map((r) => r.measure).sort());
    const notes = read.notes.filter((n) => /threshold/i.test(n));
    expect(notes).toHaveLength(1);
    const missing = checksDefault.rules.map((r) => r.measure).filter((m) => !rules.some((r) => r.measure === m));
    for (const measure of missing) expect(notes[0]).toContain(measure);
  });

  it('a file with every rule gets no such note and keeps its own values', () => {
    const rules = checksDefault.rules.map((r) => ({ ...r, value: 0.5 }));
    const read = readTestProject(JSON.stringify({ ...demo, checks: { ...demo.checks, rules } }));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(read.notes.filter((n) => /threshold/i.test(n))).toEqual([]);
    expect(read.value.project.checks.rules.every((r) => r.value === 0.5)).toBe(true);
  });
});
