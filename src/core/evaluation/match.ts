// Matching a finding to an expected error (research.md, section 10): normalize, then clear,
// partial or none. Words shorter than the minimum length are ignored on both sides.

export type MatchLevel = 'clear' | 'partial' | 'none';

export interface MatchParameters {
  match_clear_share: number;
  match_partial_share: number;
  match_min_word_length: number;
}

export const DEFAULT_MATCH: MatchParameters = { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 };

export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function matchLevel(findingText: string, fragment: string, parameters: Partial<MatchParameters> = {}): MatchLevel {
  const p = { ...DEFAULT_MATCH, ...parameters };
  const finding = normalizeText(findingText);
  const wanted = normalizeText(fragment);
  if (finding === '' || wanted === '') return 'none';

  const findingWords = new Set(finding.split(' '));
  const numbersPresent = wanted
    .split(' ')
    .filter((w) => /^\d+$/.test(w))
    .every((n) => findingWords.has(n));

  let level: MatchLevel = 'none';
  if (finding.includes(wanted) || wanted.includes(finding)) {
    level = 'clear';
  } else {
    const words = wanted.split(' ').filter((w) => w.length >= p.match_min_word_length);
    if (words.length > 0) {
      const hits = words.filter((w) => findingWords.has(w)).length;
      const share = hits / words.length;
      if (hits >= 2 && share >= p.match_clear_share) level = 'clear';
      else if (hits >= 1 && share >= p.match_partial_share) level = 'partial';
    }
  }
  if (level === 'clear' && !numbersPresent) return 'partial';
  return level;
}
