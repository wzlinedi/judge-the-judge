// The JSON Schema files published in docs/schemas/ describe the files the tool reads (contracts/file-formats.md). They are generated from the
// schemas the readers use, so they cannot drift; this test fails when a file is out of date (run `npm run schemas`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { jsonSchemas, SCHEMA_DIRECTORY } from '../../scripts/json-schemas';

const published = (name: string) => readFileSync(`${SCHEMA_DIRECTORY}/${name}`, 'utf8');
type Schema = { required?: string[]; properties?: Record<string, { const?: unknown; type?: string; properties?: Record<string, unknown> }> };

describe('docs/schemas', () => {
  const generated = jsonSchemas();

  it('has a schema for every file format the tool reads, and the case JSON', () => {
    expect(Object.keys(generated).sort()).toEqual([
      'case.schema.json',
      'checks.schema.json',
      'metric.schema.json',
      'test-cases.schema.json',
      'test-project.schema.json',
    ]);
  });

  it.each(Object.keys(generated))('%s is up to date', (name) => {
    expect(existsSync(`${SCHEMA_DIRECTORY}/${name}`), `${name} is missing: run npm run schemas`).toBe(true);
    expect(published(name), `${name} is out of date: run npm run schemas`).toBe(generated[name]);
  });

  it('holds no file that is not generated', () => {
    expect(readdirSync(SCHEMA_DIRECTORY).filter((f) => f.endsWith('.json') && !(f in generated))).toEqual([]);
  });

  it('is deterministic: two runs give the same text', () => {
    expect(jsonSchemas()).toEqual(generated);
  });

  it.each([
    ['test-project.schema.json', 'judge-the-judge-test-project', 2],
    ['test-cases.schema.json', 'judge-the-judge-test-cases', 1],
    ['metric.schema.json', 'judge-the-judge-metric', 1],
    ['checks.schema.json', 'judge-the-judge-checks', 1],
  ])('%s requires format "%s" and schema_version %i, which the readers check', (name, format, version) => {
    const schema = JSON.parse(published(name)) as Schema;
    expect(schema.properties?.['format']?.const).toBe(format);
    expect(schema.properties?.['schema_version']?.const).toBe(version);
    expect(schema.required).toEqual(expect.arrayContaining(['format', 'schema_version']));
  });

  it('the evaluation format is gone: no schema, no export of it (T289)', () => {
    expect(existsSync(`${SCHEMA_DIRECTORY}/evaluation.schema.json`)).toBe(false);
    expect(Object.keys(generated)).not.toContain('evaluation.schema.json');
  });

  it('the test project schema holds the judge set, the test cases, the metric and the checks, and the optional test run section (j)', () => {
    const schema = JSON.parse(published('test-project.schema.json')) as Schema;
    expect(Object.keys(schema.properties ?? {})).toEqual(expect.arrayContaining(['judge_set', 'dataset', 'metric', 'checks', 'test_run']));
    expect(schema.required).not.toContain('test_run');
    const run = schema.properties?.['test_run'] as { properties?: Record<string, unknown>; required?: string[] };
    expect(Object.keys(run.properties ?? {}).sort()).toEqual([
      'decisions', 'judge_version', 'minimum_sample', 'model_note', 'replies', 'reply_counted_per', 'reply_judge_version', 'results', 'rules_corrected_after_replies', 'saved',
    ]);
    expect(run.required ?? []).toEqual([]);
  });

  it('the test project schema keeps replies and decisions inside test_run, not at the top', () => {
    const schema = JSON.parse(published('test-project.schema.json')) as Schema;
    expect(Object.keys(schema.properties ?? {})).not.toContain('replies');
    expect(Object.keys(schema.properties ?? {})).not.toContain('decisions');
    const dataset = schema.properties?.['dataset'] as { properties?: Record<string, unknown> };
    expect(Object.keys(dataset.properties ?? {})).not.toContain('finalized');
  });

  it('the case schema is the case JSON: a name, fields and expected errors, with no identifier and no format', () => {
    const schema = JSON.parse(published('case.schema.json')) as Schema;
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(['base', 'expected_errors', 'fields', 'name']);
    expect(schema.required).toEqual(['fields']);
    const errors = JSON.parse(published('case.schema.json')).properties.expected_errors.items as Schema;
    expect(Object.keys(errors.properties ?? {}).sort()).toEqual(['category', 'description', 'difficulty', 'fragment', 'source_fragment']);
    expect(errors.required).toEqual(['description']);
  });

  it('the example files carry the format of their schema and every key the schema requires', () => {
    const examples: Array<[string, string]> = [
      ['examples/demo/test-project.json', 'test-project.schema.json'],
      ['examples/files/test-cases-example.json', 'test-cases.schema.json'],
      ['examples/files/case-example.json', 'case.schema.json'],
      ['examples/metrics/bias-example.json', 'metric.schema.json'],
      ['examples/metrics/bias-verdict-example.json', 'metric.schema.json'],
      ['examples/metrics/checks-example.json', 'checks.schema.json'],
    ];
    for (const [example, name] of examples) {
      const file = JSON.parse(readFileSync(example, 'utf8')) as Record<string, unknown>;
      const schema = JSON.parse(published(name)) as Schema;
      for (const key of schema.required ?? []) expect(file, `${example} lacks ${key}`).toHaveProperty(key);
      const format = schema.properties?.['format']?.const;
      if (format !== undefined) expect(file['format'], example).toBe(format);
    }
  });
});
