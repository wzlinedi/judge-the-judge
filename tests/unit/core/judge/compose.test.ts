import { describe, expect, it } from 'vitest';
import { composePrompt } from '../../../../src/core/judge/compose';

const base = { id: '1', name: 'c', expected_errors: [] };

describe('composePrompt', () => {
  it('replaces every occurrence of a variable', () => {
    const result = composePrompt('{{a}} and {{a}} and {{ b }}', { ...base, fields: { a: 'X', b: 'Y' } });
    expect(result.text).toBe('X and X and Y');
    expect(result.missing).toEqual([]);
  });

  it('turns a variable with no field into empty text and reports it', () => {
    const result = composePrompt('[{{a}}][{{b}}]', { ...base, fields: { a: 'X' } });
    expect(result.text).toBe('[X][]');
    expect(result.missing).toEqual(['b']);
  });

  it('does not scan field text again', () => {
    const result = composePrompt('{{a}} / {{b}}', { ...base, fields: { a: 'has {{b}} inside', b: 'SECRET' } });
    expect(result.text).toBe('has {{b}} inside / SECRET');
  });

  it('adds nothing', () => {
    const prompt = 'Line one\n\n  indented {{a}}\n';
    expect(composePrompt(prompt, { ...base, fields: { a: '1' } }).text).toBe('Line one\n\n  indented 1\n');
  });

  it('leaves an empty pair as written', () => {
    expect(composePrompt('x {{ }} y', { ...base, fields: {} }).text).toBe('x {{ }} y');
  });

  it('does not read names from the prototype chain', () => {
    const result = composePrompt('{{constructor}}', { ...base, fields: {} });
    expect(result.text).toBe('');
    expect(result.missing).toEqual(['constructor']);
  });

  it('inserts replacement patterns literally', () => {
    expect(composePrompt('{{a}}', { ...base, fields: { a: '$& $1 $$' } }).text).toBe('$& $1 $$');
  });
});
