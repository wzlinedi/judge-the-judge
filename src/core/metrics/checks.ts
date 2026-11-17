import type { CheckConfiguration } from '../model';
import type { CheckOutcome, MeasureValue } from './types';
import checksDefaults from './builtin/checks.default.json';

const DEFAULT_RULES = checksDefaults.rules as CheckConfiguration['rules'];

/**
 * The rules with a rule for every measure that has a bundled default: a measure with no rule in the file (a file from before
 * per-case mode, or `rules: []`) gets the bundled default, so it is never passed unchecked (FR-068, T414). `added` names them.
 */
export function withDefaultRules(checks: CheckConfiguration): { checks: CheckConfiguration; added: string[] } {
  const missing = DEFAULT_RULES.filter((d) => !checks.rules.some((r) => r.measure === d.measure));
  if (missing.length === 0) return { checks, added: [] };
  return { checks: { ...checks, rules: [...checks.rules, ...missing.map((r) => ({ ...r }))] }, added: missing.map((r) => r.measure) };
}

/** Only the rules whose measure is in use count (metric-and-checks.md, section 2). */
export function evaluateChecks(measures: Record<string, MeasureValue>, checks: CheckConfiguration, inUse: readonly string[]): CheckOutcome[] {
  return withDefaultRules(checks)
    .checks.rules.filter((rule) => inUse.includes(rule.measure))
    .map((rule) => {
      const value = measures[rule.measure]?.value ?? null;
      // No findings means no false positives; any other measure that is not available fails.
      const passed = value === null ? rule.measure === 'false_positive_rate' : rule.comparison === 'at_least' ? value >= rule.value : value <= rule.value;
      return { measure: rule.measure, comparison: rule.comparison, threshold: rule.value, value, passed };
    });
}
