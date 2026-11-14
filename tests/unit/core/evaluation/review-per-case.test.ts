// Reading a reply of a judge that gives one verdict for the whole text (FR-061, T161).
import { describe, expect, it } from 'vitest';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import { reviewCase } from '../../../../src/core/evaluation/review';
import { caseStatus } from '../../../../src/core/evaluation/status';
import type { FindingsResult } from '../../../../src/core/judge/findings';
import type { TestCase } from '../../../../src/core/model';

const params = { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 };
const testCase = (errors: Array<{ id: string; fragment?: string }>): TestCase => ({ id: '1', name: 'c', fields: { text: 't' }, expected_errors: errors.map((e) => ({ id: e.id, description: 'd', fragment: e.fragment })) });
const flagged: FindingsResult = { readable: true, findings: [{ key: 'reply', text: '', rules: ['Judge says biased'] }], unknown: [] };
const notFlagged: FindingsResult = { readable: true, findings: [], unknown: [] };
const review = (errors: Array<{ id: string; fragment?: string }>, result: FindingsResult) => reviewCase(testCase(errors), result, params, 'per_case');

describe('reviewCase per case', () => {
  it('makes every expected error found when the reply is flagged, also one without a fragment', () => {
    const r = review([{ id: 'e1', fragment: 'some words' }, { id: 'e2' }], flagged);
    expect(r.expected.map((e) => e.state)).toEqual(['found', 'found']);
    expect(r.flagged).toBe(true);
    expect(r.additional).toEqual([]);
    expect(r.needsApproval).toBe(false);
  });

  it('makes every expected error missed when the reply is not flagged', () => {
    const r = review([{ id: 'e1', fragment: 'some words' }, { id: 'e2' }], notFlagged);
    expect(r.expected.map((e) => e.state)).toEqual(['missed', 'missed']);
    expect(r.flagged).toBe(false);
  });

  it('gives the decisions the source "automatic" and one attached finding per found error', () => {
    const effective = applyDecisions(review([{ id: 'e1' }], flagged), undefined);
    expect(effective.expected[0]).toMatchObject({ state: 'found', source: 'automatic', attached: 1 });
    expect(caseStatus(effective)).toBe('pass');
    expect(caseStatus(applyDecisions(review([{ id: 'e1' }], notFlagged), undefined))).toBe('fail');
  });

  it('leaves the errors undecided, with the reason, when a field a rule needs is missing and nothing flagged the text', () => {
    const r = review([{ id: 'e1' }], { readable: true, findings: [], unknown: ['biased'] });
    expect(r.expected[0]?.state).toBe('undecided');
    expect(r.expected[0]?.reason).toContain('biased');
    expect(r.flagged).toBe(false);
  });

  it('trusts a flag even when another rule could not be checked', () => {
    const r = review([{ id: 'e1' }], { ...flagged, unknown: ['kind'] });
    expect(r.expected[0]?.state).toBe('found');
  });

  it('on a clean case makes a flag an additional finding left to the user, and no flag gives Pass', () => {
    const r = review([], flagged);
    expect(r.additional.map((f) => f.key)).toEqual(['reply']);
    expect(r.flagged).toBe(true);
    expect(caseStatus(applyDecisions(r, undefined))).toBe('awaiting');
    expect(caseStatus(applyDecisions(review([], notFlagged), undefined))).toBe('pass');
  });

  it('needs approval and decides nothing when the reply could not be read', () => {
    const r = review([{ id: 'e1' }], { readable: false, reason: 'No JSON', findings: [], unknown: [] });
    expect(r.readable).toBe(false);
    expect(r.needsApproval).toBe(true);
    expect(r.expected[0]?.state).toBe('undecided');
  });

  it('lets the user change every mark by hand', () => {
    const r = review([{ id: 'e1' }], flagged);
    const effective = applyDecisions(r, { expected: { e1: { state: 'missed', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' });
    expect(effective.expected[0]).toMatchObject({ state: 'missed', source: 'manual' });
    expect(effective.orphans).toEqual({ expected: [], additional: [] });
  });
});
