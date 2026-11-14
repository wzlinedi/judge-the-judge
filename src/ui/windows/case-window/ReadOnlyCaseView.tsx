import { useRef } from 'preact/hooks';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { SOURCE_LABELS, STATE_LABELS } from '../../../core/evaluation/source-labels';
import { composePrompt } from '../../../core/judge/compose';
import type { Evaluation } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { StatusMark } from '../../components/StatusMark';
import { MarkedFields } from './MarkedFields';

export interface ReadOnlyCaseViewProps {
  evaluation: Evaluation;
  reviewed: ReviewedCase[];
  caseId: string;
  onNavigate: (caseId: string) => void;
  onClose: () => void;
  onOpenOnRun: (caseId: string) => void;
}

/** The case as Results shows it (FR-071): the same frame as the case window of Run, and no action that changes the case. */
export function ReadOnlyCaseView({ evaluation, reviewed, caseId, onNavigate, onClose, onOpenOnRun }: ReadOnlyCaseViewProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const index = reviewed.findIndex((r) => r.testCase.id === caseId);
  const current = reviewed[index];
  if (!current) return null;
  const { testCase, effective } = current;
  const reply = evaluation.replies[caseId];
  const prompt = reply?.prompt ?? composePrompt(evaluation.judge_set.prompt, testCase).text;
  const note = evaluation.decisions[caseId]?.note ?? '';

  const left = (
    <div class="case-data">
      <p>
        <span class="muted">Kind: </span>
        <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
        {testCase.base ? <span class="muted">{` · Base: ${testCase.base}${evaluation.dataset.cases.find((c) => c.id === testCase.base)?.name ? ` (${evaluation.dataset.cases.find((c) => c.id === testCase.base)?.name})` : ''}`}</span> : null}
      </p>
      <MarkedFields testCase={testCase} judged={evaluation.judge_set.judged_text} effective={effective} uncovered={[]} rootRef={textRef} />
      <label class="field-label" for="read-only-prompt">
        Complete judge prompt
      </label>
      <textarea id="read-only-prompt" class="json" rows={8} readOnly value={prompt} />
    </div>
  );

  const right = (
    <div class="decide-pane">
      <h3>Judge’s reply</h3>
      {reply ? (
        <>
          <label class="field-label" for="read-only-reply">
            Judge reply
          </label>
          <textarea id="read-only-reply" class="json" rows={8} readOnly value={reply.reply} />
        </>
      ) : (
        <p>This case has no reply yet.</p>
      )}
      {effective ? (
        <>
          {effective.expected.length > 0 ? (
            <>
              <h4>Expected errors</h4>
              <ul class="decide-list" aria-label="Expected errors">
                {effective.expected.map((e, i) => {
                  const meta = testCase.expected_errors.find((x) => x.id === e.id);
                  return (
                    <li key={e.id} class="decide-item">
                      <strong>{`E${i + 1}`}</strong> {meta?.description} <span>{`— ${STATE_LABELS[e.state]}`}</span>
                      {e.state !== 'undecided' ? <p class="source muted">{SOURCE_LABELS[e.source]}</p> : <p class="reason">{e.reason ?? 'Not decided.'}</p>}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {effective.additional.length > 0 ? (
            <>
              <h4>Additional findings</h4>
              <ul class="decide-list" aria-label="Additional findings">
                {effective.additional.map((a) => (
                  <li key={a.key} class="decide-item">
                    {a.text === '' ? 'A finding about the whole reply' : a.text} <span>{`— ${STATE_LABELS[a.state]}`}</span>
                    {a.category || a.difficulty ? <p class="muted">{[a.category, a.difficulty].filter(Boolean).join(' · ')}</p> : null}
                    {a.state !== 'undecided' ? <p class="source muted">{SOURCE_LABELS[a.source]}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
      {note !== '' ? <p>{`Note: ${note}`}</p> : null}
    </div>
  );

  return (
    <CaseWindowFrame
      title={`Case ${testCase.id} · ${testCase.name}`}
      index={index}
      total={reviewed.length}
      canPrevious={index > 0}
      canNext={index < reviewed.length - 1}
      onPrevious={() => onNavigate((reviewed[index - 1] as ReviewedCase).testCase.id)}
      onNext={() => onNavigate((reviewed[index + 1] as ReviewedCase).testCase.id)}
      onClose={onClose}
      left={left}
      right={right}
      headerExtra={
        <>
          <StatusMark status={current.status} />
          <button type="button" onClick={() => onOpenOnRun(caseId)}>
            Open on Run
          </button>
        </>
      }
    />
  );
}
