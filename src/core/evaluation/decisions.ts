// What the user settled, laid over the automatic result (data-model.md, CaseDecisions).
import type { AddedFinding, AdditionalState, CaseDecisions, DecisionSource, Difficulty, ExpectedState } from '../model';
import type { CaseReview } from './review';
import { ownValue } from '../cases/test-run';

export type EffectiveSource = 'automatic' | DecisionSource;

export interface EffectiveExpected {
  id: string;
  state: ExpectedState | 'undecided';
  source: EffectiveSource;
  reason?: string;
  /** Findings counted as correct for this error when it is found (at least one). */
  attached: number;
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
}

export interface Effective {
  expected: EffectiveExpected[];
  additional: EffectiveAdditional[];
  approved: boolean;
  needsApproval: boolean;
  orphans: { expected: string[]; additional: string[] };
}

export function applyDecisions(review: CaseReview, decisions: CaseDecisions | undefined): Effective {
  const stored = decisions ?? { expected: {}, additional: {}, added_findings: [] as AddedFinding[], approved: false, note: '' };

  const expected: EffectiveExpected[] = review.expected.map((e) => {
    const decision = ownValue(stored.expected, e.id);
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
  }));

  const knownKeys = new Set([...review.additional, ...review.partialOnly].map((f) => f.key));
  for (const e of review.expected) for (const k of [...e.clear, ...e.partial]) knownKeys.add(k);
  const orphans = {
    expected: Object.keys(stored.expected).filter((id) => !stateOf.has(id)),
    additional: Object.keys(stored.additional).filter((key) => !knownKeys.has(key)),
  };

  return { expected, additional: [...own, ...moved, ...added], approved: stored.approved, needsApproval: review.needsApproval, orphans };
}

function undecidedFinding(finding: { key: string; text: string; rules: string[] }): EffectiveAdditional {
  return { key: finding.key, text: finding.text, rules: finding.rules, state: 'undecided', source: 'automatic' };
}

function applyStored(key: string, stored: CaseDecisions): Partial<EffectiveAdditional> {
  const decision = ownValue(stored.additional, key);
  return decision ? { state: decision.state, source: decision.source } : {};
}
