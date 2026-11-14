// The metric registry of the page: built-in definitions are bundled, never fetched (the policy blocks fetch);
// loaded ones are added when the user loads their file. Nothing is remembered after the page is closed.
import accuracy from '../core/metrics/builtin/accuracy.json';
import { createRegistry, findMetric, register, type RegisterResult, type Registry } from '../core/metrics/registry';
import type { MetricRef } from '../core/model';
import type { MetricDefinition } from '../core/metrics/types';

export const BUILT_IN_REGISTRY = createRegistry([accuracy as unknown as MetricDefinition]);

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

/** A definition that a loaded file carries is registered with the session; a built-in metric is never replaced (T243). Nothing is remembered after the page is closed. */
export function registerEmbeddedMetric(ref: MetricRef): void {
  const details = ref.definition;
  if (details === undefined || current.builtIn.includes(ref.id)) return;
  // The starter judge of a metric file is not part of an embedded definition and nothing reads it.
  const noStarter = { prompt: '', reply_mapping: { finding_text: {} }, error_rules: [], error_catalog: [], clean_base_cases: [] };
  registerMetric({ format: 'judge-the-judge-metric', schema_version: 1, id: ref.id, ...details, judge_set: noStarter }, { replace: true });
}
