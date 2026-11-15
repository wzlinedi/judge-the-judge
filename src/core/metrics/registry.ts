// One registry holds every metric definition of the session (metric-and-checks.md, section 3).
import type { MetricDefinition } from './types';

export interface Registry {
  metrics: readonly MetricDefinition[];
}

/** No metric has a special place: the registry starts with the definitions it is given (the default metric file) and takes the rest from loaded files. */
export function createRegistry(initial: readonly MetricDefinition[]): Registry {
  return { metrics: [...initial] };
}

export type RegisterResult = { ok: true; registry: Registry } | { ok: false; reason: string; canReplace: boolean };

/** Adds a definition. An id already in use is refused unless `replace` is set; every definition is treated alike. */
export function register(registry: Registry, definition: MetricDefinition, options: { replace?: boolean } = {}): RegisterResult {
  if (registry.metrics.some((m) => m.id === definition.id)) {
    if (!options.replace) return { ok: false, reason: `A metric with the id "${definition.id}" is already loaded.`, canReplace: true };
    return { ok: true, registry: { ...registry, metrics: registry.metrics.map((m) => (m.id === definition.id ? definition : m)) } };
  }
  return { ok: true, registry: { ...registry, metrics: [...registry.metrics, definition] } };
}

/** What the "Load example…" window offers besides the demo. */
export function listExamples(registry: Registry): readonly MetricDefinition[] {
  return registry.metrics;
}

export function findMetric(registry: Registry, id: string): MetricDefinition | undefined {
  return registry.metrics.find((m) => m.id === id);
}
