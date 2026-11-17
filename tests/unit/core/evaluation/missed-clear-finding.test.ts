// A finding that clearly matched an expected error the user marks "Not found" becomes an undecided additional finding, as a partly
// matching one already does, and it still counts in the findings of FR-067 (Clarifications 2026-11-17, T417). Before the fix it was
// in no list and no count.
import { describe, expect, it } from 'vitest';
import { computeResults, reviewEvaluation } from '../../../../src/core/evaluation/results';
import type { CaseDecisions, TestProject } from '../../../../src/core/model';
import { accuracyMetric, sampleProject, withRun } from '../../../helpers/fixtures';

const withDecisions = (d: Partial<CaseDecisions>): TestProject => {
  const base = sampleProject();
  return withRun(base, { decisions: { '2': { expected: {}, additional: {}, added_findings: [], approved: false, note: '', ...d } } });
};
const case2 = (p: TestProject) => reviewEvaluation(p, accuracyMetric).find((r) => r.testCase.id === '2')!;

describe('marking "Not found" an expected error a finding clearly matched (T417)', () => {
  it('the finding becomes an undecided additional finding and the case awaits verification', () => {
    const r = case2(withDecisions({ expected: { e1: { state: 'missed', source: 'manual' } } }));
    const moved = r.effective!.additional.find((a) => a.key === 'claims[]#1');
    expect(moved).toMatchObject({ text: 'Anna is a doctor.', state: 'undecided' });
    expect(r.status).toBe('awaiting');
  });

  it('once marked, it counts in findings_total, which stays what the judge reported', () => {
    const before = computeResults(withDecisions({}), accuracyMetric).counters.findings_total;
    const marked = withDecisions({ expected: { e1: { state: 'missed', source: 'manual' } }, additional: { 'claims[]#1': { state: 'false_positive', source: 'manual' } } });
    const r = case2(marked);
    expect(r.effective!.additional.find((a) => a.key === 'claims[]#1')?.state).toBe('false_positive');
    expect(computeResults(marked, accuracyMetric).counters.findings_total).toBe(before);
  });

  it('marked "Found" again, it is a correct finding again and no additional finding', () => {
    const r = case2(withDecisions({ expected: { e1: { state: 'found', source: 'manual' } } }));
    expect(r.effective!.additional.some((a) => a.key === 'claims[]#1')).toBe(false);
    expect(r.effective!.expected.find((e) => e.id === 'e1')?.attachedKeys).toContain('claims[]#1');
  });
});
