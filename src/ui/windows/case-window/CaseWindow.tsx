import { useRef, useState } from 'preact/hooks';
import { addFinding, applyOpinionTo, removeFinding } from '../../../app/actions/decide';
import { approveCase, setAddedMark, setAdditionalMark, setExpectedMark } from '../../../app/actions/decisions';
import { reminderDue, type ReplyOutcome } from '../../../app/actions/replies';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { composePrompt } from '../../../core/judge/compose';
import { extractJson } from '../../../core/judge/extract-json';
import type { Evaluation } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { Dialog } from '../../components/Dialog';
import { Part } from '../../components/CasePart';
import { PromptButtons } from '../../components/PromptButtons';
import { labels } from '../../labels';
import { DecideBar, ErrorsPane } from './DecidePane';
import { MarkedFields } from './MarkedFields';
import { SecondOpinionWindow } from '../second-opinion/SecondOpinionWindow';
import { AddFindingDialog } from './AddFindingDialog';
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
  /** Replies not saved to a file; the window only reminds, the save buttons are in the page header (T242). */
  repliesSinceSave: number;
  reply: ReplyActions;
}

export function CaseWindow({ evaluation, reviewed, caseId, onChange, onNavigate, onClose, onlyAwaiting, onOnlyAwaitingChange, repliesSinceSave, reply: replyActions }: CaseWindowProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [replacing, setReplacing] = useState<{ text: string; count: number } | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [adding, setAdding] = useState(false);
  const [opinionOpen, setOpinionOpen] = useState(false);
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

  const text = drafts[caseId] ?? reply?.reply ?? '';
  const changed = text !== (reply?.reply ?? '');
  const setText = (value: string) => setDrafts((d) => ({ ...d, [caseId]: value }));
  /** Forgets the draft of this case; with `only`, only while the box still holds that text (the user may have typed on). */
  const clearDraft = (only?: string) =>
    setDrafts((d) => {
      if (!(caseId in d) || (only !== undefined && d[caseId] !== only)) return d;
      const { [caseId]: _gone, ...rest } = d;
      return rest;
    });

  /** The result of an action on the reply: what to say, whether to ask, and the draft that is now saved. */
  const settle = (outcome: ReplyOutcome, sent?: string) => {
    if (outcome.status === 'needs_confirmation') {
      setMessage('');
      setReplacing({ text: outcome.text ?? sent ?? text, count: outcome.replaces ?? 0 });
      return;
    }
    setMessage(outcome.message ?? '');
    if (outcome.status === 'saved' || outcome.status === 'unchanged') clearDraft(sent);
  };
  const saveText = async (value: string) => settle(await replyActions.save(caseId, value), value);
  const pasteReply = async () => settle(await replyActions.paste(caseId));
  const confirmReplace = async () => {
    const pending = replacing;
    setReplacing(null);
    if (pending) settle(await replyActions.save(caseId, pending.text, true), pending.text);
  };
  /** A reply that is readable JSON is saved as soon as it is in the box, typed or pasted (FR-056). */
  const onText = (value: string) => {
    setText(value);
    if (value.trim() !== '' && value !== (reply?.reply ?? '') && extractJson(value).ok) void saveText(value);
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

  const notJsonDraft = changed && text.trim() !== '' && !extractJson(text).ok;

  const page = (
    <>
      <Part number={1} title="Case">
        <p>
          <span class="muted">Kind: </span>
          <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
          {testCase.base ? <span class="muted">{` · Base: ${testCase.base}${base ? ` (${base.name})` : ''}`}</span> : null}
        </p>
        <MarkedFields testCase={testCase} judged={judged} effective={effective} uncovered={[]} rootRef={textRef} />
        <PromptButtons prompt={prompt} primary={!reply && !notJsonDraft && copied[caseId] !== true} onCopied={() => setCopied((c) => ({ ...c, [caseId]: true }))} />
      </Part>

      <Part number={2} title="Marking">
        <DecideBar reviewed={current} effective={effective ?? null} onAddFinding={() => setAdding(true)} onSecondOpinion={() => setOpinionOpen(true)} />
      </Part>

      <Part number={3} title="Judge reply and errors">
        <div class="case-half">
          <ReplyPane
            saved={reply?.reply}
            text={text}
            onText={onText}
            copied={copied[caseId] === true}
            onSaveAsText={() => void saveText(text)}
            onPaste={() => void pasteReply()}
            message={message}
          />
          {reply && effective ? (
            <ErrorsPane
              reviewed={current}
              effective={effective}
              onExpected={(id, state) => onChange(setExpectedMark(evaluation, caseId, id, state))}
              onAdditional={(item, state) => onChange(item.added !== undefined ? setAddedMark(evaluation, caseId, item.added, state) : setAdditionalMark(evaluation, caseId, item.key, state))}
              onApprove={() => onChange(approveCase(evaluation, caseId))}
              onShowInText={showInText}
              onRemove={(item) => item.added !== undefined && onChange(removeFinding(evaluation, caseId, item.added))}
            />
          ) : (
            <section class="decide-pane">
              <h4>Errors</h4>
              <p class="muted">The errors appear here when the judge’s reply is saved.</p>
            </section>
          )}
        </div>
      </Part>
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
      page={page}
      headerExtra={
        <>
          <label class="inline-check">
            <input type="checkbox" checked={onlyAwaiting} onChange={(event) => onOnlyAwaitingChange((event.currentTarget as HTMLInputElement).checked)} /> Only cases awaiting verification
          </label>
          <span class="muted">{`${repliesSinceSave} not saved`}</span>
          {reminderDue(repliesSinceSave) ? (
            <span role="alert" class="save-reminder">
              {`${repliesSinceSave} replies are not saved to a file. Close the window and press ${labels.saveEvaluation} at the top.`}
            </span>
          ) : null}
        </>
      }
      overlay={
        <>
          {adding ? (
            <AddFindingDialog
              catalog={evaluation.judge_set.error_catalog}
              onAdd={(finding) => {
                setAdding(false);
                onChange(addFinding(evaluation, caseId, finding));
              }}
              onClose={() => setAdding(false)}
            />
          ) : null}
          {opinionOpen ? (
            <SecondOpinionWindow
              evaluation={evaluation}
              reviewed={current}
              onApply={(plan) => {
                setOpinionOpen(false);
                onChange(applyOpinionTo(evaluation, caseId, plan));
              }}
              onClose={() => setOpinionOpen(false)}
            />
          ) : null}
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
            <p>The text in the box is not JSON and was not saved. Press Keep as text to keep it, or go on and the text is lost.</p>
          </Dialog>
        </>
      }
    />
  );
}
