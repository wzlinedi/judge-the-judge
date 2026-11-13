import { describe, expect, it } from 'vitest';
import { findVariables, proposeJudgedText } from '../../../../src/core/judge/variables';

describe('findVariables', () => {
  it('lists names in order without repeats', () => {
    expect(findVariables('A {{b}} C {{a}} D {{b}}')).toEqual(['b', 'a']);
  });

  it('ignores spaces around the name', () => {
    expect(findVariables('{{  name  }} and {{name}}')).toEqual(['name']);
  });

  it('is case-sensitive', () => {
    expect(findVariables('{{Name}} {{name}}')).toEqual(['Name', 'name']);
  });

  it('accepts names with spaces, dashes and non-English letters', () => {
    expect(findVariables('{{Source text}} {{kontekst-źródłowy}}')).toEqual(['Source text', 'kontekst-źródłowy']);
  });

  it('does not treat an empty pair as a variable', () => {
    expect(findVariables('{{ }} and {{}}')).toEqual([]);
  });

  it('has no built-in names', () => {
    expect(findVariables('{{input}} {{output}}')).toEqual(['input', 'output']);
  });

  it('returns nothing for a prompt with no variable', () => {
    expect(findVariables('No variables here.')).toEqual([]);
  });
});

describe('proposeJudgedText', () => {
  it('keeps the current one while it is still a variable', () => {
    expect(proposeJudgedText(['a', 'b', 'c'], 'b')).toEqual({ name: 'b' });
  });

  it('proposes the last variable when there is no current one', () => {
    expect(proposeJudgedText(['a', 'b'], undefined)).toEqual({ name: 'b' });
  });

  it('proposes the last variable with a note when the current one left the prompt', () => {
    const result = proposeJudgedText(['a', 'b'], 'gone');
    expect(result.name).toBe('b');
    expect(result.note).toContain('gone');
    expect(result.note).toContain('b');
  });

  it('has no judged text without variables', () => {
    expect(proposeJudgedText([], undefined)).toEqual({ name: undefined });
    expect(proposeJudgedText([], 'x').name).toBeUndefined();
  });
});
