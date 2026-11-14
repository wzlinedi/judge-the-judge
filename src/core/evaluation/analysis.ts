// The tables of the Error analysis view and the report (FR-070). Counts only below this many expected errors.
import { NOT_SET, type Counters } from './counters';

export const MIN_GROUP = 10;

export interface GroupRow {
  name: string;
  expected: number;
  found: number;
  missed: number;
  /** null means "counts only": the group is too small for a rate. */
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
      rate: g.expected_total >= MIN_GROUP ? g.expected_found / g.expected_total : null,
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
