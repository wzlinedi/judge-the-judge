// The thresholds and "Load check settings" (FR-069). Thresholds are the only thing the Results step changes.
import { CASE_LEVEL_MEASURES } from '../../core/evaluation/measures';
import { readChecks } from '../../core/io/checks-file';
import type { MetricDefinition } from '../../core/metrics/types';
import type { Problem } from '../../core/model';
import type { Ports } from '../ports/types';
import { loadCheckSettings, setThresholds, type AppState } from '../store';

/** The value of one rule, as a share from 0 to 1. A value outside that range, or a measure without a rule, changes nothing. */
export function changeThreshold(state: AppState, measure: string, value: number): AppState {
  if (!Number.isFinite(value) || value < 0 || value > 1) return state;
  const rules = state.evaluation.checks.rules;
  if (!rules.some((r) => r.measure === measure)) return state;
  return setThresholds(state, { rules: rules.map((r) => (r.measure === measure ? { ...r, value } : r)) });
}

export interface ChecksLoad {
  state: AppState;
  outcome: 'loaded' | 'cancelled' | 'invalid';
  message?: string;
  problems?: Problem[];
}

/** The measures a check rule may name: the two per-error ones, the two case-level ones and those of the active metric. */
export function knownMeasures(metric: Pick<MetricDefinition, 'measures'> | undefined): string[] {
  return [...new Set(['detection_rate', 'false_positive_rate', ...CASE_LEVEL_MEASURES.map((m) => m.id), ...(metric?.measures.map((m) => m.id) ?? [])])];
}

/** "Load check settings": replaces the rules in use from a file. An invalid file is described and changes nothing. */
export async function loadChecksFromFile(state: AppState, ports: Ports, metric: Pick<MetricDefinition, 'measures'> | undefined): Promise<ChecksLoad> {
  const opened = await ports.opener.open('json');
  if (!opened) return { state, outcome: 'cancelled' };
  const read = readChecks(opened.text, knownMeasures(metric));
  if (!read.ok) return { state, outcome: 'invalid', problems: read.problems };
  return { state: loadCheckSettings(state, read.value), outcome: 'loaded', message: ['The check settings were loaded.', ...read.notes].join(' ') };
}
