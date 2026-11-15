import { genuineErrors } from '../../../core/evaluation/genuine-errors';
import type { Results, ReviewedCase } from '../../../core/evaluation/results';
import { MINIMUM_SAMPLE } from '../../../core/evaluation/results';
import type { Evaluation } from '../../../core/model';
import { PER_CASE_SENTENCE } from '../../../core/evaluation/counting-note';
import { DetailsSection } from './DetailsSection';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div class="count">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <div role="group" aria-label={title} class="count-group">
      <h3>{title}</h3>
      <dl>{children}</dl>
    </div>
  );
}

export interface SummaryViewProps {
  results: Results;
  evaluation: Evaluation;
  onThreshold: (measure: string, value: number) => void;
  onLoadChecks: () => void;
  reviewed: readonly ReviewedCase[];
  onOpenCase: (caseId: string) => void;
}

/** The findings marked Genuine error (T259): the test cases did not expect them, so the owner sees which cases are not complete. */
function GenuineErrors({ reviewed, onOpenCase }: { reviewed: readonly ReviewedCase[]; onOpenCase: (caseId: string) => void }) {
  const list = genuineErrors(reviewed);
  if (list.length === 0) return null;
  return (
    <section role="region" aria-label="Genuine errors the test cases missed" class="genuine-errors">
      <h3>Genuine errors the test cases missed</h3>
      <p class="muted">The judge found these errors, and they are genuine, but the test cases do not list them. Consider adding them to the case with Test cases › Open › Edit expected errors.</p>
      <ul class="plain-list">
        {list.map((g, i) => (
          <li key={`${g.caseId}-${i}`}>
            {`Case ${g.caseId} · ${g.caseName}: ${g.text === '' ? 'a finding about the whole reply' : `“${g.text}”`} `}
            <button type="button" class="link-button" onClick={() => onOpenCase(g.caseId)}>
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SummaryView({ results, evaluation, onThreshold, onLoadChecks, reviewed, onOpenCase }: SummaryViewProps) {
  const c = results.counters;
  const rateIds = results.evaluated_per === 'case' ? ['case_detection_rate', 'clean_case_false_positive_rate'] : ['detection_rate', 'false_positive_rate'];
  const ignored = c.ignored_expected + c.ignored_additional;
  const perCase = results.evaluated_per === 'case';
  const have = perCase ? c.defective_cases_decided : c.expected_total;

  return (
    <div class="summary-view">
      <h2 class="visually-hidden">Summary</h2>
      {results.provisional ? (
        <p role="status" aria-label="Provisional" class="notice warn">
          {`These results are provisional: ${results.undecided} ${results.undecided === 1 ? 'case is' : 'cases are'} not decided yet (${c.cases_not_run} not run, ${c.cases_awaiting} awaiting verification).`}
        </p>
      ) : null}

      {c.cases_decided === 0 ? <p class="muted">No case is decided yet, so there is no result to show. Run the cases and decide what awaits you on the Run step.</p> : null}

      {perCase ? <p>{PER_CASE_SENTENCE}</p> : null}

      <div role="group" aria-label="Counts" class="counts">
        {perCase ? (
          <>
            <Group title="Cases with expected errors">
              <Count label="Decided" value={c.defective_cases_decided} />
              <Count label="Flagged" value={c.defective_cases_flagged} />
              <Count label="Not flagged" value={c.defective_cases_decided - c.defective_cases_flagged} />
            </Group>
            <Group title="Clean cases">
              <Count label="Decided" value={c.clean_cases_decided} />
              <Count label="Flagged wrongly" value={c.clean_cases_with_false_positive} />
              <Count label="Not flagged" value={c.clean_cases_decided - c.clean_cases_with_false_positive} />
            </Group>
          </>
        ) : (
          <>
            <Group title="Expected errors">
              <Count label="Total" value={c.expected_total} />
              <Count label="Found" value={c.expected_found} />
              <Count label="Not found" value={c.expected_missed} />
            </Group>
            <Group title="Additional findings">
              <Count label="Total" value={c.additional_total} />
              <Count label="Genuine errors" value={c.real_errors} />
              <Count label="False positives" value={c.false_positives} />
            </Group>
            <Group title="Subtle errors">
              <Count label="Total" value={c.subtle_total} />
              <Count label="Found" value={c.subtle_found} />
              <Count label="Not found" value={c.subtle_missed} />
            </Group>
          </>
        )}
      </div>

      <GenuineErrors reviewed={reviewed} onOpenCase={onOpenCase} />

      {ignored > 0 ? (
        <p class="muted">
          {`Ignored: ${c.ignored_expected} expected ${c.ignored_expected === 1 ? 'error' : 'errors'} and ${c.ignored_additional} additional ${c.ignored_additional === 1 ? 'finding' : 'findings'}.`}
        </p>
      ) : null}

      <div role="group" aria-label="Rates" class="rates-group">
        <dl class="rates">
        {rateIds.map((id) => {
          const m = results.measures[id];
          if (!m) return null;
          return (
            <div key={id} class="rate">
              <dt>{m.name}</dt>
              <dd>{m.value === null ? 'not available' : `${pct(m.value)} (${m.numerator} of ${m.denominator})`}</dd>
            </div>
          );
        })}
        </dl>
      </div>

      <section role="region" aria-label="Overall result" class="overall">
        <p class={`overall-result result-${results.overall.result.replace(/\s/g, '-').toLowerCase()}`}>
          <strong>{results.overall.result}</strong>
        </p>
        <ul>
          {results.overall.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </section>

      <section role="region" aria-label="Test size" class="test-size">
        <p>{`A final answer needs at least ${MINIMUM_SAMPLE.expected_errors} injected errors and ${MINIMUM_SAMPLE.clean_cases} clean cases.`}</p>
        <p>{`Decided so far: ${have} of ${MINIMUM_SAMPLE.expected_errors} ${perCase ? 'cases with errors' : 'expected errors'}, ${c.clean_cases_decided} of ${MINIMUM_SAMPLE.clean_cases} clean cases.`}</p>
      </section>

      <DetailsSection results={results} rules={evaluation.checks.rules} onThreshold={onThreshold} onLoadChecks={onLoadChecks} />
    </div>
  );
}
