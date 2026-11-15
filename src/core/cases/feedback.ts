// Live feedback on the test cases being built (FR-045, FR-046): counts, the test size against the fixed minimums,
// warnings, and the remaining capacity. A forecast: the minimum that decides the answer is counted from decided items (FR-068).
import { MINIMUM_SAMPLE } from '../evaluation/results';
import { countingModeOf } from '../judge/counting-mode';
import type { Evaluation } from '../model';
import { MAX_CASES } from '../schemas/test-case';

export interface Need {
  have: number;
  need: number;
  missing: number;
  met: boolean;
}

export interface TestProjectFeedback {
  total: number;
  clean: number;
  withErrors: number;
  withReply: number;
  /** Injected errors in all the cases. */
  errorsTotal: number;
  /** Cases with errors, grouped by their number of errors, in ascending order. */
  byErrorCount: Array<{ errors: number; cases: number }>;
  /** Groups of cases whose fields are all identical, each by identifiers in order. */
  duplicates: string[][];
  capacity: { limit: number; used: number; remaining: number; full: boolean };
  size: {
    /** What the first total counts: injected errors, or cases with expected errors for a judge evaluated per case. */
    unit: 'injected errors' | 'cases with expected errors';
    errors: Need;
    clean: Need;
    sentence: string;
  };
  warnings: string[];
}

const need = (have: number, minimum: number): Need => ({ have, need: minimum, missing: Math.max(0, minimum - have), met: have >= minimum });

/** Fields compared as a whole: the same names with the same texts, in any order. */
function fieldsKey(fields: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(fields).sort().map((k) => [k, fields[k]]));
}

function list(ids: readonly string[]): string {
  return ids.length <= 2 ? ids.join(' and ') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

export function testProjectFeedback(evaluation: Pick<Evaluation, 'dataset' | 'judge_set' | 'replies'>): TestProjectFeedback {
  const cases = evaluation.dataset.cases;
  const withErrorsCases = cases.filter((c) => c.expected_errors.length > 0);
  const clean = cases.length - withErrorsCases.length;
  const errorsTotal = withErrorsCases.reduce((sum, c) => sum + c.expected_errors.length, 0);
  const perCase = countingModeOf(evaluation.judge_set) === 'per_case';

  const counts = new Map<number, number>();
  for (const c of withErrorsCases) counts.set(c.expected_errors.length, (counts.get(c.expected_errors.length) ?? 0) + 1);
  const byErrorCount = [...counts.entries()].sort(([a], [b]) => a - b).map(([errors, n]) => ({ errors, cases: n }));

  const groups = new Map<string, string[]>();
  for (const c of cases) groups.set(fieldsKey(c.fields), [...(groups.get(fieldsKey(c.fields)) ?? []), c.id]);
  const duplicates = [...groups.values()].filter((ids) => ids.length > 1);

  const unit = perCase ? 'cases with expected errors' : 'injected errors';
  const errors = need(perCase ? withErrorsCases.length : errorsTotal, MINIMUM_SAMPLE.expected_errors);
  const cleanNeed = need(clean, MINIMUM_SAMPLE.clean_cases);
  const required = `at least ${MINIMUM_SAMPLE.expected_errors} ${unit} and ${MINIMUM_SAMPLE.clean_cases} clean cases`;
  const sentence = errors.met && cleanNeed.met ? `The test is big enough for a reliable answer (${required} are needed).` : `A reliable answer needs ${required}; until then the result is Inconclusive.`;

  const warnings: string[] = [];
  if (cases.length > 0 && withErrorsCases.length === 0) {
    warnings.push(`There are no cases with injected errors. Without them the ${perCase ? 'case ' : ''}detection rate cannot be computed, and a judge that flags nothing would look perfect.`);
  }
  if (cases.length > 0 && clean === 0) {
    warnings.push(`There are no clean cases. Without them the ${perCase ? 'clean-case ' : ''}false-positive rate cannot be computed, and a judge that flags everything would look perfect.`);
  }
  if (errorsTotal > 0 && !withErrorsCases.some((c) => c.expected_errors.some((e) => e.difficulty === 'subtle'))) {
    warnings.push('No expected error is marked subtle, so the result cannot say whether the judge finds hard errors.');
  }
  for (const ids of duplicates) warnings.push(`Cases ${list(ids)} have identical fields.`);

  return {
    total: cases.length,
    clean,
    withErrors: withErrorsCases.length,
    withReply: cases.filter((c) => evaluation.replies[c.id] !== undefined).length,
    errorsTotal,
    byErrorCount,
    duplicates,
    capacity: { limit: MAX_CASES, used: cases.length, remaining: Math.max(0, MAX_CASES - cases.length), full: cases.length >= MAX_CASES },
    size: { unit, errors, clean: cleanNeed, sentence },
    warnings,
  };
}
