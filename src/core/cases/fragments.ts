// Where a fragment is in a text (FR-044, FR-077, FR-080). Word for word first, then ignoring case.
export interface Spot {
  start: number;
  end: number;
}

export function findFragment(text: string, fragment: string, from = 0): Spot | undefined {
  if (fragment === '') return undefined;
  const exact = text.indexOf(fragment, from);
  if (exact !== -1) return { start: exact, end: exact + fragment.length };
  const loose = text.toLowerCase().indexOf(fragment.toLowerCase(), from);
  // Lower-casing can change a length (some letters); the spot is only trusted when it is the same length.
  if (loose !== -1 && text.toLowerCase().length === text.length) return { start: loose, end: loose + fragment.length };
  return undefined;
}

/** Every place the fragment occurs in the text, in order. */
export function findAllFragments(text: string, fragment: string): Spot[] {
  const spots: Spot[] = [];
  let from = 0;
  for (;;) {
    const spot = findFragment(text, fragment, from);
    if (!spot) return spots;
    spots.push(spot);
    from = Math.max(spot.end, spot.start + 1);
  }
}
