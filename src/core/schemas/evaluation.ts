// The evaluation file (file-formats.md, section 5).
import { z } from 'zod';
import { metricDetailsSchema } from './metric';
import { judgeSetSchema } from './judge-set';
import { testCasesSchema } from './test-case';

export const EVALUATION_FORMAT = 'judge-the-judge-evaluation';
export const TEST_PROJECT_FORMAT = 'judge-the-judge-test-project';
export const EVALUATION_SCHEMA_VERSION = 1;

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

export const evaluationSchema = z.object({
  tool_version: z.string().optional(),
  saved: z.string().optional(),
  judge_set: judgeSetSchema,
  judge_version: z.string().optional(),
  reply_judge_version: z.string().optional(),
  reply_counted_per: z.enum(['expected_error', 'case']).optional(),
  rules_corrected_after_replies: z.boolean().optional(),
  model_note: z.string().default(''),
  metric: metricRefSchema.omit({ definition: true }),
  dataset: testCasesSchema,
  replies: z.record(z.string(), z.object({ prompt: z.string(), reply: z.string().min(1) })).default({}),
  decisions: z.record(z.string(), caseDecisionsSchema).default({}),
  checks: checksSchema,
  minimum_sample: z.object({ expected_errors: z.number(), clean_cases: z.number() }).optional(),
  results: z.unknown().optional(),
});

export const EVALUATION_KEYS = [
  'format', 'schema_version', 'tool_version', 'saved', 'judge_set', 'judge_version', 'reply_judge_version', 'reply_counted_per',
  'rules_corrected_after_replies', 'model_note', 'metric', 'dataset', 'replies', 'decisions', 'checks',
  'minimum_sample', 'results', 'proposals',
] as const;
