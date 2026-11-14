// A correction of the rules after replies that switches the way of counting (FR-075, SC-003; T163).
import { describe, expect, it } from 'vitest';
import { attachReplies } from '../../src/app/actions/replies';
import { computeResults } from '../../src/core/evaluation/results';
import { readEvaluation, writeEvaluation } from '../../src/core/io/evaluation-file';
import { buildHtmlReport } from '../../src/core/io/html-report';
import { reviewEvaluation } from '../../src/core/evaluation/results';
import type { Evaluation } from '../../src/core/model';
import { accuracyJudgeSet, accuracyMetric, biasVerdictMetric, verdictEvaluation } from '../helpers/fixtures';

const meta = { now: '2026-11-14T10:00:00Z', toolVersion: 't', judgeVersion: 'bbbbbbbbbbbb', testCasesVersion: 'cccccccccccc' };

/** The verdict judge's replies, now read with the rules of the accuracy judge: a rule on a list, so counted per expected error. */
const switched = (): Evaluation => ({ ...verdictEvaluation(), reply_counted_per: 'case', judge_set: accuracyJudgeSet() });

describe('switching the way of counting', () => {
  it('records the way of counting when the first reply arrives', () => {
    const e = { ...verdictEvaluation(), replies: {}, decisions: {}, reply_judge_version: undefined, reply_counted_per: undefined };
    const result = attachReplies(e, { items: [{ case_id: '1', reply: '{"biased":true}' }], problems: [] }, { judgeVersion: 'v', countedPer: 'case' });
    expect(result.evaluation.reply_counted_per).toBe('case');
    const again = attachReplies(result.evaluation, { items: [{ case_id: '2', reply: '{"biased":false}' }], problems: [] }, { judgeVersion: 'w', countedPer: 'expected_error' });
    expect(again.evaluation.reply_counted_per).toBe('case');
  });

  it('records counted_per_before_correction when a correction changed the way, and null when it did not', () => {
    expect(computeResults(verdictEvaluation(), biasVerdictMetric).counted_per_before_correction).toBeNull();
    const e = { ...verdictEvaluation(), reply_counted_per: 'case' as const };
    expect(computeResults(e, biasVerdictMetric).counted_per_before_correction).toBeNull();
    const after = computeResults(switched(), accuracyMetric);
    expect(after.evaluated_per).toBe('expected_error');
    expect(after.counted_per_before_correction).toBe('case');
  });

  it('is named in the evaluation file, and read back it gives the same numbers', () => {
    const e = switched();
    const results = computeResults(e, accuracyMetric);
    const text = writeEvaluation(e, results, meta);
    const file = JSON.parse(text);
    expect(file.results.counted_per_before_correction).toBe('case');
    expect(file.reply_counted_per).toBe('case');
    const read = readEvaluation(text);
    if (!read.ok) throw new Error('not readable');
    const again = computeResults(read.value.evaluation, accuracyMetric);
    expect(again.counted_per_before_correction).toBe('case');
    expect(again.counters).toEqual(results.counters);
    expect(again.overall).toEqual(results.overall);
  });

  it('is named in the report, with the way used before and after', () => {
    const e = switched();
    const html = buildHtmlReport(e, computeResults(e, accuracyMetric), reviewEvaluation(e, accuracyMetric), meta);
    expect(html).toMatch(/counted per case when the replies were received[^<]*per expected error/i);
  });

  it('recomputing a loaded file in either mode gives identical numbers', () => {
    for (const [e, metric] of [[verdictEvaluation(), biasVerdictMetric], [switched(), accuracyMetric]] as const) {
      const results = computeResults(e, metric);
      const read = readEvaluation(writeEvaluation(e, results, meta));
      if (!read.ok) throw new Error('not readable');
      expect(computeResults(read.value.evaluation, metric)).toEqual(results);
    }
  });
});
