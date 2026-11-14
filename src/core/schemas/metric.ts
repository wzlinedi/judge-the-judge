// The metric definition file (metric-and-checks.md, section 1). It is data only: no code can be in it.
import { z } from 'zod';
import { judgeSetSchema } from './judge-set';

export const METRIC_FORMAT = 'judge-the-judge-metric';
export const METRIC_SCHEMA_VERSION = 1;

const measure = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  operation: z.string(),
  numerator: z.string().optional(),
  denominator: z.string().optional(),
  of: z.string().optional(),
  interval: z.string().optional(),
  better: z.enum(['higher', 'lower']),
});

const cleanCase = z.object({
  name: z.string(),
  fields: z.record(z.string(), z.string()),
  expected_errors: z.array(z.unknown()),
});

export const metricSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'The id may hold only lower case letters, digits and dashes.'),
  name: z.string().min(1),
  description: z.string(),
  limitations: z.string(),
  output_format: z.string(),
  judge_set: judgeSetSchema.extend({ clean_base_cases: z.array(cleanCase).default([]) }),
  parameters: z.record(z.string(), z.object({ default: z.number(), description: z.string().default('') })),
  measures: z.array(measure).min(1),
});

export const METRIC_KEYS = ['format', 'schema_version', 'id', 'name', 'description', 'limitations', 'output_format', 'judge_set', 'parameters', 'measures'] as const;
