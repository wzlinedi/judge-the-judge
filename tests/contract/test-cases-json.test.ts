// file-formats.md, section 3: the test-case file and the stored case layout (FR-020, FR-027, FR-079, SC-019).
import { describe, expect, it } from 'vitest';
import { readTestCasesJson } from '../../src/core/io/test-cases-json';
import { writeTestProject } from '../../src/core/io/test-project-file';
import { FILE_META } from '../helpers/file-meta';
import { sampleProject } from '../helpers/fixtures';

const file = (cases: unknown[], over: Record<string, unknown> = {}) => JSON.stringify({ format: 'judge-the-judge-test-cases', schema_version: 1, name: 'Set', cases, ...over });
const read = (text: string) => {
  const r = readTestCasesJson(text);
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' | '));
  return r;
};
const ok = { name: 'A', fields: { source_text: 'S', summary: 'T' }, expected_errors: [] };

describe('readTestCasesJson', () => {
  it('reads the file with the case rules: ids optional, error ids assigned, notes for unknown keys', () => {
    const r = read(file([{ ...ok, id: '5', expected_errors: [{ description: 'd', category: 'c', fragment: 'S' }], extra: 1 }], { future: true }));
    expect(r.value.name).toBe('Set');
    expect(r.value.drafts[0]!.draft.id).toBe('5');
    expect(r.value.drafts[0]!.draft.expected_errors[0]!.id).toBe('e1');
    expect(r.notes.join(' ')).toMatch(/future/);
  });

  it('reads a test project file through its dataset.cases', () => {
    const e = sampleProject();
    const text = writeTestProject(e, null, FILE_META);
    const r = read(text);
    expect(r.value.drafts.map((d) => d.draft.name)).toEqual(['Anna', 'Anna + 2 errors']);
    expect(r.value.drafts[1]!.draft.base).toBe('1');
  });

  it('refuses another kind of file, an unknown version and unreadable JSON, naming what it found', () => {
    for (const text of [JSON.stringify({ format: 'judge-the-judge-evaluation', schema_version: 1 }), file([], { schema_version: 99 }), '{ "format": ']) {
      const r = readTestCasesJson(text);
      expect(r.ok).toBe(false);
    }
    const bad = readTestCasesJson('{ "format": ');
    expect(bad.ok === false && bad.problems[0]!.line).toBeDefined();
    const evaluation = readTestCasesJson(JSON.stringify({ format: 'judge-the-judge-evaluation', schema_version: 1 }));
    expect(evaluation.ok === false && evaluation.problems[0]!.message).toContain('judge-the-judge-evaluation');
  });

  it('lists an invalid case with its position and reason and keeps the rest', () => {
    const r = read(file([ok, { name: 'B', fields: { source_text: 5 }, expected_errors: [] }, { ...ok, name: 'C', expected_errors: [{ category: 'x' }] }]));
    expect(r.value.drafts.map((d) => d.position)).toEqual([1]);
    expect(r.value.invalid.map((i) => i.position)).toEqual([2, 3]);
    expect(r.value.invalid[1]!.reason).toMatch(/description/);
  });

  it('a duplicate identifier inside the file makes the later case invalid', () => {
    const r = read(file([{ ...ok, id: '1' }, { ...ok, name: 'B', id: '1' }]));
    expect(r.value.drafts).toHaveLength(1);
    expect(r.value.invalid[0]).toMatchObject({ position: 2 });
    expect(r.value.invalid[0]!.reason).toMatch(/identifier/i);
  });

  it('ignores a "field" key on an expected error and says so once', () => {
    const r = read(file([{ ...ok, expected_errors: [{ description: 'd', field: 'summary' }] }]));
    expect(r.notes.filter((n) => /"field"/.test(n))).toHaveLength(1);
  });

  it('an empty list of cases is a problem', () => {
    const r = readTestCasesJson(file([]));
    expect(r.ok).toBe(false);
  });
});

describe('the example files', () => {
  it('examples/files/test-cases-example.json imports without a problem and the case example is one valid case', async () => {
    const { readFileSync } = await import('node:fs');
    const { checkCaseJson } = await import('../../src/core/cases/case-json');
    const { planImport } = await import('../../src/core/cases/validate-test-cases');
    const { accuracyJudgeSet } = await import('../helpers/fixtures');
    const set = accuracyJudgeSet();
    const read = read_(readFileSync('examples/files/test-cases-example.json', 'utf8'));
    const plan = planImport(read.value.drafts, read.value.invalid, { variables: ['source_text', 'summary'], judgedText: 'summary', catalog: set.error_catalog, existing: [] });
    expect(plan.invalid).toEqual([]);
    expect(plan.cases.map((c) => c.base)).toEqual([undefined, '1']);
    expect(plan.missingCategories).toEqual([]);
    const single = checkCaseJson(readFileSync('examples/files/case-example.json', 'utf8'), { mode: 'paste', variables: ['source_text', 'summary'], judgedText: 'summary', catalog: set.error_catalog, existingCases: plan.cases.slice(0, 1) });
    expect(single.problems).toEqual([]);
    expect(single.case?.base).toBe('1');
  });
});

function read_(text: string) {
  const r = readTestCasesJson(text);
  if (!r.ok) throw new Error('not readable');
  return r;
}
