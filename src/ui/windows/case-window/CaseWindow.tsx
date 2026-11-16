import { useEffect, useRef, useState } from 'preact/hooks';
import { addFinding, applyOpinionTo, removeFinding } from '../../../app/actions/decide';
import { approveCase, setAddedMark, setAdditionalMark, setExpectedMark } from '../../../app/actions/decisions';
import { reminderDue, removeReply, replaceNeedsQuestion, type ReplyOutcome } from '../../../app/actions/replies';
import { ownValue, repliesOf } from '../../../core/cases/test-run';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { composePrompt } from '../../../core/judge/compose';
import { extractJson } from '../../../core/judge/extract-json';
import type { TestProject } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { Dialog } from '../../components/Dialog';
import { Part } from '../../components/CasePart';
import { PromptButtons } from '../../components/PromptButtons';
import { labels } from '../../labels';
import { DecideBar, ErrorsPane, ExpectedPreview } from './DecidePane';
import { MarkedFields } from './MarkedFields';
import { useShowIssue } from './useShowIssue';
import { SecondOpinionWindow } from '../second-opinion/SecondOpinionWindow';
import { AddFindingDialog } from './AddFindingDialog';
import { ReplyPane } from './ReplyPane';

/** What the case window asks of the application when the user enters a reply (FR-056). */
export interface ReplyActions {
  save: (caseId: string, text: string, confirmed?: boolean) => Promise<ReplyOutcome>;
  paste: (caseId: string, confirmed?: boolean) => Promise<ReplyOutcome>;
}

export interface CaseWindowProps {
  evaluation: TestProject;
  reviewed: ReviewedCase[];
  caseId: string;
  onChange: (next: TestProject) => void;
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
  /** The case whose saved reply is being changed in the box: "Change reply" opens it, "Save reply" asks (T261) and saves, "Cancel" drops the edits (T293). */
  const [editing, setEditing] = useState<string | null>(null);
  /** The finding that was pressed, in the reply or on the right, or that "Show the issue" points at: both places mark it until the next pointing,
   *  a move to another case or Close (T293; research.md, 33.6). */
  const [pointed, setPointed] = useState<string | null>(null);
  const partRef = useRef<HTMLDivElement>(null);
  /** The change that waits for the answer to "Change the judge’s reply?": a text typed into the box, or a paste. */
  const [pending, setPending] = useState<{ kind: 'type'; value: string } | { kind: 'paste' } | { kind: 'remove' } | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [adding, setAdding] = useState(false);
  const [opinionOpen, setOpinionOpen] = useState(false);
  const { strong, shown, show: showInText } = useShowIssue(textRef);
  useEffect(() => {
    setEditing(null);
    setPointed(null);
  }, [caseId]);
  const position = reviewed.findIndex((r) => r.testCase.id === caseId);
  const current = reviewed[position];
  if (!current) return null;

  const list = onlyAwaiting ? reviewed.filter((r) => r.status === 'awaiting') : reviewed;
  const inList = list.findIndex((r) => r.testCase.id === caseId);
  const previous = [...reviewed.slice(0, position)].reverse().find((r) => !onlyAwaiting || r.status === 'awaiting');
  const next = reviewed.slice(position + 1).find((r) => !onlyAwaiting || r.status === 'awaiting');
  const positionLabel = inList >= 0 ? `${inList + 1} of ${list.length}` : `${position + 1} of ${reviewed.length}`;

  const { testCase, effective } = current;
  const reply = repliesOf(evaluation)[caseId];
  const judged = evaluation.judge_set.judged_text;
  const prompt = reply?.prompt ?? composePrompt(evaluation.judge_set.prompt, testCase).text;
  const base = testCase.base ? reviewed.find((r) => r.testCase.id === testCase.base)?.testCase : undefined;

  const text = ownValue(drafts, caseId) ?? reply?.reply ?? '';
  const changed = text !== (reply?.reply ?? '');
  const setText = (value: string) => setDrafts((d) => ({ ...d, [caseId]: value }));
  /** Forgets the draft of this case; with `only`, only while the box still holds that text (the user may have typed on). */
  const clearDraft = (only?: string) =>
    setDrafts((d) => {
      if (!Object.hasOwn(d, caseId) || (only !== undefined && d[caseId] !== only)) return d;
      const { [caseId]: _gone, ...rest } = d;
      return rest;
    });

