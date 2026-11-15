// Who may be changed, and how late changes are marked (FR-017, FR-025, FR-039, FR-053, FR-089).
import type { ChangedAfterFirstReply, Reply, TestCase } from '../model';

export type CaseAction = 'rename' | 'remove' | 'correct';
export type CaseChange = { allowed: true } | { allowed: false; reason: string };

export function canChangeCase(cases: readonly TestCase[], _replies: Readonly<Record<string, Reply>>, _finalized: boolean, id: string, action: CaseAction): CaseChange {
  if (action === 'remove') {
    const dependants = cases.filter((c) => c.base === id);
    if (dependants.length > 0) {
      return { allowed: false, reason: `This case is the base of ${dependants.map((c) => `"${c.name}"`).join(', ')}. Remove those cases first.` };
    }
  }
  return { allowed: true };
}

/** After the first reply, a new case is "added" and a corrected one "corrected"; an added case stays "added". */
export function markLate(testCase: TestCase, hasReplies: boolean, change: ChangedAfterFirstReply): TestCase {
  if (!hasReplies) return testCase;
  if (change === 'corrected' && testCase.changed_after_first_reply === 'added') return testCase;
  return { ...testCase, changed_after_first_reply: change };
}
