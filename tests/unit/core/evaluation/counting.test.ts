import { describe, expect, it } from 'vitest';
import { countAll, emptyCounters } from '../../../../src/core/evaluation/counters';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import type { CaseReview } from '../../../../src/core/evaluation/review';
import type { CaseDecisions } from '../../../../src/core/model';
import { wilson } from '../../../../src/core/evaluation/wilson';
import { computeMeasures } from '../../../../src/core/evaluation/measures';
import { overallResult } from '../../../../src/core/evaluation/overall';
import accuracy from '../../../../src/core/metrics/builtin/accuracy.json';
import checksDefault from '../../../../src/core/metrics/builtin/checks.default.json';
import type { MetricDefinition } from '../../../../src/core/metrics/types';
import { add, effective, exp, kase } from '../../../helpers/counting';

const metric = accuracy as unknown as MetricDefinition;
const minimum = { expected_errors: 30, clean_cases: 10 };

describe('countAll', () => {
  const cases = [
    kase('A', [{ id: 'e1', category: 'wrong-number', difficulty: 'obvious' }, { id: 'e2', category: 'wrong-number' }, { id: 'e3', category: 'contradiction', difficulty: 'subtle' }], 'fail',
      effective([exp('e1', 'found', 1), exp('e2', 'found', 2), exp('e3', 'missed', 0)], [add('a1', 'real_error', { category: 'factual-error', difficulty: 'subtle' }), add('a2', 'false_positive', { rules: ['r1', 'r2'] }), add('a3', 'ignored')])),
    kase('B', [], 'fail', effective([], [add('b1', 'false_positive')])),
    kase('C', [], 'pass', effective([])),
    kase('D', [{ id: 'e1' }], 'awaiting', effective([exp('e1', 'undecided', 0)], [add('d1', 'undecided')])),
    kase('E', [{ id: 'e1' }], 'not_run', null),
  ];
  const c = countAll(cases);

  it('counts only Pass and Fail cases', () => {
    expect(c.expected_total).toBe(3);
    expect(c.expected_found).toBe(2);
    expect(c.expected_missed).toBe(1);
    expect(c.cases_decided).toBe(3);
    expect(c.cases_awaiting).toBe(1);
    expect(c.cases_not_run).toBe(1);
  });

  it('counts additional findings and leaves ignored ones in their own counters', () => {
    expect(c.additional_total).toBe(3);
    expect(c.real_errors).toBe(1);
    expect(c.false_positives).toBe(2);
    expect(c.ignored_additional).toBe(1);
    expect(c.ignored_expected).toBe(0);
  });

  it('adds correct findings, real errors and false positives to findings_total', () => {
    expect(c.findings_total).toBe(1 + 2 + 1 + 2);
  });

  it('counts subtle errors', () => {
    expect(c).toMatchObject({ subtle_total: 1, subtle_found: 0, subtle_missed: 1 });
  });

  it('counts clean cases and cases with a false positive', () => {
    expect(c).toMatchObject({ clean_cases_decided: 2, cases_with_false_positive: 2, clean_cases_with_false_positive: 1 });
  });

  it('counts defective cases decided and flagged', () => {
    expect(c).toMatchObject({ defective_cases_decided: 1, defective_cases_flagged: 1 });
  });

  it('splits expected errors per category and difficulty', () => {
    expect(c.per_category).toEqual({ 'wrong-number': { expected_total: 2, expected_found: 2 }, contradiction: { expected_total: 1, expected_found: 0 } });
    expect(c.per_difficulty).toEqual({ obvious: { expected_total: 1, expected_found: 1 }, subtle: { expected_total: 1, expected_found: 0 }, '(not set)': { expected_total: 1, expected_found: 1 } });
  });

  it('splits additional findings per rule, category and difficulty', () => {
    expect(c.per_rule).toEqual({ r1: { real_errors: 1, false_positives: 2 }, r2: { real_errors: 0, false_positives: 1 } });
    expect(c.additional_per_category).toEqual({ 'factual-error': { real: 1, fp: 0 }, '(no category)': { real: 0, fp: 2 } });
    expect(c.additional_per_difficulty).toEqual({ subtle: { real: 1, fp: 0 }, '(not set)': { real: 0, fp: 2 } });
  });

  it('leaves ignored expected errors out of every counter but their own', () => {
    const ignored = countAll([kase('A', [{ id: 'e1' }, { id: 'e2' }], 'pass', effective([exp('e1', 'ignored', 0), exp('e2', 'found', 1)]))]);
    expect(ignored).toMatchObject({ expected_total: 1, expected_found: 1, ignored_expected: 1, findings_total: 1 });
  });

  it('starts from zeros', () => {
    expect(countAll([])).toEqual(emptyCounters());
  });
});

describe('wilson', () => {
  it('matches known values', () => {
    const w = wilson(8, 10);
    expect(w?.lower).toBeCloseTo(0.4902, 3);
    expect(w?.upper).toBeCloseTo(0.9433, 3);
    const z = wilson(0, 10);
    expect(z?.lower).toBeCloseTo(0, 6);
    expect(z?.upper).toBeCloseTo(0.2775, 3);
    const all = wilson(30, 30);
    expect(all?.upper).toBeCloseTo(1, 6);
    expect(all?.lower).toBeCloseTo(0.8865, 3);
  });
  it('has no interval without a total', () => {
    expect(wilson(0, 0)).toBeNull();
  });
});

