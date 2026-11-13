import { describe, expect, it } from 'vitest';
import { findFindings, previewRules } from '../../../../src/core/judge/findings';
import { recognizeFields } from '../../../../src/core/judge/fields';
import type { ErrorRule } from '../../../../src/core/model';

const bad: ErrorRule = {
  name: 'Contradicted or unsupported',
  match: 'any',
  conditions: [
    { field: 'claims[].verdict', comparison: 'equals', value: 'contradicted' },
    { field: 'claims[].verdict', comparison: 'equals', value: 'unsupported' },
  ],
};
const findingText = { 'claims[]': 'claims[].text' };
const reply = JSON.stringify({
  claims: [
    { text: 'one', verdict: 'supported' },
    { text: 'two', verdict: 'contradicted' },
    { text: 'three', verdict: 'unsupported' },
  ],
});

describe('findFindings', () => {
  it('gives one finding per list item, keyed by list path and position', () => {
    const r = findFindings(reply, [bad], findingText);
    expect(r.readable).toBe(true);
    expect(r.findings).toEqual([
      { key: 'claims[]#2', text: 'two', rules: ['Contradicted or unsupported'] },
      { key: 'claims[]#3', text: 'three', rules: ['Contradicted or unsupported'] },
    ]);
  });

  it('shows every rule that holds for an item, but gives one finding', () => {
    const second: ErrorRule = { name: 'Second', match: 'all', conditions: [{ field: 'claims[].verdict', comparison: 'equals', value: 'contradicted' }] };
    const r = findFindings(reply, [bad, second], findingText);
    expect(r.findings.find((f) => f.key === 'claims[]#2')?.rules).toEqual(['Contradicted or unsupported', 'Second']);
    expect(r.findings).toHaveLength(2);
  });

  it('has empty text when no finding-text field is set', () => {
    expect(findFindings(reply, [bad], {}).findings.map((f) => f.text)).toEqual(['', '']);
  });

  it('gives a whole-reply finding keyed "reply" with no text for a rule outside any list', () => {
    const rule: ErrorRule = { name: 'Biased', match: 'any', conditions: [{ field: 'verdict.biased', comparison: 'equals', value: 'yes' }] };
    expect(findFindings('{"verdict":{"biased":"Yes"}}', [rule], {}).findings).toEqual([{ key: 'reply', text: '', rules: ['Biased'] }]);
    expect(findFindings('{"verdict":{"biased":"no"}}', [rule], {}).findings).toEqual([]);
  });

  it('reads fields outside a list once, together with list fields', () => {
    const rule: ErrorRule = {
      name: 'Bad when overall is false',
      match: 'all',
      conditions: [
        { field: 'overall.ok', comparison: 'equals', value: 'false' },
        { field: 'claims[].verdict', comparison: 'equals', value: 'contradicted' },
      ],
    };
    const text = JSON.stringify({ overall: { ok: false }, claims: [{ text: 'a', verdict: 'contradicted' }, { text: 'b', verdict: 'supported' }] });
    expect(findFindings(text, [rule], findingText).findings.map((f) => f.key)).toEqual(['claims[]#1']);
    const ok = JSON.stringify({ overall: { ok: true }, claims: [{ text: 'a', verdict: 'contradicted' }] });
    expect(findFindings(ok, [rule], findingText).findings).toEqual([]);
  });

  it('keeps the fields that made a rule unknown as the reason', () => {
    const text = JSON.stringify({ claims: [{ text: 'a' }, { text: 'b', verdict: 'contradicted' }] });
    const r = findFindings(text, [bad], findingText);
    expect(r.readable).toBe(true);
    expect(r.unknown).toEqual(['claims[].verdict']);
    expect(r.findings.map((f) => f.key)).toEqual(['claims[]#2']);
  });

  it('says a reply that cannot be read cannot be read, with where', () => {
    const r = findFindings('{\n "claims": \n}', [bad], findingText);
    expect(r.readable).toBe(false);
    expect(r.findings).toEqual([]);
    expect(r.reason).toMatch(/line 3/i);
    expect(findFindings('just words', [bad], findingText).readable).toBe(false);
  });

  it('is not readable automatically without usable rules', () => {
    const r = findFindings(reply, [], findingText);
    expect(r.readable).toBe(false);
    expect(r.reason).toMatch(/rule/i);
  });

  it('reads a wrapped reply', () => {
    expect(findFindings('Here:\n```json\n' + reply + '\n```', [bad], findingText).findings).toHaveLength(2);
  });

  it('does not apply broken rules when the sample is known', () => {
    const sample = recognizeFields('{"claims":[{"text":"a","verdict":"v"}]}');
    if (!sample.ok) throw new Error('bad sample');
    const broken: ErrorRule = { name: 'Broken', match: 'any', conditions: [{ field: 'claims[].nothing', comparison: 'is_not_empty' }] };
    const r = findFindings(reply, [broken, bad], findingText, sample);
    expect(r.findings.every((f) => !f.rules.includes('Broken'))).toBe(true);
    expect(r.findings).toHaveLength(2);
    expect(r.unknown).toEqual([]);
  });

  it('keys findings of nested lists by every position', () => {
    const rule: ErrorRule = { name: 'n', match: 'any', conditions: [{ field: 'sections[].claims[].v', comparison: 'equals', value: 'bad' }] };
    const text = JSON.stringify({ sections: [{ claims: [{ v: 'ok' }] }, { claims: [{ v: 'ok' }, { v: 'bad' }] }] });
    expect(findFindings(text, [rule], {}).findings.map((f) => f.key)).toEqual(['sections[].claims[]#2.2']);
  });
});

describe('previewRules', () => {
  it('shows every item of the sample as a finding with its rules or as no finding', () => {
    const rows = previewRules(reply, [bad], findingText);
    expect(rows.readable).toBe(true);
    if (rows.readable) {
      expect(rows.rows.map((r) => [r.key, r.text, r.rules])).toEqual([
        ['claims[]#1', 'one', []],
        ['claims[]#2', 'two', ['Contradicted or unsupported']],
        ['claims[]#3', 'three', ['Contradicted or unsupported']],
      ]);
    }
  });

  it('is not readable for a broken sample', () => {
    expect(previewRules('{', [bad], findingText).readable).toBe(false);
  });
});
