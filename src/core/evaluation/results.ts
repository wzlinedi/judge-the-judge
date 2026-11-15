// Everything the Results step and the files show, in one value (core-api.md, computeResults).
import type { CaseDecisions, Evaluation, TestCase } from '../model';
import { findFindings, type Finding } from '../judge/findings';
import { recognizeFields } from '../judge/fields';
import { countingModeOf } from '../judge/counting-mode';
import type { MeasureValue, MetricDefinition } from '../metrics/types';
import { countAll, type Counters } from './counters';
import { applyDecisions, promotedErrors, type Effective, type EffectiveSource } from './decisions';
import { DEFAULT_MATCH, type MatchParameters } from './match';
import { computeMeasures } from './measures';
import { overallResult, type MinimumSample, type OverallResult } from './overall';
import { reviewCase, type CaseReview } from './review';
import { caseStatus, type CaseStatus } from './status';

export const MINIMUM_SAMPLE: MinimumSample = { expected_errors: 30, clean_cases: 10 };

export interface ReviewedCase {
  testCase: TestCase;
  review: CaseReview | null;
  effective: Effective | null;
  status: CaseStatus;
  /** What the judge's reply says, one entry per finding (empty when there is no reply or it cannot be read). */
  findings: Finding[];
}

export interface CaseResult {
  status: CaseStatus;
  expected: Array<{ id: string; state: string; source: EffectiveSource }>;
  additional: Array<{ key: string; text: string; rules: string[]; state: string; source: EffectiveSource }>;
}

export interface Results {
  evaluated_per: 'expected_error' | 'case';
  counted_per_before_correction: 'expected_error' | 'case' | null;
  /** True while a case is not run or awaits verification. */
  provisional: boolean;
  undecided: number;
  counters: Counters;
  measures: Record<string, MeasureValue>;
  overall: OverallResult;
  cases: Record<string, CaseResult>;
}

export function matchParameters(evaluation: Evaluation, metric: Pick<MetricDefinition, 'parameters'> | undefined): MatchParameters {
  const defaults: Record<string, number> = { ...DEFAULT_MATCH };
  for (const [name, def] of Object.entries(metric?.parameters ?? {})) defaults[name] = def.default;
  return { ...DEFAULT_MATCH, ...defaults, ...evaluation.metric.parameters } as MatchParameters;
}

/** Reads and matches every case; cases without a reply are Not run. */
export function reviewEvaluation(evaluation: Evaluation, metric?: Pick<MetricDefinition, 'parameters'>): ReviewedCase[] {
  const { judge_set } = evaluation;
  const sample = judge_set.sample_reply ? recognizeFields(judge_set.sample_reply) : undefined;
  const recognized = sample?.ok ? sample : undefined;
  const parameters = matchParameters(evaluation, metric);
  const mode = countingModeOf(judge_set);

  return evaluation.dataset.cases.map((testCase) => {
    const reply = evaluation.replies[testCase.id];
    if (!reply) return { testCase, review: null, effective: null, status: 'not_run' as const, findings: [] };
    const found = findFindings(reply.reply, judge_set.error_rules, judge_set.reply_mapping.finding_text, recognized);
    const decisions: CaseDecisions | undefined = evaluation.decisions[testCase.id];
    // the expected errors that real-error marks made are not matched: they are found by definition (T253)
    const made = promotedErrors(decisions, new Set(found.findings.map((f) => f.key)));
    const matched = made.size === 0 ? testCase : { ...testCase, expected_errors: testCase.expected_errors.filter((e) => !made.has(e.id)) };
    const review = reviewCase(matched, found, parameters, mode);
    const effective = applyDecisions(review, decisions, testCase.expected_errors.map((e) => e.id));
    return { testCase, review, effective, status: caseStatus(effective), findings: found.findings };
  });
}

export function computeResults(evaluation: Evaluation, metric: MetricDefinition, minimum: MinimumSample = MINIMUM_SAMPLE): Results {
  const mode = countingModeOf(evaluation.judge_set);
  const evaluated = mode === 'per_case' ? ('case' as const) : ('expected_error' as const);
  const reviewed = reviewEvaluation(evaluation, metric);
  const counters = countAll(reviewed, mode);
  const measures = computeMeasures(counters, metric, mode);
  const overall = overallResult(counters, measures, evaluation.checks, minimum, mode);

  const cases: Record<string, CaseResult> = {};
  for (const r of reviewed) {
    cases[r.testCase.id] = {
      status: r.status,
      expected: (r.effective?.expected ?? []).map((e) => ({ id: e.id, state: e.state, source: e.source })),
      additional: (r.effective?.additional ?? []).map((a) => ({ key: a.key, text: a.text, rules: a.rules, state: a.state, source: a.source })),
    };
  }
  const undecided = counters.cases_awaiting + counters.cases_not_run;
  return {
    evaluated_per: evaluated,
    counted_per_before_correction: evaluation.reply_counted_per !== undefined && evaluation.reply_counted_per !== evaluated ? evaluation.reply_counted_per : null,
    provisional: undecided > 0,
    undecided,
    counters,
    measures,
    overall,
    cases,
  };
}