  /** The result of an action on the reply: what to say, and the draft that is now saved. */
  const settle = (outcome: ReplyOutcome, sent?: string) => {
    setMessage(outcome.message ?? '');
    if (outcome.status === 'saved' || outcome.status === 'unchanged') clearDraft(sent);
  };
  const isEditing = editing === caseId && reply !== undefined;
  // a change of a saved reply was asked about already (T261), so the replies action does not ask again
  const saveText = async (value: string) => {
    const outcome = await replyActions.save(caseId, value, reply !== undefined);
    settle(outcome, value);
    return outcome;
  };
  /**
   * A case without a reply: a readable JSON that comes in one change (a paste or a drop) is saved as soon as it is in the box (FR-056).
   * Text typed one character at a time is saved when the box loses the focus, so a first "{}" or "1" does not save an empty reply (R10).
   */
  const typed = (value: string) => {
    const typedByKey = Math.abs(value.length - text.length) <= 1;
    setText(value);
    if (!typedByKey && reply === undefined && value.trim() !== '' && extractJson(value).ok) void saveText(value);
  };
  const boxLeft = () => {
    if (reply === undefined && !isEditing && text.trim() !== '' && extractJson(text).ok) void saveText(text);
  };
  const pasted = async () => {
    const outcome = await replyActions.paste(caseId, reply !== undefined);
    settle(outcome);
    return outcome;
  };
  /** While a saved reply is changed, typing only changes the draft; "Save reply" saves it (T293). */
  const onText = (value: string) => (isEditing ? setText(value) : typed(value));
  /** The reply is what the judge returned: changing it asks first (T261), and an emptied box removes it (T291). */
  const saveReplyPressed = () => {
    if (text.trim() === '') setPending({ kind: 'remove' });
    else if (!changed) {
      clearDraft();
      setEditing(null);
    } else setPending({ kind: 'type', value: text });
  };
  const cancelEditing = () => {
    clearDraft();
    setMessage('');
    setEditing(null);
  };
  const pasteReply = () => {
    if (reply !== undefined) setPending({ kind: 'paste' });
    else void pasted();
  };
  const confirmChange = async () => {
    const change = pending;
    setPending(null);
    if (change?.kind === 'remove') {
      clearDraft();
      setMessage('');
      setEditing(null);
      onChange(removeReply(evaluation, caseId));
    } else if (change?.kind === 'type') {
      const outcome = await saveText(change.value);
      if (outcome.status === 'saved' || outcome.status === 'unchanged') setEditing(null);
    } else if (change?.kind === 'paste') {
      await pasted();
    }
  };
  /** A block was pressed in the reply: mark it and its line on the right, and bring that line into view (T293). */
  const point = (key: string) => {
    setPointed(key);
    setTimeout(() => {
      // The card is found in code, not with a selector built from the key: a key may hold spaces or quotes (S9).
      const cards = partRef.current?.querySelectorAll<HTMLElement>('[data-finding-keys]') ?? [];
      const card = [...cards].find((c) => {
        try {
          const keys: unknown = JSON.parse(c.dataset['findingKeys'] ?? '[]');
          return Array.isArray(keys) && keys.includes(key);
        } catch {
          return false;
        }
      });
      card?.scrollIntoView?.({ block: 'center' });
    }, 0);
  };
  const handMarks = replaceNeedsQuestion(evaluation, caseId).count;

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

  const unsavedDraft = changed && text.trim() !== '';

