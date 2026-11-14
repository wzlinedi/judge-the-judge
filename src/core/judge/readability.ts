// When replies cannot be read automatically, every case needs verification (FR-021).
import type { JudgeSet } from '../model';
import { recognizeFields } from './fields';
import { ruleList, whereTheErrorIs } from './findings';
import { validateRules } from './rules';

const CONSEQUENCE = 'Every case will then need verification by hand or with an LLM opinion.';

/** Plain sentences, empty when replies can be read automatically. The user decides what to do about them. */
export function readabilityWarnings(set: JudgeSet): string[] {
  const warnings: string[] = [];
  const sample = set.sample_reply;
  const recognized = sample === undefined || sample.trim() === '' ? null : recognizeFields(sample);
  if (recognized === null) {
    warnings.push(`There is no sample reply. ${CONSEQUENCE}`);
  } else if (!recognized.ok) {
    warnings.push(`The sample reply cannot be read. ${CONSEQUENCE}`);
  }
  if (set.error_rules.length === 0) {
    warnings.push(`There is no error rule. ${CONSEQUENCE}`);
  } else if (recognized?.ok) {
    validateRules(set.error_rules, recognized).forEach((validation, i) => {
      if (!validation.usable) warnings.push(`The rule "${set.error_rules[i]?.name}" is ${validation.unfinished ? 'unfinished' : 'broken'}: ${validation.reason} ${CONSEQUENCE}`);
    });
  }
  if (recognized?.ok) {
    for (const rule of set.error_rules) {
      const list = ruleList(rule);
      if (list !== undefined && whereTheErrorIs(rule, list, set.reply_mapping.finding_text) === undefined) {
        warnings.push(`The rule "${rule.name}" has no field that shows where the error is. ${CONSEQUENCE}`);
      }
    }
  }
  return warnings;
}
