// Judge version: prompt, finding-text choices and error rules, and, only when it is not empty, the list of
// rules that the sample reply turns off. The sample reply itself, the catalog and the judged text do not change
// how a reply is read, so they are not part of it (research.md, 14; code review R3).
import { contentVersion } from '../hash';
import type { JudgeSet } from '../model';
import { recognizeFields } from './fields';
import { validateRules } from './rules';

/** Indices of the rules that the recognized sample reply turns off (empty with no sample or an unreadable one). */
function unusableRules(judgeSet: JudgeSet): number[] {
  const rules = judgeSet.error_rules ?? [];
  if (rules.length === 0 || judgeSet.sample_reply === undefined || judgeSet.sample_reply.trim() === '') return [];
  const recognized = recognizeFields(judgeSet.sample_reply);
  if (!recognized.ok) return [];
  const off: number[] = [];
  validateRules(rules, recognized).forEach((v, i) => {
    if (!v.usable) off.push(i);
  });
  return off;
}

export function judgeVersion(judgeSet: JudgeSet): Promise<string> {
  const unusable = unusableRules(judgeSet);
  return contentVersion({
    prompt: judgeSet.prompt,
    finding_text: judgeSet.reply_mapping?.finding_text ?? {},
    error_rules: judgeSet.error_rules ?? [],
    ...(unusable.length > 0 ? { unusable_rules: unusable } : {}),
  });
}

/**
 * The judge version as it was worked out before the rules turned off by the sample reply were part of it (code review R3). A file
 * saved then stored this version; a load accepts it as the current one (Clarifications 2026-11-17, finding 8; FR-075).
 */
export function judgeVersionWithoutUnusable(judgeSet: JudgeSet): Promise<string> {
  return contentVersion({
    prompt: judgeSet.prompt,
    finding_text: judgeSet.reply_mapping?.finding_text ?? {},
    error_rules: judgeSet.error_rules ?? [],
  });
}
