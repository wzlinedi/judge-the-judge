// The thresholds of the Results step (FR-069): the only thing that step changes.
import { setThresholds, type AppState } from '../store';

/** The value of one rule, as a share from 0 to 1. A value outside that range, or a measure without a rule, changes nothing. */
export function changeThreshold(state: AppState, measure: string, value: number): AppState {
  if (!Number.isFinite(value) || value < 0 || value > 1) return state;
  const rules = state.project.checks.rules;
  if (!rules.some((r) => r.measure === measure)) return state;
  return setThresholds(state, { rules: rules.map((r) => (r.measure === measure ? { ...r, value } : r)) });
}