  const page = (
    <>
      <Part number={1} title="Case">
        <p>
          <span class="muted">Kind: </span>
          <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
          {testCase.base ? <span class="muted">{` · Base: ${testCase.base}${base ? ` (${base.name})` : ''}`}</span> : null}
        </p>
        <MarkedFields testCase={testCase} judged={judged} effective={effective} strong={strong} shown={shown} rootRef={textRef} columns />
        <PromptButtons prompt={prompt} primary={!reply && !unsavedDraft && ownValue(copied, caseId) !== true} onCopied={() => setCopied((c) => ({ ...c, [caseId]: true }))} />
      </Part>

      <Part number={2} title="Marking">
        <DecideBar reviewed={current} effective={effective ?? null} onAddFinding={() => setAdding(true)} onSecondOpinion={() => setOpinionOpen(true)} />
      </Part>

      <Part number={3} title="Verify the judge reply">
        <div class="case-half" ref={partRef}>
          <ReplyPane
            saved={reply?.reply}
            text={text}
            onText={onText}
            copied={ownValue(copied, caseId) === true}
            onSaveAsText={() => void saveText(text)}
            onPaste={pasteReply}
            message={message}
            editing={isEditing}
            onChangeReply={() => setEditing(caseId)}
            onSaveReply={saveReplyPressed}
            onCancel={cancelEditing}
            onBlur={boxLeft}
            findings={current.findings}
            pointed={pointed}
            onPoint={point}
          />
          {reply && effective ? (
            <ErrorsPane
              reviewed={current}
              effective={effective}
              onExpected={(id, state) => onChange(setExpectedMark(evaluation, caseId, id, state))}
              onAdditional={(item, state) => onChange(item.added !== undefined ? setAddedMark(evaluation, caseId, item.added, state) : setAdditionalMark(evaluation, caseId, item.key, state))}
              onApprove={() => onChange(approveCase(evaluation, caseId))}
              onShowInText={showInText}
              judged={judged}
              onRemove={(item) => item.added !== undefined && onChange(removeFinding(evaluation, caseId, item.added))}
              pointed={pointed}
              onHighlight={isEditing ? undefined : setPointed}
            />
          ) : (
            <ExpectedPreview testCase={testCase} judged={judged} onShowInText={showInText} />
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
              {`${repliesSinceSave} replies are not saved to a file. Close the window and press ${labels.saveTestProject} at the top.`}
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
            open={pending !== null}
            title={pending?.kind === 'remove' ? 'Remove the judge’s reply?' : 'Change the judge’s reply?'}
            onClose={() => setPending(null)}
            actions={
              <>
                <button type="button" onClick={() => setPending(null)}>
                  {labels.cancel}
                </button>
                <button type="button" class="primary" onClick={confirmChange}>
                  {pending?.kind === 'remove' ? 'Remove reply' : 'Change reply'}
                </button>
              </>
            }
          >
            {pending?.kind === 'remove' ? (
              <>
                <p>The reply is what the judge returned, and the results are counted from it. Removing it takes the case out of the results.</p>
                <p>{`The case is Not run again, with no reply and no added findings${handMarks > 0 ? `. The ${handMarks} ${handMarks === 1 ? 'mark you set (by hand or from an opinion) is' : 'marks you set (by hand or from an opinion) are'} removed` : ''}.`}</p>
              </>
            ) : (
              <>
                <p>The reply is what the judge returned, and the results are counted from it. Change it only to put right a mistake in copying it.</p>
                <p>{`The case is marked again from the changed text${handMarks > 0 ? `. The ${handMarks} ${handMarks === 1 ? 'mark you set (by hand or from an opinion) is' : 'marks you set (by hand or from an opinion) are'} removed` : ''}.`}</p>
              </>
            )}
          </Dialog>
          <Dialog
            open={leaving !== null}
            title={isEditing ? 'The changes to the reply are not saved' : 'The reply in the box is not saved'}
            onClose={() => setLeaving(null)}
            actions={
              <>
                <button type="button" onClick={() => setLeaving(null)}>
                  {labels.cancel}
                </button>
                <button type="button" class="primary" onClick={discardAndLeave}>
                  Discard reply
                </button>
              </>
            }
          >
            {isEditing ? <p>The changes to the reply are not saved. Press Save reply to keep them, or go on and they are lost.</p> : extractJson(text).ok ? <p>The text in the box is JSON that was not saved yet. Click outside the box to save it, or go on and the text is lost.</p> : <p>The text in the box is not JSON and was not saved. Press Keep as text to keep it, or go on and the text is lost.</p>}
          </Dialog>
        </>
      }
    />
  );
}
