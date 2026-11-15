// "Real error (missed in scenario)" (T253): an additional finding marked so becomes an expected error of its test case at once, and goes
// back when its mark changes or it is removed. One idempotent reconcile after every change of decisions; pure, no clock.
import { markLate } from '../cases/case-actions';
import type { AddedFinding, AdditionalDecision, CaseDecisions, Evaluation, ExpectedError, TestCase } from '../model';
import type { ReviewedCase } from './results';

export interface Promotion {
  evaluation: Evaluation;
  /** What the user is told, one sentence each. */
  notes: string[];
}

const WHOLE_REPLY = 'A finding about the whole reply that the test case did not expect.';

const nextId = (errors: readonly ExpectedError[]): string => {
  const used = new Set(errors.map((e) => e.id));
  let n = errors.length;
  do n++;
  while (used.has(`e${n}`));
  return `e${n}`;
};

/** Replaces one test case, drops the stored test cases version and marks the case as corrected after the first reply. */
function withCase(evaluation: Evaluation, testCase: TestCase, errors: ExpectedError[], decisions: CaseDecisions): Evaluation {
  const { version: _stale, ...dataset } = evaluation.dataset;
  const hasReplies = Object.keys(evaluation.replies).length > 0;
  const changed = markLate({ ...testCase, expected_errors: errors }, hasReplies, 'corrected');
  return { ...evaluation, dataset: { ...dataset, cases: evaluation.dataset.cases.map((c) => (c.id === testCase.id ? changed : c)) }, decisions: { ...evaluation.decisions, [testCase.id]: decisions } };
}

const label = (errors: readonly ExpectedError[], id: string) => `E${errors.findIndex((e) => e.id === id) + 1}`;

/**
 * Makes the expected errors of one case agree with its marks: every finding marked real that has no expected error gets one, and every
 * expected error whose finding is no longer marked real goes. `reviewed` is the case as it was read before or after the change; it gives
 * the text of the findings of the reply.
 */
export function syncPromotions(evaluation: Evaluation, reviewed: ReviewedCase): Promotion {
  const caseId = reviewed.testCase.id;
  const stored = evaluation.decisions[caseId];
  const testCase = evaluation.dataset.cases.find((c) => c.id === caseId);
  if (!stored || !testCase) return { evaluation, notes: [] };

  const texts = new Map((reviewed.effective?.additional ?? []).map((a) => [a.key, a]));
  const decisions = structuredClone(stored);
  let errors = [...testCase.expected_errors];
  const notes: string[] = [];

  const remove = (id: string) => {
    if (!errors.some((e) => e.id === id)) return;
    notes.push(`Removed from the expected errors of case ${caseId}: ${label(errors, id)}.`);
    errors = errors.filter((e) => e.id !== id);
    delete decisions.expected[id];
  };
  const add = (text: string, category: string | undefined, difficulty: ExpectedError['difficulty']): string => {
    const id = nextId(errors);
    delete decisions.expected[id];
    errors.push({ id, description: text === '' ? WHOLE_REPLY : text, ...(category ? { category } : {}), ...(text !== '' ? { fragment: text } : {}), ...(difficulty ? { difficulty } : {}) });
    notes.push(`Added to the expected errors of case ${caseId} as ${label(errors, id)}.`);
    return id;
  };

  for (const [key, d] of Object.entries(decisions.additional) as Array<[string, AdditionalDecision]>) {
    if (d.promoted_to !== undefined && d.state !== 'real_error') {
      remove(d.promoted_to);
      delete d.promoted_to;
    } else if (d.state === 'real_error' && (d.promoted_to === undefined || !errors.some((e) => e.id === d.promoted_to))) {
      const item = texts.get(key);
      if (item) d.promoted_to = add(item.text, item.category, item.difficulty);
    }
  }
  decisions.added_findings.forEach((f: AddedFinding) => {
    if (f.promoted_to !== undefined && f.state !== 'real_error') {
      remove(f.promoted_to);
      delete f.promoted_to;
    } else if (f.state === 'real_error' && (f.promoted_to === undefined || !errors.some((e) => e.id === f.promoted_to))) {
      f.promoted_to = add(f.text, f.category, f.difficulty);
    }
  });

  if (notes.length === 0) return { evaluation, notes };
  return { evaluation: withCase(evaluation, testCase, errors, decisions), notes };
}

/** Removing a finding added by hand takes the expected error it made with it; the finding itself is removed by the caller. */
export function dropPromotion(evaluation: Evaluation, caseId: string, addedIndex: number): Evaluation {
  const stored = evaluation.decisions[caseId];
  const testCase = evaluation.dataset.cases.find((c) => c.id === caseId);
  const id = stored?.added_findings[addedIndex]?.promoted_to;
  if (!stored || !testCase || id === undefined) return evaluation;
  const decisions = structuredClone(stored);
  delete decisions.expected[id];
  const finding = decisions.added_findings[addedIndex] as AddedFinding;
  delete finding.promoted_to;
  return withCase(evaluation, testCase, testCase.expected_errors.filter((e) => e.id !== id), decisions);
}
