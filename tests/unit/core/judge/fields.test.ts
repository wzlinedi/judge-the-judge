import { describe, expect, it } from 'vitest';
import { proposeFindingText, recognizeFields, validFindingTextField } from '../../../../src/core/judge/fields';

function recognized(sample: string) {
  const r = recognizeFields(sample);
  if (!r.ok) throw new Error('sample not readable: ' + r.message);
  return r;
}

const sample = JSON.stringify({
  overall: { ok: true },
  claims: [
    { text: 'The book has 300 pages', verdict: 'contradicted', score: 3, note: null },
    { text: 'It was published in 1890', verdict: 'supported', score: 5, note: null },
  ],
});

describe('recognizeFields', () => {
  it('uses dotted paths and [] for each item of a list', () => {
    const r = recognized(sample);
    expect(r.fields.map((f) => f.path)).toEqual(['overall.ok', 'claims[].text', 'claims[].verdict', 'claims[].score', 'claims[].note']);
    expect(r.lists).toEqual(['claims[]']);
  });

  it('gives each field its kind and the list it belongs to', () => {
    const f = Object.fromEntries(recognized(sample).fields.map((x) => [x.path, x]));
    expect(f['overall.ok']).toMatchObject({ kind: 'boolean', list: undefined });
    expect(f['claims[].text']).toMatchObject({ kind: 'text', list: 'claims[]' });
    expect(f['claims[].score']).toMatchObject({ kind: 'number' });
    expect(f['claims[].note']).toMatchObject({ kind: 'empty' });
  });

  it('keeps up to eight distinct values seen', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ v: `value ${i % 10}` }));
    const r = recognized(JSON.stringify({ items }));
    const field = r.fields.find((f) => f.path === 'items[].v');
    expect(field?.values).toHaveLength(8);
    expect(new Set(field?.values).size).toBe(8);
    expect(recognized(sample).fields.find((f) => f.path === 'claims[].verdict')?.values).toEqual(['contradicted', 'supported']);
    expect(recognized(sample).fields.find((f) => f.path === 'overall.ok')?.values).toEqual(['true']);
  });

  it('handles a reply that is itself a list', () => {
    const r = recognized('[{"text":"a","ok":false}]');
    expect(r.fields.map((f) => f.path)).toEqual(['[].text', '[].ok']);
    expect(r.lists).toEqual(['[]']);
  });

  it('recognizes nested lists with their full path', () => {
    const r = recognized(JSON.stringify({ sections: [{ title: 'T', claims: [{ text: 'x' }] }] }));
    expect(r.lists).toEqual(['sections[]', 'sections[].claims[]']);
    const f = Object.fromEntries(r.fields.map((x) => [x.path, x]));
    expect(f['sections[].title']?.list).toBe('sections[]');
    expect(f['sections[].claims[].text']?.list).toBe('sections[].claims[]');
  });

  it('reads a sample wrapped in a code fence', () => {
    expect(recognized('```json\n{"a":1}\n```').fields.map((f) => f.path)).toEqual(['a']);
  });

  it('reports a key with a dot or brackets', () => {
    expect(recognized('{"a.b": 1, "c[d]": 2, "ok": 3}').unsupportedKeys).toEqual(['a.b', 'c[d]']);
  });

  it('reports an unreadable sample with line and column', () => {
    const r = recognizeFields('{\n  "a": \n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(3);
      expect(r.column).toBe(1);
    }
    expect(recognizeFields('no json here').ok).toBe(false);
  });
});

describe('proposeFindingText', () => {
  it('prefers a well-known name, in the order text, claim, statement, element, sentence, part, quote', () => {
    expect(proposeFindingText(recognized('{"c":[{"id":"a long identifier value","claim":"x","statement":"y"}]}'))).toEqual({ 'c[]': 'c[].claim' });
    expect(proposeFindingText(recognized('{"c":[{"quote":"q","text":"t"}]}'))).toEqual({ 'c[]': 'c[].text' });
  });

  it('otherwise takes the text field with the longest average value', () => {
    const r = recognized('{"c":[{"label":"ab","explanation":"a much longer explanation here","n":5}]}');
    expect(proposeFindingText(r)).toEqual({ 'c[]': 'c[].explanation' });
  });

  it('proposes nothing for a list with no text field', () => {
    expect(proposeFindingText(recognized('{"c":[{"n":1}]}'))).toEqual({});
  });

  it('proposes one field per list', () => {
    const r = recognized(JSON.stringify({ a: [{ text: 'x' }], b: [{ sentence: 'y' }] }));
    expect(proposeFindingText(r)).toEqual({ 'a[]': 'a[].text', 'b[]': 'b[].sentence' });
  });
});

describe('validFindingTextField', () => {
  it('must belong to that list and hold text', () => {
    const r = recognized(sample);
    expect(validFindingTextField(r, 'claims[]', 'claims[].text')).toBe(true);
    expect(validFindingTextField(r, 'claims[]', 'claims[].score')).toBe(false);
    expect(validFindingTextField(r, 'claims[]', 'overall.ok')).toBe(false);
    expect(validFindingTextField(r, 'claims[]', 'nothing')).toBe(false);
  });
});
