import type { Effective } from '../../../core/evaluation/decisions';
import { findFragment } from '../../../core/cases/fragments';
import type { ChangedPlace } from '../../../core/cases/text-list-check';
import type { TestCase } from '../../../core/model';

export interface Segment {
  text: string;
  /** Set for a highlighted fragment of an expected error. */
  error?: { id: string; label: string; state: string };
  /** Set for a changed place that no expected error covers: the words beside its colour. */
  warning?: string;
}

interface Spot {
  start: number;
  end: number;
  error?: NonNullable<Segment['error']>;
  warning?: string;
}

type Shown = Pick<TestCase, 'fields' | 'expected_errors'>;

/** Where each expected error is: in the judged text when its fragment occurs there, otherwise in the first other field that holds it (an omission). */
export function locateFragments(testCase: Shown, judgedField: string | undefined): Array<{ index: number; id: string; field: string; start: number; end: number }> {
  const names = Object.keys(testCase.fields);
  const order = judgedField !== undefined && names.includes(judgedField) ? [judgedField, ...names.filter((n) => n !== judgedField)] : names;
  const found: Array<{ index: number; id: string; field: string; start: number; end: number }> = [];
  testCase.expected_errors.forEach((error, index) => {
    if (!error.fragment) return;
    for (const field of order) {
      const spot = findFragment(testCase.fields[field] ?? '', error.fragment);
      if (spot) {
        found.push({ index, id: error.id, field, ...spot });
        return;
      }
    }
  });
  return found;
}

/** The text of one field cut into plain pieces and highlighted ones (non-overlapping). */
export function fieldMarks(testCase: Shown, field: string, judgedField: string | undefined, effective: Effective | null, uncovered: readonly ChangedPlace[] = []): Segment[] {
  const text = testCase.fields[field] ?? '';
  const spots: Spot[] = [];
  const free = (start: number, end: number) => !spots.some((s) => start < s.end && end > s.start);
  for (const at of locateFragments(testCase, judgedField)) {
    if (at.field !== field || !free(at.start, at.end)) continue;
    const state = effective ? (effective.expected.find((e) => e.id === at.id)?.state ?? 'undecided') : 'undecided';
    spots.push({ start: at.start, end: at.end, error: { id: at.id, label: `E${at.index + 1}`, state } });
  }
  for (const place of uncovered) {
    if (place.field !== field || place.end <= place.start || !free(place.start, place.end)) continue;
    spots.push({ start: place.start, end: place.end, warning: 'not in the list' });
  }
  spots.sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let at = 0;
  for (const spot of spots) {
    if (spot.start > at) segments.push({ text: text.slice(at, spot.start) });
    segments.push({ text: text.slice(spot.start, spot.end), ...(spot.error ? { error: spot.error } : {}), ...(spot.warning ? { warning: spot.warning } : {}) });
    at = spot.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at) });
  return segments.length > 0 ? segments : [{ text }];
}
