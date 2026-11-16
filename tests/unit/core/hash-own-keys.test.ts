// A key named __proto__ is part of the content version (S1, Constitution IX, FR-056, T398).
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../../src/core/hash';

const withProto = (text: string) => JSON.parse(`{"a":"x","__proto__":{"text":"${text}"}}`);

describe('canonicalJson with a __proto__ key', () => {
  it('two objects that differ only under that key give different text', () => {
    expect(canonicalJson(withProto('one'))).not.toBe(canonicalJson(withProto('two')));
  });
  it('the key is in the text', () => {
    expect(canonicalJson(withProto('one'))).toContain('"__proto__"');
  });
});
