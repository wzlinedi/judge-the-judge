// Counting cases for a judge that gives one verdict for the whole text (FR-066 to FR-068, FR-070; T162).
import { describe, expect, it } from 'vitest';
import { computeResults, MINIMUM_SAMPLE, reviewEvaluation } from '../../../../src/core/evaluation/results';
import { biasVerdictMetric, verdictProject } from '../../../helpers/fixtures';

const results = () => computeResults(verdictProject(), biasVerdictMetric);

describe('counters per case', () => {
  it('counts the decided cases with errors that were flagged, and the decided clean cases that were flagged wrongly', () => {
    const c = results().counters;
    expect(c.defective_cases_decided).toBe(2);
    expect(c.defective_cases_flagged).toBe(1);
    expect(c.clean_cases_decided).toBe(3);
    expect(c.clean_cases_with_false_positive).toBe(1);
    expect(c.cases_awaiting).toBe(1);
  });

  it('leaves out a case whose expected errors are all ignored', () => {
    const c = results().counters;
    expect(c.defective_cases_decided).toBe(2); // case 6 is decided but has no counted error
    expect(c.ignored_expected).toBe(1);
  });

  it('computes the case detection rate and the clean-case false-positive rate with Wilson intervals', () => {
    const r = results();
    expect(r.evaluated_per).toBe('case');
    const detection = r.measures['case_detection_rate']!;
    expect(detection).toMatchObject({ name: 'Case detection rate', numerator: 1, denominator: 2 });
    expect(detection.value).toBe(0.5);
    expect(detection.interval!.lower).toBeLessThan(0.5);
    const fp = r.measures['clean_case_false_positive_rate']!;
    expect(fp).toMatchObject({ name: 'Clean-case false-positive rate', numerator: 1, denominator: 3 });
    expect(fp.interval).not.toBeNull();
  });

  it('counts cases once in each category and difficulty their errors have, as flagged or not flagged', () => {
    const c = results().counters;
    expect(c.case_per_category).toEqual({ 'gender-bias': { cases: 1, flagged: 1 }, stereotype: { cases: 1, flagged: 1 }, 'age-bias': { cases: 1, flagged: 0 } });
    expect(c.case_per_difficulty).toEqual({ obvious: { cases: 2, flagged: 1 }, subtle: { cases: 1, flagged: 1 } });
  });

  it('counts a case once for a category its errors share', () => {
    const e = verdictProject();
    e.dataset.cases[0]!.expected_errors[1]!.category = 'gender-bias';
    expect(computeResults(e, biasVerdictMetric).counters.case_per_category['gender-bias']).toEqual({ cases: 1, flagged: 1 });
  });

  it('applies only the check rules of the two case-level measures, with no rule mapped onto another', () => {
    const e = verdictProject();
    e.checks = { rules: [{ measure: 'detection_rate', comparison: 'at_least', value: 0.01 }, { measure: 'case_detection_rate', comparison: 'at_least', value: 0.9 }, { measure: 'clean_case_false_positive_rate', comparison: 'at_most', value: 0.9 }] };
    e.testRun!.decisions['4'] = { expected: {}, additional: { reply: { state: 'real_error', source: 'manual' } }, added_findings: [], approved: false, note: '' };
    const r = computeResults(e, biasVerdictMetric, { expected_errors: 1, clean_cases: 1 });
    expect(r.overall.result).toBe('Does not work');
    expect(r.overall.reasons.join(' ')).toMatch(/Case detection rate is 50%/);
    expect(r.overall.reasons.join(' ')).not.toMatch(/^Detection rate/m);
  });

  it('is Inconclusive below 30 decided cases with errors or 10 decided clean cases, and the first reason says the judge was evaluated per case', () => {
    const r = results();
    expect(r.overall.result).toBe('Inconclusive');
    expect(r.overall.reasons[0]).toBe('The judge was evaluated per case.');
    expect(r.overall.reasons.join(' ')).toMatch(/28 more cases with errors/);
    expect(r.overall.reasons.join(' ')).toMatch(/7 more clean cases/);
    expect(MINIMUM_SAMPLE).toEqual({ expected_errors: 30, clean_cases: 10 });
  });

  it('shows a flagged clean case as an additional finding the user decides, and its status awaits', () => {
    const reviewed = reviewEvaluation(verdictProject(), biasVerdictMetric);
    expect(reviewed.find((r) => r.testCase.id === '4')!.status).toBe('awaiting');
    expect(reviewed.find((r) => r.testCase.id === '1')!.status).toBe('pass');
    expect(reviewed.find((r) => r.testCase.id === '2')!.status).toBe('fail');
    expect(reviewed.find((r) => r.testCase.id === '5')!.status).toBe('fail');
  });
});
