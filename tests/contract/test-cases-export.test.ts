// FR-050: "Export test cases" writes every case and nothing else, and reads back identical (SC-019).
import { describe, expect, it } from 'vitest';
import { testCasesVersion } from '../../src/core/cases/version';
import { planImport } from '../../src/core/cases/validate-test-cases';
import { readTestCasesJson, writeTestCases } from '../../src/core/io/test-cases-json';
import { sampleEvaluation } from '../helpers/fixtures';

const e = sampleEvaluation();

describe('writeTestCases', () => {
  const text = writeTestCases({ name: e.dataset.name, cases: e.dataset.cases }, { toolVersion: '1.0.0' });
  const file = JSON.parse(text);

  it('writes the format, every case (clean ones included) and nothing else of the work', () => {
    expect(file.format).toBe('judge-the-judge-test-cases');
    expect(file.schema_version).toBe(1);
    expect(file.cases).toHaveLength(2);
    expect(file.cases[0].expected_errors).toEqual([]);
    expect(file.cases[1].base).toBe('1');
    for (const key of ['judge_set', 'metric', 'checks', 'replies', 'decisions', 'finalized', 'error_catalog', 'dataset']) expect(file).not.toHaveProperty(key);
    expect(JSON.stringify(file)).not.toMatch(/finalized/);
  });

  it('imports into an empty test project with identical content and version', async () => {
    const read = readTestCasesJson(text);
    if (!read.ok) throw new Error('not readable');
    const plan = planImport(read.value.drafts, read.value.invalid, { variables: ['source_text', 'summary'], judgedText: 'summary', catalog: e.judge_set.error_catalog, existing: [] });
    expect(plan.invalid).toEqual([]);
    expect(plan.newIdentifiers).toBe(0);
    expect(plan.cases.map(({ changed_after_first_reply: _m, ...rest }) => rest)).toEqual(e.dataset.cases.map(({ changed_after_first_reply: _m, ...rest }) => rest));
    expect(await testCasesVersion(plan.cases)).toBe(await testCasesVersion(e.dataset.cases));
  });
});
