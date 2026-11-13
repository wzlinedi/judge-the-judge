import { describe, expect, it } from 'vitest';
import { extractJson } from '../../../../src/core/judge/extract-json';

describe('extractJson', () => {
  it('reads the whole text', () => {
    const r = extractJson('{"a": 1}');
    expect(r.ok && r.value).toEqual({ a: 1 });
  });

  it('reads a code fence', () => {
    const r = extractJson('Here you go:\n```json\n{"a": [1, 2]}\n```\nBye {not json}');
    expect(r.ok && r.value).toEqual({ a: [1, 2] });
  });

  it('reads from the first brace to its end inside prose', () => {
    const r = extractJson('Sure. {"verdict": "ok"} Hope this helps.');
    expect(r.ok && r.value).toEqual({ verdict: 'ok' });
  });

  it('is not confused by braces inside strings', () => {
    const r = extractJson('Result: {"text": "a } b { c", "n": 2} done');
    expect(r.ok && r.value).toEqual({ text: 'a } b { c', n: 2 });
  });

  it('reads a list at top level', () => {
    const r = extractJson('[{"a":1},{"a":2}]');
    expect(r.ok && r.value).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('reports a broken outer JSON with line and column and never reads an inner object', () => {
    const text = '{\n  "claims": [{"text": "x"}],\n  "b": \n}';
    const r = extractJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('invalid');
      expect(r.line).toBe(4);
      expect(r.column).toBe(1);
    }
  });

  it('reports the place in the whole text, not in the extracted part', () => {
    const text = 'Line one\nLine two {"a": }';
    const r = extractJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(2);
      expect(r.column).toBe(16);
    }
  });

  it('does not read an inner object of an unfinished outer one', () => {
    const r = extractJson('{"a": {"b": 1}, "c": ');
    expect(r.ok).toBe(false);
  });

  it('says "not readable" for free text', () => {
    const r = extractJson('Just a sentence with no data.');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_json');
  });

  it('says so for empty text', () => {
    const r = extractJson('   \n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty');
  });

  it('handles escapes inside strings', () => {
    const r = extractJson('x {"a": "quote \\" and \\\\ backslash"} y');
    expect(r.ok && r.value).toEqual({ a: 'quote " and \\ backslash' });
  });
});
