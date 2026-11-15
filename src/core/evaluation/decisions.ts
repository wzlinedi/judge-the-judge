// What the user settled, laid over the automatic result (data-model.md, CaseDecisions).
import type { AddedFinding, AdditionalState, CaseDecisions, DecisionSource, Difficulty, ExpectedState } from '../model';
import type { CaseReview } from './review';

export type EffectiveSource = 'automatic' | DecisionSource;

export interface EffectiveExpected {
  id: string;
  state: ExpectedState | 'undecided';
  source: EffectiveSource;
  reason?: string;
  /** Findings counted as correct for this error when it is found (at least one). */
  attached: number;
  /** Made by a "Real error (missed in scenario)" mark (T253): it is found by definition and has no marks of its own. */
  promoted?: boolean;
}

export interface EffectiveAdditional {
  key: string;
  text: string;
  rules: string[];
  state: AdditionalState | 'undecided';
  source: EffectiveSource;
  reason?: string;
  category?: string;
  difficulty?: Difficulty;
  /** Index in `added_findings` when it was added by hand or by an opinion. */
  added?: number;
  fromOpinion?: boolean;
  /** A partial finding that moved here because its expected error was decided missed. */
  moved?: boolean;
  /** The expected error that this real-error finding made; it is counted there, once (T253). */
  promotedTo?: string;
}

export interface Effective {
  expected: EffectiveExpected[];
  additional: EffectiveAdditional[];
  approved: boolean;
  needsApproval: boolean;
  orphans: { expected: string[]; additional: string[] };
}

/** The expected errors that real-error marks made, with the source of the mark (T253). */
export function promotedErrors(decisions: CaseDecisions | undefined, replyKeys?: ReadonlySet<string>): Map<string, DecisionSource> {
  const found = new Map<string, DecisionSource>();
  if (!decisions) return found;
  // a link of a finding that the reply no longer has (after a correction of the rules, FR-053) is left out
  for (const [key, d] of Object.entries(decisions.additional)) if (d.state === 'real_error' && d.promoted_to !== undefined && (replyKeys === undefined || replyKeys.has(key))) found.set(d.promoted_to, d.source);
  for (const f of decisions.added_findings) if (f.state === 'real_error' && f.promoted_to !== undefined) found.set(f.promoted_to, f.source);
  return found;
}

/**
 * `order` is the identifiers of the expected errors of the case, in order: the review leaves out the expected errors that a real-error
 * mark made (they are never matched), and they are put back here, found, where the case lists them.
 */
export function applyDecisions(review: CaseReview, decisions: CaseDecisions | undefined, order?: readonly string[]): Effective {
  const stored = decisions ?? { expected: {}, additional: {}, added_findings: [] as AddedFinding[], approved: false, note: '' };
  const replyKeys = new Set([...review.additional, ...review.partialOnly].map((f) => f.key));
  for (const e of review.expected) for (const k of [...e.clear, ...e.partial]) replyKeys.add(k);
  const promoted = promotedErrors(decisions, replyKeys);

  const reviewed: EffectiveExpected[] = review.expected.map((e) => {
    const decision = stored.expected[e.id];
    const state = decision ? decision.state : e.state;
    return {
      id: e.id,
      state,
      source: decision ? decision.source : 'automatic',
      ...(state === 'undecided' && e.reason ? { reason: e.reason } : {}),
      // Findings counted as correct for a found error: those that clearly matched it, else those that
      // partly matched it (found by hand), and at least one.
      attached: state === 'found' ? (e.clear.length > 0 ? e.clear.length : Math.max(1, e.partial.length)) : 0,
    };
  });
  const byId = new Map(reviewed.map((e) => [e.id, e]));
  for (const [id, source] of promoted) if (!byId.has(id) && (order?.includes(id) ?? false)) byId.set(id, { id, state: 'found', source, attached: 1, promoted: true });
  const expected: EffectiveExpected[] = order ? order.flatMap((id) => (byId.has(id) ? [byId.get(id) as EffectiveExpected] : [])) : reviewed;
  const stateOf = new Map(expected.map((e) => [e.id, e.state]));

  // Findings that only partly resembled an error: they wait while any such error is undecided,
  // count as correct when one is found, and become additional findings otherwise.
  const moved: EffectiveAdditional[] = [];
  for (const finding of review.partialOnly) {
    const resembled = review.expected.filter((e) => e.partial.includes(finding.key)).map((e) => stateOf.get(e.id));
    if (resembled.some((s) => s === 'undecided' || s === 'found')) continue;
    moved.push({ ...undecidedFinding(finding), moved: true, ...applyStored(finding.key, stored) });
  }

  const own: EffectiveAdditional[] = review.additional.map((f) => ({ ...undecidedFinding(f), ...applyStored(f.key, stored) }));
  const linked = (id: string | undefined): { promotedTo: string } | Record<string, never> => (id !== undefined && promoted.has(id) ? { promotedTo: id } : {});
  const added: EffectiveAdditional[] = stored.added_findings.map((f, index) => ({
    key: `added#${index + 1}`,
    text: f.text,
    rules: [],
    state: f.state,
    source: f.source,
    ...(f.category !== undefined ? { category: f.category } : {}),
    ...(f.difficulty !== undefined ? { difficulty: f.difficulty } : {}),
    added: index,
    ...(f.from_opinion ? { fromOpinion: true } : {}),
    ...(f.state === 'real_error' ? linked(f.promoted_to) : {}),
  }));

  const knownKeys = new Set([...review.additional, ...review.partialOnly].map((f) => f.key));
  for (const e of review.expected) for (const k of [...e.clear, ...e.partial]) knownKeys.add(k);
  const orphans = {
    expected: Object.keys(stored.expected).filter((id) => !stateOf.has(id)),
    additional: Object.keys(stored.additional).filter((key) => !knownKeys.has(key)),
  };

  // a link to an expected error that the case no longer has counts for nothing: the finding is an ordinary one
  const unlinked = (a: EffectiveAdditional): EffectiveAdditional => {
    if (a.promotedTo === undefined || (stateOf.has(a.promotedTo) && promoted.has(a.promotedTo))) return a;
    const { promotedTo: _gone, ...rest } = a;
    return rest;
  };
  return { expected, additional: [...own, ...moved, ...added].map(unlinked), approved: stored.approved, needsApproval: review.needsApproval, orphans };
}

function undecidedFinding(finding: { key: string; text: string; rules: string[] }): EffectiveAdditional {
  return { key: finding.key, text: finding.text, rules: finding.rules, state: 'undecided', source: 'automatic' };
}

function applyStored(key: string, stored: CaseDecisions): Partial<EffectiveAdditional> {
  const decision = stored.additional[key];
  if (!decision) return {};
  return { state: decision.state, source: decision.source, ...(decision.state === 'real_error' && decision.promoted_to !== undefined ? { promotedTo: decision.promoted_to } : {}) };
}
