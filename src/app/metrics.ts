// The metric registry of the page: built-in definitions are bundled, never fetched (the policy blocks fetch).
import accuracy from '../core/metrics/builtin/accuracy.json';
import { createRegistry, findMetric } from '../core/metrics/registry';
import type { MetricDefinition } from '../core/metrics/types';

export const BUILT_IN_REGISTRY = createRegistry([accuracy as unknown as MetricDefinition]);

/** The active metric of an evaluation; falls back to Accuracy, whose parameters and measures are the defaults. */
export function metricFor(id: string): MetricDefinition {
  return findMetric(BUILT_IN_REGISTRY, id) ?? (accuracy as unknown as MetricDefinition);
}
