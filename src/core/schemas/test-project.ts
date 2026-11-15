// The test project file (file-formats.md, sections 1 and 5): one file with an optional test run.
import { z } from 'zod';
import { metricDetailsSchema } from './metric';
import { judgeSetSchema } from './judge-set';
import { testCasesSchema } from './test-case';

export const TEST_PROJECT_FORMAT = 'judge-the-judge-test-project';
/** Version 2 adds the optional `test_run` section and drops `dataset.finalized` (T289). Version 1 is upgraded on load. */
export const TEST_PROJECT_SCHEMA_VERSION = 2;

const source = z.enum(['manual', 'llm-approved']);
const expectedDecision = z.object({ state: z.enum(['found', 'missed', 'ignored']), source });
const additionalDecision = z.object({ state: z.enum(['real_error', 'false_positive', 'ignored']), source });

export const caseDecisionsSchema = z.object({
  expected: z.record(z.string(), expectedDecision).default({}),
  additional: z.record(z.string(), additionalDecision).default({}),
  added_findings: z
    .array(
      z.object({
        text: z.string(),
        category: z.string().optional(),
        difficulty: z.enum(['obvious', 'subtle']).optional(),
        from_opinion: z.boolean().optional(),
        state: z.enum(['real_error', 'false_positive', 'ignored']),
        source,
      }),
    )
    .default([]),
  approved: z.boolean().default(false),
  note: z.string().default(''),
});

export const checksSchema = z.object({
  rules: z.array(z.object({ measure: z.string(), comparison: z.enum(['at_least', 'at_most']), value: z.number().min(0).max(1) })),
});

export const metricRefSchema = z.object({ id: z.string(), parameters: z.record(z.string(), z.number()).default({}), definition: metricDetailsSchema.optional() });

/** The `test_run` section: present once the test run has started, also before the first reply. */
export const testRunSchema = z.object({
  saved: z.string().optional(),
  judge_version: z.string().optional(),
  reply_judge_version: z.string().optional(),
  reply_counted_per: z.enum(['expected_error', 'case']).optional(),
  rules_corrected_after_replies: z.boolean().optional(),
  model_note: z.string().default(''),
  replies: z.record(z.string(), z.object({ prompt: z.string(), reply: z.string().min(1) })).default({}),
  decisions: z.record(z.string(), caseDecisionsSchema).default({}),
  minimum_sample: z.object({ expected_errors: z.number(), clean_cases: z.number() }).optional(),
  results: z.unknown().optional(),
});

export const testProjectSchema = z.object({
  tool_version: z.string().optional(),
  judge_set: judgeSetSchema,
  dataset: testCasesSchema,
  metric: metricRefSchema,
  checks: checksSchema,
  test_run: testRunSchema.optional(),
});

/** `proposals` is the key of an earlier build: it is known, so it is reported on its own and not as an unknown key. */
export const TEST_PROJECT_KEYS = ['format', 'schema_version', 'tool_version', 'judge_set', 'dataset', 'metric', 'checks', 'test_run', 'proposals'] as const;
