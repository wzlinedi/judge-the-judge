import { useRef } from 'preact/hooks';
import { approveCase, setAddedMark, setAdditionalMark, setExpectedMark } from '../../../app/actions/decisions';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { composePrompt } from '../../../core/judge/compose';
import type { Evaluation } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { StatusMark } from '../../components/StatusMark';
import { labels } from '../../labels';
import { DecidePane } from './DecidePane';
import { applyMarks } from './marks';

const MARK_SIGNS: Record<string, string> = { found: '✓', missed: '✕', undecided: '?', ignored: '–' };

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
}

export function CaseWindow({ evaluation, reviewed, caseId, onChange, onNavigate, onClose, onlyAwaiting, onOnlyAwaitingChange, saveBar }: CaseWindowProps) {
  const textRef = useRef<HTMLDivElement>(null);
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
      <div ref={textRef}>
        {Object.entries(testCase.fields).map(([name, text]) => (
          <section key={name} class="field-block">
            <h3>{name}{name === judged ? ' (judged text)' : ''}</h3>
            <p class="field-text">
              {(name === judged ? applyMarks(text, testCase, effective) : [{ text }]).map((segment, i) =>
                segment.error ? (
                  <mark key={i} class={`fragment fragment-${segment.error.state}`} data-error={segment.error.id} tabIndex={-1}>
                    <sup>{`${segment.error.label} ${MARK_SIGNS[segment.error.state] ?? ''}`}</sup>
                    {segment.text}
                  </mark>
                ) : (
                  <span key={i}>{segment.text}</span>
                ),
              )}
            </p>
          </section>
        ))}
      </div>
      <label class="field-label" for="complete-prompt">
        Complete judge prompt
      </label>
      <textarea id="complete-prompt" class="json" rows={8} readOnly value={prompt} aria-label="Complete judge prompt" />
    </div>
  );

  const right =
    reply && effective ? (
      <DecidePane
        reviewed={current}
        effective={effective}
        reply={reply.reply}
        onExpected={(id, state) => onChange(setExpectedMark(evaluation, caseId, id, state))}
        onAdditional={(item, state) => onChange(item.added !== undefined ? setAddedMark(evaluation, caseId, item.added, state) : setAdditionalMark(evaluation, caseId, item.key, state))}
        onApprove={() => onChange(approveCase(evaluation, caseId))}
        onShowInText={showInText}
      />
    ) : (
      <div class="decide-pane">
        <h3>Judge’s reply</h3>
        <p>This case has no reply yet.</p>
      </div>
    );

  return (
    <CaseWindowFrame
      title={`Case ${testCase.id} · ${testCase.name}`}
      index={inList >= 0 ? inList : position}
      total={inList >= 0 ? list.length : reviewed.length}
      positionLabel={positionLabel}
      canPrevious={previous !== undefined}
      canNext={next !== undefined}
      onPrevious={() => previous && onNavigate(previous.testCase.id)}
      onNext={() => next && onNavigate(next.testCase.id)}
      onClose={onClose}
      left={left}
      right={right}
      headerExtra={
        <>
          <label class="inline-check">
            <input type="checkbox" checked={onlyAwaiting} onChange={(event) => onOnlyAwaitingChange((event.currentTarget as HTMLInputElement).checked)} /> Only cases awaiting verification
          </label>
          <StatusMark status={current.status} />
          <span class="muted">{`${saveBar.repliesSinceSave} not saved`}</span>
          <button type="button" class="primary" onClick={saveBar.onSave}>
            {labels.saveEvaluation}
          </button>
          <button type="button" onClick={saveBar.onSaveAs}>
            {labels.saveEvaluationAs}
          </button>
        </>
      }
    />
  );
}