describe('computeMeasures', () => {
  it('computes the two rates with intervals', () => {
    const m = computeMeasures({ ...emptyCounters(), expected_total: 40, expected_found: 32, findings_total: 40, false_positives: 4 }, metric);
    expect(m['detection_rate']).toMatchObject({ value: 0.8, numerator: 32, denominator: 40 });
    expect(m['detection_rate']?.interval?.lower).toBeLessThan(0.8);
    expect(m['false_positive_rate']).toMatchObject({ value: 0.1, numerator: 4, denominator: 40 });
  });

  it('says "not available" at a zero denominator', () => {
    const m = computeMeasures(emptyCounters(), metric);
    expect(m['false_positive_rate']).toMatchObject({ value: null, interval: null });
  });
});

describe('overallResult', () => {
  const run = (counters: Partial<ReturnType<typeof emptyCounters>>) => {
    const full = { ...emptyCounters(), ...counters };
    return overallResult(full, computeMeasures(full, metric), checksDefault as never, minimum, 'per_expected_error');
  };
  const big = { expected_total: 40, clean_cases_decided: 10, cases_decided: 30 };

  it('is Inconclusive while any case is not decided', () => {
    const r = run({ ...big, expected_found: 40, findings_total: 40, cases_awaiting: 2 });
    expect(r.result).toBe('Inconclusive');
    expect(r.reasons.join(' ')).toMatch(/2 cases/);
    expect(run({ ...big, expected_found: 40, findings_total: 40, cases_not_run: 1 }).result).toBe('Inconclusive');
  });

  it('is Inconclusive below the minimum test size, saying what is missing', () => {
    const few = run({ expected_total: 20, expected_found: 20, findings_total: 20, clean_cases_decided: 4 });
    expect(few.result).toBe('Inconclusive');
    expect(few.reasons.join(' ')).toMatch(/10 more expected errors/);
    expect(few.reasons.join(' ')).toMatch(/6 more clean cases/);
  });

  it('is Works when every check passes', () => {
    const r = run({ ...big, expected_found: 36, findings_total: 38, false_positives: 2 });
    expect(r.result).toBe('Works');
  });

  it('is Does not work when a check fails, naming it', () => {
    const r = run({ ...big, expected_found: 20, findings_total: 22, false_positives: 2 });
    expect(r.result).toBe('Does not work');
    expect(r.reasons.join(' ')).toMatch(/Detection rate/);
    const fp = run({ ...big, expected_found: 40, findings_total: 60, false_positives: 20 });
    expect(fp.result).toBe('Does not work');
    expect(fp.reasons.join(' ')).toMatch(/False-positive rate/);
  });

  it('treats a false-positive rate that is not available as passed', () => {
    const r = run({ ...big, expected_found: 0, findings_total: 0 });
    expect(r.result).toBe('Does not work');
    expect(r.reasons.join(' ')).toMatch(/Detection rate/);
    expect(r.reasons.join(' ')).not.toMatch(/False-positive rate/);
  });

  it('adds a borderline note for a rate whose interval contains its threshold', () => {
    const r = run({ ...big, expected_found: 32, findings_total: 32, false_positives: 0 });
    expect(r.result).toBe('Works');
    expect(r.borderline.join(' ')).toMatch(/Detection rate/);
  });
});

// R5 and R6 (code review 2026-11-16; research.md 11, "Counting findings"): every finding counts once, a partly matching finding counts
// when its error is found, and a found error with no finding counts one.
describe('correct findings, from the review and the decisions', () => {
  const f = (key: string) => ({ key, text: key, rules: ['r'] });
  const review = (over: Partial<CaseReview>): CaseReview => ({ readable: true, needsApproval: false, expected: [], additional: [], partialOnly: [], unknown: [], ...over });
  const none: CaseDecisions = { expected: {}, additional: {}, added_findings: [], approved: false, note: '' };
  const count = (r: CaseReview, decisions: CaseDecisions = none, falsePositives: string[] = []) => {
    const eff = applyDecisions(r, decisions);
    for (const key of falsePositives) eff.additional.push({ key, text: key, rules: ['r'], state: 'false_positive', source: 'manual' });
    return countAll([kase('A', r.expected.map((e) => ({ id: e.id })), 'fail', eff)]);
  };

  it('counts a finding once when it clearly matches two expected errors (R5)', () => {
    const c = count(
      review({ expected: [{ id: 'e1', state: 'found', clear: ['f1'], partial: [] }, { id: 'e2', state: 'found', clear: ['f1'], partial: [] }] }),
      none,
      ['fp'],
    );
    expect(c.findings_total).toBe(2);
    expect(c.false_positives).toBe(1);
  });

  it('counts a finding that only partly matches a found error, next to the finding that found it (R6)', () => {
    const c = count(review({ expected: [{ id: 'e1', state: 'found', clear: ['f1'], partial: ['f2'] }], partialOnly: [f('f2')] }));
    expect(c.findings_total).toBe(2);
  });

  it('counts one correct finding for an error marked found by hand when no finding points at it (R6)', () => {
    const c = count(review({ expected: [{ id: 'e1', state: 'undecided', clear: [], partial: [] }] }), { ...none, expected: { e1: { state: 'found', source: 'manual' } } });
    expect(c.findings_total).toBe(1);
  });
});

