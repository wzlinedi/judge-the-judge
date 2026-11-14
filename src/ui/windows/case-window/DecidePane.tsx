import type { Effective, EffectiveAdditional, EffectiveExpected } from '../../../core/evaluation/decisions';
import { markFindings } from '../../../core/evaluation/finding-marks';
import { markProgress } from '../../../core/evaluation/mark-progress';
import type { ReviewedCase } from '../../../core/evaluation/results';
import type { AdditionalState, ExpectedState, TestCase } from '../../../core/model';
import { SOURCE_LABELS } from '../../components/sources';
import { StatusMark } from '../../components/StatusMark';
import { labels } from '../../labels';

const EXPECTED_MARKS: ReadonlyArray<{ state: ExpectedState; label: string }> = [
  { state: 'found', label: labels.found },
  { state: 'missed', label: labels.issueMissed },
  { state: 'ignored', label: labels.ignore },
];
const ADDITIONAL_MARKS: ReadonlyArray<{ state: AdditionalState; label: string }> = [
  { state: 'false_positive', label: labels.issueFalsePositive },
  { state: 'real_error', label: labels.realError },
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
  onShowInText: (expectedId: string) => void;
  onRemove: (item: EffectiveAdditional) => void;
}

function ExpectedItem({ error, index, testCase, onMark, onShow }: { error: EffectiveExpected; index: number; testCase: TestCase; onMark: (s: ExpectedState) => void; onShow: () => void }) {
  const meta = testCase.expected_errors.find((e) => e.id === error.id);
  const name = `E${index + 1}`;
  return (
    <li data-expected={error.id} class="decide-item">
      <div class="item-head">
        <strong>{name}</strong> <span>{meta?.description}</span>
        <button type="button" class="link-button" onClick={onShow}>
          {labels.showInText}
        </button>
      </div>
      {meta?.fragment ? <p class="muted item-fragment">{`Fragment: “${meta.fragment}”`}</p> : null}
      <div role="group" aria-label={`Mark for ${name}`} class="marks">
        {EXPECTED_MARKS.map((m) => (
          <button key={m.state} type="button" aria-pressed={error.state === m.state} class={error.state === m.state ? 'pressed' : ''} onClick={() => onMark(m.state)}>
            {m.label}
          </button>
        ))}
      </div>
      {error.state === 'undecided' ? <p class="reason">{error.reason ?? 'Decide this by hand.'}</p> : <p class="source muted">{SOURCE_LABELS[error.source]}</p>}
    </li>
  );
}

function AdditionalItem({ item, onMark, onRemove }: { item: EffectiveAdditional; onMark: (s: AdditionalState) => void; onRemove: () => void }) {
  return (
    <li data-additional={item.key} class="decide-item">
      <div class="item-head">
        <span>{item.text === '' ? 'A finding about the whole reply' : item.text}</span>
        {item.added !== undefined ? (
          <button type="button" class="link-button" onClick={onRemove}>
            {labels.remove}
          </button>
        ) : null}
      </div>
      {item.rules.length > 0 ? <p class="muted">{`Rule: ${item.rules.join(', ')}`}</p> : null}
      {item.category || item.difficulty ? <p class="muted">{[item.category, item.difficulty].filter(Boolean).join(' · ')}</p> : null}
      <div role="group" aria-label={`Mark for ${item.text || item.key}`} class="marks">
        {ADDITIONAL_MARKS.map((m) => (
          <button key={m.state} type="button" aria-pressed={item.state === m.state} class={item.state === m.state ? 'pressed' : ''} onClick={() => onMark(m.state)}>
            {m.label}
          </button>
        ))}
      </div>
      {item.state === 'undecided' ? <p class="reason">This finding matches no expected error. Is it a false positive or a real error?</p> : <p class="source muted">{SOURCE_LABELS[item.source]}</p>}
    </li>
  );
}

/** Each finding of the reply with the words that go with its colour (FR-077): green matches, amber partly matches, red matches no expected error. */
function FindingsInReply({ reviewed, unreadable }: { reviewed: ReviewedCase; unreadable: boolean }) {
  if (unreadable) return <p class="muted">The reply is shown without finding highlights because it cannot be read.</p>;
  const marks = markFindings(reviewed);
  if (marks.length === 0) return <p class="muted">The reply holds no findings to highlight.</p>;
  return (
    <ul class="plain-list findings-in-reply" aria-label="Findings in the reply">
      {marks.map((m) => (
        <li key={m.key}>
          <mark class={`finding finding-${m.kind}`}>{m.text === '' ? 'The whole reply' : m.text}</mark> <span class="finding-label">{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Part 2 of the case window of Run: Add finding, Second opinion…, the meter "Marked N of M" and the status of the case. */
export function DecideBar({ reviewed, effective, onAddFinding, onSecondOpinion }: DecideBarProps) {
  const progress = effective ? markProgress(effective) : null;
  return (
    <div class="decide-bar">
      {effective ? (
        <>
          <button type="button" onClick={onAddFinding}>
            {labels.addFinding}
          </button>
          <button type="button" onClick={onSecondOpinion}>
            {labels.secondOpinion}
          </button>
        </>
      ) : null}
      {progress ? <span class="mark-meter">{`Marked ${progress.marked} of ${progress.total}`}</span> : null}
      <StatusMark status={reviewed.status} />
    </div>
  );
}

/** The right column of part 3: the errors of the case with their marks, and the findings of the reply. */
export function ErrorsPane({ reviewed, effective, onExpected, onAdditional, onApprove, onShowInText, onRemove }: ErrorsPaneProps) {
  const unreadable = reviewed.review !== null && !reviewed.review.readable;
  const awaiting = reviewed.status === 'awaiting';
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
              <ExpectedItem key={e.id} error={e} index={i} testCase={reviewed.testCase} onMark={(s) => onExpected(e.id, s)} onShow={() => onShowInText(e.id)} />
            ))}
          </ul>
        </>
      ) : null}

      {effective.additional.length > 0 ? (
        <>
          <h5>Additional findings</h5>
          <ul class="decide-list" aria-label="Additional findings">
            {effective.additional.map((a) => (
              <AdditionalItem key={a.key} item={a} onMark={(s) => onAdditional(a, s)} onRemove={() => onRemove(a)} />
            ))}
          </ul>
        </>
      ) : null}

      <h5>Findings in the reply</h5>
      <FindingsInReply reviewed={reviewed} unreadable={unreadable} />
    </section>
  );
}
