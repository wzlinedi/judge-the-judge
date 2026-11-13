import { describe, expect, it } from 'vitest';
import { approveCase, setAddedMark, setAdditionalMark, setExpectedMark } from '../../../src/app/actions/decisions';
import { sampleEvaluation } from '../../helpers/fixtures';

describe('decision actions', () => {
  it('set a mark by hand with the source "manual" and leave the old evaluation alone', () => {
    const before = sampleEvaluation();
    const frozen = JSON.stringify(before);
    const after = setExpectedMark(before, '2', 'e1', 'missed');
    expect(JSON.stringify(before)).toBe(frozen);
    expect(after.decisions['2']?.expected['e1']).toEqual({ state: 'missed', source: 'manual' });
  });

  it('create the decisions of a case when it has none', () => {
    const after = setAdditionalMark(sampleEvaluation(), '1', 'claims[]#1', 'false_positive');
    expect(after.decisions['1']).toEqual({ expected: {}, additional: { 'claims[]#1': { state: 'false_positive', source: 'manual' } }, added_findings: [], approved: false, note: '' });
  });

  it('change a mark of a finding added by hand, and make its source "manual"', () => {
    const after = setAddedMark(sampleEvaluation(), '2', 1, 'real_error');
    expect(after.decisions['2']?.added_findings[1]).toMatchObject({ state: 'real_error', source: 'manual', from_opinion: true });
  });

  it('approve a case', () => {
    expect(approveCase(sampleEvaluation(), '1').decisions['1']?.approved).toBe(true);
  });
});
