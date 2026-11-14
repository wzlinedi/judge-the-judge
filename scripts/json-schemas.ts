// The JSON Schema files of docs/schemas/, made from the schemas the readers use (file-formats.md; FR-006). They describe the files as the tool
// reads them, so extra keys stay allowed and a key with a default is optional.
import { z } from 'zod';
import { importCase } from '../src/core/io/test-cases-json';
import { checksSchema, EVALUATION_FORMAT, evaluationSchema } from '../src/core/schemas/evaluation';
import { CHECKS_FORMAT, CHECKS_SCHEMA_VERSION } from '../src/core/schemas/checks';
import { METRIC_FORMAT, METRIC_SCHEMA_VERSION, metricSchema } from '../src/core/schemas/metric';
import { testCaseSchema } from '../src/core/schemas/test-case';
import { TEST_CASES_FORMAT, TEST_CASES_SCHEMA_VERSION } from '../src/core/schemas/test-cases';
import { TEST_PROJECT_FORMAT, TEST_PROJECT_SCHEMA_VERSION, testProjectSchema } from '../src/core/schemas/test-project';
import { EVALUATION_SCHEMA_VERSION } from '../src/core/schemas/evaluation';

export const SCHEMA_DIRECTORY = 'docs/schemas';

/** `format` and `schema_version` are checked by the readers before the schema runs, so the published schema states them here. */
const envelope = (format: string, schemaVersion: number) => ({ format: z.literal(format), schema_version: z.literal(schemaVersion) });

const caseJson = z.object({
  name: z.string().default(''),
  base: testCaseSchema.shape.base,
  fields: testCaseSchema.shape.fields,
  expected_errors: z.array(testCaseSchema.shape.expected_errors.element.omit({ id: true })).default([]),
});

const sources: Record<string, { title: string; description: string; schema: z.ZodType }> = {
  'case.schema.json': {
    title: 'Judge the Judge: one test case',
    description: 'The case JSON: what "Paste JSON", "Show JSON" and "Copy JSON" use (file-formats.md, section 2).',
    schema: caseJson,
  },
  'checks.schema.json': {
    title: 'Judge the Judge: check configuration',
    description: 'The thresholds of the checks (metric-and-checks.md, section 2). `minimum_sample` is read and ignored: the minimum test size is fixed.',
    schema: z.object({ ...envelope(CHECKS_FORMAT, CHECKS_SCHEMA_VERSION), rules: checksSchema.shape.rules.min(1), minimum_sample: z.unknown().optional() }),
  },
  'evaluation.schema.json': {
    title: 'Judge the Judge: evaluation file',
    description: 'The whole work of one run and its results (file-formats.md, section 5).',
    schema: z.object({ ...envelope(EVALUATION_FORMAT, EVALUATION_SCHEMA_VERSION), ...evaluationSchema.shape }),
  },
  'metric.schema.json': {
    title: 'Judge the Judge: metric definition',
    description: 'A metric defined as data (metric-and-checks.md, section 1).',
    schema: z.object({ ...envelope(METRIC_FORMAT, METRIC_SCHEMA_VERSION), ...metricSchema.shape }),
  },
  'test-cases.schema.json': {
    title: 'Judge the Judge: test-case file',
    description: 'Test cases alone, for "Import test cases" and "Export test cases" (file-formats.md, section 3).',
    schema: z.object({
      ...envelope(TEST_CASES_FORMAT, TEST_CASES_SCHEMA_VERSION),
      tool_version: z.string().optional(),
      name: z.string().optional(),
      cases: z.array(importCase),
    }),
  },
  'test-project.schema.json': {
    title: 'Judge the Judge: test project file',
    description: 'The judge set, the error catalog, the test cases, the metric and the thresholds: one test, used for every run (file-formats.md, section 1).',
    schema: z.object({ ...envelope(TEST_PROJECT_FORMAT, TEST_PROJECT_SCHEMA_VERSION), ...testProjectSchema.shape }),
  },
};

/** The text of every schema file, by file name. */
export function jsonSchemas(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [name, { title, description, schema }] of Object.entries(sources)) {
    const { $schema, ...body } = z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' }) as Record<string, unknown>;
    files[name] = JSON.stringify({ $schema, $id: name, title, description, ...body }, null, 2) + '\n';
  }
  return files;
}
