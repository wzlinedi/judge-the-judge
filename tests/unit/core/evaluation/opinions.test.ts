// Reading the pasted opinion of the user's LLM (file-formats.md, section 7; FR-063, FR-084).
import { describe, expect, it } from 'vitest';
import { readOpinion } from '../../../../src/core/io/opinions';

const inner = { id: '3', expected: [{ index: 1, found: true, reason: 'r', fragment: 'f' }], additional: [{ index: 1, real: false, reason: 'r2', fragment: 'f2' }], new: [] };

const ok = (text: string, id = '3') => {
  const r = readOpinion(text, id);
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' | '));
  return r.value;
};
const problems = (text: string, id = '3') => {
  const r = readOpinion(text, id);
  if (r.ok) throw new Error('expected a refusal');
  return r.problems;
};

describe('readOpinion', () => {
  it('accepts the wrapped object, the bare object and a list with exactly one opinion', () => {
    for (const text of [JSON.stringify({ opinion: inner }), JSON.stringify(inner), JSON.stringify([inner]), JSON.stringify({ opinions: [inner] }), JSON.stringify([{ opinion: inner }])]) {
      expect(ok(text)).toEqual({ id: '3', expected: inner.expected, additional: inner.additional, new: [] });
    }
  });

  it('accepts an opinion inside a code fence and other text', () => {
    expect(ok('Here you are:\n```json\n' + JSON.stringify({ opinion: inner }) + '\n```\nGood luck').id).toBe('3');
  });

  it('accepts a number as the identifier', () => {
    expect(ok(JSON.stringify({ ...inner, id: 3 })).id).toBe('3');
  });

  it('refuses a list of several opinions, saying the opinion is asked for one case at a time', () => {
    const [p] = problems(JSON.stringify([inner, { ...inner, id: '4' }]));
    expect(p?.message).toMatch(/one case at a time/i);
  });

  it('refuses an opinion for another case, with the reason', () => {
    const [p] = problems(JSON.stringify({ opinion: { ...inner, id: '5' } }));
    expect(p?.message).toMatch(/case 5/);
    expect(p?.message).toMatch(/case 3/);
  });

  it('refuses an opinion without an identifier', () => {
    const { id: _id, ...rest } = inner;
    const [p] = problems(JSON.stringify(rest));
    expect(p?.path).toBe('opinion.id');
  });

  it('reports a JSON that cannot be read with its line and column', () => {
    const [p] = problems('{\n  "opinion": {\n    "id": "3",,\n  }\n}');
    expect(p?.line).toBe(3);
    expect(p?.column).toBeGreaterThan(0);
  });

  it('says so when there is no JSON in the text', () => {
    expect(problems('The judge was right.')[0]?.message).toMatch(/no JSON/i);
  });

  it('reads an additional entry with text and no valid index as a new finding', () => {
    const v = ok(JSON.stringify({ id: '3', expected: [], additional: [{ text: 'Something else', real: true, reason: 'because' }, { index: 0, text: 'Zero', real: false }, { index: 1, real: true }], new: [] }));
    expect(v.additional).toEqual([{ index: 1, real: true }]);
    expect(v.new).toEqual([
      { text: 'Something else', real: true, reason: 'because' },
      { text: 'Zero', real: false },
    ]);
  });

  it('keeps category and difficulty of a new finding', () => {
    const v = ok(JSON.stringify({ id: '3', expected: [], additional: [], new: [{ text: 'x', real: true, reason: 'r', fragment: 'f', category: 'factual-error', difficulty: 'subtle' }] }));
    expect(v.new).toEqual([{ text: 'x', real: true, reason: 'r', fragment: 'f', category: 'factual-error', difficulty: 'subtle' }]);
  });

  it('requires text and real in a new finding, naming the path', () => {
    const ps = problems(JSON.stringify({ id: '3', expected: [], additional: [], new: [{ real: true }, { text: 'x' }] }));
    expect(ps.map((p) => p.path)).toEqual(['new[1].text', 'new[2].real']);
  });

  it('treats missing lists as empty and ignores an unknown difficulty with a note', () => {
    const r = readOpinion(JSON.stringify({ id: '3', new: [{ text: 'x', real: true, difficulty: 'hard' }] }), '3');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.expected).toEqual([]);
      expect(r.value.new[0]?.difficulty).toBeUndefined();
      expect(r.notes.join(' ')).toMatch(/difficulty/);
    }
  });

  it('keeps an entry without found or real, which answers nothing', () => {
    const v = ok(JSON.stringify({ id: '3', expected: [{ index: 1, reason: 'unsure' }], additional: [] }));
    expect(v.expected).toEqual([{ index: 1, reason: 'unsure' }]);
  });
});
