// A measure id or a parameter name of a metric file may be a built-in JavaScript name (Constitution IX, T407): it is kept as
// an own key, it changes no prototype, and a complement finds the measure it names among the measures of the file only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMetric, measureProblems } from '../../../../src/core/io/metric-file';
import { computeMeasures } from '../../../../src/core/evaluation/measures';
import { matchParameters } from '../../../../src/core/evaluation/results';
import { ownValue } from '../../../../src/core/cases/test-run';
import type { Counters } from '../../../../src/core/evaluation/counters';
import type { MetricDefinition } from '../../../../src/core/metrics/types';
import { sampleProject } from '../../../helpers/fixtures';

const base = JSON.parse(readFileSync('examples/metrics/bias-example.json', 'utf8'));

/** The example metric with two more measures: a ratio named `id` and its complement. */
function metricWith(id: string): MetricDefinition {
  const file = structuredClone(base);
  const extra = JSON.stringify([
    { id: 'PLACEHOLDER', name: 'Extra', operation: 'ratio', numerator: 'expected_found', denominator: 'expected_total', better: 'higher' },
    { id: 'extra-complement', name: 'Extra complement', operation: 'complement', of: 'PLACEHOLDER', better: 'lower' },
  ]).slice(1, -1);
  const text = JSON.stringify(file).replace('"measures":[', `"measures":[${extra},`).replaceAll('"PLACEHOLDER"', JSON.stringify(id));
  const read = readMetric(text);
  if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
  return read.value;
}

const counters = { expected_total: 4, expected_found: 3, findings_total: 5, false_positives: 1 } as unknown as Counters;

describe('a measure whose id is a built-in JavaScript name (T407)', () => {
  it.each(['__proto__', 'constructor', 'toString'])('%s: the measure and its complement are computed as own keys', (id) => {
    const measures = computeMeasures(counters, metricWith(id));
    expect(Object.getPrototypeOf(measures)).toBe(Object.prototype);
    expect(Object.hasOwn(measures, id)).toBe(true);
    expect(ownValue(measures, id)?.value).toBe(0.75);
    expect(ownValue(measures, 'extra-complement')?.value).toBe(0.25);
  });

  it('a complement of a built-in name that is not a measure of the file is refused', () => {
    for (const of of ['constructor', 'toString']) {
      const problems = measureProblems([{ id: 'detection_rate', operation: 'ratio', numerator: 'expected_found', denominator: 'expected_total' }, { id: 'c', operation: 'complement', of }], 'measures');
      expect(problems.some((p) => p.message.includes(`complement of "${of}"`))).toBe(true);
    }
  });
});

describe('a parameter of a metric file named __proto__ (T407)', () => {
  it('keeps its default as an own key and changes no prototype', () => {
    const text = JSON.stringify(base).replace('"parameters":{', '"parameters":{"__proto__":{"default":0.5,"description":""},');
    const read = readMetric(text);
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    const project = sampleProject();
    const parameters = matchParameters({ ...project, metric: { ...project.metric, parameters: {} } }, read.value) as unknown as Record<string, number>;
    expect(Object.getPrototypeOf(parameters)).toBe(Object.prototype);
    expect(ownValue(parameters, '__proto__')).toBe(0.5);
  });
});
