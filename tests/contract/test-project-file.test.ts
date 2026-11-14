// contracts/file-formats.md, section 1: the test project file (FR-020, SC-013).
import { describe, expect, it } from 'vitest';
import { writeEvaluation } from '../../src/core/io/evaluation-file';
import { readTestProject, writeTestProject } from '../../src/core/io/test-project-file';
import { sampleEvaluation } from '../helpers/fixtures';

const meta = { toolVersion: '1.0.0', testCasesVersion: '3fa9c2d41b07' };
const evaluation = sampleEvaluation();
const text = writeTestProject(evaluation, meta);
// The tests edit a parsed file freely, so its shape is deliberately loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsed = () => JSON.parse(text) as Record<string, any>;
const read = (value: unknown) => readTestProject(typeof value === 'string' ? value : JSON.stringify(value));
const ok = (value: unknown) => {
  const result = read(value);
  if (!result.ok) throw new Error(result.problems.map((p) => p.message).join('; '));
  return result;
};

describe('writeTestProject', () => {
  it('writes format, schema version, judge set, dataset, metric and checks', () => {
    const file = parsed();
    expect(file['format']).toBe('judge-the-judge-test-project');
    expect(file['schema_version']).toBe(1);
    expect(file['tool_version']).toBe('1.0.0');
    expect(file['judge_set'].prompt).toBe(evaluation.judge_set.prompt);
    expect(file['judge_set'].judged_text).toBe('summary');
    expect(file['judge_set'].error_catalog.length).toBeGreaterThan(0);
    expect(file['dataset']).toMatchObject({ name: 'Book summaries', version: '3fa9c2d41b07', finalized: true });
    expect(file['dataset'].cases).toHaveLength(2);
    expect(file['dataset'].cases[1].changed_after_first_reply).toBe('added');
    expect(file['metric'].id).toBe('accuracy');
    expect(file['checks'].rules.length).toBe(4);
  });

  it('holds no replies, decisions, results, model note or minimum test size', () => {
    const file = parsed();
    for (const key of ['replies', 'decisions', 'results', 'model_note', 'minimum_sample', 'reply_judge_version']) expect(file).not.toHaveProperty(key);
    expect(text).not.toContain('checked by hand');
    expect(text).not.toContain('temperature 0');
  });

  it('is different from an evaluation file', () => {
    const asEvaluation = writeEvaluation(evaluation, null, { now: '2026-01-01T00:00:00Z', toolVersion: '1.0.0', judgeVersion: 'aaaaaaaaaaaa', testCasesVersion: 'bbbbbbbbbbbb' });
    expect(JSON.parse(asEvaluation).format).toBe('judge-the-judge-evaluation');
  });
});

describe('readTestProject', () => {
  it('round-trips identically with the same judge and test cases versions', () => {
    const result = ok(text);
    expect(result.notes).toEqual([]);
    expect(writeTestProject(result.value.evaluation, meta)).toBe(text);
  });

  it('starts an evaluation with no replies, decisions or model note', () => {
    const { evaluation: loaded } = ok(text).value;
    expect(loaded.replies).toEqual({});
    expect(loaded.decisions).toEqual({});
    expect(loaded.model_note).toBe('');
    expect(loaded.dataset.cases.map((c) => c.id)).toEqual(['1', '2']);
    expect(loaded.dataset.cases[1]?.expected_errors.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('restores finalized as saved, either way', () => {
    expect(ok(text).value.evaluation.dataset.finalized).toBe(true);
    const open = parsed();
    open['dataset'].finalized = false;
    expect(ok(open).value.evaluation.dataset.finalized).toBe(false);
  });

  it('restores the metric with its parameters and the check rules', () => {
    const { evaluation: loaded } = ok(text).value;
    expect(loaded.metric).toEqual(evaluation.metric);
    expect(loaded.checks).toEqual(evaluation.checks);
  });

  it('never writes a minimum_sample, and tells the user it is fixed when a file has one', () => {
    const file = parsed();
    file['checks'].minimum_sample = { expected_errors: 5, clean_cases: 1 };
    const result = ok(file);
    expect(result.notes.join(' ')).toMatch(/minimum test size.*fixed/i);
    expect(writeTestProject(result.value.evaluation, meta)).not.toContain('minimum_sample');
  });

  it('refuses an evaluation file with a message that names "Load evaluation"', () => {
    const asEvaluation = writeEvaluation(evaluation, null, { now: '2026-01-01T00:00:00Z', toolVersion: '1.0.0', judgeVersion: 'aaaaaaaaaaaa', testCasesVersion: 'bbbbbbbbbbbb' });
    const result = read(asEvaluation);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.message).toContain('Load evaluation');
  });

  it('falls back to the last variable when judged_text is absent or unknown, and says so', () => {
    for (const judged of [undefined, 'nonexistent']) {
      const file = parsed();
      if (judged === undefined) delete file['judge_set'].judged_text;
      else file['judge_set'].judged_text = judged;
      const result = ok(file);
      expect(result.value.evaluation.judge_set.judged_text).toBe('summary');
      expect(result.notes.join(' ')).toContain('summary');
    }
  });

  it('loads a rule on a field the sample reply does not contain as broken and reports it', () => {
    const file = parsed();
    file['judge_set'].error_rules.push({ name: 'Ghost rule', match: 'all', conditions: [{ field: 'ghost.field', comparison: 'equals', value: 'x' }] });
    const result = ok(file);
    expect(result.value.evaluation.judge_set.error_rules.map((r) => r.name)).toContain('Ghost rule');
    expect(result.notes.join(' ')).toContain('ghost.field');
  });

  it('keeps the stored parameters of an unregistered metric and tells the user', () => {
    const file = parsed();
    file['metric'] = { id: 'bias', parameters: { match_clear_share: 0.7 } };
    const result = readTestProject(JSON.stringify(file), (id) => id === 'accuracy');
    if (!result.ok) throw new Error('unreadable');
    expect(result.value.evaluation.metric).toEqual({ id: 'bias', parameters: { match_clear_share: 0.7 } });
    expect(result.notes.join(' ')).toContain('bias');
  });

  it('rejects invalid files with a plain message and a place', () => {
    const notJson = read('{ "format": ');
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.problems[0]?.line).toBe(1);
    expect(read({ format: 'something-else', schema_version: 1 }).ok).toBe(false);
    expect(read({ ...parsed(), schema_version: 99 }).ok).toBe(false);
    const noPrompt = parsed();
    delete noPrompt['judge_set'].prompt;
    const result = read(noPrompt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.path).toContain('judge_set');
  });

  it('reports unknown extra keys once as a note', () => {
    const file = { ...parsed(), extra_key: 1, other_key: 2 };
    const result = ok(file);
    expect(result.notes.filter((n) => /extra_key/.test(n))).toHaveLength(1);
  });
});
