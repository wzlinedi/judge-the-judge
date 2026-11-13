// The one line of overall result (data-model.md, OverallResult; FR-068).
import type { CheckConfiguration, CountingMode } from '../model';
import { evaluateChecks } from '../metrics/checks';
import type { MeasureValue } from '../metrics/types';
import type { Counters } from './counters';
import { measuresInUse } from './measures';

export interface MinimumSample {
  expected_errors: number;
  clean_cases: number;
}

export interface OverallResult {
  result: 'Works' | 'Does not work' | 'Inconclusive';
  reasons: string[];
  borderline: string[];
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export function overallResult(
  counters: Counters,
  measures: Record<string, MeasureValue>,
  checks: CheckConfiguration,
  minimum: MinimumSample,
  mode: CountingMode,
): OverallResult {
  const perCase = mode === 'per_case';
  const reasons: string[] = [];
  const unit = perCase ? 'cases with errors' : 'expected errors';

  const undecided = counters.cases_awaiting + counters.cases_not_run;
  if (undecided > 0) {
    reasons.push(`${undecided} ${undecided === 1 ? 'case is' : 'cases are'} not decided yet (${counters.cases_not_run} not run, ${counters.cases_awaiting} awaiting verification).`);
  }
  const have = perCase ? counters.defective_cases_decided : counters.expected_total;
  if (have < minimum.expected_errors) {
    const missing = minimum.expected_errors - have;
    reasons.push(`The test is too small: ${missing} more ${perCase ? 'cases with errors' : 'expected errors'} ${missing === 1 ? 'is' : 'are'} needed (at least ${minimum.expected_errors} ${unit}).`);
  }
  if (counters.clean_cases_decided < minimum.clean_cases) {
    const missing = minimum.clean_cases - counters.clean_cases_decided;
    reasons.push(`The test is too small: ${missing} more clean ${missing === 1 ? 'case is' : 'cases are'} needed (at least ${minimum.clean_cases}).`);
  }
  if (reasons.length > 0) return { result: 'Inconclusive', reasons: perCase ? ['The judge was evaluated per case.', ...reasons] : reasons, borderline: [] };

  const outcomes = evaluateChecks(measures, checks, measuresInUse(mode));
  const borderline: string[] = [];
  for (const o of outcomes) {
    const m = measures[o.measure];
    if (m?.interval && m.interval.lower <= o.threshold && o.threshold <= m.interval.upper) {
      borderline.push(`${m.name} is borderline: its 95% interval ${pct(m.interval.lower)} to ${pct(m.interval.upper)} contains the threshold ${pct(o.threshold)}.`);
    }
  }
  const lines = outcomes.map((o) => {
    const name = measures[o.measure]?.name ?? o.measure;
    const shown = o.value === null ? 'not available' : pct(o.value);
    const direction = o.comparison === 'at_least' ? 'at least' : 'at most';
    return { passed: o.passed, text: o.passed ? `${name} is ${shown} (${direction} ${pct(o.threshold)} required).` : `${name} is ${shown}, but ${direction} ${pct(o.threshold)} is required.` };
  });
  const failed = lines.filter((l) => !l.passed);
  const prefix = perCase ? ['The judge was evaluated per case.'] : [];
  if (failed.length > 0) return { result: 'Does not work', reasons: [...prefix, ...failed.map((l) => l.text)], borderline };
  return { result: 'Works', reasons: [...prefix, ...lines.map((l) => l.text)], borderline };
}
