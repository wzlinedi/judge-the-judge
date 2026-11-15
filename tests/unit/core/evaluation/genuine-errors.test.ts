import { describe, expect, it } from 'vitest';
import { genuineErrors } from '../../../../src/core/evaluation/genuine-errors';
import type { EffectiveAdditional } from '../../../../src/core/evaluation/decisions';
import type { ReviewedCase } from '../../../../src/core/evaluation/results';
import type { CaseStatus } from '../../../../src/core/evaluation/status';

const finding = (key: string, state: EffectiveAdditional['state'], text = key): EffectiveAdditional => ({ key, text, rules: [], state, source: 'manual' });

const reviewed = (id: string, status: CaseStatus, additional: EffectiveAdditional[]): ReviewedCase => ({
  testCase: { id, name: `Case ${id}`, fields: {}, expected_errors: [] },
  review: null,
  effective: { expected: [], additional, approved: false, needsApproval: false, orphans: { expected: [], additional: [] } },
  status,
  findings: [],
});

describe('genuineErrors (T259)', () => {
  it('lists every finding marked Genuine error in a decided case, with its case, in the order of the cases', () => {
    const list = genuineErrors([
      reviewed('1', 'pass', [finding('a', 'false_positive'), finding('b', 'real_error', 'lives with his brother')]),
      reviewed('2', 'awaiting', [finding('c', 'real_error')]),
      reviewed('3', 'fail', [finding('d', 'real_error', ''), finding('e', 'ignored')]),
    ]);
    expect(list).toEqual([
      { caseId: '1', caseName: 'Case 1', text: 'lives with his brother' },
      { caseId: '3', caseName: 'Case 3', text: '' },
    ]);
  });

  it('is empty when no finding is a genuine error', () => {
    expect(genuineErrors([reviewed('1', 'pass', [finding('a', 'false_positive')])])).toEqual([]);
  });
});
