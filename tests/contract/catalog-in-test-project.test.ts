// FR-016: the catalog has no file of its own; it is saved inside the test project, with or without its test run.
import { describe, expect, it } from 'vitest';
import { withoutTestRun } from '../../src/core/cases/test-run';
import { readTestProject, writeTestProject } from '../../src/core/io/test-project-file';
import { FILE_META as meta } from '../helpers/file-meta';
import { sampleProject } from '../helpers/fixtures';

const e = sampleProject();

describe('the catalog in files', () => {
  it('is saved and loaded as judge_set.error_catalog of the test project', () => {
    const text = writeTestProject(withoutTestRun(e), null, meta);
    expect(JSON.parse(text).judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
    expect(JSON.parse(text)).not.toHaveProperty('error_catalog');
    const read = readTestProject(text);
    if (!read.ok) throw new Error('unreadable');
    expect(read.value.project.judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
  });

  it('is saved and loaded as judge_set.error_catalog next to a test run', () => {
    const text = writeTestProject(e, null, meta);
    expect(JSON.parse(text).judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
    const read = readTestProject(text);
    if (!read.ok) throw new Error('unreadable');
    expect(read.value.project.judge_set.error_catalog).toEqual(e.judge_set.error_catalog);
  });

  it('keeps a description; the short example of an older file is joined to it and not written again (T248)', () => {
    const text = writeTestProject({ ...e, judge_set: { ...e.judge_set, error_catalog: [{ name: 'x', description: 'd' }] } }, null, meta);
    const old = JSON.parse(text);
    old.judge_set.error_catalog = [{ name: 'x', description: 'd', example: 'ex' }];
    const read = readTestProject(JSON.stringify(old));
    if (!read.ok) throw new Error('unreadable');
    expect(read.value.project.judge_set.error_catalog).toEqual([{ name: 'x', description: 'd. Example: ex' }]);
    const again = JSON.parse(writeTestProject(read.value.project, null, meta));
    expect(again.judge_set.error_catalog).toEqual([{ name: 'x', description: 'd. Example: ex' }]);
  });

  it('has no file of its own: a retired catalog file is refused naming what is supported', () => {
    const catalogFile = JSON.stringify({ format: 'judge-the-judge-error-catalog', schema_version: 1, categories: [{ name: 'x' }] });
    const read = readTestProject(catalogFile);
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.problems[0]?.message).toContain('judge-the-judge-error-catalog');
      expect(read.problems[0]?.message).toContain('judge-the-judge-test-project');
    }
  });
});
