// The `judge_set` layout (file-formats.md, section 1): `prompt` is required; every other key may be
// absent or empty.
import { z } from 'zod';
import type { JudgeSet } from '../model';

export const conditionSchema = z.object({
  field: z.string().min(1),
  comparison: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']),
  value: z.string().optional(),
});

export const errorRuleSchema = z.object({
  name: z.string().min(1),
  match: z.enum(['all', 'any']),
  conditions: z.array(conditionSchema),
});

export const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  example: z.string().optional(),
});

export const judgeSetSchema = z.object({
  prompt: z.string(),
  judged_text: z.string().optional(),
  sample_reply: z.string().optional(),
  reply_mapping: z.object({ finding_text: z.record(z.string(), z.string()).default({}) }).default({ finding_text: {} }),
  error_rules: z.array(errorRuleSchema).default([]),
  error_catalog: z.array(categorySchema).default([]),
});

/** Drops absent optional keys so a written file holds only what the user has, in the order of the contract. */
export function cleanJudgeSet(set: JudgeSet): JudgeSet {
  return {
    prompt: set.prompt,
    ...(set.judged_text !== undefined ? { judged_text: set.judged_text } : {}),
    ...(set.sample_reply !== undefined ? { sample_reply: set.sample_reply } : {}),
    reply_mapping: set.reply_mapping,
    error_rules: set.error_rules,
    error_catalog: set.error_catalog,
  };
}
