// The test project file (file-formats.md, section 1).
import { z } from 'zod';
import { checksSchema, metricRefSchema, TEST_PROJECT_FORMAT } from './evaluation';
import { judgeSetSchema } from './judge-set';
import { testCasesSchema } from './test-case';

export { TEST_PROJECT_FORMAT };
export const TEST_PROJECT_SCHEMA_VERSION = 1;

export const testProjectSchema = z.object({
  tool_version: z.string().optional(),
  judge_set: judgeSetSchema,
  dataset: testCasesSchema,
  metric: metricRefSchema,
  checks: checksSchema,
});

export const TEST_PROJECT_KEYS = ['format', 'schema_version', 'tool_version', 'judge_set', 'dataset', 'metric', 'checks'] as const;
