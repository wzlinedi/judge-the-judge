// How a judge is counted follows from the shape of its error rules (FR-061, research.md section 29).
import type { CountingMode, ErrorRule, JudgeSet } from '../model';
import { recognizeFields, type RecognizedFields } from './fields';
import { isListPath, validateRules } from './rules';

/**
 * `per_case` when at least one usable rule exists and every usable rule uses only fields outside any list: the judge gives
 * one verdict for the whole text. Without a sample reply a rule cannot be called broken, so every rule counts.
 */
export function countingMode(rules: readonly ErrorRule[], sample?: RecognizedFields): CountingMode {
  const validations = sample ? validateRules(rules, sample) : undefined;
  const used = rules.filter((rule, i) => rule.conditions.length > 0 && validations?.[i]?.usable !== false);
  if (used.length === 0) return 'per_expected_error';
  return used.every((r) => r.conditions.every((c) => !isListPath(c.field))) ? 'per_case' : 'per_expected_error';
}

/** The way a judge set is counted, reading its own sample reply. */
export function countingModeOf(judgeSet: Pick<JudgeSet, 'error_rules' | 'sample_reply'>): CountingMode {
  const sample = judgeSet.sample_reply && judgeSet.sample_reply.trim() !== '' ? recognizeFields(judgeSet.sample_reply) : undefined;
  return countingMode(judgeSet.error_rules, sample && 'fields' in sample ? sample : undefined);
}
