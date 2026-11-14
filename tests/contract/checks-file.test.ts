// The check configuration file (metric-and-checks.md, section 2; FR-069).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readChecks } from '../../src/core/io/checks-file';

const KNOWN = ['detection_rate', 'false_positive_rate', 'case_detection_rate', 'clean_case_false_positive_rate'];
const file = (over: Record<string, unknown> = {}) => JSON.stringify({ format: 'judge-the-judge-checks', schema_version: 1, rules: [{ measure: 'detection_rate', comparison: 'at_least', value: 0.7 }], ...over });
const refused = (text: string) => {
  const r = readChecks(text, KNOWN);
  if (r.ok) throw new Error('expected a refusal');
  return r.problems;
};

describe('readChecks', () => {
  it('reads the bundled default and the example', () => {
    for (const path of ['src/core/metrics/builtin/checks.default.json', 'examples/metrics/checks-example.json']) {
      const r = readChecks(readFileSync(path, 'utf8'), KNOWN);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.rules).toHaveLength(4);
    }
  });

  it('reads at_least and at_most with values from 0 to 1', () => {
    const r = readChecks(file({ rules: [{ measure: 'detection_rate', comparison: 'at_least', value: 0 }, { measure: 'false_positive_rate', comparison: 'at_most', value: 1 }] }), KNOWN);
    expect(r.ok && r.value.rules).toEqual([
      { measure: 'detection_rate', comparison: 'at_least', value: 0 },
      { measure: 'false_positive_rate', comparison: 'at_most', value: 1 },
    ]);
  });

  it('ignores minimum_sample and says the value is fixed', () => {
    const r = readChecks(file({ minimum_sample: { expected_errors: 5, clean_cases: 1 } }), KNOWN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).not.toHaveProperty('minimum_sample');
      expect(r.notes.join(' ')).toMatch(/minimum test size is fixed/i);
      expect(r.notes.join(' ')).toMatch(/30 injected errors and 10 clean cases/);
    }
  });

  it('refuses an unknown measure, naming the path and the known ones', () => {
    const [p] = refused(file({ rules: [{ measure: 'f1_score', comparison: 'at_least', value: 0.5 }] }));
    expect(p?.path).toBe('rules[0].measure');
    expect(p?.message).toContain('f1_score');
    expect(p?.message).toContain('detection_rate');
  });

  it('accepts a measure of the active metric', () => {
    const r = readChecks(file({ rules: [{ measure: 'recall', comparison: 'at_least', value: 0.5 }] }), [...KNOWN, 'recall']);
    expect(r.ok).toBe(true);
  });

  it('refuses an unknown comparison and a value out of range or not a number', () => {
    expect(refused(file({ rules: [{ measure: 'detection_rate', comparison: 'above', value: 0.5 }] }))[0]?.path).toBe('rules[0].comparison');
    for (const value of [1.5, -0.1, '0.5', null]) {
      expect(refused(file({ rules: [{ measure: 'detection_rate', comparison: 'at_least', value }] }))[0]?.path).toBe('rules[0].value');
    }
  });

  it('refuses a measure used twice, and an empty or missing list of rules', () => {
    const rule = { measure: 'detection_rate', comparison: 'at_least', value: 0.5 };
    expect(refused(file({ rules: [rule, rule] }))[0]?.message).toMatch(/twice/);
    expect(refused(file({ rules: [] }))[0]?.message).toMatch(/at least one rule/i);
    const { rules: _r, ...without } = JSON.parse(file());
    expect(refused(JSON.stringify(without))[0]?.path).toBe('rules');
  });

  it('refuses another format, a metric file and a JSON that cannot be read, with the place', () => {
    expect(refused(file({ format: 'judge-the-judge-metric' }))[0]?.path).toBe('format');
    const [p] = refused('{\n  "format": "judge-the-judge-checks",,\n}');
    expect(p?.line).toBe(2);
  });
});
