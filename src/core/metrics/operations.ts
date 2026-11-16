// The operations a measure may use: `ratio` and `complement` over the counters the tool produces.
import type { Counters } from '../evaluation/counters';
import { wilson } from '../evaluation/wilson';
import { ownValue } from '../cases/test-run';
import type { MeasureDefinition, MeasureValue } from './types';

export const COUNTER_NAMES = [
  'expected_total', 'expected_found', 'expected_missed', 'findings_total', 'false_positives', 'real_errors',
  'additional_total', 'subtle_total', 'subtle_found', 'cases_decided', 'cases_with_false_positive',
  'clean_cases_decided', 'clean_cases_with_false_positive', 'defective_cases_decided', 'defective_cases_flagged',
] as const;

export function evaluateMeasure(measure: MeasureDefinition, counters: Counters, computed: Record<string, MeasureValue>): MeasureValue {
  const base = { id: measure.id, name: measure.name, better: measure.better };
  if (measure.operation === 'complement') {
    const of = measure.of ? ownValue(computed, measure.of) : undefined;
    return { ...base, value: of && of.value !== null ? 1 - of.value : null, interval: null };
  }
  const numerator = (counters as unknown as Record<string, number>)[measure.numerator ?? ''] ?? 0;
  const denominator = (counters as unknown as Record<string, number>)[measure.denominator ?? ''] ?? 0;
  if (denominator === 0) return { ...base, value: null, numerator, denominator, interval: null };
  return {
    ...base,
    value: numerator / denominator,
    numerator,
    denominator,
    interval: measure.interval === 'wilson95' ? wilson(numerator, denominator) : null,
  };
}
