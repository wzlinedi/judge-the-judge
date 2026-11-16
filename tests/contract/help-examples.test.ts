// Principle VIII: every file example the Help shows is read from `examples/` (or the built-in metric files), and each one loads with its own
// reader without a problem. Help cannot show an example the tool would refuse.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCaseJson } from '../../src/core/cases/case-json';
import { planImport } from '../../src/core/cases/validate-test-cases';
import { readMetric } from '../../src/core/io/metric-file';
import { readOpinion } from '../../src/core/io/opinions';
import { readTestCasesCsv } from '../../src/core/io/test-cases-csv';
import { readTestCasesJson } from '../../src/core/io/test-cases-json';
import { readTestProject } from '../../src/core/io/test-project-file';
import { accuracyJudgeSet } from '../helpers/fixtures';

const text = (path: string) => readFileSync(path, 'utf8');
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]));

const VARIABLES = ['source_text', 'summary'];

/** What a reader gives back: nothing but `ok`, and the notes it wrote. */
interface Outcome {
  ok: boolean;
  notes?: readonly string[];
  problems?: readonly unknown[];
}

/**
 * One reader for each example file. A file that is not listed here fails the test below, so a new example
 * cannot be added without a check. `allowedNotes` is what the reader may say about the file, and nothing else.
 */
const readers: Record<string, { read: (path: string) => Outcome; allowedNotes?: RegExp }> = {
  'examples/demo/test-project.json': { read: (p) => readTestProject(text(p)) },
  'examples/samples/completeness-test-project.json': { read: (p) => readTestProject(text(p)) },
  'examples/samples/bias-test-project.json': { read: (p) => readTestProject(text(p)) },
  'examples/files/test-cases-example.json': {
    read: (p) => {
      const read = readTestCasesJson(text(p));
      if (!read.ok) return read;
      const plan = planImport(read.value.drafts, read.value.invalid, { variables: VARIABLES, judgedText: 'summary', catalog: accuracyJudgeSet().error_catalog, existing: [] });
      return plan.invalid.length > 0 || plan.missingCategories.length > 0 ? { ok: false, problems: plan.invalid } : read;
    },
  },
  'examples/files/test-cases-example.csv': { read: (p) => readTestCasesCsv(text(p), VARIABLES) },
  'examples/files/case-example.json': {
    read: (p) => {
      const check = checkCaseJson(text(p), { mode: 'paste', variables: VARIABLES, judgedText: 'summary', catalog: accuracyJudgeSet().error_catalog, existingCases: [] });
      return { ok: check.problems.length === 0, notes: [...check.notes, ...check.warnings], problems: check.problems };
    },
    allowedNotes: /base/i, // the example names a base case that a project of its own would hold
  },
  'examples/demo/opinions.json': {
    read: (p) => {
      const opinions = JSON.parse(text(p)) as Record<string, unknown>;
      const results = Object.entries(opinions).map(([caseId, opinion]) => readOpinion(JSON.stringify(opinion), caseId));
      return {
        ok: results.length > 0 && results.every((r) => r.ok),
        notes: results.flatMap((r) => (r.ok ? r.notes : [])),
        problems: results.flatMap((r) => (r.ok ? [] : r.problems)),
      };
    },
  },
  'examples/metrics/bias-example.json': { read: (p) => readMetric(text(p)) },
  'examples/metrics/bias-verdict-example.json': { read: (p) => readMetric(text(p)) },
  // The numbers of the demo are checked against the recomputation in tests/integration/demo.test.ts.
  'examples/demo/expected-results.json': { read: (p) => ({ ok: typeof JSON.parse(text(p)) === 'object' }) },
};

const builtIns = ['src/core/metrics/builtin/accuracy.json'];

describe('the examples of the Help', () => {
  const imported = files('src/ui/help')
    .filter((f) => f.endsWith('.tsx'))
    .flatMap((f) => [...text(f).matchAll(/from '((?:\.\.\/)+(?:examples|core\/metrics\/builtin)\/[^']+?)(?:\?raw)?'/g)].map((m) => relative('.', join(f, '..', m[1] as string)).replaceAll('\\', '/')));

  it('finds the examples the Help imports', () => {
    expect(imported.length).toBeGreaterThanOrEqual(6);
    expect(new Set(imported)).toContain('examples/files/test-cases-example.csv');
  });

  it('has a reader for every example it shows, and for every file in examples/', () => {
    const known = new Set([...Object.keys(readers), ...builtIns]);
    expect([...new Set(imported)].filter((f) => !known.has(f))).toEqual([]);
    const everyExample = files('examples')
      .map((f) => f.replaceAll('\\', '/'))
      .filter((f) => !f.endsWith('.gitkeep'));
    expect(everyExample.filter((f) => !known.has(f))).toEqual([]);
  });

  it.each(Object.keys(readers))('%s loads without a problem and without a note the example does not allow', (path) => {
    const { read, allowedNotes } = readers[path] as (typeof readers)[string];
    const outcome = read(path);
    expect(outcome.problems ?? []).toEqual([]);
    expect(outcome.ok).toBe(true);
    const unexpected = (outcome.notes ?? []).filter((note) => !(allowedNotes?.test(note) ?? false));
    expect(unexpected).toEqual([]);
  });

  it.each(builtIns)('%s, whose sample reply the Help shows, loads without a problem', (path) => {
    const read = readMetric(text(path));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.notes).toEqual([]);
  });
});
