// The metric registry of the page: the default metric file is bundled, never fetched (the policy blocks fetch), and
// takes the same route as a loaded one; no metric has a special place. Loaded ones are added when the user loads their file. Nothing is remembered after the page is closed.
import accuracy from '../core/metrics/builtin/accuracy.json';
import { createRegistry, findMetric, register, type RegisterResult, type Registry } from '../core/metrics/registry';
import type { MetricRef } from '../core/model';
import type { MetricDefinition } from '../core/metrics/types';

export const DEFAULT_REGISTRY = createRegistry([accuracy as unknown as MetricDefinition]);

/** One registry for the session (metric-and-checks.md, section 3). */
let current: Registry = DEFAULT_REGISTRY;

export function sessionRegistry(): Registry {
  return current;
}

export function registerMetric(definition: MetricDefinition, options: { replace?: boolean } = {}): RegisterResult {
  const result = register(current, definition, options);
  if (result.ok) current = result.registry;
  return result;
}

/** Back to the default metric file; used by tests. */
export function resetRegistry(): void {
  current = DEFAULT_REGISTRY;
}

/** The active metric of an evaluation. A file that names a metric which is not loaded is refused when it is read, so this never guesses. */
export function metricFor(id: string): MetricDefinition {
  const found = findMetric(current, id);
  if (found === undefined) throw new Error(`The metric "${id}" is not loaded.`);
  return found;
}

/** A definition that a loaded file carries is registered with the session; a loaded definition replaces an earlier one of the same id (T243, T274). Nothing is remembered after the page is closed. */
export function registerEmbeddedMetric(ref: MetricRef): void {
  const details = ref.definition;
  if (details === undefined) return;
  // The starter judge of a metric file is not part of an embedded definition and nothing reads it.
  const noStarter = { prompt: '', reply_mapping: { finding_text: {} }, error_rules: [], error_catalog: [], clean_base_cases: [] };
  registerMetric({ format: 'judge-the-judge-metric', schema_version: 1, id: ref.id, ...details, judge_set: noStarter }, { replace: true });
}
