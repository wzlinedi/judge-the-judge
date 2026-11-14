// One registry holds every metric definition of the session (metric-and-checks.md, section 3).
import type { MetricDefinition } from './types';

export interface Registry {
  metrics: readonly MetricDefinition[];
  /** Ids of the definitions registered at start; they cannot be replaced. */
  builtIn: readonly string[];
}

export function createRegistry(builtIns: readonly MetricDefinition[]): Registry {
  return { metrics: [...builtIns], builtIn: builtIns.map((m) => m.id) };
}

export type RegisterResult = { ok: true; registry: Registry } | { ok: false; reason: string; canReplace: boolean };

/** Adds a definition. An id already used by a loaded definition is refused unless `replace` is set; a built-in one never is. */
export function register(registry: Registry, definition: MetricDefinition, options: { replace?: boolean } = {}): RegisterResult {
  if (registry.builtIn.includes(definition.id)) {
    return { ok: false, reason: `"${definition.id}" is a built-in metric and cannot be replaced.`, canReplace: false };
  }
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
