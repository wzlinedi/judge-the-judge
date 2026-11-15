// The preview of an LLM opinion and its application (FR-063, SC-028). Nothing changes until the user applies it.
import type { AdditionalState, CaseDecisions, Difficulty, ExpectedState, TestCase, VerificationOpinion } from '../model';
import type { Effective, EffectiveSource } from './decisions';

export const NO_ANSWER = 'The LLM opinion gave no answer for this item';

export interface PlannedMark {
  /** E1…, A1…: the number the verification prompt gave the item. */
  label: string;
  kind: 'expected' | 'additional';
  /** The expected error id, or the key of the additional finding. */
  target: string;
  /** Position in `added_findings` when the item is a finding added by hand or by an opinion. */
  added?: number;
  from: { state: string; source: EffectiveSource };
  to: ExpectedState | AdditionalState;
  /** `same` is "no change": the answer agrees with the mark. */
  change: 'set' | 'same';
  replacesHand: boolean;
  replacesOpinion: boolean;
  reason?: string;
  fragment?: string;
}

export interface PlannedNew {
  text: string;
  real: boolean;
  reason?: string;
  fragment?: string;
  category?: string;
  difficulty?: Difficulty;
}

export interface OpinionPlan {
  marks: PlannedMark[];
  newFindings: PlannedNew[];
  unanswered: Array<{ label: string; reason: string; undecided: boolean }>;
  notes: string[];
  itemCount: number;
  canApply: boolean;
  classifiesNone: boolean;
  /** Said when the opinion cannot be applied because it classifies nothing. */
  message?: string;
}

export function opinionPlan(testCase: Pick<TestCase, 'expected_errors'>, effective: Effective, opinion: VerificationOpinion): OpinionPlan {
  const marks: PlannedMark[] = [];
  const unanswered: OpinionPlan['unanswered'] = [];
  const notes: string[] = [];

  const note = (label: string, count: number) => count > 1 && notes.push(`The opinion has ${count} entries for ${label}; only the first answer was used.`);

  effective.expected.forEach((item, i) => {
    const label = `E${i + 1}`;
    const entries = opinion.expected.filter((e) => e.index === i + 1);
    const answer = entries.find((e) => typeof e.found === 'boolean');
    note(label, entries.length);
    if (!answer) {
      unanswered.push({
        label,
        undecided: item.state === 'undecided',
        reason: entries.length === 0 ? 'The opinion has no entry with this number.' : 'Its entry has no true or false for "found".',
      });
      return;
    }
    const to: ExpectedState = answer.found ? 'found' : 'missed';
    const same = item.state === to;
    marks.push({
      label,
      kind: 'expected',
      target: item.id,
      from: { state: item.state, source: item.source },
      to,
      change: same ? 'same' : 'set',
      replacesHand: !same && item.source === 'manual',
      replacesOpinion: !same && item.source === 'llm-approved',
      ...(answer.reason ? { reason: answer.reason } : {}),
      ...(answer.fragment ? { fragment: answer.fragment } : {}),
    });
  });

  effective.additional.forEach((item, i) => {
    const label = `A${i + 1}`;
    const entries = opinion.additional.filter((e) => e.index === i + 1);
    const answer = entries.find((e) => typeof e.real === 'boolean');
    note(label, entries.length);
    if (!answer) {
      unanswered.push({
        label,
        undecided: item.state === 'undecided',
        reason: entries.length === 0 ? 'The opinion has no entry with this number.' : 'Its entry has no true or false for "real".',
      });
      return;
    }
    const to: AdditionalState = answer.real ? 'real_error' : 'false_positive';
    const same = item.state === to;
    marks.push({
      label,
      kind: 'additional',
      target: item.key,
      ...(item.added !== undefined ? { added: item.added } : {}),
      from: { state: item.state, source: item.source },
      to,
      change: same ? 'same' : 'set',
      replacesHand: !same && item.source === 'manual',
      replacesOpinion: !same && item.source === 'llm-approved',
      ...(answer.reason ? { reason: answer.reason } : {}),
      ...(answer.fragment ? { fragment: answer.fragment } : {}),
    });
  });

  for (const e of opinion.expected) {
    if (e.index > effective.expected.length) notes.push(`The opinion has an entry for E${e.index}, but this case has ${effective.expected.length} expected errors.`);
  }
  for (const a of opinion.additional) {
    if (a.index > effective.additional.length) notes.push(`The opinion has an entry for A${a.index}, but this case has ${effective.additional.length} additional findings.`);
  }

  const newFindings: PlannedNew[] = opinion.new.map((n) => ({
    text: n.text,
    real: n.real,
    ...(n.reason ? { reason: n.reason } : {}),
    ...(n.fragment ? { fragment: n.fragment } : {}),
    ...(n.category ? { category: n.category } : {}),
    ...(n.difficulty ? { difficulty: n.difficulty } : {}),
  }));

  const itemCount = effective.expected.length + effective.additional.length;
  const classifiesNone = marks.length === 0 && newFindings.length === 0;
  return {
    marks,
    newFindings,
    unanswered,
    notes,
    itemCount,
    canApply: !classifiesNone,
    classifiesNone,
    ...(classifiesNone ? { message: `The opinion classifies none of the ${itemCount} items of this case. Nothing will change.` } : {}),
  };
}

/** The decisions after the user applied the opinion: every answered item with the source `llm-approved`, the new findings added, the case approved. */
export function applyOpinion(decisions: CaseDecisions | undefined, plan: OpinionPlan): CaseDecisions {
  const base: CaseDecisions = decisions ?? { expected: {}, additional: {}, added_findings: [], approved: false, note: '' };
  if (!plan.canApply) return base;
  const next = structuredClone(base);
  for (const m of plan.marks) {
    if (m.kind === 'expected') next.expected[m.target] = { state: m.to as ExpectedState, source: 'llm-approved' };
    else if (m.added !== undefined && next.added_findings[m.added]) next.added_findings[m.added] = { ...(next.added_findings[m.added] as CaseDecisions['added_findings'][number]), state: m.to as AdditionalState, source: 'llm-approved' };
    else next.additional[m.target] = { state: m.to as AdditionalState, source: 'llm-approved' };
  }
  for (const n of plan.newFindings) {
    next.added_findings.push({
      text: n.text,
      ...(n.category ? { category: n.category } : {}),
      ...(n.difficulty ? { difficulty: n.difficulty } : {}),
      from_opinion: true,
      state: n.real ? 'real_error' : 'false_positive',
      source: 'llm-approved',
    });
  }
  next.approved = true;
  return next;
}
