// A field of a pasted case may be named like a built-in JavaScript name (S1, Constitution IX, T396).
import { describe, expect, it } from 'vitest';
import { checkCaseJson } from '../../../../src/core/cases/case-json';

const NAMES = ['__proto__', 'constructor', 'toString'];
const ctx = (variables: string[]) => ({ mode: 'paste', variables, judgedText: undefined, catalog: [], existingCases: [] }) as never;

describe('checkCaseJson with a field named like a built-in JavaScript name', () => {
  it.each(NAMES)('%s: the field keeps its text as its own key and the prototype is unchanged', (name) => {
    const text = `{"name":"N","fields":{"${name}":"Some text.","summary":"S"},"expected_errors":[]}`;
    const check = checkCaseJson(text, ctx(['summary']));
    expect(check.problems).toEqual([]);
    const fields = check.case?.fields as Record<string, string>;
    expect(Object.getPrototypeOf(fields)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(fields, name)?.value).toBe('Some text.');
    expect(fields['summary']).toBe('S');
  });

  it.each(['constructor', 'toString'])('a missing variable {{%s}} is reported, not found on the prototype', (name) => {
    const text = '{"name":"N","fields":{"summary":"S"},"expected_errors":[]}';
    const check = checkCaseJson(text, ctx(['summary', name]));
    expect(check.problems.some((p) => p.message.includes(`"${name}"`))).toBe(true);
  });
});
