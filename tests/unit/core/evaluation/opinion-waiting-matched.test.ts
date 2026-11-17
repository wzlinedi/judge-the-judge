// T454 (code review finding 4; FR-063): the second opinion and the findings that wait for an undecided expected error. A finding that clearly
// matches an error that is undecided (for example when the reply lacks a field a rule needs) is numbered in the prompt like one that only
// partly matches; the plan of a waiting finding starts from its stored mark; and the preview says when the mark of a waiting finding counts.
import { describe, expect, it } from 'vitest';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import { opinionItems } from '../../../../src/core/evaluation/opinion-items';
import { applyOpinion, opinionPlan } from '../../../../src/core/evaluation/opinions';
import { reviewCase } from '../../../../src/core/evaluation/review';
import { verificationPrompt } from '../../../../src/core/generation/verification-prompt';
import type { FindingsResult } from '../../../../src/core/judge/findings';
import type { CaseDecisions, TestCase, VerificationOpinion } from '../../../../src/core/model';
import { sampleProject } from '../../../helpers/fixtures';

const params = { match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 };
const testCase: TestCase = {
  id: '1',
  name: 'c',
  fields: { summary: 's' },
  expected_errors: [
    { id: 'e1', description: 'd1', fragment: 'Anna is a doctor' },
    { id: 'e2', description: 'd2', fragment: 'the bridge was opened in Krakow' },
  ],
};
/** c#1 clearly matches E1; c#2 only partly matches E2; the reply lacks a field a rule needs, so both errors are undecided. */
const findings: FindingsResult['findings'] = [
  { key: 'c#1', text: 'Anna is a doctor', rules: ['r'] },
  { key: 'c#2', text: 'the old bridge', rules: ['r'] },
];
const review = reviewCase(testCase, { readable: true, findings, unknown: ['claims[].verdict'] }, params, 'per_expected_error');
const reviewedWith = (decisions?: CaseDecisions) => ({ testCase, review, effective: applyDecisions(review, decisions), status: 'awaiting' as const, findings });
const decisionsWith = (additional: CaseDecisions['additional']): CaseDecisions => ({ expected: {}, additional, added_findings: [], approved: false, note: '' });
const opinion = (over: Partial<VerificationOpinion>): VerificationOpinion => ({ id: '1', expected: [], additional: [], new: [], ...over });

describe('the waiting findings of the second opinion (T454, code review finding 4)', () => {
  it('(setup) both errors are undecided; c#1 matches E1 clearly and c#2 matches E2 partly', () => {
    expect(review.expected.map((e) => e.state)).toEqual(['undecided', 'undecided']);
    expect(review.expected[0]!.clear).toEqual(['c#1']);
    expect(review.expected[1]!.partial).toEqual(['c#2']);
    expect(reviewedWith().effective.additional).toEqual([]);
  });

  it('(a) lists a finding that clearly matches an undecided error among the waiting findings, and the prompt says "(matches E1)"', () => {
    const { waiting } = opinionItems(reviewedWith());
    expect(waiting.map((w) => w.key).sort()).toEqual(['c#1', 'c#2']);
    const prompt = verificationPrompt(sampleProject(), reviewedWith());
    expect(prompt).toMatch(/A\d\. "Anna is a doctor" \(rule: r\) \(matches E1\)/);
    expect(prompt).toMatch(/A\d\. "the old bridge" \(rule: r\) \(partly matches E2\)/);
    expect(prompt).not.toContain('There are no additional findings.');
  });

  it('(a) an opinion on that number marks the finding itself and adds nothing under "new"', () => {
    const reviewed = reviewedWith();
    const { waiting } = opinionItems(reviewed);
    const index = waiting.findIndex((w) => w.key === 'c#1') + 1;
    const plan = opinionPlan(testCase, reviewed.effective, opinion({ additional: [{ index, real: false }] }), waiting);
    expect(plan.marks).toHaveLength(1);
    expect(plan.marks[0]).toMatchObject({ kind: 'additional', target: 'c#1', to: 'false_positive' });
    const decisions = applyOpinion(undefined, plan);
    expect(decisions.additional['c#1']).toEqual({ state: 'false_positive', source: 'llm-approved' });
    expect(decisions.added_findings).toEqual([]);
  });

  it('(b) the plan of a waiting finding starts from its stored mark, set by hand or by an earlier opinion', () => {
    for (const [source, replacesHand, replacesOpinion] of [['manual', true, false], ['llm-approved', false, true]] as const) {
      const decisions = decisionsWith({ 'c#1': { state: 'real_error', source } });
      const reviewed = reviewedWith(decisions);
      const { waiting } = opinionItems(reviewed, decisions);
      const index = waiting.findIndex((w) => w.key === 'c#1') + 1;
      const changed = opinionPlan(testCase, reviewed.effective, opinion({ additional: [{ index, real: false }] }), waiting);
      expect(changed.marks[0]).toMatchObject({ from: { state: 'real_error', source }, change: 'set', replacesHand, replacesOpinion });
      const same = opinionPlan(testCase, reviewed.effective, opinion({ additional: [{ index, real: true }] }), waiting);
      expect(same.marks[0]).toMatchObject({ from: { state: 'real_error', source }, change: 'same', replacesHand: false, replacesOpinion: false });
    }
  });

  it('(c) says that the mark of a waiting finding counts only once its error is decided Not found, unless the opinion decides it', () => {
    const reviewed = reviewedWith();
    const { waiting } = opinionItems(reviewed);
    const index = waiting.findIndex((w) => w.key === 'c#1') + 1;
    const undecided = opinionPlan(testCase, reviewed.effective, opinion({ additional: [{ index, real: false }] }), waiting);
    expect(undecided.marks[0]!.waitsFor).toEqual(['E1']);
    const decided = opinionPlan(testCase, reviewed.effective, opinion({ expected: [{ index: 1, found: false }], additional: [{ index, real: false }] }), waiting);
    expect(decided.marks.find((m) => m.target === 'c#1')!.waitsFor).toBeUndefined();
  });
});
