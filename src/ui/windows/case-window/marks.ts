import type { Effective } from '../../../core/evaluation/decisions';
import type { TestCase } from '../../../core/model';

export interface Segment {
  text: string;
  /** Set for a highlighted fragment. */
  error?: { id: string; label: string; state: string };
}

/** Splits the judged text at the first occurrence of each expected error's fragment (non-overlapping). */
export function applyMarks(text: string, testCase: TestCase, effective: Effective | null): Segment[] {
  const spots: Array<{ start: number; end: number; id: string; label: string; state: string }> = [];
  testCase.expected_errors.forEach((error, i) => {
    if (!error.fragment) return;
    const start = text.indexOf(error.fragment);
    if (start === -1) return;
    const end = start + error.fragment.length;
    if (spots.some((s) => start < s.end && end > s.start)) return;
    spots.push({ start, end, id: error.id, label: `E${i + 1}`, state: effective?.expected.find((e) => e.id === error.id)?.state ?? 'undecided' });
  });
  spots.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let at = 0;
  for (const spot of spots) {
    if (spot.start > at) segments.push({ text: text.slice(at, spot.start) });
    segments.push({ text: text.slice(spot.start, spot.end), error: { id: spot.id, label: spot.label, state: spot.state } });
    at = spot.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at) });
  return segments.length > 0 ? segments : [{ text }];
}
