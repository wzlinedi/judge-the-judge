import { useRef, useState } from 'preact/hooks';
import { approveCase, setAddedMark, setAdditionalMark, setExpectedMark } from '../../../app/actions/decisions';
import { reminderDue, type ReplyOutcome } from '../../../app/actions/replies';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { composePrompt } from '../../../core/judge/compose';
import type { Evaluation } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { Dialog } from '../../components/Dialog';
import { StatusMark } from '../../components/StatusMark';
import { labels } from '../../labels';
import { DecidePane } from './DecidePane';
import { MarkedFields } from './MarkedFields';
import { ReplyPane } from './ReplyPane';

/** What the case window asks of the application when the user enters a reply (FR-056). */
export interface ReplyActions {
  save: (caseId: string, text: string, confirmed?: boolean) => Promise<ReplyOutcome>;
  paste: (caseId: string) => Promise<ReplyOutcome>;
}

export interface CaseWindowProps {
  evaluation: Evaluation;
  reviewed: ReviewedCase[];
  caseId: string;
  onChange: (next: Evaluation) => void;
  onNavigate: (caseId: string) => void;
  onClose: () => void;
  onlyAwaiting: boolean;
  onOnlyAwaitingChange: (value: boolean) => void;
  saveBar: { fileName: string | null; repliesSinceSave: number; onSave: () => void; onSaveAs: () => void };
  reply: ReplyActions;
}

