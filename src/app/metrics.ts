// The metric registry of the page: built-in definitions are bundled, never fetched (the policy blocks fetch);
// loaded ones are added when the user loads their file. Nothing is remembered after the page is closed.
import accuracy from '../core/metrics/builtin/accuracy.json';
import completeness from '../core/metrics/builtin/completeness.json';
import { createRegistry, findMetric, register, type RegisterResult, type Registry } from '../core/metrics/registry';
import type { MetricDefinition } from '../core/metrics/types';

export const BUILT_IN_REGISTRY = createRegistry([accuracy as unknown as MetricDefinition, completeness as unknown as MetricDefinition]);

/** One registry for the session (metric-and-checks.md, section 3). */
let current: Registry = BUILT_IN_REGISTRY;

export function sessionRegistry(): Registry {
  return current;
}

export function registerMetric(definition: MetricDefinition, options: { replace?: boolean } = {}): RegisterResult {
  const result = register(current, definition, options);
  if (result.ok) current = result.registry;
  return result;
}

/** Back to the built-in definitions; used by tests. */
export function resetRegistry(): void {
  current = BUILT_IN_REGISTRY;
}

/** The active metric of an evaluation; falls back to Accuracy, whose parameters and measures are the defaults. */
export function metricFor(id: string): MetricDefinition {
  return findMetric(current, id) ?? (accuracy as unknown as MetricDefinition);
}
