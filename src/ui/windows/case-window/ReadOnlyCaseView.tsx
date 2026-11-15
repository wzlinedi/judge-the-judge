import { useRef } from 'preact/hooks';
import type { Effective } from '../../../core/evaluation/decisions';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { STATE_LABELS } from '../../../core/evaluation/source-labels';
import { composePrompt } from '../../../core/judge/compose';
import type { Evaluation } from '../../../core/model';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { Part } from '../../components/CasePart';
import { SOURCE_LABELS } from '../../components/sources';
import { StatusMark } from '../../components/StatusMark';
import { ErrorCard } from './ErrorCard';
import { errorSides } from './marks';
import { MarkedFields } from './MarkedFields';
import { showTargetOf, useShowIssue } from './useShowIssue';

export interface ReadOnlyCaseViewProps {
  evaluation: Evaluation;
  reviewed: ReviewedCase[];
  caseId: string;
  onNavigate: (caseId: string) => void;
  onClose: () => void;
  onOpenOnRun: (caseId: string) => void;
}

const count = (n: number, word: string) => (n === 0 ? [] : [`${n} ${word}`]);

/** "3 expected: 2 found, 1 not found · Additional: 2 false positive": what the case came to, before the errors (T256). */
export function errorsSummary(effective: Pick<Effective, 'expected' | 'additional'>): string {
  const by = (items: ReadonlyArray<{ state: string }>, state: string) => items.filter((i) => i.state === state).length;
  const expected = effective.expected;
  const additional = effective.additional;
  const left = expected.length === 0 ? 'No expected errors' : `${expected.length} expected: ${[...count(by(expected, 'found'), 'found'), ...count(by(expected, 'missed'), 'not found'), ...count(by(expected, 'ignored'), 'ignored'), ...count(by(expected, 'undecided'), 'undecided')].join(', ')}`;
  const right = additional.length === 0 ? 'no additional errors' : `Additional: ${[...count(by(additional, 'real_error'), 'real error (missed in scenario)'), ...count(by(additional, 'false_positive'), 'false positive'), ...count(by(additional, 'ignored'), 'ignored'), ...count(by(additional, 'undecided'), 'undecided')].join(', ')}`;
  return `${left} · ${right}`;
}

/**
 * The case as Results shows it (FR-071, T256): the same frame and the same parts as the case window of Run, and no action that changes the case.
 * 1. Case (the fields with the highlights and the complete prompt), 2. Judge reply (read-only), 3. Errors (a summary line, then the two groups).
 */
export function ReadOnlyCaseView({ evaluation, reviewed, caseId, onNavigate, onClose, onOpenOnRun }: ReadOnlyCaseViewProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const { strong, shown, show } = useShowIssue(textRef);
  const index = reviewed.findIndex((r) => r.testCase.id === caseId);
  const current = reviewed[index];
  if (!current) return null;
  const { testCase, effective } = current;
  const reply = evaluation.replies[caseId];
  const prompt = reply?.prompt ?? composePrompt(evaluation.judge_set.prompt, testCase).text;
  const note = evaluation.decisions[caseId]?.note ?? '';
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
        <MarkedFields testCase={testCase} judged={judged} effective={effective} uncovered={[]} strong={strong} shown={shown} rootRef={textRef} />
        <label class="field-label" for="read-only-prompt">
          Complete judge prompt
        </label>
        <textarea id="read-only-prompt" class="json prompt-full" rows={8} readOnly value={prompt} />
      </Part>

      <Part number={2} title="Judge reply">
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
        {note !== '' ? <p>{`Note: ${note}`}</p> : null}
      </Part>

      <Part number={3} title="Errors">
        {effective && (effective.expected.length > 0 || effective.additional.length > 0) ? (
          <>
            <p class="errors-summary" role="status" aria-label="Summary of the errors">
              {errorsSummary(effective)}
            </p>
            {effective.expected.length > 0 ? (
              <>
                <h4>Expected errors</h4>
                <ul class="decide-list" aria-label="Expected errors">
                  {effective.expected.map((e, i) => {
                    const meta = testCase.expected_errors.find((x) => x.id === e.id);
                    const sides = errorSides(testCase, judged, meta ?? {});
                    return (
                      <li key={e.id} class="decide-item" data-expected={e.id}>
                        <ErrorCard name={`E${i + 1}`} title={meta?.description ?? ''} facts={[meta?.category, meta?.difficulty].filter((x): x is NonNullable<typeof x> => !!x)} sides={sides} onShow={() => show(showTargetOf(sides, e.id))}>
                          <p class="error-state">{STATE_LABELS[e.state]}</p>
                          {e.state !== 'undecided' ? <p class="source muted">{SOURCE_LABELS[e.source]}</p> : <p class="reason">{e.reason ?? 'Not decided.'}</p>}
                        </ErrorCard>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            {effective.additional.length > 0 ? (
              <>
                <h4>Additional errors</h4>
                <ul class="decide-list" aria-label="Additional errors">
                  {effective.additional.map((a) => {
                    const sides = a.text === '' ? [] : errorSides(testCase, judged, { fragment: a.text });
                    return (
                      <li key={a.key} class="decide-item" data-additional={a.key}>
                        <ErrorCard title={a.text === '' ? 'A finding about the whole reply' : 'Found by the judge'} facts={[a.category, a.difficulty].filter((x): x is NonNullable<typeof x> => !!x)} sides={sides} onShow={() => show(showTargetOf(sides))}>
                          <p class="error-state">{STATE_LABELS[a.state]}</p>
                          {a.state !== 'undecided' ? <p class="source muted">{SOURCE_LABELS[a.source]}</p> : null}
                        </ErrorCard>
                      </li>
                    );
                  })}
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