export function CaseWindow({ evaluation, reviewed, caseId, onChange, onNavigate, onClose, onlyAwaiting, onOnlyAwaitingChange, saveBar, reply: replyActions }: CaseWindowProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [replacing, setReplacing] = useState<{ text: string; count: number } | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const position = reviewed.findIndex((r) => r.testCase.id === caseId);
  const current = reviewed[position];
  if (!current) return null;

  const list = onlyAwaiting ? reviewed.filter((r) => r.status === 'awaiting') : reviewed;
  const inList = list.findIndex((r) => r.testCase.id === caseId);
  const previous = [...reviewed.slice(0, position)].reverse().find((r) => !onlyAwaiting || r.status === 'awaiting');
  const next = reviewed.slice(position + 1).find((r) => !onlyAwaiting || r.status === 'awaiting');
  const positionLabel = inList >= 0 ? `${inList + 1} of ${list.length}` : `${position + 1} of ${reviewed.length}`;

  const { testCase, effective } = current;
  const reply = evaluation.replies[caseId];
  const judged = evaluation.judge_set.judged_text;
  const prompt = reply?.prompt ?? composePrompt(evaluation.judge_set.prompt, testCase).text;
  const base = testCase.base ? reviewed.find((r) => r.testCase.id === testCase.base)?.testCase : undefined;

  const showInText = (expectedId: string) => {
    const el = textRef.current?.querySelector<HTMLElement>(`mark[data-error="${expectedId}"]`);
    el?.scrollIntoView?.({ block: 'center' });
    el?.focus();
  };

  const left = (
    <div class="case-data">
      <p>
        <span class="muted">Kind: </span>
        <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
        {testCase.base ? <span class="muted">{` · Base: ${testCase.base}${base ? ` (${base.name})` : ''}`}</span> : null}
      </p>
      <MarkedFields testCase={testCase} judged={judged} effective={effective} uncovered={[]} rootRef={textRef} />
      <label class="field-label" for="complete-prompt">
        Complete judge prompt
      </label>
      <textarea id="complete-prompt" class="json" rows={8} readOnly value={prompt} aria-label="Complete judge prompt" />
    </div>
  );

  const text = drafts[caseId] ?? reply?.reply ?? '';
  const changed = text !== (reply?.reply ?? '');
  const setText = (value: string) => setDrafts((d) => ({ ...d, [caseId]: value }));
  const clearDraft = () =>
    setDrafts((d) => {
      const { [caseId]: _gone, ...rest } = d;
      return rest;
    });

  /** The result of an action on the reply: what to say, whether to ask, and the draft that is now saved. */
  const settle = (outcome: ReplyOutcome) => {
    if (outcome.status === 'needs_confirmation') {
      setMessage('');
      setReplacing({ text: outcome.text ?? text, count: outcome.replaces ?? 0 });
      return;
    }
    setMessage(outcome.message ?? '');
    if (outcome.status === 'saved' || outcome.status === 'unchanged') clearDraft();
  };
  const saveReply = async () => settle(await replyActions.save(caseId, text));
  const pasteReply = async () => settle(await replyActions.paste(caseId));
  const confirmReplace = async () => {
    const pending = replacing;
    setReplacing(null);
    if (pending) settle(await replyActions.save(caseId, pending.text, true));
  };

  /** Moving or closing with a reply that was typed and not saved asks first (FR-055). */
  const leave = (go: () => void) => {
    if (changed && text.trim() !== '') setLeaving(() => go);
    else {
      clearDraft();
      setMessage('');
      go();
    }
  };
  const discardAndLeave = () => {
    const go = leaving;
    setLeaving(null);
    clearDraft();
    setMessage('');
    go?.();
  };

  const right = (
    <>
      <ReplyPane
        prompt={prompt}
        saved={reply?.reply}
        text={text}
        onText={setText}
        copied={copied[caseId] === true}
        onCopied={() => setCopied((c) => ({ ...c, [caseId]: true }))}
        onSave={() => void saveReply()}
        onPaste={() => void pasteReply()}
        message={message}
      />
      {reply && effective ? (
        <DecidePane
          reviewed={current}
          effective={effective}
          replyChanged={changed && text.trim() !== ''}
          onExpected={(id, state) => onChange(setExpectedMark(evaluation, caseId, id, state))}
          onAdditional={(item, state) => onChange(item.added !== undefined ? setAddedMark(evaluation, caseId, item.added, state) : setAdditionalMark(evaluation, caseId, item.key, state))}
          onApprove={() => onChange(approveCase(evaluation, caseId))}
          onShowInText={showInText}
        />
      ) : null}
    </>
  );

  return (
    <CaseWindowFrame
      title={`Case ${testCase.id} · ${testCase.name}`}
      index={inList >= 0 ? inList : position}
      total={inList >= 0 ? list.length : reviewed.length}
      positionLabel={positionLabel}
      canPrevious={previous !== undefined}
      canNext={next !== undefined}
      onPrevious={() => previous && leave(() => onNavigate(previous.testCase.id))}
      onNext={() => next && leave(() => onNavigate(next.testCase.id))}
      onClose={() => leave(onClose)}
      left={left}
      right={right}
      headerExtra={
        <>
          <label class="inline-check">
            <input type="checkbox" checked={onlyAwaiting} onChange={(event) => onOnlyAwaitingChange((event.currentTarget as HTMLInputElement).checked)} /> Only cases awaiting verification
          </label>
          <StatusMark status={current.status} />
          <span class="muted">{`${saveBar.repliesSinceSave} not saved`}</span>
          {reminderDue(saveBar.repliesSinceSave) ? (
            <span role="alert" class="save-reminder">
              Save evaluation now.
            </span>
          ) : null}
          <button type="button" onClick={saveBar.onSave}>
            {labels.saveEvaluation}
          </button>
          <button type="button" onClick={saveBar.onSaveAs}>
            {labels.saveEvaluationAs}
          </button>
        </>
      }
      overlay={
        <>
          <Dialog
            open={replacing !== null}
            title="Replace this reply?"
            onClose={() => setReplacing(null)}
            actions={
              <>
                <button type="button" onClick={() => setReplacing(null)}>
                  {labels.cancel}
                </button>
                <button type="button" class="primary" onClick={() => void confirmReplace()}>
                  Replace reply
                </button>
              </>
            }
          >
            <p>{`Replacing this reply removes ${replacing?.count ?? 0} ${replacing?.count === 1 ? 'decision' : 'decisions'} you made. The case is marked again from the new reply.`}</p>
          </Dialog>
          <Dialog
            open={leaving !== null}
            title="The reply in the box is not saved"
            onClose={() => setLeaving(null)}
            actions={
              <>
                <button type="button" class="primary" onClick={() => setLeaving(null)}>
                  {labels.cancel}
                </button>
                <button type="button" onClick={discardAndLeave}>
                  Discard reply
                </button>
              </>
            }
          >
            <p>You typed or pasted a reply and did not press Save reply. If you go on, the text is lost.</p>
          </Dialog>
        </>
      }
    />
  );
}
