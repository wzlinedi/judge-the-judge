// T458 (Clarifications 2026-11-17, finding 6, answer A; FR-062, FR-067): a finding that matched an expected error marked "Ignored" is left
// out with that error. It does not become an additional finding and the case does not wait for it; "Not found" still moves it (T417).
import { describe, expect, it } from 'vitest';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import { reviewCase } from '../../../../src/core/evaluation/review';
import { caseStatus } from '../../../../src/core/evaluation/status';
import type { CaseDecisions, ExpectedState, TestCase } from '../../../../src/core/model';

const params = { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 };
const testCase: TestCase = { id: '1', name: 'c', fields: { summary: 's' }, expected_errors: [{ id: 'e1', description: 'd', fragment: 'Anna is a doctor' }] };
const review = reviewCase(
  testCase,
  { readable: true, findings: [{ key: 'c#1', text: 'Anna is a doctor', rules: ['r'] }, { key: 'c#2', text: 'Anna is a baker', rules: ['r'] }], unknown: [] },
  params,
  'per_expected_error',
);
const marked = (state: ExpectedState): CaseDecisions => ({ expected: { e1: { state, source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' });

describe('the findings of an expected error marked "Ignored" (T458)', () => {
  it('(setup) c#1 clearly and c#2 partly match E1', () => {
    expect(review.expected[0]).toMatchObject({ clear: ['c#1'], partial: ['c#2'] });
  });

  it('"Ignored": neither becomes an additional finding, and the case does not wait for them', () => {
    const effective = applyDecisions(review, marked('ignored'));
    expect(effective.additional.map((a) => a.key)).toEqual([]);
    expect(caseStatus(effective)).not.toBe('awaiting');
  });

  it('"Not found": both become additional findings and the case waits (T417, unchanged)', () => {
    const effective = applyDecisions(review, marked('missed'));
    expect(effective.additional.map((a) => a.key).sort()).toEqual(['c#1', 'c#2']);
    expect(caseStatus(effective)).toBe('awaiting');
  });

  it('"Found" again: both are correct findings and no additional finding', () => {
    const effective = applyDecisions(review, marked('found'));
    expect(effective.additional).toEqual([]);
    expect(effective.expected[0]!.attachedKeys).toEqual(['c#1', 'c#2']);
  });
});
