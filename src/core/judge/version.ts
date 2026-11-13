// Judge version: prompt, finding-text choices and error rules. The sample reply, the catalog and
// the judged text do not change how a reply is read, so they are not part of it (research.md, 14).
import { contentVersion } from '../hash';
import type { JudgeSet } from '../model';

export function judgeVersion(judgeSet: JudgeSet): Promise<string> {
  return contentVersion({
    prompt: judgeSet.prompt,
    finding_text: judgeSet.reply_mapping?.finding_text ?? {},
    error_rules: judgeSet.error_rules ?? [],
  });
}
