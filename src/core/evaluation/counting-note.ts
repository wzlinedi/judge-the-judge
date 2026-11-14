// What the result says when the way of counting changed after the replies were received (FR-075).
import type { Results } from './results';

const way = (v: 'expected_error' | 'case') => (v === 'case' ? 'per case' : 'per expected error');

export const PER_CASE_SENTENCE = 'This judge gives one verdict for the whole text, so the tool counts cases, not errors.';
export const PER_CASE_WHY = 'The judge gives one verdict for the whole text and does not say which error it found, so a case is counted once in each category and difficulty its errors have, with counts only and no rate.';

export function countingSwitchNote(results: Pick<Results, 'evaluated_per' | 'counted_per_before_correction'>): string | null {
  if (results.counted_per_before_correction === null) return null;
  return `The result was counted ${way(results.counted_per_before_correction)} when the replies were received and is counted ${way(results.evaluated_per)} now, because a correction of the rules changed how the judge is read.`;
}
