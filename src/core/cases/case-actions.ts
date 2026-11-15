// Who may be changed, and how late changes are marked (FR-017, FR-025, FR-039, FR-053, FR-089).
import type { ChangedAfterFirstReply, Reply, TestCase } from '../model';

export type CaseAction = 'rename' | 'remove' | 'correct';
export type CaseChange = { allowed: true } | { allowed: false; reason: string };

/** Every case may be changed at any time: a case is independent once it is made, so a base in use may be removed too (T283). */
export function canChangeCase(_cases: readonly TestCase[], _replies: Readonly<Record<string, Reply>>, _finalized: boolean, _id: string, _action: CaseAction): CaseChange {
  return { allowed: true };
}

/** After the first reply, a new case is "added" and a corrected one "corrected"; an added case stays "added". */
export function markLate(testCase: TestCase, hasReplies: boolean, change: ChangedAfterFirstReply): TestCase {
  if (!hasReplies) return testCase;
  if (change === 'corrected' && testCase.changed_after_first_reply === 'added') return testCase;
  return { ...testCase, changed_after_first_reply: change };
}
