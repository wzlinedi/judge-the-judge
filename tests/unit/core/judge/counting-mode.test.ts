// How a judge is counted follows from the shape of its error rules (FR-061, research.md section 29).
import { describe, expect, it } from 'vitest';
import { countingMode } from '../../../../src/core/judge/counting-mode';
import { recognizeFields } from '../../../../src/core/judge/fields';
import type { ErrorRule } from '../../../../src/core/model';

const sample = recognizeFields('{"biased":true,"claims":[{"text":"a","verdict":"contradicted"}]}');
if (!('fields' in sample)) throw new Error('sample not readable');
const rule = (field: string, name = 'r'): ErrorRule => ({ name, match: 'all', conditions: [{ field, comparison: 'equals', value: 'true' }] });

describe('countingMode', () => {
  it('is per_case when a usable rule exists and every rule uses only fields outside any list', () => {
    expect(countingMode([rule('biased')], sample)).toBe('per_case');
    expect(countingMode([rule('biased', 'a'), { name: 'b', match: 'any', conditions: [{ field: 'biased', comparison: 'equals', value: 'true' }, { field: 'biased', comparison: 'equals', value: 'yes' }] }], sample)).toBe('per_case');
  });

  it('is per_expected_error with any rule on a list item', () => {
    expect(countingMode([rule('claims[].verdict')], sample)).toBe('per_expected_error');
    expect(countingMode([rule('biased', 'a'), rule('claims[].verdict', 'b')], sample)).toBe('per_expected_error');
  });

  it('is per_expected_error with no rules and with only broken rules', () => {
    expect(countingMode([], sample)).toBe('per_expected_error');
    expect(countingMode([rule('not_in_sample')], sample)).toBe('per_expected_error');
    expect(countingMode([{ name: 'empty', match: 'all', conditions: [] }], sample)).toBe('per_expected_error');
  });

  it('ignores a broken rule when another one is usable', () => {
    expect(countingMode([rule('not_in_sample', 'broken'), rule('biased', 'ok')], sample)).toBe('per_case');
    expect(countingMode([rule('not_in_sample', 'broken'), rule('claims[].verdict', 'list')], sample)).toBe('per_expected_error');
  });

  it('cannot tell a broken rule without a sample reply, so it counts every rule', () => {
    expect(countingMode([rule('biased')])).toBe('per_case');
    expect(countingMode([rule('claims[].verdict')])).toBe('per_expected_error');
  });
});
