// What each finding of the judge's reply matches (FR-077): the words that go with the colour.
import type { ReviewedCase } from './results';

export type FindingKind = 'clear' | 'partial' | 'none';

export interface FindingMark {
  /** The number of the finding in the reply: F1 is 1 (T293). */
  number: number;
  key: string;
  text: string;
  kind: FindingKind;
  /** The numbers (E1 is 1) of the expected errors it matches. */
  errorNumbers: number[];
  label: string;
}

const numbers = (list: number[]) => `${list.length === 1 ? 'error' : 'errors'} ${list.join(', ')}`;

/** Empty when the case has no reply or the reply cannot be read (the view then says so in one line). */
export function markFindings(reviewed: Pick<ReviewedCase, 'review' | 'findings'>): FindingMark[] {
  const review = reviewed.review;
  if (!review || !review.readable) return [];
  return reviewed.findings.map((finding, index) => {
    const clear = review.expected.flatMap((e, i) => (e.clear.includes(finding.key) ? [i + 1] : []));
    const partial = review.expected.flatMap((e, i) => (e.partial.includes(finding.key) ? [i + 1] : []));
    if (clear.length > 0) return { number: index + 1, key: finding.key, text: finding.text, kind: 'clear' as const, errorNumbers: clear, label: `matches ${numbers(clear)}` };
    if (partial.length > 0) return { number: index + 1, key: finding.key, text: finding.text, kind: 'partial' as const, errorNumbers: partial, label: `partial match with ${numbers(partial)}` };
    return { number: index + 1, key: finding.key, text: finding.text, kind: 'none' as const, errorNumbers: [], label: 'no expected error' };
  });
}
