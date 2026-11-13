import type { CheckConfiguration } from '../model';
import type { CheckOutcome, MeasureValue } from './types';

/** Only the rules whose measure is in use count (metric-and-checks.md, section 2). */
export function evaluateChecks(measures: Record<string, MeasureValue>, checks: CheckConfiguration, inUse: readonly string[]): CheckOutcome[] {
  return checks.rules
    .filter((rule) => inUse.includes(rule.measure))
    .map((rule) => {
      const value = measures[rule.measure]?.value ?? null;
      // No findings means no false positives; any other measure that is not available fails.
      const passed = value === null ? rule.measure === 'false_positive_rate' : rule.comparison === 'at_least' ? value >= rule.value : value <= rule.value;
      return { measure: rule.measure, comparison: rule.comparison, threshold: rule.value, value, passed };
    });
}
