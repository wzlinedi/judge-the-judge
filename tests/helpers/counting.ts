import type { CountInput } from '../../src/core/evaluation/counters';
import type { Effective, EffectiveAdditional, EffectiveExpected } from '../../src/core/evaluation/decisions';
import type { CaseStatus } from '../../src/core/evaluation/status';
import type { TestCase } from '../../src/core/model';

export const exp = (id: string, state: EffectiveExpected['state'], attached = 1): EffectiveExpected => ({ id, state, source: 'automatic', attached });
export const add = (key: string, state: EffectiveAdditional['state'], more: Partial<EffectiveAdditional> = {}): EffectiveAdditional => ({
  key,
  text: key,
  rules: ['r1'],
  state,
  source: 'manual',
  ...more,
});
export const effective = (expected: EffectiveExpected[], additional: EffectiveAdditional[] = []): Effective => ({
  expected,
  additional,
  approved: false,
  needsApproval: false,
  orphans: { expected: [], additional: [] },
});
export const kase = (
  id: string,
  errors: Array<{ id: string; category?: string; difficulty?: 'obvious' | 'subtle' }>,
  status: CaseStatus,
  eff: Effective | null,
): CountInput => {
  const testCase: TestCase = { id, name: id, fields: { summary: 's' }, expected_errors: errors.map((e) => ({ description: 'd', ...e })) };
  return { testCase, effective: eff, status };
};
