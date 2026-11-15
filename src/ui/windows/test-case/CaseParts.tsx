import { defaultCaseName } from '../../../core/cases/identifiers';
import type { AppState } from '../../../app/store';
import { findVariables } from '../../../core/judge/variables';
import type { CaseJsonCheck } from '../../../core/model';
import { JsonBox } from '../../components/JsonBox';
import { useRef } from 'preact/hooks';
import { useShowIssue } from '../case-window/useShowIssue';
import { baseNameOf, CaseData, ErrorList } from './CaseData';

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

/** What the user typed in "Test case name"; null while the field was not touched (T239). */
export type TypedName = string | null;

/** The name that goes to the check and to Save case: only what the user typed, so that a name in the JSON still counts while the field is untouched. */
export const typedNameOf = (typed: TypedName): string | undefined => (typed !== null && typed.trim() !== '' ? typed : undefined);

/** "Test case name" at the top of part 1: "Case N" (N the identifier the case will get), the name in the pasted JSON while the user has not typed, or what the user typed. */
export function NameField({ state, check, typed, onTyped }: { state: AppState; check: CaseJsonCheck | undefined; typed: TypedName; onTyped: (name: string) => void }) {
  const automatic = check?.case?.name ?? defaultCaseName(state.evaluation.dataset.cases);
  return (
    <>
      <label class="field-label" for="case-name">
        Test case name
      </label>
      <div>
        <input id="case-name" type="text" value={typed ?? automatic} placeholder={automatic} onInput={(event) => onTyped((event.currentTarget as HTMLInputElement).value)} />
      </div>
    </>
  );
}

export interface AnswerBoxProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  check: CaseJsonCheck | undefined;
  rows: number;
  /** The words "saved as a clean case" are said in the list of expected errors instead of under the box. */
  hideCleanKind?: boolean;
}

/** The box for the JSON, checked as it changes, with its problems, notes and warnings. */
export function AnswerBox({ label, value, onChange, check, rows, hideCleanKind }: AnswerBoxProps) {
  return (
    <>
      <JsonBox label={label} value={value} onChange={onChange} check={() => check?.problems ?? []} rows={rows} />
      {check ? <Status check={check} hideCleanKind={hideCleanKind ?? false} /> : null}
    </>
  );
}

/** The case of the JSON above with its fields, and its expected errors, read-only; they change only through that JSON. "Show the issue" marks a passage in the fields (T284). */
export function ExpectedErrorsPart({ state, text, check }: { state: AppState; text: string; check: CaseJsonCheck | undefined }) {
  const textRef = useRef<HTMLDivElement>(null);
  const { strong, shown: spots, show } = useShowIssue(textRef);
  if (text.trim() === '') return <p class="muted">Paste the JSON to see the expected errors here.</p>;
  const made = check?.case;
  if (!made) return <p class="muted">The JSON is not valid yet, so there is no list to show.</p>;
  return (
    <>
      <CaseData testCase={made} judged={state.evaluation.judge_set.judged_text} strong={strong} shown={spots} rootRef={textRef} baseName={baseNameOf(state, made.base)} />
      {made.expected_errors.length === 0 ? <p>No expected errors: this will be saved as a clean case.</p> : <ErrorList testCase={made} judged={state.evaluation.judge_set.judged_text} onShow={show} />}
    </>
  );
}
