// The findings marked "Genuine error" (T259): real errors that the test cases did not expect. They stay additional findings and are
// listed in Results, so the owner sees which test cases are not complete. Counted like `real_errors`: decided cases only.
import type { ReviewedCase } from './results';

export interface GenuineError {
  caseId: string;
  caseName: string;
  /** The words of the finding; empty for a finding about the whole reply. */
  text: string;
}

export function genuineErrors(reviewed: readonly ReviewedCase[]): GenuineError[] {
  return reviewed.flatMap(({ testCase, effective, status }) =>
    effective && (status === 'pass' || status === 'fail')
      ? effective.additional.filter((a) => a.state === 'real_error').map((a) => ({ caseId: testCase.id, caseName: testCase.name, text: a.text }))
      : [],
  );
}
