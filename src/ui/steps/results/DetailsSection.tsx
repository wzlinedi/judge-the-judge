import { falsePositiveShares } from '../../../core/evaluation/analysis';
import { measuresInUse } from '../../../core/evaluation/measures';
import type { Results } from '../../../core/evaluation/results';
import type { CheckRule } from '../../../core/model';
import { labels } from '../../labels';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export interface DetailsSectionProps {
  results: Results;
  rules: readonly CheckRule[];
  onThreshold: (measure: string, value: number) => void;
  onLoadChecks: () => void;
}

/** The only part of the Results step that changes data (FR-069): collapsed by default, so the counts keep the attention. */
export function DetailsSection({ results, rules, onThreshold, onLoadChecks }: DetailsSectionProps) {
  const use = measuresInUse(results.evaluated_per === 'case' ? 'per_case' : 'per_expected_error');
  const inUse = rules.filter((r) => use.includes(r.measure));
  const shares = falsePositiveShares(results.counters);
  const further = Object.values(results.measures).filter((m) => !use.includes(m.id));

  return (
    <details class="card details-section">
      <summary>Details</summary>

      <h3>Thresholds</h3>
      <ul class="plain-list">
        {inUse.map((rule) => {
          const name = results.measures[rule.measure]?.name ?? rule.measure;
          const direction = rule.comparison === 'at_least' ? 'at least' : 'at most';
          const label = `${name}: ${direction} (%)`;
          return (
            <li key={rule.measure}>
              <label class="field-label" for={`threshold-${rule.measure}`}>
                {label}
              </label>
              <input
                id={`threshold-${rule.measure}`}
                type="number"
                min={0}
                max={100}
                step="any"
                value={String(Math.round(rule.value * 1000) / 10)}
                onInput={(event) => {
                  const text = (event.currentTarget as HTMLInputElement).value.trim();
                  const percent = Number(text);
                  if (text !== '' && Number.isFinite(percent) && percent >= 0 && percent <= 100) onThreshold(rule.measure, percent / 100);
                }}
              />
              <p class="muted">{`The judge works only if the ${name.toLowerCase()} is ${direction} ${pct(rule.value)}.`}</p>
            </li>
          );
        })}
      </ul>
      <div class="button-row">
        <button type="button" onClick={onLoadChecks}>
          {labels.loadCheckSettings}
        </button>
      </div>

      <h3>95% intervals</h3>
      <ul class="plain-list">
        {use.map((id) => {
          const m = results.measures[id];
          if (!m) return null;
          return <li key={id}>{m.interval ? `${m.name}: 95% interval ${pct(m.interval.lower)} to ${pct(m.interval.upper)}.` : `${m.name}: no interval, there is nothing to count yet.`}</li>;
        })}
      </ul>
      {results.overall.borderline.length > 0 ? (
        <ul class="plain-list" aria-label="Borderline">
          {results.overall.borderline.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <h3>Information</h3>
      <p>{`Cases with at least one false positive: ${shares.cases.count} of ${shares.cases.of}.`}</p>
      <p>{`Clean cases with a false positive: ${shares.clean.count} of ${shares.clean.of}.`}</p>

      {further.length > 0 ? (
        <>
          <h3>Further measures</h3>
          <ul class="plain-list">
            {further.map((m) => (
              <li key={m.id}>{`${m.name}: ${m.value === null ? 'not available' : pct(m.value)}${m.numerator !== undefined ? ` (${m.numerator} of ${m.denominator})` : ''}`}</li>
            ))}
          </ul>
        </>
      ) : null}
    </details>
  );
}
