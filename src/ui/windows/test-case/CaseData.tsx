import type { RefObject } from 'preact';
import type { ChangedPlace, ListCheck } from '../../../core/cases/text-list-check';
import type { AppState } from '../../../app/store';
import type { TestCase } from '../../../core/model';
import { ErrorCard } from '../case-window/ErrorCard';
import { MarkedFields } from '../case-window/MarkedFields';
import { errorSides, type ShownSpot } from '../case-window/marks';
import { showTargetOf, type ShowTarget } from '../case-window/useShowIssue';

/** The name of the case another case was made from, for "Base: 4 (Anna)". */
export function baseNameOf(state: AppState, base: string | undefined): string | undefined {
  if (base === undefined) return undefined;
  const found = state.evaluation.dataset.cases.find((c) => c.id === base);
  return found && found.name.trim() !== '' ? found.name : undefined;
}

type Shown = Omit<TestCase, 'id'> & { id?: string };

export interface CaseDataProps {
  testCase: Shown;
  judged: string | undefined;
  uncovered?: readonly ChangedPlace[];
  strong?: string | null;
  shown?: readonly ShownSpot[];
  rootRef?: RefObject<HTMLDivElement | null>;
  /** The name of the base case, shown beside its number. */
  baseName?: string | undefined;
}

/** The name, the kind and the base of a case. */
export function CaseSummary({ testCase, baseName }: { testCase: Shown; baseName?: string | undefined }) {
  return (
    <>
      {testCase.name.trim() !== '' ? (
        <p>
          <span class="muted">Name: </span>
          <strong>{testCase.name}</strong>
        </p>
      ) : null}
      <p>
        <span class="muted">Kind: </span>
        <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
        {testCase.base ? <span class="muted">{` · Base: ${testCase.base}${baseName ? ` (${baseName})` : ''}`}</span> : null}
      </p>
    </>
  );
}

/** A case read-only: its fields, with the fragments of the expected errors highlighted and numbered. */
export function CaseData({ testCase, judged, uncovered = [], strong, shown = [], rootRef, baseName }: CaseDataProps) {
  return (
    <div class="case-data">
      <CaseSummary testCase={testCase} baseName={baseName} />
      <MarkedFields testCase={testCase} judged={judged} effective={null} uncovered={uncovered} strong={strong} shown={shown} rootRef={rootRef} />
    </div>
  );
}

/** The line of FR-080 and the notes under it. */
export function CheckLine({ list, testCase }: { list: ListCheck; testCase: Shown }) {
  const notes = list.notes.map((n) => `E${n.index + 1}: ${n.kind === 'no_fragment' ? 'no fragment, so it cannot be matched automatically and is decided by hand on Run.' : 'no category, so it is not grouped in the error analysis.'}`);
  const removed = list.uncovered.filter((p) => p.end <= p.start);
  return (
    <div class="check-line-block">
      <p class={list.agrees ? 'check-line agree' : 'check-line warning-text'} role="status">
        <span aria-hidden="true">{list.agrees ? '✓ ' : '⚠ '}</span>
        {list.line}
      </p>
      {removed.length > 0 ? (
        <ul class="plain-list" aria-label="Removed text not in the list">
          {removed.map((p, i) => (
            <li key={i} class="warning-text">{`Text of the base is gone from ${p.field} and no expected error covers it: “${(p.removed ?? '').slice(0, 120)}”`}</li>
          ))}
        </ul>
      ) : null}
      {notes.length > 0 && testCase.expected_errors.length > 0 ? (
        <ul class="plain-list muted" aria-label="Notes about the list">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface ErrorListProps {
  testCase: Shown;
  /** The judged text field, which the search for a fragment starts with. */
  judged: string | undefined;
  /** "Show the issue" for each error whose passages are in the case. */
  onShow?: (target: ShowTarget) => void;
}

/** The expected errors of a case as a list, each shown by the shared component (T251): number, category, difficulty, description and its passages. */
export function ErrorList({ testCase, judged, onShow }: ErrorListProps) {
  if (testCase.expected_errors.length === 0) return <p class="muted">This case has no expected errors.</p>;
  return (
    <ol class="plain-list error-list" aria-label="Expected errors">
      {testCase.expected_errors.map((error, i) => {
        const sides = errorSides(testCase, judged, error);
        return (
          <li key={i} class="decide-item" data-expected={error.id}>
            <ErrorCard name={`E${i + 1}`} title={error.description} facts={[error.category ?? 'no category', error.difficulty ?? 'no difficulty']} sides={sides} onShow={onShow ? () => onShow(showTargetOf(sides, error.id)) : undefined}>
              {error.fragment ? null : <p class="item-fragment muted">No fragment</p>}
            </ErrorCard>
          </li>
        );
      })}
    </ol>
  );
}
