import type { CountingMode } from '../model';
import { evaluateMeasure } from '../metrics/operations';
import type { MeasureDefinition, MeasureValue, MetricDefinition } from '../metrics/types';
import type { Counters } from './counters';

/** The two measures the tool computes whenever the judge is evaluated per case (metric-and-checks.md). */
export const CASE_LEVEL_MEASURES: MeasureDefinition[] = [
  { id: 'case_detection_rate', name: 'Case detection rate', description: 'Cases with errors that the judge flagged.', operation: 'ratio', numerator: 'defective_cases_flagged', denominator: 'defective_cases_decided', interval: 'wilson95', better: 'higher' },
  { id: 'clean_case_false_positive_rate', name: 'Clean-case false-positive rate', description: 'Clean cases that the judge flagged.', operation: 'ratio', numerator: 'clean_cases_with_false_positive', denominator: 'clean_cases_decided', interval: 'wilson95', better: 'lower' },
];

const PER_ERROR_IDS = ['detection_rate', 'false_positive_rate'];

export function measuresInUse(mode: CountingMode): string[] {
  return mode === 'per_case' ? CASE_LEVEL_MEASURES.map((m) => m.id) : PER_ERROR_IDS;
}

export function computeMeasures(counters: Counters, metric: Pick<MetricDefinition, 'measures'>, mode: CountingMode = 'per_expected_error'): Record<string, MeasureValue> {
  const definitions =
    mode === 'per_case' ? [...CASE_LEVEL_MEASURES, ...metric.measures.filter((m) => !PER_ERROR_IDS.includes(m.id) && !CASE_LEVEL_MEASURES.some((x) => x.id === m.id))] : metric.measures;
  const computed: Record<string, MeasureValue> = {};
  for (const measure of definitions) computed[measure.id] = evaluateMeasure(measure, counters, computed);
  return computed;
}
