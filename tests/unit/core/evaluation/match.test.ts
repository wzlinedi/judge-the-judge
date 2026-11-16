import { describe, expect, it } from 'vitest';
import { matchLevel, normalizeText } from '../../../../src/core/evaluation/match';

describe('normalizeText', () => {
  it('lower-cases, replaces punctuation by spaces and collapses runs', () => {
    expect(normalizeText('  Hello,   WORLD!! — it\'s "fine". ')).toBe('hello world it s fine');
  });
  it('normalizes Unicode', () => {
    expect(normalizeText('Zażółć gęślą')).toBe('zażółć gęślą');
    expect(normalizeText('é')).toBe(normalizeText('é'));
  });
});

describe('matchLevel', () => {
  it('is clear when one normalized text contains the other', () => {
    expect(matchLevel('The story was published as a book in 1887, says the claim.', 'published as a book in 1887')).toBe('clear');
    expect(matchLevel('published as a book', 'It was PUBLISHED, as a book!')).toBe('clear');
  });

  it('is clear with at least two hits and a share of 0.6', () => {
    expect(matchLevel('the heroine rejects the proposal twice', 'She twice rejects a proposal of marriage')).toBe('clear');
  });

  it('is partial with one hit and a share of 0.3', () => {
    expect(matchLevel('A proposal was made', 'She rejects a proposal of marriage')).toBe('partial');
  });

  it('is none otherwise', () => {
    expect(matchLevel('Something entirely different', 'She rejects a proposal of marriage')).toBe('none');
    expect(matchLevel('', 'fragment')).toBe('none');
    expect(matchLevel('finding', '')).toBe('none');
  });

  it('ignores words shorter than the minimum length', () => {
    expect(matchLevel('it is on a an to of', 'it is on a an to of by me')).toBe('clear'); // containment
    expect(matchLevel('xx yy zz', 'ab cd ef gh')).toBe('none');
  });

  it('turns clear into partial when a number of the fragment is missing from the finding', () => {
    expect(matchLevel('The book was published in 1890 by the author', 'The book was published in 1887 by the author')).toBe('partial');
    expect(matchLevel('The book was published in 1887 by the author', 'The book was published in 1887 by the author')).toBe('clear');
  });

  it('works for Polish text', () => {
    expect(matchLevel('Wokulski kocha Izabelę Łęcką', 'Wokulski bardzo kocha Izabelę Łęcką z całego serca')).toBe('partial');
    expect(matchLevel('Wokulski bardzo kocha Izabelę Łęcką z całego serca', 'Wokulski kocha Izabelę Łęcką')).toBe('clear');
  });

  it('lets parameters override the defaults', () => {
    const finding = 'the heroine rejects the proposal twice';
    const fragment = 'She twice rejects a proposal of marriage';
    expect(matchLevel(finding, fragment, { match_clear_share: 0.99 })).toBe('partial');
    expect(matchLevel(finding, fragment, { match_min_word_length: 9 })).toBe('none');
    expect(matchLevel('A proposal was made', fragment, { match_partial_share: 0.9 })).toBe('none');
  });
});

// R4 (code review 2026-11-16; research.md 10, point 2): containment counts only on whole words, and the shorter text has at least two words.
describe('matchLevel: containment on whole words', () => {
  it('is not clear when a short text is a piece of a word of the longer text', () => {
    expect(matchLevel('No comparison is given', 'Paris')).not.toBe('clear');
    expect(matchLevel('he', 'the hero rejects the proposal')).not.toBe('clear');
  });

  it('is clear when the shorter text is two or more whole words of the longer text', () => {
    expect(matchLevel('the hero rejects', 'the hero rejects the proposal')).toBe('clear');
    expect(matchLevel('the hero rejects the proposal', 'hero rejects')).toBe('clear');
  });
});

