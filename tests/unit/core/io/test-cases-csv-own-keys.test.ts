// A CSV column "field:<name>" may use a built-in JavaScript name (S1, Constitution IX, T396).
import { describe, expect, it } from 'vitest';
import { readTestCasesCsv } from '../../../../src/core/io/test-cases-csv';

describe('readTestCasesCsv with a column field:__proto__', () => {
  it.each(['__proto__', 'constructor', 'toString'])('field:%s keeps its text as its own key, and the prototype is unchanged', (name) => {
    const read = readTestCasesCsv(`name,field:${name},field:summary\nA,Some text.,S\n`, ['summary']);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.invalid).toEqual([]);
    const fields = read.value.drafts[0]!.draft.fields;
    expect(Object.getPrototypeOf(fields)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(fields, name)?.value).toBe('Some text.');
  });
});
