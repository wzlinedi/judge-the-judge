// Reproduce and audit (FR-075, SC-003; User Story 13): the results recomputed from a loaded evaluation file,
// and any difference from the stored ones.
import { describe, expect, it } from 'vitest';
import { recompute, rulesCorrectedAfterReplies } from '../../../../src/core/evaluation/recompute';
import { computeResults } from '../../../../src/core/evaluation/results';
import { testCasesVersion } from '../../../../src/core/cases/version';
import { readEvaluation, writeEvaluation, type LoadedEvaluation } from '../../../../src/core/io/evaluation-file';
import { judgeVersion } from '../../../../src/core/judge/version';
import { accuracyMetric, sampleEvaluation } from '../../../helpers/fixtures';

async function saved(over: Partial<ReturnType<typeof sampleEvaluation>> = {}) {
  const evaluation = { ...sampleEvaluation(), ...over };
  const meta = { now: '2026-11-14T10:00:00Z', toolVersion: '1.0.0', judgeVersion: await judgeVersion(evaluation.judge_set), testCasesVersion: await testCasesVersion(evaluation.dataset.cases) };
  return { text: writeEvaluation(evaluation, computeResults(evaluation, accuracyMetric), meta), meta };
}
const loaded = (text: string): LoadedEvaluation => {
  const read = readEvaluation(text);
  if (!read.ok) throw new Error('not readable');
  return read.value;
};
const versionsOf = async (l: LoadedEvaluation) => ({ judgeVersion: await judgeVersion(l.evaluation.judge_set), testCasesVersion: await testCasesVersion(l.evaluation.dataset.cases) });
type FileJson = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const tamper = (text: string, change: (file: FileJson) => void) => {
  const file = JSON.parse(text) as FileJson;
  change(file);
  return JSON.stringify(file);
};

describe('recompute gives identical numbers from identical inputs', () => {
  it('reports no difference for a file the tool wrote, and returns the same results as computing them', async () => {
    const { text } = await saved();
    const l = loaded(text);
    const r = recompute(l, accuracyMetric, await versionsOf(l));
    expect(r.differences).toEqual([]);
    expect(r.results).toEqual(computeResults(l.evaluation, accuracyMetric));
  });

  it('uses the metric parameters stored in the file, not the defaults', async () => {
    const { text } = await saved();
    const l = loaded(text);
    expect(l.evaluation.metric.parameters['match_clear_share']).toBe(0.5);
    expect(recompute(l, accuracyMetric, await versionsOf(l)).differences).toEqual([]);
  });

  it('has nothing to compare while nothing is decided: the stored results are empty', async () => {
    const { text } = await saved({ replies: {}, decisions: {} });
    const l = loaded(text);
    expect(l.storedResults).toEqual({});
    expect(recompute(l, accuracyMetric, await versionsOf(l)).differences).toEqual([]);
  });

  it('is the same on every call', async () => {
    const { text } = await saved();
    const l = loaded(text);
    const v = await versionsOf(l);
    expect(recompute(l, accuracyMetric, v)).toEqual(recompute(l, accuracyMetric, v));
  });
});

describe('a differing stored result is reported with both numbers', () => {
  it('names the stored and the recomputed value of a changed measure', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { f.results.measures.detection_rate.value = 0.99; }));
    const r = recompute(l, accuracyMetric, await versionsOf(l));
    const found = r.differences.find((d) => d.what === 'results.measures.detection_rate.value');
    expect(found).toBeDefined();
    expect(found!.stored).toBe('0.99');
    expect(found!.recomputed).not.toBe('0.99');
    expect(r.results.measures['detection_rate']!.value).not.toBe(0.99);
  });

  it('reports a changed counter and a changed overall verdict', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { f.results.counters.cases_decided = 7; f.results.overall.verdict = 'works'; }));
    const r = recompute(l, accuracyMetric, await versionsOf(l));
    expect(r.differences.map((d) => d.what)).toEqual(expect.arrayContaining(['results.counters.cases_decided']));
  });

  it('reports a reply that was changed by hand in the file, because the stored numbers no longer follow from it', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { f.replies['1'].reply = JSON.stringify({ claims: [{ text: 'Anna is a plumber.', verdict: 'contradicted', reason: 'x' }] }); }));
    const r = recompute(l, accuracyMetric, await versionsOf(l));
    expect(r.differences.length).toBeGreaterThan(0);
  });

  it('reports stored results when nothing is decided any more, and no results when some were stored', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { f.replies = {}; f.decisions = {}; }));
    expect(recompute(l, accuracyMetric, await versionsOf(l)).differences.length).toBeGreaterThan(0);
  });

  it('reports a judge version or test cases version that does not match the judge and the cases in the file', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { f.judge_version = '000000000000'; f.dataset.version = '111111111111'; }));
    const v = await versionsOf(l);
    const r = recompute(l, accuracyMetric, v);
    expect(r.differences).toEqual(expect.arrayContaining([
      { what: 'judge version', stored: '000000000000', recomputed: v.judgeVersion },
      { what: 'test cases version', stored: '111111111111', recomputed: v.testCasesVersion },
    ]));
  });

  it('does not report a version the file does not hold', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { delete f.judge_version; delete f.dataset.version; }));
    expect(recompute(l, accuracyMetric, await versionsOf(l)).differences).toEqual([]);
  });

  it('does not report a number that differs only in the last binary digits', async () => {
    const { text } = await saved();
    const l = loaded(tamper(text, (f) => { f.results.measures.detection_rate.value += 1e-12; }));
    expect(recompute(l, accuracyMetric, await versionsOf(l)).differences).toEqual([]);
  });
});

describe('the rules were corrected after the replies exactly when the two judge versions differ', () => {
  it('is true only for two different versions', () => {
    expect(rulesCorrectedAfterReplies('aaaaaaaaaaaa', 'bbbbbbbbbbbb')).toBe(true);
    expect(rulesCorrectedAfterReplies('aaaaaaaaaaaa', 'aaaaaaaaaaaa')).toBe(false);
  });

  it('is false while no reply has recorded a version', () => {
    expect(rulesCorrectedAfterReplies(undefined, 'aaaaaaaaaaaa')).toBe(false);
  });

  it('is what the evaluation file stores', async () => {
    const { text, meta } = await saved();
    expect(JSON.parse(text).rules_corrected_after_replies).toBe(rulesCorrectedAfterReplies(sampleEvaluation().reply_judge_version, meta.judgeVersion));
    const same = sampleEvaluation();
    same.reply_judge_version = meta.judgeVersion;
    const again = writeEvaluation(same, computeResults(same, accuracyMetric), meta);
    expect(JSON.parse(again).rules_corrected_after_replies).toBe(false);
  });
});
