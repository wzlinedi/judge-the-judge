import type { Effective } from './decisions';

export interface MarkProgress {
  marked: number;
  total: number;
}

/**
 * "Marked N of M" in the case window of Run (T230): every expected error and every additional finding is one item,
 * and an item is marked once it is not undecided (Ignore is a decision too).
 */
export function markProgress(effective: Pick<Effective, 'expected' | 'additional'>): MarkProgress {
  // an expected error that a real-error mark made has no mark of its own (T253)
  const items = [...effective.expected.filter((e) => !e.promoted), ...effective.additional];
  return { marked: items.filter((i) => i.state !== 'undecided').length, total: items.length };
}
