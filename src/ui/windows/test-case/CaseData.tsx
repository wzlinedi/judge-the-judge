import type { RefObject } from 'preact';
import type { ChangedPlace, ListCheck } from '../../../core/cases/text-list-check';
import type { AppState } from '../../../app/store';
import type { TestCase } from '../../../core/model';
import { labels } from '../../labels';
import { MarkedFields } from '../case-window/MarkedFields';

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
  rootRef?: RefObject<HTMLDivElement | null>;
  /** The name of the base case, shown beside its number. */
  baseName?: string | undefined;
}

/** A case read-only: its fields, with the fragments of the expected errors highlighted and numbered. */
export function CaseData({ testCase, judged, uncovered = [], strong, rootRef, baseName }: CaseDataProps) {
  return (
    <div class="case-data">
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
      <MarkedFields testCase={testCase} judged={judged} effective={null} uncovered={uncovered} strong={strong} rootRef={rootRef} />
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
  /** "Show in text" for each error; the button is disabled with the words "not in the text" for an error that is in no field. */
  onShow?: (expectedId: string) => void;
  notInText?: ReadonlySet<number>;
}

/** The expected errors of a case as a list: number, category, difficulty, fragment, description. */
export function ErrorList({ testCase, onShow, notInText }: ErrorListProps) {
  if (testCase.expected_errors.length === 0) return <p class="muted">This case has no expected errors.</p>;
  return (
    <ol class="plain-list error-list" aria-label="Expected errors">
      {testCase.expected_errors.map((error, i) => {
        const missing = notInText?.has(i) ?? false;
        return (
          <li key={i} class="decide-item">
            <div class="item-head">
              <strong>{`E${i + 1}`}</strong>
              <span class="muted">{`${[error.category ?? 'no category', error.difficulty ?? 'no difficulty'].join(' · ')}`}</span>
              {onShow && error.fragment ? (
                <button type="button" class="link-button" disabled={missing} onClick={() => onShow(error.id)}>
                  {labels.showInText}
                </button>
              ) : null}
              {missing ? <span class="not-in-text warning-text">not in the text</span> : null}
            </div>
            {error.fragment ? <p class="item-fragment">{`“${error.fragment}”`}</p> : <p class="item-fragment muted">No fragment</p>}
            <p class="source">{error.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
