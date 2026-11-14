import { listCheckOf, uncoveredLines } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { findVariables } from '../../../core/judge/variables';
import type { CaseJsonCheck } from '../../../core/model';
import { JsonBox } from '../../components/JsonBox';
import { baseNameOf, CaseSummary, CheckLine, ErrorList } from './CaseData';

export function contextOf(state: AppState) {
  const { judge_set, dataset } = state.evaluation;
  return { variables: findVariables(judge_set.prompt), judgedText: judge_set.judged_text, catalog: judge_set.error_catalog, existingCases: dataset.cases };
}

export function Status({ check, hideCleanKind = false }: { check: CaseJsonCheck; hideCleanKind?: boolean }) {
  return (
    <div class="check-status">
      {check.problems.length === 0 && check.kind && !(hideCleanKind && check.kind === 'Clean') ? (
        <p class="muted">{check.kind === 'Clean' ? 'This will be saved as a clean case.' : 'This will be saved as a case with injected errors.'}</p>
      ) : null}
      {check.notes.length > 0 ? (
        <ul class="plain-list" aria-label="Notes">
          {check.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {check.warnings.length > 0 ? (
        <ul class="plain-list" aria-label="Warnings">
          {check.warnings.map((w) => (
            <li key={w} class="warning-text">{`Warning: ${w}`}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { Part } from '../../components/CasePart';

export interface AnswerBoxProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  check: CaseJsonCheck | undefined;
  rows: number;
  state: AppState;
  /** The words "saved as a clean case" are said in the list of expected errors instead of under the box. */
  hideCleanKind?: boolean;
}

/** The box for the JSON, checked as it changes, with its problems, notes and warnings; changed places that no expected error covers are warnings under it. */
export function AnswerBox({ label, value, onChange, check, rows, state, hideCleanKind }: AnswerBoxProps) {
  const uncovered = check?.case ? uncoveredLines(listCheckOf(state, check.case)) : [];
  return (
    <>
      <JsonBox label={label} value={value} onChange={onChange} check={() => check?.problems ?? []} rows={rows} />
      {check ? <Status check={check} hideCleanKind={hideCleanKind ?? false} /> : null}
      {uncovered.length > 0 ? (
        <ul class="plain-list" aria-label="Changed places not in the list">
          {uncovered.map((line) => (
            <li key={line} class="warning-text">{`Warning: ${line}`}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** The expected errors of the JSON above, read-only; they change only through that JSON. */
export function ExpectedErrorsPart({ state, text, check }: { state: AppState; text: string; check: CaseJsonCheck | undefined }) {
  if (text.trim() === '') return <p class="muted">Paste the JSON to see the expected errors here.</p>;
  const shown = check?.case;
  if (!shown) return <p class="muted">The JSON is not valid yet, so there is no list to show.</p>;
  const list = listCheckOf(state, shown);
  return (
    <>
      <CaseSummary testCase={shown} baseName={baseNameOf(state, shown.base)} />
      {shown.expected_errors.length > 0 || !list.agrees ? <CheckLine list={list} testCase={shown} /> : null}
      {shown.expected_errors.length === 0 ? <p>No expected errors: this will be saved as a clean case.</p> : <ErrorList testCase={shown} notInText={new Set(list.notInText.map((m) => m.index))} />}
    </>
  );
}
