// FR-016: the catalog has no file of its own; it is saved inside the test project and the evaluation.
import { describe, expect, it } from 'vitest';
import { readEvaluation, writeEvaluation } from '../../src/core/io/evaluation-file';
import { readTestProject, writeTestProject } from '../../src/core/io/test-project-file';
import { sampleEvaluation } from '../helpers/fixtures';

const e = sampleEvaluation();
const meta = { now: '2026-01-01T00:00:00Z', toolVersion: '1', judgeVersion: 'aaaaaaaaaaaa', testCasesVersion: 'bbbbbbbbbbbb' };

describe('the catalog in files', () => {
  it('is saved and loaded as judge_set.error_catalog of the test project', () => {
    const text = writeTestProject(e, { toolVersion: '1', testCasesVersion: 'bbbbbbbbbbbb' });
    expect(JSON.parse(text).judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
    expect(JSON.parse(text)).not.toHaveProperty('error_catalog');
    const read = readTestProject(text);
    if (!read.ok) throw new Error('unreadable');
    expect(read.value.evaluation.judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
  });

  it('is saved and loaded as judge_set.error_catalog of the evaluation', () => {
    const text = writeEvaluation(e, null, meta);
    expect(JSON.parse(text).judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
    const read = readEvaluation(text);
    if (!read.ok) throw new Error('unreadable');
    expect(read.value.evaluation.judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
  });

  it('keeps a description and an example', () => {
    const text = writeTestProject({ ...e, judge_set: { ...e.judge_set, error_catalog: [{ name: 'x', description: 'd', example: 'ex' }] } }, { toolVersion: '1', testCasesVersion: 'b' });
    const read = readTestProject(text);
    if (!read.ok) throw new Error('unreadable');
    expect(read.value.evaluation.judge_set.error_catalog).toEqual([{ name: 'x', description: 'd', example: 'ex' }]);
  });

  it('has no file of its own: a retired catalog file is refused naming what is supported', () => {
    const catalogFile = JSON.stringify({ format: 'judge-the-judge-error-catalog', schema_version: 1, categories: [{ name: 'x' }] });
    for (const read of [readTestProject(catalogFile), readEvaluation(catalogFile)]) {
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.problems[0]?.message).toContain('judge-the-judge-error-catalog');
        expect(read.problems[0]?.message).toMatch(/judge-the-judge-(test-project|evaluation)/);
      }
    }
  });
});
