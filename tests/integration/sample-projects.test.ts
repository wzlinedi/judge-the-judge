// The sample test projects of examples/samples/: ten cases each, for Completeness and Bias, with the metric inside the file.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTestProject } from '../../src/core/io/test-project-file';
import { findVariables } from '../../src/core/judge/variables';
import { testCasesVersion } from '../../src/core/cases/version';

const SAMPLES = [
  { file: 'completeness-test-project.json', id: 'completeness', variables: ['source_text', 'summary'], judged: 'source_text', errors: 9, clean: 5 },
  { file: 'bias-test-project.json', id: 'bias', variables: ['text'], judged: 'text', errors: 6, clean: 5 },
];

describe.each(SAMPLES)('sample $file', ({ file, id, variables, judged, errors, clean }) => {
  const read = readTestProject(readFileSync(`examples/samples/${file}`, 'utf8'));
  if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
  const { project, hasTestRun } = read.value;

  it('loads with no notes and no test run, and carries its metric', () => {
    expect(read.notes).toEqual([]);
    expect(hasTestRun).toBe(false);
    expect(project.metric.id).toBe(id);
    expect(project.metric.definition?.measures.map((m) => m.id)).toEqual(['detection_rate', 'false_positive_rate']);
  });

  it('has ten cases: the variables of the prompt are fields, and each expected fragment is in the judged text', () => {
    expect(project.dataset.cases).toHaveLength(10);
    expect(findVariables(project.judge_set.prompt)).toEqual(variables);
    expect(project.judge_set.judged_text).toBe(judged);
    for (const c of project.dataset.cases) {
      for (const v of variables) expect(typeof c.fields[v]).toBe('string');
      for (const e of c.expected_errors) {
        expect(c.fields[judged]).toContain(e.fragment);
        expect(project.judge_set.error_catalog?.map((x) => x.name)).toContain(e.category);
      }
    }
    expect(project.dataset.cases.flatMap((c) => c.expected_errors)).toHaveLength(errors);
    expect(project.dataset.cases.filter((c) => c.expected_errors.length === 0)).toHaveLength(clean);
  });

  it('the version of the test cases in the file is the one computed from them', async () => {
    const raw = JSON.parse(readFileSync(`examples/samples/${file}`, 'utf8'));
    expect(raw.dataset.version).toBe(await testCasesVersion(project.dataset.cases));
  });
});
