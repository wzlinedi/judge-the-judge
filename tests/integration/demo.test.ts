import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeResults, reviewEvaluation } from '../../src/core/evaluation/results';
import { readEvaluation } from '../../src/core/io/evaluation-file';
import { findVariables } from '../../src/core/judge/variables';
import { extractJson } from '../../src/core/judge/extract-json';
import { composePrompt } from '../../src/core/judge/compose';
import { judgeVersion } from '../../src/core/judge/version';
import { testCasesVersion } from '../../src/core/cases/version';
import { accuracyMetric } from '../helpers/fixtures';

const load = (file: string) => readFileSync(`examples/demo/${file}`, 'utf8');
const read = readEvaluation(load('evaluation.json'));
if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
const evaluation = read.value.evaluation;
const expected = JSON.parse(load('expected-results.json'));
const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('the demo (FR-026, research.md section 23)', () => {
  it('loads finalized with 20 cases and 20 replies and no decisions', () => {
    expect(read.notes).toEqual([]);
    expect(evaluation.dataset.finalized).toBe(true);
    expect(evaluation.dataset.cases).toHaveLength(20);
    expect(Object.keys(evaluation.replies)).toHaveLength(20);
    expect(evaluation.decisions).toEqual({});
  });

  it('has the Accuracy judge with the variables source_text and summary, judged text summary', () => {
    expect(findVariables(evaluation.judge_set.prompt)).toEqual(['source_text', 'summary']);
    expect(evaluation.judge_set.judged_text).toBe('summary');
    expect(evaluation.metric.id).toBe('accuracy');
  });

  it('has 10 clean cases and 10 made from them with 3 injected errors each, half obvious and half subtle or more', () => {
    const clean = evaluation.dataset.cases.filter((c) => c.expected_errors.length === 0);
    const injected = evaluation.dataset.cases.filter((c) => c.expected_errors.length > 0);
    expect(clean).toHaveLength(10);
    expect(injected).toHaveLength(10);
    for (const c of injected) {
      expect(c.expected_errors).toHaveLength(3);
      expect(clean.map((b) => b.id)).toContain(c.base);
      for (const e of c.expected_errors) expect(c.fields['summary']).toContain(e.fragment);
    }
    const all = injected.flatMap((c) => c.expected_errors);
    const subtle = all.filter((e) => e.difficulty === 'subtle').length;
    expect(subtle).toBeGreaterThanOrEqual(10);
    expect(subtle).toBeLessThanOrEqual(20);
  });

  it('every stored prompt is the judge prompt composed with the case', () => {
    for (const c of evaluation.dataset.cases) expect(evaluation.replies[c.id]?.prompt).toBe(composePrompt(evaluation.judge_set.prompt, c).text);
  });

  it('computeResults equals the expected results file', () => {
    expect(roundTrip(computeResults(evaluation, accuracyMetric))).toEqual(expected.as_loaded);
  });

  it('opens with 15 of 20 cases decided and the 5 others awaiting verification', () => {
    const results = computeResults(evaluation, accuracyMetric);
    expect(results.counters).toMatchObject({ cases_decided: 15, cases_awaiting: 5, cases_not_run: 0 });
    expect(results.provisional).toBe(true);
    expect(results.overall.result).toBe('Inconclusive');
    const awaiting = reviewEvaluation(evaluation, accuracyMetric).filter((r) => r.status === 'awaiting').map((r) => r.testCase.id);
    expect(awaiting).toEqual(expected.awaiting_verification);
  });

  it('after the 5 cases are decided the result is Works with the full test size', () => {
    const finished = { ...evaluation, decisions: expected.decisions_after };
    const results = computeResults(finished, accuracyMetric);
    expect(roundTrip(results)).toEqual(expected.after_deciding);
    expect(results.overall.result).toBe('Works');
    expect(results.counters).toMatchObject({ expected_total: 30, clean_cases_decided: 10, cases_awaiting: 0 });
    expect(results.provisional).toBe(false);
  });

  it('contains a missed error, a false positive, a real error, a partial match, a fenced reply and an unreadable reply', () => {
    const before = reviewEvaluation(evaluation, accuracyMetric);
    expect(before.some((r) => r.effective?.expected.some((e) => e.state === 'missed' && e.source === 'automatic'))).toBe(true);
    expect(before.some((r) => r.review && r.review.partialOnly.length > 0)).toBe(true);
    expect(before.some((r) => r.review && !r.review.readable)).toBe(true);
    const fenced = Object.values(evaluation.replies).filter((r) => r.reply.includes('```'));
    expect(fenced).toHaveLength(1);
    expect(extractJson(fenced[0]!.reply).ok).toBe(true);
    const after = computeResults({ ...evaluation, decisions: expected.decisions_after }, accuracyMetric).counters;
    expect(after.false_positives).toBeGreaterThan(0);
    expect(after.real_errors).toBeGreaterThan(0);
  });

  it('records the versions of the judge and of the test cases', async () => {
    expect(read.value.judgeVersion).toBe(await judgeVersion(evaluation.judge_set));
    expect(read.value.testCasesVersion).toBe(await testCasesVersion(evaluation.dataset.cases));
  });

  it('has the same test as a test project file, with no replies', () => {
    const project = JSON.parse(load('test-project.json'));
    expect(project).toMatchObject({ format: 'judge-the-judge-test-project', schema_version: 1 });
    expect(project.dataset.cases).toHaveLength(20);
    expect(project.dataset.finalized).toBe(true);
    expect(project).not.toHaveProperty('replies');
    expect(project.judge_set.prompt).toBe(evaluation.judge_set.prompt);
  });

  it('has a ready opinion for every case that awaits verification and can be applied', () => {
    const opinions = JSON.parse(load('opinions.json'));
    const applicable = expected.awaiting_verification.filter((id: string) => id !== '10');
    expect(Object.keys(opinions).sort()).toEqual([...applicable].sort());
    for (const [id, o] of Object.entries<{ opinion: { id: string } }>(opinions)) expect(o.opinion.id).toBe(id);
  });
});
