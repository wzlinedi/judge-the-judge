// Counters and the splits (data-model.md, Counters and measures): computed only from cases whose
// status is Pass or Fail. Ignored items are left out of every counter except the two "ignored" ones.
import type { CountingMode, TestCase } from '../model';
import type { Effective } from './decisions';
import { ownValue, setOwn } from '../cases/test-run';
import type { CaseStatus } from './status';

export interface CountInput {
  testCase: TestCase;
  effective: Effective | null;
  status: CaseStatus;
}

export interface Counters {
  expected_total: number;
  expected_found: number;
  expected_missed: number;
  additional_total: number;
  real_errors: number;
  false_positives: number;
  findings_total: number;
  subtle_total: number;
  subtle_found: number;
  subtle_missed: number;
  ignored_expected: number;
  ignored_additional: number;
  cases_decided: number;
  cases_awaiting: number;
  cases_not_run: number;
  clean_cases_decided: number;
  cases_with_false_positive: number;
  clean_cases_with_false_positive: number;
  defective_cases_decided: number;
  defective_cases_flagged: number;
  per_category: Record<string, { expected_total: number; expected_found: number }>;
  per_difficulty: Record<string, { expected_total: number; expected_found: number }>;
  per_rule: Record<string, { real_errors: number; false_positives: number }>;
  additional_per_category: Record<string, { real: number; fp: number }>;
  additional_per_difficulty: Record<string, { real: number; fp: number }>;
  /** For a judge evaluated per case: cases with expected errors, once in each category and difficulty their errors have. */
  case_per_category: Record<string, { cases: number; flagged: number }>;
  case_per_difficulty: Record<string, { cases: number; flagged: number }>;
}

/** The entry under `key`, created as an own entry when it is not there; a name such as `__proto__` or `constructor` is only a name (S1, Constitution IX). */
function entry<T>(record: Record<string, T>, key: string, make: () => T): T {
  const found = ownValue(record, key);
  if (found !== undefined) return found;
  const created = make();
  setOwn(record, key, created);
  return created;
}

export const NO_CATEGORY = '(no category)';
export const NOT_SET = '(not set)';
export const ADDED_BY_HAND = '(added by hand)';

export function emptyCounters(): Counters {
  return {
    expected_total: 0, expected_found: 0, expected_missed: 0, additional_total: 0, real_errors: 0, false_positives: 0,
    findings_total: 0, subtle_total: 0, subtle_found: 0, subtle_missed: 0, ignored_expected: 0, ignored_additional: 0,
    cases_decided: 0, cases_awaiting: 0, cases_not_run: 0, clean_cases_decided: 0, cases_with_false_positive: 0,
    clean_cases_with_false_positive: 0, defective_cases_decided: 0, defective_cases_flagged: 0,
    per_category: {}, per_difficulty: {}, per_rule: {}, additional_per_category: {}, additional_per_difficulty: {},
    case_per_category: {}, case_per_difficulty: {},
  };
}

/** Per case, the per-error counters are still computed (every error of a flagged case is found); the case counters are the ones shown. */
export function countAll(inputs: readonly CountInput[], mode: CountingMode = 'per_expected_error'): Counters {
  const c = emptyCounters();
  let correct = 0;

  for (const { testCase, effective, status } of inputs) {
    if (status === 'not_run') c.cases_not_run++;
    else if (status === 'awaiting') c.cases_awaiting++;
    if (!effective || (status !== 'pass' && status !== 'fail')) continue;

    c.cases_decided++;
    const clean = testCase.expected_errors.length === 0;
    if (clean) c.clean_cases_decided++;

    let counted = 0;
    let found = 0;
    const attachedKeys = new Set<string>();
    const categories = new Set<string>();
    const difficulties = new Set<string>();
    for (const e of effective.expected) {
      if (e.state === 'ignored') {
        c.ignored_expected++;
        continue;
      }
      if (e.state !== 'found' && e.state !== 'missed') continue;
      counted++;
      const meta = testCase.expected_errors.find((x) => x.id === e.id);
      const category = meta?.category ?? NO_CATEGORY;
      const difficulty = meta?.difficulty ?? NOT_SET;
      categories.add(category);
      difficulties.add(difficulty);
      const byCategory = entry(c.per_category, category, () => ({ expected_total: 0, expected_found: 0 }));
      const byDifficulty = entry(c.per_difficulty, difficulty, () => ({ expected_total: 0, expected_found: 0 }));
      c.expected_total++;
      byCategory.expected_total++;
      byDifficulty.expected_total++;
      if (meta?.difficulty === 'subtle') c.subtle_total++;
      if (e.state === 'found') {
        found++;
        c.expected_found++;
        byCategory.expected_found++;
        byDifficulty.expected_found++;
        // Each finding counts once, also when it points at several errors; a found error with no finding counts one (code review R5, R6).
        if (e.attachedKeys === undefined) correct += e.attached;
        else if (e.attachedKeys.length === 0) correct += 1;
        else for (const key of e.attachedKeys) attachedKeys.add(key);
        if (meta?.difficulty === 'subtle') c.subtle_found++;
      } else {
        c.expected_missed++;
        if (meta?.difficulty === 'subtle') c.subtle_missed++;
      }
    }
    correct += attachedKeys.size;
    if (counted > 0) {
      c.defective_cases_decided++;
      if (found > 0) c.defective_cases_flagged++;
      if (mode === 'per_case') {
        for (const [groups, names] of [[c.case_per_category, categories], [c.case_per_difficulty, difficulties]] as const) {
          for (const name of names) {
            const group = entry(groups, name, () => ({ cases: 0, flagged: 0 }));
            group.cases++;
            if (found > 0) group.flagged++;
          }
        }
      }
    }

    let falsePositive = false;
    for (const a of effective.additional) {
      if (a.state === 'ignored') {
        c.ignored_additional++;
        continue;
      }
      if (a.state !== 'real_error' && a.state !== 'false_positive') continue;
      const real = a.state === 'real_error';
      c.additional_total++;
      if (real) c.real_errors++;
      else {
        c.false_positives++;
        falsePositive = true;
      }
      const side = real ? 'real' : 'fp';
      entry(c.additional_per_category, a.category ?? NO_CATEGORY, () => ({ real: 0, fp: 0 }))[side]++;
      entry(c.additional_per_difficulty, a.difficulty ?? NOT_SET, () => ({ real: 0, fp: 0 }))[side]++;
      for (const rule of a.rules.length > 0 ? a.rules : [ADDED_BY_HAND]) {
        entry(c.per_rule, rule, () => ({ real_errors: 0, false_positives: 0 }))[real ? 'real_errors' : 'false_positives']++;
      }
    }
    if (falsePositive) {
      c.cases_with_false_positive++;
      if (clean) c.clean_cases_with_false_positive++;
    }
  }
  c.findings_total = correct + c.real_errors + c.false_positives;
  return c;
}
