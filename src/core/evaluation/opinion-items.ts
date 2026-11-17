// The list of items that the verification prompt numbers and the opinion answers (FR-063, code review R8):
// E1… the expected errors, A1… the additional findings, then the findings that match an undecided expected error,
// partly or clearly (code review finding 4). The prompt and the plan of an opinion both read this list, so the numbers always agree.
import { ownValue } from '../cases/test-run';
import type { AdditionalState, CaseDecisions, DecisionSource } from '../model';
import type { Effective } from './decisions';
import type { ReviewedCase } from './results';

/** A finding that waits for an expected error that is not decided yet; it is numbered after the additional findings. */
export interface WaitingFinding {
  key: string;
  text: string;
  rules: string[];
  /** The undecided expected errors it clearly matches, as "E1". */
  matches: string[];
  /** The undecided expected errors it partly matches, as "E2". */
  resembles: string[];
  /** The mark stored for it, by hand or by an earlier opinion; it counts once its errors are decided Not found (T417). */
  stored?: { state: AdditionalState; source: DecisionSource };
}

/** FNV-1a over the text, as six hexadecimal characters. It only tells that a list changed; it is not a security measure. */
export function listCode(keys: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const char of keys.join('\n')) {
    hash ^= char.codePointAt(0) as number;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(0, 6);
}

/** The keys of the items in prompt order; a waiting finding has its own prefix, so moving it to another list changes the code. */
export function itemKeys(effective: Effective, waiting: readonly WaitingFinding[]): string[] {
  return [...effective.expected.map((e) => `E:${e.id}`), ...effective.additional.map((a) => `A:${a.key}`), ...waiting.map((w) => `W:${w.key}`)];
}

export interface OpinionItems {
  waiting: WaitingFinding[];
  /** The code of the whole list: the prompt gives it and the opinion repeats it. */
  code: string;
}

export function opinionItems(reviewed: Pick<ReviewedCase, 'review' | 'effective'>, decisions?: CaseDecisions): OpinionItems {
  const { review, effective } = reviewed;
  if (!review || !effective) return { waiting: [], code: listCode([]) };
  const stateOf = new Map(effective.expected.map((e, i) => [e.id, { state: e.state, label: `E${i + 1}` }]));
  const undecided = (id: string) => stateOf.get(id)?.state === 'undecided';
  const waiting: WaitingFinding[] = [];
  const seen = new Set<string>();
  for (const finding of [...review.partialOnly, ...(review.matched ?? [])]) {
    // a finding that already moved to the additional findings is in that list
    if (seen.has(finding.key) || effective.additional.some((a) => a.key === finding.key)) continue;
    seen.add(finding.key);
    const labelsOf = (list: 'clear' | 'partial') =>
      review.expected.filter((e) => e[list].includes(finding.key) && undecided(e.id)).map((e) => stateOf.get(e.id)?.label as string);
    const matches = labelsOf('clear');
    const resembles = labelsOf('partial');
    if (matches.length + resembles.length === 0) continue;
    const stored = decisions ? ownValue(decisions.additional, finding.key) : undefined;
    waiting.push({ key: finding.key, text: finding.text, rules: finding.rules, matches, resembles, ...(stored ? { stored } : {}) });
  }
  return { waiting, code: listCode(itemKeys(effective, waiting)) };
}
