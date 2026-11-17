// A reply that lacks a field a rule needs: "the tool does not guess; the case awaits verification with the reason" and "nothing is
// marked automatically" (FR-061, User Story acceptance 4, Edge Cases; T413).
import { describe, expect, it } from 'vitest';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import { reviewCase } from '../../../../src/core/evaluation/review';
import { caseStatus } from '../../../../src/core/evaluation/status';
import type { FindingsResult } from '../../../../src/core/judge/findings';
import type { CountingMode, TestCase } from '../../../../src/core/model';

const params = { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 };
const testCase = (errors: Array<{ id: string; fragment?: string }>): TestCase => ({
  id: '1',
  name: 'c',
  fields: { summary: 's' },
  expected_errors: errors.map((e) => ({ id: e.id, description: 'd', fragment: e.fragment })),
});
const missing = (findings: FindingsResult['findings']): FindingsResult => ({ readable: true, findings, unknown: ['claims[].verdict'] });

describe.each<CountingMode>(['per_expected_error', 'per_case'])('a reply that lacks a field a rule needs (%s, T413)', (mode) => {
  it('marks no expected error automatically, also one a finding clearly matches; each says which field is missing', () => {
    const findings = mode === 'per_case' ? [{ key: 'reply', text: '', rules: ['r'] }] : [{ key: 'c#1', text: 'Anna is a doctor', rules: ['r'] }];
    const r = reviewCase(testCase([{ id: 'e1', fragment: 'Anna is a doctor' }, { id: 'e2', fragment: 'second oven in 2005' }]), missing(findings), params, mode);
    expect(r.expected.map((e) => e.state)).toEqual(['undecided', 'undecided']);
    for (const e of r.expected) expect(e.reason).toContain('claims[].verdict');
    expect(caseStatus(applyDecisions(r, undefined))).toBe('awaiting');
  });

  it('a clean case awaits verification with the reason, instead of Pass', () => {
    const r = reviewCase(testCase([]), missing([]), params, mode);
    expect(r.needsApproval).toBe(true);
    expect(r.reason).toContain('claims[].verdict');
    expect(caseStatus(applyDecisions(r, undefined))).toBe('awaiting');
  });

  it('with every field present nothing changes: a clean case with no finding is Pass', () => {
    const r = reviewCase(testCase([]), { readable: true, findings: [], unknown: [] }, params, mode);
    expect(r.needsApproval).toBe(false);
    expect(caseStatus(applyDecisions(r, undefined))).toBe('pass');
  });
});
