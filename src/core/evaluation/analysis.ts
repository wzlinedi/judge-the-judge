// The tables of the Error analysis view and the report (FR-070). The detection rate of every group is shown (T268); a group of fewer than MIN_GROUP says little.
import { NOT_SET, type Counters } from './counters';
import { MINIMUM_SAMPLE } from './results';

export const MIN_GROUP = 10;

/** The sentence under the two tables of groups (T268). */
export const SMALL_GROUP_NOTE = `A rate of a small group says little: with fewer than ${MIN_GROUP} expected errors, one error more or less changes it a lot.`;

/** The sentence of Details › Thresholds on how much data the result needs (T268). */
export const DATA_NEEDED_NOTE = `The overall result needs at least ${MINIMUM_SAMPLE.expected_errors} expected errors and ${MINIMUM_SAMPLE.clean_cases} clean cases, and a group of fewer than ${MIN_GROUP} expected errors says little.`;

export interface GroupRow {
  name: string;
  expected: number;
  found: number;
  missed: number;
  /** null only when there is nothing to divide (no expected errors) or the judge is evaluated per case, which has no rate. */
  rate: number | null;
}

export interface AdditionalRow {
  name: string;
  real: number;
  fp: number;
}

export interface RuleRow {
  rule: string;
  real: number;
  fp: number;
}

export interface ErrorAnalysis {
  byCategory: GroupRow[];
  byDifficulty: GroupRow[];
  perRule: RuleRow[];
  additionalByCategory: AdditionalRow[];
  additionalByDifficulty: AdditionalRow[];
}

const DIFFICULTY_ORDER = ['obvious', 'subtle', NOT_SET];

function groups(source: Counters['per_category'], order?: readonly string[]): GroupRow[] {
  const rank = (name: string) => (order ? (order.includes(name) ? order.indexOf(name) : order.length) : 0);
  return Object.entries(source)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, g]) => ({
      name,
      expected: g.expected_total,
      found: g.expected_found,
      missed: g.expected_total - g.expected_found,
      rate: g.expected_total > 0 ? g.expected_found / g.expected_total : null,
    }));
}

function additional(source: Counters['additional_per_category'], order?: readonly string[]): AdditionalRow[] {
  const rank = (name: string) => (order ? (order.includes(name) ? order.indexOf(name) : order.length) : 0);
  return Object.entries(source)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, v]) => ({ name, real: v.real, fp: v.fp }));
}

/** Per case the groups count cases, once in each category and difficulty their errors have; there is never a rate. */
function caseGroups(source: Counters['case_per_category'], order?: readonly string[]): GroupRow[] {
  const rank = (name: string) => (order ? (order.includes(name) ? order.indexOf(name) : order.length) : 0);
  return Object.entries(source)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, g]) => ({ name, expected: g.cases, found: g.flagged, missed: g.cases - g.flagged, rate: null }));
}

export function errorAnalysis(counters: Counters, perCase = false): ErrorAnalysis {
  return {
    byCategory: perCase ? caseGroups(counters.case_per_category) : groups(counters.per_category),
    byDifficulty: perCase ? caseGroups(counters.case_per_difficulty, DIFFICULTY_ORDER) : groups(counters.per_difficulty, DIFFICULTY_ORDER),
    perRule: Object.entries(counters.per_rule)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([rule, v]) => ({ rule, real: v.real_errors, fp: v.false_positives })),
    additionalByCategory: additional(counters.additional_per_category),
    additionalByDifficulty: additional(counters.additional_per_difficulty, DIFFICULTY_ORDER),
  };
}

/** The two shares of Details (FR-069), as information. */
export function falsePositiveShares(counters: Counters): { cases: { count: number; of: number }; clean: { count: number; of: number } } {
  return {
    cases: { count: counters.cases_with_false_positive, of: counters.cases_decided },
    clean: { count: counters.clean_cases_with_false_positive, of: counters.clean_cases_decided },
  };
}
