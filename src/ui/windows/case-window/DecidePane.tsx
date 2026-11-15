import type { Effective, EffectiveAdditional, EffectiveExpected } from '../../../core/evaluation/decisions';
import { markFindings, type FindingMark } from '../../../core/evaluation/finding-marks';
import { markProgress } from '../../../core/evaluation/mark-progress';
import type { ReviewedCase } from '../../../core/evaluation/results';
import type { AdditionalState, ExpectedState, TestCase } from '../../../core/model';
import { SOURCE_LABELS } from '../../components/sources';
import { StatusMark } from '../../components/StatusMark';
import { labels } from '../../labels';
import { ErrorCard } from './ErrorCard';
import { errorSides } from './marks';
import { showTargetOf, type ShowTarget } from './useShowIssue';

const EXPECTED_MARKS: ReadonlyArray<{ state: ExpectedState; label: string }> = [
  { state: 'found', label: labels.found },
  { state: 'missed', label: labels.issueMissed },
  { state: 'ignored', label: labels.ignore },
];
const ADDITIONAL_MARKS: ReadonlyArray<{ state: AdditionalState; label: string }> = [
  { state: 'real_error', label: labels.realError },
  { state: 'false_positive', label: labels.issueFalsePositive },
  { state: 'ignored', label: labels.ignore },
];

export interface DecideBarProps {
  reviewed: ReviewedCase;
  effective: Effective | null;
  onAddFinding: () => void;
  onSecondOpinion: () => void;
}

export interface ErrorsPaneProps {
  reviewed: ReviewedCase;
  effective: Effective;
  onExpected: (expectedId: string, state: ExpectedState) => void;
  onAdditional: (item: EffectiveAdditional, state: AdditionalState) => void;
  /** "No more findings": the findings added by hand are all, for a reply that could not be read. */
  onApprove: () => void;
  /** "Show the issue": scroll to part 1 and highlight the passages of the error in the fields. */
  onShowInText: (target: ShowTarget) => void;
  /** The judged text field, which the search for a fragment starts with. */
  judged: string | undefined;
  onRemove: (item: EffectiveAdditional) => void;
  /** The finding that was pressed (in the reply or here), marked for a moment (T293). */
  pointed?: string | null;
  /** A finding was pressed here: its block in the saved reply is marked and brought into view. Not offered while the reply is being changed. */
  onPoint?: ((key: string) => void) | undefined;
  /** "Show the issue" of an error that the judge found also marks that finding in the reply (T311); it does not scroll. */
  onHighlight?: ((key: string) => void) | undefined;
}

function ExpectedItem({ error, index, testCase, judged, judgeSays, onMark, onShow, pointed, onPoint }: { error: EffectiveExpected; index: number; testCase: TestCase; judged: string | undefined; judgeSays: readonly FindingMark[]; onMark: (s: ExpectedState) => void; onShow: (target: ShowTarget) => void; pointed: string | null; onPoint: ((key: string) => void) | undefined }) {
  const meta = testCase.expected_errors.find((e) => e.id === error.id);
  const sides = errorSides(testCase, judged, meta ?? {});
  const name = `E${index + 1}`;
  return (
    <li data-expected={error.id} class="decide-item">
      <ErrorCard name={name} title={meta?.description ?? ''} facts={[meta?.category, meta?.difficulty].filter((x): x is NonNullable<typeof x> => !!x)} sides={sides} onShow={() => onShow(showTargetOf(sides, error.id))}>
        {judgeSays.map((m) => {
          const said = `F${m.number} · Judge: ${m.text === '' ? 'the whole reply' : `“${m.text}”`} (${m.kind === 'clear' ? 'matches' : 'partly matches'})`;
          return (
            <p key={m.key} class="judge-says">
              {onPoint ? (
                <button type="button" class={`link-button${pointed === m.key ? ' pointed' : ''}`} data-finding-line={m.key} onClick={() => onPoint(m.key)}>
                  {said}
                </button>
              ) : (
                said
              )}
            </p>
          );
        })}
        <div role="group" aria-label={`Mark for ${name}`} class="marks">
          {EXPECTED_MARKS.map((m) => (
            <button key={m.state} type="button" aria-pressed={error.state === m.state} class={error.state === m.state ? 'pressed' : ''} onClick={() => onMark(m.state)}>
              {m.label}
            </button>
          ))}
        </div>
        {error.state === 'undecided' ? <p class="reason">{error.reason ?? 'Decide this by hand.'}</p> : <p class="source muted">{SOURCE_LABELS[error.source]}</p>}
      </ErrorCard>
    </li>
  );
}

function AdditionalItem({ item, number, testCase, judged, onMark, onShow, onRemove, pointed, onPoint }: { item: EffectiveAdditional; number: number | undefined; testCase: TestCase; judged: string | undefined; onMark: (s: AdditionalState) => void; onShow: (target: ShowTarget) => void; onRemove: () => void; pointed: string | null; onPoint: ((key: string) => void) | undefined }) {
  const sides = item.text === '' ? [] : errorSides(testCase, judged, { fragment: item.text });
  const facts = [item.rules.length > 0 ? `Rule: ${item.rules.join(', ')}` : undefined, item.category, item.difficulty].filter((x): x is string => !!x);
  return (
    <li data-additional={item.key} class="decide-item">
      <ErrorCard
        title={`${number !== undefined ? `F${number} · ` : ''}${item.text === '' ? 'A finding about the whole reply' : 'Found by the judge'}`}
        facts={facts}
        sides={sides}
        onShow={() => onShow(showTargetOf(sides))}
        actions={
          item.added !== undefined ? (
            <button type="button" class="link-button" onClick={onRemove}>
              {labels.remove}
            </button>
          ) : null
        }
      >
        {number !== undefined && onPoint ? (
          <p class="judge-says">
            <button type="button" class={`link-button${pointed === item.key ? ' pointed' : ''}`} data-finding-line={item.key} onClick={() => onPoint(item.key)}>
              {`Show F${number} in the reply`}
            </button>
          </p>
        ) : null}
        <div role="group" aria-label={`Mark for ${item.text || item.key}`} class="marks">
          {ADDITIONAL_MARKS.map((m) => (
            <button key={m.state} type="button" aria-pressed={item.state === m.state} class={item.state === m.state ? 'pressed' : ''} onClick={() => onMark(m.state)}>
              {m.label}
            </button>
          ))}
        </div>
        {item.state === 'undecided' ? <p class="reason">This finding matches no expected error. Is it a genuine error that the test case missed, or a false positive?</p> : <p class="source muted">{SOURCE_LABELS[item.source]}</p>}
      </ErrorCard>
    </li>
  );
}

