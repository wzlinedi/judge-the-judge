// Case status (data-model.md, FR-064).
import type { Effective } from './decisions';

export type CaseStatus = 'not_run' | 'awaiting' | 'pass' | 'fail';

/** `null` means the case has no reply yet. */
export function caseStatus(effective: Effective | null): CaseStatus {
  if (effective === null) return 'not_run';
  const undecided = effective.expected.some((e) => e.state === 'undecided') || effective.additional.some((a) => a.state === 'undecided');
  if (undecided) return 'awaiting';
  if (effective.needsApproval && !effective.approved) return 'awaiting';
  const failed = effective.expected.some((e) => e.state === 'missed') || effective.additional.some((a) => a.state === 'false_positive');
  return failed ? 'fail' : 'pass';
}
