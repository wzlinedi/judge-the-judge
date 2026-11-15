// A pasted JSON is shown at once with new lines and an indent of 2 spaces; anything else stays as pasted (T292, FR-084).
import { describe, expect, it } from 'vitest';
import { formatIfWholeJson } from '../../../../src/core/io/format-json';

describe('formatIfWholeJson', () => {
  it('formats a text that is valid JSON as a whole, with an indent of 2 spaces', () => {
    expect(formatIfWholeJson('{"claims":[{"text":"x","ok":true}],"n":1}')).toBe('{\n  "claims": [\n    {\n      "text": "x",\n      "ok": true\n    }\n  ],\n  "n": 1\n}');
  });

  it('keeps the same data: only the spaces change', () => {
    const text = '{"a":[1,2,{"b":null}],"c":"d e"}';
    expect(JSON.parse(formatIfWholeJson(text))).toEqual(JSON.parse(text));
  });

  it('ignores white space around the JSON and leaves a formatted JSON as it is', () => {
    const pretty = '{\n  "a": 1\n}';
    expect(formatIfWholeJson(pretty)).toBe(pretty);
    expect(formatIfWholeJson(`\n  ${pretty}  \n`)).toBe(pretty);
  });

  it('leaves text that is not valid JSON as pasted, so that a problem points at the user’s text', () => {
    for (const text of ['{ nope', '{"a": 1,}', 'hello', '{"a":1} {"b":2}', '']) expect(formatIfWholeJson(text)).toBe(text);
  });

  it('leaves JSON inside a code fence or with other text around it as pasted', () => {
    const fenced = '```json\n{"a":1}\n```';
    const around = 'Here is the reply: {"a":1} Hope it helps.';
    expect(formatIfWholeJson(fenced)).toBe(fenced);
    expect(formatIfWholeJson(around)).toBe(around);
  });
});
