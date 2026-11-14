import { useRef } from 'preact/hooks';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { STATE_LABELS } from '../../../core/evaluation/source-labels';
import { SOURCE_LABELS } from '../../components/sources';
import { markProgress } from '../../../core/evaluation/mark-progress';
import { composePrompt } from '../../../core/judge/compose';
import type { Evaluation } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { StatusMark } from '../../components/StatusMark';
import { Part } from '../../components/CasePart';
import { PromptButtons } from '../../components/PromptButtons';
import { MarkedFields } from './MarkedFields';
import { Place } from './DecidePane';
import { whereInCase } from './marks';

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

  const progress = effective ? markProgress(effective) : null;
  const judged = evaluation.judge_set.judged_text;
  const baseCase = testCase.base ? evaluation.dataset.cases.find((c) => c.id === testCase.base) : undefined;

  const page = (
    <>
      <Part number={1} title="Case">
        <p>
          <span class="muted">Kind: </span>
          <strong>{testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</strong>
          {testCase.base ? <span class="muted">{` · Base: ${testCase.base}${baseCase?.name ? ` (${baseCase.name})` : ''}`}</span> : null}
        </p>
        <MarkedFields testCase={testCase} judged={judged} effective={effective} uncovered={[]} rootRef={textRef} />
        <PromptButtons prompt={prompt} />
      </Part>

      <Part number={2} title="Result">
        <div class="decide-bar">
          {progress ? <span class="mark-meter">{`Marked ${progress.marked} of ${progress.total}`}</span> : null}
          <StatusMark status={current.status} />
        </div>
        {note !== '' ? <p>{`Note: ${note}`}</p> : null}
      </Part>

      <Part number={3} title="Judge reply">
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
      </Part>

      <Part number={4} title="Errors">
        {effective && (effective.expected.length > 0 || effective.additional.length > 0) ? (
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
                        {meta?.fragment ? <p class="muted item-fragment">{`Fragment: “${meta.fragment}”`}</p> : null}
                        <Place field={meta?.fragment ? whereInCase(testCase, judged, meta.fragment)?.field : null} />
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
                      <Place field={a.text === '' ? null : whereInCase(testCase, judged, a.text)?.field} />
                      {a.category || a.difficulty ? <p class="muted">{[a.category, a.difficulty].filter(Boolean).join(' · ')}</p> : null}
                      {a.state !== 'undecided' ? <p class="source muted">{SOURCE_LABELS[a.source]}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <p class="muted">{reply ? 'No errors were expected or found in this case.' : 'The errors appear when the judge’s reply is saved.'}</p>
        )}
      </Part>
    </>
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
      page={page}
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