/** Part 3 before the reply is saved: the expected errors of the case, read-only, with no marks (FR-055, T264). */
export function ExpectedPreview({ testCase, judged, onShowInText }: { testCase: TestCase; judged: string | undefined; onShowInText: (target: ShowTarget) => void }) {
  const errors = testCase.expected_errors;
  return (
    <section class="decide-pane">
      <h4>Errors</h4>
      {errors.length === 0 ? (
        <p class="muted">No expected errors.</p>
      ) : (
        <>
          <h5>Expected errors</h5>
          <ul class="decide-list" aria-label="Expected errors">
            {errors.map((error, i) => {
              const sides = errorSides(testCase, judged, error);
              return (
                <li key={error.id} data-expected={error.id} class="decide-item">
                  <ErrorCard name={`E${i + 1}`} title={error.description} facts={[error.category, error.difficulty].filter((x): x is NonNullable<typeof x> => !!x)} sides={sides} onShow={() => onShowInText(showTargetOf(sides, error.id))} />
                </li>
              );
            })}
          </ul>
          <p class="muted">The judge’s findings and the marks appear when its reply is saved.</p>
        </>
      )}
    </section>
  );
}

/** Part 2 of the case window of Run: Add finding, Second opinion…, the meter "Marked N of M" and the status of the case. */
export function DecideBar({ reviewed, effective, onAddFinding, onSecondOpinion }: DecideBarProps) {
  const progress = effective ? markProgress(effective) : null;
  return (
    <div class="decide-bar">
      <button type="button" disabled={!effective} aria-describedby={effective ? undefined : 'decide-why'} onClick={onAddFinding}>
        {labels.addFinding}
      </button>
      <button type="button" disabled={!effective} aria-describedby={effective ? undefined : 'decide-why'} onClick={onSecondOpinion}>
        {labels.secondOpinion}
      </button>
      {effective ? null : (
        <span id="decide-why" class="why-disabled">
          Paste the judge’s reply first
        </span>
      )}
      {progress ? <span class="mark-meter">{`Marked ${progress.marked} of ${progress.total}`}</span> : null}
      <StatusMark status={reviewed.status} />
    </div>
  );
}

/** The right column of part 3: the errors of the case in two groups, expected and additional, each with its marks (T252). */
export function ErrorsPane({ reviewed, effective, onExpected, onAdditional, onApprove, onShowInText, judged, onRemove, pointed = null, onPoint, onHighlight }: ErrorsPaneProps) {
  const unreadable = reviewed.review !== null && !reviewed.review.readable;
  const awaiting = reviewed.status === 'awaiting';
  // the words of the judge that match each expected error (FR-077, T258): the list "Findings in the reply" is gone
  const marks = markFindings(reviewed);
  return (
    <section class="decide-pane">
      <h4>Errors</h4>
      {unreadable ? (
        <>
          <div class="unreadable-note">
            <p class="error-note">{reviewed.review?.reason}</p>
            <button type="button" class={awaiting ? 'primary' : ''} aria-pressed={effective.approved} onClick={onApprove}>
              {labels.noMoreFindings}
            </button>
          </div>
          <p class="muted">Add the findings you can see in this reply with Add finding. When you have added all of them, press No more findings.</p>
        </>
      ) : null}
      {reviewed.review?.flagged !== undefined ? (
        <p class="muted">{`This judge is evaluated per case. The text was ${reviewed.review.flagged ? '' : 'not '}flagged.`}</p>
      ) : null}

      {effective.expected.length > 0 ? (
        <>
          <h5>Expected errors</h5>
          <ul class="decide-list" aria-label="Expected errors">
            {effective.expected.map((e, i) => (
              <ExpectedItem key={e.id} error={e} index={i} testCase={reviewed.testCase} judged={judged} judgeSays={marks.filter((m) => m.kind !== 'none' && m.errorNumbers.includes(i + 1))} onMark={(s) => onExpected(e.id, s)} onShow={(target) => { onShowInText(target); const found = marks.find((m) => m.kind !== 'none' && m.errorNumbers.includes(i + 1)); if (found) onHighlight?.(found.key); }} pointed={pointed} onPoint={onPoint} />
            ))}
          </ul>
        </>
      ) : null}

      {effective.additional.length > 0 ? (
        <>
          <h5>Additional errors</h5>
          <ul class="decide-list" aria-label="Additional errors">
            {effective.additional.map((a) => (
              <AdditionalItem key={a.key} item={a} number={marks.find((m) => m.key === a.key)?.number} testCase={reviewed.testCase} judged={judged} onMark={(s) => onAdditional(a, s)} onShow={(target) => { onShowInText(target); onHighlight?.(a.key); }} onRemove={() => onRemove(a)} pointed={pointed} onPoint={onPoint} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
