import type { Need, TestProjectFeedback } from '../../../core/cases/feedback';

const total = (label: string, n: Need) => `${label}: ${n.have} of ${n.need} (${n.met ? 'met' : `${n.missing} missing`})`;
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The test size against the minimums, the balance by number of errors, and the sentence about the final answer (FR-045, FR-052). */
export function TestSize({ feedback }: { feedback: TestProjectFeedback }) {
  const errorsLabel = feedback.size.unit === 'injected errors' ? 'Injected errors' : 'Cases with expected errors';
  return (
    <div role="group" aria-label="Test size" class="test-size">
      <p>{total(errorsLabel, feedback.size.errors)}</p>
      <p>{total('Clean cases', feedback.size.clean)}</p>
      {feedback.byErrorCount.length > 0 ? (
        <p class="muted">{feedback.byErrorCount.map((g) => `${plural(g.cases, 'case', 'cases')} with ${plural(g.errors, 'error', 'errors')}`).join(', ')}</p>
      ) : null}
      <p>{feedback.size.sentence}</p>
    </div>
  );
}
