import { describe, expect, it } from 'vitest';
import accuracy from '../../../../src/core/metrics/builtin/accuracy.json';
import checksDefault from '../../../../src/core/metrics/builtin/checks.default.json';
import { createRegistry, listExamples, register } from '../../../../src/core/metrics/registry';
import { evaluateChecks } from '../../../../src/core/metrics/checks';
import { evaluateMeasure } from '../../../../src/core/metrics/operations';
import type { MeasureDefinition, MetricDefinition } from '../../../../src/core/metrics/types';
import { emptyCounters } from '../../../../src/core/evaluation/counters';

const builtIn = accuracy as unknown as MetricDefinition;

describe('registry', () => {
  it('holds accuracy at start', () => {
    const registry = createRegistry([builtIn]);
    expect(listExamples(registry).map((m) => m.id)).toEqual(['accuracy']);
  });

  it('registers a new definition and refuses a duplicate id', () => {
    const registry = createRegistry([builtIn]);
    const extra = { ...builtIn, id: 'bias', name: 'Bias' };
    const added = register(registry, extra);
    expect(added.ok && listExamples(added.registry).map((m) => m.id)).toEqual(['accuracy', 'bias']);
    expect(register(registry, builtIn).ok).toBe(false);
    expect(registry.metrics).toHaveLength(1);
  });

  it('refuses to replace a built-in definition', () => {
    const registry = createRegistry([builtIn]);
    const r = register(registry, { ...builtIn, name: 'Changed' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/built-in|already/i);
  });
});

describe('operations', () => {
  const ratio: MeasureDefinition = { id: 'r', name: 'R', description: '', operation: 'ratio', numerator: 'expected_found', denominator: 'expected_total', interval: 'wilson95', better: 'higher' };
  const complement: MeasureDefinition = { id: 'c', name: 'C', description: '', operation: 'complement', of: 'r', better: 'lower' };

  it('ratio is a share from 0 to 1 with an interval', () => {
    const v = evaluateMeasure(ratio, { ...emptyCounters(), expected_total: 10, expected_found: 8 }, {});
    expect(v).toMatchObject({ value: 0.8, numerator: 8, denominator: 10 });
    expect(v.interval?.upper).toBeCloseTo(0.9433, 3);
  });

  it('ratio is "not available" at a zero denominator', () => {
    expect(evaluateMeasure(ratio, emptyCounters(), {})).toMatchObject({ value: null, interval: null });
  });

  it('complement is 1 minus the value, or not available', () => {
    expect(evaluateMeasure(complement, emptyCounters(), { r: { id: 'r', name: 'R', value: 0.25, interval: null, better: 'higher' } }).value).toBeCloseTo(0.75);
    expect(evaluateMeasure(complement, emptyCounters(), { r: { id: 'r', name: 'R', value: null, interval: null, better: 'higher' } }).value).toBeNull();
  });
});

describe('check configuration', () => {
  it('the bundled default holds the four rules and the fixed minimum test size', () => {
    expect(checksDefault.rules).toEqual([
      { measure: 'detection_rate', comparison: 'at_least', value: 0.8 },
      { measure: 'false_positive_rate', comparison: 'at_most', value: 0.1 },
      { measure: 'case_detection_rate', comparison: 'at_least', value: 0.8 },
      { measure: 'clean_case_false_positive_rate', comparison: 'at_most', value: 0.1 },
    ]);
    expect(checksDefault.minimum_sample).toEqual({ expected_errors: 30, clean_cases: 10 });
  });

  const m = (value: number | null) => ({ id: 'x', name: 'X', value, interval: null, better: 'higher' as const });

  it('at_least and at_most compare with the threshold', () => {
    const measures = { detection_rate: m(0.8), false_positive_rate: m(0.11) };
    const out = evaluateChecks(measures, checksDefault as never, ['detection_rate', 'false_positive_rate']);
    expect(out.map((o) => [o.measure, o.passed])).toEqual([['detection_rate', true], ['false_positive_rate', false]]);
  });

  it('counts only the rules whose measure is in use', () => {
    const out = evaluateChecks({ detection_rate: m(0.5), false_positive_rate: m(0.5) }, checksDefault as never, ['false_positive_rate']);
    expect(out.map((o) => o.measure)).toEqual(['false_positive_rate']);
  });

  it('a measure that is not available passes for the false-positive rate and fails for any other', () => {
    const out = evaluateChecks({ detection_rate: m(null), false_positive_rate: m(null) }, checksDefault as never, ['detection_rate', 'false_positive_rate']);
    expect(out.map((o) => o.passed)).toEqual([false, true]);
  });
});
