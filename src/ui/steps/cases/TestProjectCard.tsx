import { testProjectFeedback, type Need } from '../../../core/cases/feedback';
import { readabilityWarnings } from '../../../core/judge/readability';
import type { AppState } from '../../../app/store';
import { useVersions } from '../run/useVersions';

const total = (label: string, n: Need) => `${label}: ${n.have} of ${n.need} (${n.met ? 'met' : `${n.missing} missing`})`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The test project card (FR-045, FR-046): what is built so far, whether it is big enough, and what to fix. It has no unsaved indicator: the header has the one. */
export function TestProjectCard({ state }: { state: AppState }) {
  const { evaluation } = state;
  const versions = useVersions(evaluation);
  const f = testProjectFeedback(evaluation);
  const warnings = [...f.warnings, ...readabilityWarnings(evaluation.judge_set)];
  const errorsLabel = f.size.unit === 'injected errors' ? 'Injected errors' : 'Cases with expected errors';

  return (
    <section role="region" aria-label="Test project" class="card test-project-card">
      <h2>Test project</h2>
      <p>
        <strong>{evaluation.dataset.name}</strong>
        {versions.cases ? <span class="muted">{` · Test cases version ${versions.cases}`}</span> : null}
      </p>
      <p>{`${plural(f.total, 'test case', 'test cases')}: ${f.withErrors} with injected errors, ${f.clean} clean, ${f.withReply} with a reply.`}</p>

      <div role="group" aria-label="Test size" class="test-size">
        <p>{total(errorsLabel, f.size.errors)}</p>
        <p>{total('Clean cases', f.size.clean)}</p>
        {f.byErrorCount.length > 0 ? (
          <p class="muted">{f.byErrorCount.map((g) => `${plural(g.cases, 'case', 'cases')} with ${plural(g.errors, 'error', 'errors')}`).join(', ')}</p>
        ) : null}
        <p>{f.size.sentence}</p>
      </div>

      {warnings.length > 0 ? (
        <ul class="plain-list notice warn" aria-label="Warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <p class="muted">
        {f.capacity.full
          ? `The limit of ${f.capacity.limit} test cases is reached. Remove a case before adding another.`
          : `${f.capacity.remaining} more ${f.capacity.remaining === 1 ? 'test case' : 'test cases'} can be added (${f.capacity.limit} at most).`}
      </p>
    </section>
  );
}
