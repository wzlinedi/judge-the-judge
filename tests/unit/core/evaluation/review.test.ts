import { describe, expect, it } from 'vitest';
import { reviewCase } from '../../../../src/core/evaluation/review';
import type { FindingsResult } from '../../../../src/core/judge/findings';
import type { TestCase } from '../../../../src/core/model';

const params = { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 };
const testCase = (errors: Array<{ id: string; fragment?: string }>): TestCase => ({
  id: '1',
  name: 'c',
  fields: { summary: 's' },
  expected_errors: errors.map((e) => ({ id: e.id, description: 'd', fragment: e.fragment })),
});
const found = (...findings: Array<[string, string]>): FindingsResult => ({
  readable: true,
  findings: findings.map(([key, text]) => ({ key, text, rules: ['r'] })),
  unknown: [],
});

describe('reviewCase (per expected error)', () => {
  it('finds an expected error on a clear match', () => {
    const r = reviewCase(testCase([{ id: 'e1', fragment: 'published in 1887' }]), found(['c#1', 'The book was published in 1887 apparently']), params);
    expect(r.expected[0]).toMatchObject({ id: 'e1', state: 'found', clear: ['c#1'] });
    expect(r.additional).toEqual([]);
    expect(r.needsApproval).toBe(false);
  });

  it('attaches all findings that clearly match one error', () => {
    const r = reviewCase(testCase([{ id: 'e1', fragment: 'published in 1887' }]), found(['c#1', 'published in 1887'], ['c#2', 'It was published in 1887, wrongly']), params);
    expect(r.expected[0]?.clear).toEqual(['c#1', 'c#2']);
    expect(r.additional).toEqual([]);
  });

  it('leaves an error with no fragment undecided, with the reason', () => {
    const r = reviewCase(testCase([{ id: 'e1' }]), found(['c#1', 'anything']), params);
    expect(r.expected[0]?.state).toBe('undecided');
    expect(r.expected[0]?.reason).toMatch(/fragment/i);
    expect(r.additional.map((f) => f.key)).toEqual(['c#1']);
  });

  it('leaves an error whose best match is partial undecided and keeps the finding with it', () => {
    const r = reviewCase(testCase([{ id: 'e1', fragment: 'She rejects a proposal of marriage' }]), found(['c#1', 'A proposal was made']), params);
    expect(r.expected[0]).toMatchObject({ state: 'undecided', partial: ['c#1'], clear: [] });
    expect(r.expected[0]?.reason).toMatch(/partly/i);
    expect(r.additional).toEqual([]);
    expect(r.partialOnly.map((f) => f.key)).toEqual(['c#1']);
  });

  it('marks an error missed automatically only when the reply was read, no rule was unknown and no additional finding exists', () => {
    const tc = testCase([{ id: 'e1', fragment: 'published in 1887' }]);
    expect(reviewCase(tc, found(), params).expected[0]?.state).toBe('missed');
    const withAdditional = reviewCase(tc, found(['c#1', 'something else entirely']), params);
    expect(withAdditional.expected[0]?.state).toBe('undecided');
    expect(withAdditional.expected[0]?.reason).toMatch(/other words/i);
    const withUnknown = reviewCase(tc, { readable: true, findings: [], unknown: ['claims[].verdict'] }, params);
    expect(withUnknown.expected[0]?.state).toBe('undecided');
    expect(withUnknown.expected[0]?.reason).toContain('claims[].verdict');
  });

  it('never decides additional findings', () => {
    const r = reviewCase(testCase([]), found(['c#1', 'a claim']), params);
    expect(r.additional).toEqual([{ key: 'c#1', text: 'a claim', rules: ['r'] }]);
  });

  it('needs approval and decides nothing when the reply could not be read', () => {
    const r = reviewCase(testCase([{ id: 'e1', fragment: 'x y z' }]), { readable: false, reason: 'No JSON', findings: [], unknown: [] }, params);
    expect(r.readable).toBe(false);
    expect(r.needsApproval).toBe(true);
    expect(r.expected[0]?.state).toBe('undecided');
    expect(r.expected[0]?.reason).toContain('No JSON');
  });

  it('makes a whole-reply finding an additional finding that is never matched', () => {
    const r = reviewCase(testCase([{ id: 'e1', fragment: 'published in 1887' }]), { readable: true, findings: [{ key: 'reply', text: '', rules: ['Biased'] }], unknown: [] }, params);
    expect(r.additional.map((f) => f.key)).toEqual(['reply']);
    expect(r.expected[0]?.state).toBe('undecided');
  });
});
