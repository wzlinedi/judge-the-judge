// The preview of an opinion and its application (FR-063, SC-028).
import { describe, expect, it } from 'vitest';
import { applyOpinion, NO_ANSWER, opinionPlan } from '../../../../src/core/evaluation/opinions';
import { reviewEvaluation } from '../../../../src/core/evaluation/results';
import type { VerificationOpinion } from '../../../../src/core/model';
import { accuracyMetric, sampleEvaluation } from '../../../helpers/fixtures';

/** Case 2 of the sample: E1 and E2 found automatically, A1 a real error set by hand, A2 a false positive from an earlier opinion. */
const evaluation = sampleEvaluation();
const reviewed = reviewEvaluation(evaluation, accuracyMetric).find((r) => r.testCase.id === '2')!;
const opinion = (over: Partial<VerificationOpinion>): VerificationOpinion => ({ id: '2', expected: [], additional: [], new: [], ...over });
const plan = (o: VerificationOpinion) => opinionPlan(reviewed.testCase, reviewed.effective!, o);

describe('opinionPlan', () => {
  it('answers an item only with found or real as true or false', () => {
    const p = plan(opinion({ expected: [{ index: 1, reason: 'unsure' }, { index: 2, found: false }] }));
    expect(p.marks.map((m) => m.label)).toEqual(['E2']);
    expect(p.unanswered.map((u) => u.label)).toEqual(['E1', 'A1', 'A2']);
  });

  it('lists per answered item the current mark and source and the new mark, with reason and fragment', () => {
    const p = plan(opinion({ expected: [{ index: 2, found: false, reason: 'no finding', fragment: 'second oven in 2005' }] }));
    expect(p.marks).toHaveLength(1);
    expect(p.marks[0]).toMatchObject({ label: 'E2', kind: 'expected', from: { state: 'found', source: 'automatic' }, to: 'missed', change: 'set', replacesHand: false, reason: 'no finding', fragment: 'second oven in 2005' });
  });

  it('flags a mark that replaces one set by hand, and one from an earlier opinion', () => {
    const p = plan(opinion({ additional: [{ index: 1, real: false, reason: 'no' }, { index: 2, real: true }] }));
    expect(p.marks[0]).toMatchObject({ label: 'A1', from: { state: 'real_error', source: 'manual' }, to: 'false_positive', replacesHand: true, replacesOpinion: false });
    expect(p.marks[1]).toMatchObject({ label: 'A2', from: { state: 'false_positive', source: 'llm-approved' }, to: 'real_error', replacesHand: false, replacesOpinion: true });
  });

  it('calls answers that agree with the current mark "no change"', () => {
    const p = plan(opinion({ expected: [{ index: 1, found: true }], additional: [{ index: 1, real: true }] }));
    expect(p.marks.map((m) => m.change)).toEqual(['same', 'same']);
    expect(p.marks.every((m) => !m.replacesHand)).toBe(true);
    expect(p.canApply).toBe(true);
  });

  it('lists new findings with text, real, optional category and difficulty', () => {
    const p = plan(opinion({ new: [{ text: 'The cat is blue', real: true, reason: 'r', category: 'factual-error', difficulty: 'subtle' }, { text: 'Other', real: false }] }));
    expect(p.newFindings).toEqual([
      { text: 'The cat is blue', real: true, reason: 'r', category: 'factual-error', difficulty: 'subtle' },
      { text: 'Other', real: false },
    ]);
    expect(p.canApply).toBe(true);
    expect(p.classifiesNone).toBe(false);
  });

  it('lists unanswered items with the reason', () => {
    const p = plan(opinion({ expected: [{ index: 1, found: true }] }));
    expect(p.unanswered.map((u) => u.label)).toEqual(['E2', 'A1', 'A2']);
    expect(p.unanswered.every((u) => u.reason.length > 0)).toBe(true);
  });

  it('says "classifies none" when nothing is answered and nothing is added, and then cannot be applied', () => {
    const p = plan(opinion({ expected: [{ index: 9, found: true }], additional: [{ index: 1, reason: 'unsure' }] }));
    expect(p.classifiesNone).toBe(true);
    expect(p.canApply).toBe(false);
    expect(p.message).toBe('The opinion classifies none of the 4 items of this case. Nothing will change.');
    expect(p.unanswered).toHaveLength(4);
    expect(p.notes.join(' ')).toMatch(/E9/);
  });

  it('ignores a second entry for the same item and says so', () => {
    const p = plan(opinion({ expected: [{ index: 1, found: false }, { index: 1, found: true }] }));
    expect(p.marks).toHaveLength(1);
    expect(p.marks[0]?.to).toBe('missed');
    expect(p.notes.join(' ')).toMatch(/E1/);
  });

  it('has a fixed sentence for an item that got no answer', () => {
    expect(NO_ANSWER).toBe('The LLM opinion gave no answer for this item');
  });
});

describe('applyOpinion', () => {
  const decisions = evaluation.decisions['2']!;

  it('sets every answered item, hand-set ones included, with the source llm-approved, and approves the case', () => {
    const p = plan(opinion({ expected: [{ index: 1, found: true }, { index: 2, found: false }], additional: [{ index: 1, real: false }, { index: 2, real: false }] }));
    const after = applyOpinion(decisions, p);
    expect(after.expected).toEqual({ e1: { state: 'found', source: 'llm-approved' }, e2: { state: 'missed', source: 'llm-approved' } });
    expect(after.added_findings[0]).toMatchObject({ text: 'The oven was never bought', state: 'false_positive', source: 'llm-approved' });
    expect(after.added_findings[1]).toMatchObject({ state: 'false_positive', source: 'llm-approved' });
    expect(after.approved).toBe(true);
    expect(after.note).toBe('checked by hand');
  });

  it('adds new findings as added findings with from_opinion, category and difficulty', () => {
    const p = plan(opinion({ new: [{ text: 'The cat is blue', real: true, category: 'factual-error', difficulty: 'subtle' }, { text: 'Other', real: false }] }));
    const after = applyOpinion(decisions, p);
    expect(after.added_findings.slice(2)).toEqual([
      { text: 'The cat is blue', category: 'factual-error', difficulty: 'subtle', from_opinion: true, state: 'real_error', source: 'llm-approved' },
      { text: 'Other', from_opinion: true, state: 'false_positive', source: 'llm-approved' },
    ]);
  });

  it('leaves the items the opinion does not answer as they are', () => {
    const p = plan(opinion({ expected: [{ index: 2, found: false }] }));
    const after = applyOpinion(decisions, p);
    expect(after.expected).toEqual({ e2: { state: 'missed', source: 'llm-approved' } });
    expect(after.added_findings[0]).toEqual(decisions.added_findings[0]);
  });

  it('works on a case that has no decisions yet, and does not change what it is given', () => {
    const frozen = JSON.stringify(decisions);
    const p = plan(opinion({ expected: [{ index: 1, found: false }] }));
    const after = applyOpinion(undefined, p);
    expect(after).toEqual({ expected: { e1: { state: 'missed', source: 'llm-approved' } }, additional: {}, added_findings: [], approved: true, note: '' });
    applyOpinion(decisions, p);
    expect(JSON.stringify(decisions)).toBe(frozen);
  });

  it('changes nothing for a plan that cannot be applied', () => {
    const p = plan(opinion({}));
    expect(p.canApply).toBe(false);
    expect(applyOpinion(decisions, p)).toEqual(decisions);
  });
});
