import { describe, expect, it } from 'vitest';
import { readEvaluation, writeEvaluation } from '../../src/core/io/evaluation-file';
import { computeResults } from '../../src/core/evaluation/results';
import { judgeVersion } from '../../src/core/judge/version';
import { testCasesVersion } from '../../src/core/cases/version';
import { accuracyMetric, sampleEvaluation } from '../helpers/fixtures';

async function written(overrides: Partial<ReturnType<typeof sampleEvaluation>> = {}) {
  const evaluation = { ...sampleEvaluation(), ...overrides };
  const results = computeResults(evaluation, accuracyMetric);
  const meta = { now: '2026-11-13T10:15:00Z', toolVersion: '1.0.0', judgeVersion: await judgeVersion(evaluation.judge_set), testCasesVersion: await testCasesVersion(evaluation.dataset.cases) };
  return { evaluation, results, meta, text: writeEvaluation(evaluation, results, meta) };
}

describe('evaluation file (file-formats.md, section 5)', () => {
  it('has the format, schema version and the saved details', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    expect(file).toMatchObject({ format: 'judge-the-judge-evaluation', schema_version: 1, tool_version: '1.0.0', saved: '2026-11-13T10:15:00Z' });
  });

  it('holds everything needed to continue, reproduce and audit', async () => {
    const { text, meta } = await written();
    const file = JSON.parse(text);
    expect(file.judge_set.judged_text).toBe('summary');
    expect(file.judge_set.error_catalog.length).toBeGreaterThan(0);
    expect(file.judge_version).toBe(meta.judgeVersion);
    expect(file.reply_judge_version).toBe('aaaaaaaaaaaa');
    expect(file.rules_corrected_after_replies).toBe(true);
    expect(file.model_note).toBe('model X\ntemperature 0');
    expect(file.metric).toEqual({ id: 'accuracy', parameters: { match_clear_share: 0.5, match_partial_share: 0.3, match_min_word_length: 4 } });
    expect(file.dataset).toMatchObject({ name: 'Book summaries', version: meta.testCasesVersion, finalized: true });
    expect(file.dataset.cases[1]).toMatchObject({ id: '2', base: '1', changed_after_first_reply: 'added' });
    expect(Object.keys(file.replies)).toEqual(['1', '2']);
    expect(file.decisions['2'].added_findings[0]).toMatchObject({ category: 'factual-error', difficulty: 'obvious' });
    expect(file.decisions['2'].added_findings[1]).toMatchObject({ from_opinion: true });
    expect(file.checks.rules).toHaveLength(4);
    expect(file.minimum_sample).toEqual({ expected_errors: 30, clean_cases: 10 });
    expect(file.results).toMatchObject({ evaluated_per: 'expected_error', counted_per_before_correction: null });
    expect(file.results.counters.additional_per_category).toBeDefined();
    expect(file.results.counters.additional_per_difficulty).toBeDefined();
    expect(file).not.toHaveProperty('proposals');
  });

  it('reads back what it wrote, and writes the same text again', async () => {
    const { text, meta } = await written();
    const read = readEvaluation(text);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const again = writeEvaluation(read.value.evaluation, computeResults(read.value.evaluation, accuracyMetric), { ...meta, now: read.value.saved ?? '' });
    expect(again).toBe(text);
    expect(read.value.evaluation.dataset.finalized).toBe(true);
    expect(read.value.evaluation.replies['2']?.reply).toContain('```json');
    expect(read.value.replyJudgeVersion).toBe('aaaaaaaaaaaa');
    expect(read.notes).toEqual([]);
  });

  it('restores the stored matching parameters, so recomputing gives the same numbers', async () => {
    const { text, results } = await written();
    const read = readEvaluation(text);
    expect(read.ok && read.value.evaluation.metric.parameters['match_clear_share']).toBe(0.5);
    if (read.ok) expect(computeResults(read.value.evaluation, accuracyMetric).counters).toEqual(results.counters);
  });

  it('leaves results empty until something is decided', async () => {
    const { text } = await written({ replies: {}, decisions: {} });
    expect(JSON.parse(text).results).toEqual({});
  });

  it('ignores an old "proposals" key and says so', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    file.proposals = { '2': {} };
    const read = readEvaluation(JSON.stringify(file));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.notes.join(' ')).toMatch(/proposals/);
  });

  it('reports a field on an expected error once and ignores it', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    file.dataset.cases[1].expected_errors[0].field = 'summary';
    file.dataset.cases[1].expected_errors[1].field = 'summary';
    const read = readEvaluation(JSON.stringify(file));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.notes.filter((n) => /field/.test(n))).toHaveLength(1);
  });

  it('loads a file saved when a real-error mark kept a link to an expected error (T253, undone by T259) and drops the link', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    file.decisions['2'].added_findings[0].state = 'real_error';
    file.decisions['2'].added_findings[0].promoted_to = 'e9';
    file.decisions['2'].additional = { 'x#1': { state: 'real_error', source: 'manual', promoted_to: 'e8' } };
    const read = readEvaluation(JSON.stringify(file));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.evaluation.decisions['2']!.added_findings[0]).not.toHaveProperty('promoted_to');
    expect(read.value.evaluation.decisions['2']!.additional['x#1']).toEqual({ state: 'real_error', source: 'manual' });
  });

  it('refuses a test project file with a message that names "Load test project"', () => {
    const read = readEvaluation(JSON.stringify({ format: 'judge-the-judge-test-project', schema_version: 1 }));
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.problems[0]?.message).toContain('Load test project');
  });

  it('refuses a newer schema version, an unknown format and text that is not JSON', () => {
    expect(readEvaluation(JSON.stringify({ format: 'judge-the-judge-evaluation', schema_version: 9 })).ok).toBe(false);
    expect(readEvaluation(JSON.stringify({ format: 'something' })).ok).toBe(false);
    const broken = readEvaluation('{\n"format": \n}');
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.problems[0]).toMatchObject({ line: 3, column: 1 });
  });

  it('returns problems that name the place, and changes nothing, for an invalid file', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    file.dataset.cases[0].fields = { source_text: 5 };
    delete file.judge_set.prompt;
    const read = readEvaluation(JSON.stringify(file));
    expect(read.ok).toBe(false);
    if (!read.ok) {
      const paths = read.problems.map((p) => p.path);
      expect(paths).toContain('judge_set.prompt');
      expect(paths).toContain('dataset.cases[0].fields.source_text');
    }
  });

  it('refuses more than 500 cases and fields above 100,000 characters', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    file.dataset.cases = Array.from({ length: 501 }, (_, i) => ({ id: String(i), name: `c${i}`, fields: { summary: 's' }, expected_errors: [] }));
    expect(readEvaluation(JSON.stringify(file)).ok).toBe(false);
    const long = JSON.parse(text);
    long.dataset.cases[0].fields.summary = 'x'.repeat(100001);
    expect(readEvaluation(JSON.stringify(long)).ok).toBe(false);
  });

  it('gives an expected error with no id one of its own', async () => {
    const { text } = await written();
    const file = JSON.parse(text);
    delete file.dataset.cases[1].expected_errors[0].id;
    const read = readEvaluation(JSON.stringify(file));
    expect(read.ok && read.value.evaluation.dataset.cases[1]?.expected_errors.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});
