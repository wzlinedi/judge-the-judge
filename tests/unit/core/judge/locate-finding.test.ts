// Where each finding is in the text of a judge's reply (T293, FR-055).
import { describe, expect, it } from 'vitest';
import { locateFinding } from '../../../../src/core/judge/locate-finding';

const reply = JSON.stringify({ claims: [{ text: 'a', ok: true }, { text: 'b "quoted" {not a brace}', ok: false }, { text: 'c', ok: false }] }, null, 2);
const slice = (text: string, key: string) => {
  const at = locateFinding(text, key);
  return at ? text.slice(at.start, at.end) : undefined;
};

describe('locateFinding', () => {
  it('finds the block of an item of a list by its position', () => {
    expect(JSON.parse(slice(reply, 'claims[]#1')!)).toEqual({ text: 'a', ok: true });
    expect(JSON.parse(slice(reply, 'claims[]#2')!)).toEqual({ text: 'b "quoted" {not a brace}', ok: false });
    expect(JSON.parse(slice(reply, 'claims[]#3')!)).toEqual({ text: 'c', ok: false });
  });

  it('works on a reply written on one line, and on JSON in a code fence or with text around it', () => {
    const compact = JSON.stringify(JSON.parse(reply));
    expect(JSON.parse(slice(compact, 'claims[]#2')!).ok).toBe(false);
    const fenced = `Here it is:\n\`\`\`json\n${reply}\n\`\`\`\nDone.`;
    expect(JSON.parse(slice(fenced, 'claims[]#3')!).text).toBe('c');
  });

  it('finds an item of a nested list, and of a list under a path', () => {
    const nested = JSON.stringify({ result: { sections: [{ items: [{ n: 1 }, { n: 2 }] }, { items: [{ n: 3 }, { n: 4 }, { n: 5 }] }] } }, null, 2);
    expect(JSON.parse(slice(nested, 'result.sections[].items[]#2.3')!)).toEqual({ n: 5 });
    expect(JSON.parse(slice(nested, 'result.sections[].items[]#1.1')!)).toEqual({ n: 1 });
  });

  it('a finding about the whole reply is the whole JSON', () => {
    expect(JSON.parse(slice(reply, 'reply')!)).toEqual(JSON.parse(reply));
    expect(slice(`text ${reply} text`, 'reply')).toBe(reply);
  });

  it('is undefined for a position that is not there, a text that is not JSON, or a list that is not in the reply', () => {
    expect(locateFinding(reply, 'claims[]#9')).toBeUndefined();
    expect(locateFinding(reply, 'nothing[]#1')).toBeUndefined();
    expect(locateFinding('not json at all', 'claims[]#1')).toBeUndefined();
    expect(locateFinding('not json at all', 'reply')).toBeUndefined();
  });
});
