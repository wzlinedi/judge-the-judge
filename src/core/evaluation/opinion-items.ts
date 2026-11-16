// The list of items that the verification prompt numbers and the opinion answers (FR-063, code review R8):
// E1… the expected errors, A1… the additional findings, then the findings that only partly match an undecided
// expected error. The prompt and the plan of an opinion both read this list, so the numbers always agree.
import type { Effective } from './decisions';
import type { ReviewedCase } from './results';

/** A finding that waits for an expected error that is not decided yet; it is numbered after the additional findings. */
export interface WaitingFinding {
  key: string;
  text: string;
  rules: string[];
  /** The expected errors it partly matches that are undecided, as "E2". */
  resembles: string[];
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

export function opinionItems(reviewed: Pick<ReviewedCase, 'review' | 'effective'>): OpinionItems {
  const { review, effective } = reviewed;
  if (!review || !effective) return { waiting: [], code: listCode([]) };
  const stateOf = new Map(effective.expected.map((e, i) => [e.id, { state: e.state, label: `E${i + 1}` }]));
  const waiting: WaitingFinding[] = [];
  for (const finding of review.partialOnly) {
    // a finding that already moved to the additional findings is in that list
    if (effective.additional.some((a) => a.key === finding.key)) continue;
    const resembles = review.expected
      .filter((e) => e.partial.includes(finding.key) && stateOf.get(e.id)?.state === 'undecided')
      .map((e) => stateOf.get(e.id)?.label as string);
    if (resembles.length > 0) waiting.push({ key: finding.key, text: finding.text, rules: finding.rules, resembles });
  }
  return { waiting, code: listCode(itemKeys(effective, waiting)) };
}
