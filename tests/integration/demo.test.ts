import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeResults, reviewEvaluation } from '../../src/core/evaluation/results';
import { withoutTestRun } from '../../src/core/cases/test-run';
import { readTestProject } from '../../src/core/io/test-project-file';
import { findVariables } from '../../src/core/judge/variables';
import { extractJson } from '../../src/core/judge/extract-json';
import { composePrompt } from '../../src/core/judge/compose';
import { judgeVersion } from '../../src/core/judge/version';
import { testCasesVersion } from '../../src/core/cases/version';
import { accuracyMetric } from '../helpers/fixtures';

const load = (file: string) => readFileSync(`examples/demo/${file}`, 'utf8');
const read = readTestProject(load('test-project.json'));
if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
const evaluation = read.value.project;
const expected = JSON.parse(load('expected-results.json'));
const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('the demo (FR-026, research.md section 23)', () => {
  it('loads with its test run: 20 cases, 20 replies and no decisions (T289)', () => {
    expect(read.notes).toEqual([]);
    expect(read.value.hasTestRun).toBe(true);
    expect(evaluation.dataset.cases).toHaveLength(20);
    expect(Object.keys(evaluation.testRun!.replies)).toHaveLength(20);
    expect(evaluation.testRun!.decisions).toEqual({});
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
    for (const c of evaluation.dataset.cases) expect(evaluation.testRun!.replies[c.id]?.prompt).toBe(composePrompt(evaluation.judge_set.prompt, c).text);
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
    const finished = { ...evaluation, testRun: { ...evaluation.testRun!, decisions: expected.decisions_after } };
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
    const fenced = Object.values(evaluation.testRun!.replies).filter((r) => r.reply.includes('```'));
    expect(fenced).toHaveLength(1);
    expect(extractJson(fenced[0]!.reply).ok).toBe(true);
    const after = computeResults({ ...evaluation, testRun: { ...evaluation.testRun!, decisions: expected.decisions_after } }, accuracyMetric).counters;
    expect(after.false_positives).toBeGreaterThan(0);
    expect(after.real_errors).toBeGreaterThan(0);
  });

  it('records the versions of the judge and of the test cases', async () => {
    expect(read.value.stored?.judgeVersion).toBe(await judgeVersion(evaluation.judge_set));
    expect(read.value.testCasesVersion).toBe(await testCasesVersion(evaluation.dataset.cases));
  });

  it('is one test project file: version 2, with a test_run section, and no file of its own for the evaluation (T289)', () => {
    const project = JSON.parse(load('test-project.json'));
    expect(project).toMatchObject({ format: 'judge-the-judge-test-project', schema_version: 2 });
    expect(project.dataset.cases).toHaveLength(20);
    expect(project.dataset).not.toHaveProperty('finalized');
    expect(Object.keys(project.test_run.replies)).toHaveLength(20);
    expect(project).not.toHaveProperty('replies');
    expect(existsSync('examples/demo/evaluation.json')).toBe(false);
    expect(project.judge_set.prompt).toBe(evaluation.judge_set.prompt);
  });

  it('gives the test project without its test run when the run is dropped, with the same 20 cases and no reply', () => {
    const dropped = withoutTestRun(evaluation);
    expect(dropped.testRun).toBeUndefined();
    expect(dropped.dataset.cases).toHaveLength(20);
    expect(computeResults(dropped, accuracyMetric).counters).toMatchObject({ cases_decided: 0, cases_not_run: 20 });
  });

  it('has a ready opinion for every case that awaits verification and can be applied', () => {
    const opinions = JSON.parse(load('opinions.json'));
    const applicable = expected.awaiting_verification.filter((id: string) => id !== '10');
    expect(Object.keys(opinions).sort()).toEqual([...applicable].sort());
    for (const [id, o] of Object.entries<{ opinion: { id: string } }>(opinions)) expect(o.opinion.id).toBe(id);
  });
});
