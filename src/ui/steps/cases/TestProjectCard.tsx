import { testProjectFeedback } from '../../../core/cases/feedback';
import { isStarted } from '../../../core/cases/test-run';
import { readabilityWarnings } from '../../../core/judge/readability';
import type { AppState } from '../../../app/store';
import { useVersions } from '../run/useVersions';
import { plural, TestSize } from './TestSize';

/** The test project card (FR-045, FR-046): what is built so far, whether it is big enough, and what to fix. It has no unsaved indicator: the header has the one. */
export function TestProjectCard({ state }: { state: AppState }) {
  const { project: evaluation } = state;
  const versions = useVersions(evaluation);
  const f = testProjectFeedback(evaluation);
  const warnings = [...f.warnings, ...readabilityWarnings(evaluation.judge_set)];

  return (
    <section role="region" aria-label="Test project" class="card test-project-card">
      <h2>Test project</h2>
      <p>
        <strong>{evaluation.dataset.name}</strong>
        {versions.cases ? <span class="muted">{` · Test cases version ${versions.cases}`}</span> : null}
      </p>
      {isStarted(evaluation) ? <p class="muted">The test run has started: the judge prompt and the fields of every case are fixed.</p> : null}
      <p>{`${plural(f.total, 'test case', 'test cases')}: ${f.withErrors} with injected errors, ${f.clean} clean, ${f.withReply} with a reply.`}</p>

      <TestSize feedback={f} />

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
