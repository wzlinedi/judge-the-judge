// Do the text of a case with injected errors and its list of expected errors agree? (FR-080)
// Changed places are found against the base case word by word (jsdiff), never character by character,
// so two fields of 100,000 characters are compared within a second. When the texts differ so much that
// the comparison would take long, the field counts as changed as a whole.
import { diffArrays } from 'diff';
import type { TestCase } from '../model';
import { findAllFragments, findFragment } from './fragments';

export interface ChangedPlace {
  field: string;
  /** The range in the text of the case; empty for text that was only removed. */
  start: number;
  end: number;
  /** The text now at the place. */
  text: string;
  /** The text of the base that is gone from the place. */
  removed?: string;
}

export interface FragmentNote {
  index: number;
  kind: 'no_fragment' | 'no_category';
}

export interface ListCheck {
  /** Changed places, against the base, that no expected error covers. */
  uncovered: ChangedPlace[];
  /** Expected errors whose fragment is in no field. */
  notInText: Array<{ index: number; fragment: string }>;
  identicalToBase: boolean;
  /** Expected errors that cannot be matched or grouped; only a note, never a mismatch. */
  notes: FragmentNote[];
  agrees: boolean;
  /** The one line shown in the case view. */
  line: string;
}

interface Token {
  value: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
/** Above this many changed words a field is treated as changed as a whole. */
const MAX_EDIT = 2000;

function tokens(text: string): Token[] {
  return Array.from(text.matchAll(WORD), (m) => ({ value: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

const lower = (text: string) => text.toLowerCase();

export function changedPlaces(field: string, before: string, after: string): ChangedPlace[] {
  if (before === after) return [];
  const a = tokens(before);
  const b = tokens(after);
  const parts = diffArrays(
    a.map((t) => t.value),
    b.map((t) => t.value),
    { maxEditLength: MAX_EDIT },
  );
  if (parts === undefined) return [{ field, start: 0, end: after.length, text: after, removed: before }];

  const places: ChangedPlace[] = [];
  let oldAt = 0;
  let newAt = 0;
  let open: ChangedPlace | undefined;
  const close = () => {
    if (open) places.push(open);
    open = undefined;
  };
  for (const part of parts) {
    const count = part.count ?? part.value.length;
    if (!part.added && !part.removed) {
      close();
      oldAt += count;
      newAt += count;
    } else if (part.removed) {
      const first = a[oldAt];
      const last = a[oldAt + count - 1];
      const gone = first && last ? before.slice(first.start, last.end) : '';
      const at = b[newAt]?.start ?? after.length;
      open = open ? { ...open, removed: `${open.removed ?? ''}${open.removed ? ' ' : ''}${gone}` } : { field, start: at, end: at, text: '', removed: gone };
      oldAt += count;
    } else {
      const first = b[newAt];
      const last = b[newAt + count - 1];
      if (first && last) {
        open = open ? { ...open, start: Math.min(open.start, first.start), end: last.end, text: after.slice(Math.min(open.start, first.start), last.end) } : { field, start: first.start, end: last.end, text: after.slice(first.start, last.end) };
      }
      newAt += count;
    }
  }
  close();
  return places;
}

const significant = (text: string): string[] => (lower(text).match(/[\p{L}\p{N}]{4,}/gu) ?? []) as string[];

function covers(place: ChangedPlace, fieldText: string, fragments: readonly string[]): boolean {
  return fragments.some((fragment) => {
    if (place.end > place.start) {
      return findAllFragments(fieldText, fragment).some((spot) => spot.start < place.end && spot.end > place.start);
    }
    const gone = lower(place.removed ?? '');
    const f = lower(fragment);
    if (gone.includes(f) || f.includes(gone)) return true;
    const words = significant(gone);
    return words.length > 0 && words.filter((w) => f.includes(w)).length * 2 >= words.length;
  });
}

export function textListCheck(testCase: Omit<TestCase, 'id'> & { id?: string }, base: Pick<TestCase, 'fields'> | undefined, _judgedText: string | undefined): ListCheck {
  const errors = testCase.expected_errors;
  const fragments = errors.map((e) => e.fragment ?? '').filter((f) => f !== '');

  const notes: FragmentNote[] = [];
  const notInText: ListCheck['notInText'] = [];
  const texts = Object.values(testCase.fields);
  errors.forEach((error, index) => {
    if (error.fragment === undefined || error.fragment === '') notes.push({ index, kind: 'no_fragment' });
    else if (!texts.some((t) => findFragment(t, error.fragment as string))) notInText.push({ index, fragment: error.fragment });
    if (error.category === undefined || error.category === '') notes.push({ index, kind: 'no_category' });
  });

  const uncovered: ChangedPlace[] = [];
  let identicalToBase = false;
  if (base) {
    identicalToBase = Object.keys(base.fields).length === Object.keys(testCase.fields).length && Object.entries(testCase.fields).every(([k, v]) => base.fields[k] === v);
    if (!identicalToBase) {
      for (const [field, after] of Object.entries(testCase.fields)) {
        const before = base.fields[field];
        if (before === undefined) continue;
        for (const place of changedPlaces(field, before, after)) if (!covers(place, after, fragments)) uncovered.push(place);
      }
    }
  }

  const mismatches: string[] = [];
  if (identicalToBase) mismatches.push('the case is identical to its base case');
  if (uncovered.length > 0) mismatches.push(`${uncovered.length} changed ${uncovered.length === 1 ? 'place' : 'places'} not in the list`);
  if (notInText.length > 0) mismatches.push(`${notInText.length} expected ${notInText.length === 1 ? 'error' : 'errors'} not in the text`);
  const agrees = mismatches.length === 0;
  const line = agrees ? 'Text and list agree' : mismatches.length === 1 ? capital(mismatches[0] as string) : `${mismatches.length} mismatches: ${mismatches.join(', ')}`;
  return { uncovered, notInText, identicalToBase, notes, agrees, line };
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
