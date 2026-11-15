import { useMemo, useState } from 'preact/hooks';
import { NO_ANSWER, opinionPlan, type OpinionPlan, type PlannedMark } from '../../../core/evaluation/opinions';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { verificationPrompt } from '../../../core/generation/verification-prompt';
import { readOpinion } from '../../../core/io/opinions';
import type { TestProject } from '../../../core/model';
import { CopyButton } from '../../components/CopyButton';
import { Dialog } from '../../components/Dialog';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';

export interface SecondOpinionWindowProps {
  evaluation: TestProject;
  reviewed: ReviewedCase;
  onApply: (plan: OpinionPlan) => void;
  onClose: () => void;
}

const STATE_LABELS: Record<string, string> = {
  undecided: 'undecided',
  found: labels.found,
  missed: labels.issueMissed,
  ignored: labels.ignore,
  false_positive: labels.issueFalsePositive,
  real_error: labels.realError,
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Mark({ mark }: { mark: PlannedMark }) {
  const now = STATE_LABELS[mark.from.state];
  const next = STATE_LABELS[mark.to];
  return (
    <li>
      {mark.change === 'same' ? (
        <strong>{`${mark.label} ${next} — no change`}</strong>
      ) : (
        <strong>{`${mark.label} ${now} → ${next}${mark.replacesHand ? ' (replaces a mark set by hand)' : mark.replacesOpinion ? ' (replaces a mark from an earlier opinion)' : ''}`}</strong>
      )}
      {mark.reason ? <p class="muted">{mark.reason}</p> : null}
      {mark.fragment ? <p class="muted">{`Fragment: “${mark.fragment}”`}</p> : null}
    </li>
  );
}

/** "Second opinion…" (FR-063): the prompt for the user's LLM, one box for its answer, the preview of every change, Apply opinion and Cancel. */
export function SecondOpinionWindow({ evaluation, reviewed, onApply, onClose }: SecondOpinionWindowProps) {
  const caseId = reviewed.testCase.id;
  const effective = reviewed.effective;
  const [text, setText] = useState('');
  const prompt = useMemo(() => verificationPrompt(evaluation, reviewed), [evaluation, reviewed]);
  const read = useMemo(() => (text.trim() === '' ? null : readOpinion(text, caseId)), [text, caseId]);
  const plan = useMemo(() => (read?.ok && effective ? opinionPlan(reviewed.testCase, effective, read.value) : null), [read, effective, reviewed.testCase]);
  if (!effective) return null;

  return (
    <Dialog
      open
      wide
      title="Second opinion"
      onClose={onClose}
      actions={
        <>
          <button type="button" onClick={onClose}>
            {labels.cancel}
          </button>
          <button type="button" class="primary" disabled={!plan?.canApply} onClick={() => plan && onApply(plan)}>
            {labels.applyOpinion}
          </button>
        </>
      }
    >
      <p>{`The LLM checks ${plural(effective.expected.length, 'expected error', 'expected errors')} and ${plural(effective.additional.length, 'additional finding', 'additional findings')} of this case.`}</p>

      <h3>1 · Prompt for your LLM</h3>
      <label class="field-label" for="opinion-prompt">
        Verification prompt
      </label>
      <textarea id="opinion-prompt" class="json" rows={8} readOnly value={prompt} />
      <CopyButton text={prompt} label={labels.copyPrompt} />

      <h3>2 · Paste your LLM’s answer</h3>
      <JsonBox label="Opinion of your LLM" value={text} onChange={setText} check={() => (read && !read.ok ? read.problems : [])} rows={8} />

      <h3>3 · What will change</h3>
      {plan === null ? <p class="muted">Nothing is pasted yet. Nothing will change until you press Apply opinion.</p> : null}
      {plan?.classifiesNone ? <p role="status">{plan.message}</p> : null}
      {plan && plan.marks.length > 0 ? (
        <ul class="plain-list preview" aria-label="What will change">
          {plan.marks.map((m) => (
            <Mark key={m.label} mark={m} />
          ))}
          {plan.newFindings.map((n, i) => (
            <li key={`new-${i}`}>
              <strong>{`+ new finding “${n.text}” → ${n.real ? labels.realError : labels.issueFalsePositive}`}</strong>
              {n.category || n.difficulty ? <p class="muted">{[n.category, n.difficulty].filter(Boolean).join(' · ')}</p> : null}
              {n.reason ? <p class="muted">{n.reason}</p> : null}
              {n.fragment ? <p class="muted">{`Fragment: “${n.fragment}”`}</p> : null}
            </li>
          ))}
        </ul>
      ) : plan && plan.newFindings.length > 0 ? (
        <ul class="plain-list preview" aria-label="What will change">
          {plan.newFindings.map((n, i) => (
            <li key={`new-${i}`}>
              <strong>{`+ new finding “${n.text}” → ${n.real ? labels.realError : labels.issueFalsePositive}`}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {plan && plan.unanswered.length > 0 ? (
        <>
          <h4>No answer</h4>
          <ul class="plain-list" aria-label="No answer">
            {plan.unanswered.map((u) => (
              <li key={u.label}>
                <strong>{u.label}</strong>
                {` — ${u.undecided ? `${NO_ANSWER}. ` : 'Keeps its mark. '}${u.reason}`}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {plan && plan.notes.length > 0 ? (
        <ul class="plain-list muted" aria-label="Notes on the opinion">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </Dialog>
  );
}
