import { useRef, useState } from 'preact/hooks';
import { listCheckOf } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { caseToJson } from '../../../core/cases/case-json';
import { composePrompt } from '../../../core/judge/compose';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { CopyButton } from '../../components/CopyButton';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { baseNameOf, CaseData, CheckLine, ErrorList } from './CaseData';

export interface CaseReadOnlyProps {
  state: AppState;
  caseId: string;
  onNavigate: (caseId: string) => void;
  onClone: (caseId: string) => void;
  onCorrect: (caseId: string) => void;
  onClose: () => void;
}

/** "Open": a saved case read-only (FR-086). Nothing in it can be edited. */
export function CaseReadOnly({ state, caseId, onNavigate, onClone, onCorrect, onClose }: CaseReadOnlyProps) {
  const [showJson, setShowJson] = useState(false);
  const [strong, setStrong] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { dataset, replies, judge_set } = state.evaluation;
  const index = dataset.cases.findIndex((c) => c.id === caseId);
  const testCase = dataset.cases[index];
  if (!testCase) return null;
  const reply = replies[caseId];
  const prompt = reply?.prompt ?? composePrompt(judge_set.prompt, testCase).text;
  const json = caseToJson(testCase);
  const list = testCase.expected_errors.length > 0 ? listCheckOf(state, testCase) : undefined;
  const showInText = (expectedId: string) => {
    setStrong(expectedId);
    const element = textRef.current?.querySelector<HTMLElement>(`mark[data-error="${expectedId}"]`);
    element?.scrollIntoView?.({ block: 'center' });
    element?.focus();
  };
  const previous = dataset.cases[index - 1];
  const next = dataset.cases[index + 1];

  return (
    <CaseWindowFrame
      title={`Case ${testCase.id} · ${testCase.name || `Case ${testCase.id}`}`}
      index={index}
      total={dataset.cases.length}
      onPrevious={() => previous && onNavigate(previous.id)}
      onNext={() => next && onNavigate(next.id)}
      onClose={onClose}
      headerExtra={
        <>
          <button type="button" onClick={() => onClone(caseId)}>
            {labels.clone}
          </button>
          {dataset.finalized && !reply ? (
            <button type="button" onClick={() => onCorrect(caseId)}>
              {labels.correctExpectedErrors}
            </button>
          ) : null}
        </>
      }
      left={
        <>
          <CaseData testCase={testCase} judged={judge_set.judged_text} uncovered={list?.uncovered ?? []} strong={strong} rootRef={textRef} baseName={baseNameOf(state, testCase.base)} />
          <label class="field-label" for="read-prompt">
            Complete judge prompt
          </label>
          <textarea id="read-prompt" class="json" rows={8} readOnly value={prompt} aria-label="Complete judge prompt" />
          <CopyButton text={prompt} label={labels.copyPrompt} />
        </>
      }
      right={
        <>
          <h3>Expected errors</h3>
          {list ? <CheckLine list={list} testCase={testCase} /> : null}
          <ErrorList testCase={testCase} onShow={showInText} notInText={new Set(list?.notInText.map((m) => m.index) ?? [])} />
          {dataset.finalized && reply ? <p class="muted">This case has a reply, so its expected errors cannot be corrected.</p> : null}
          {reply ? (
            <>
              <h3>Judge’s reply</h3>
              <textarea class="json" rows={6} readOnly aria-label="Judge’s reply" value={reply.reply} />
            </>
          ) : null}
          <div class="button-row">
            <button type="button" aria-expanded={showJson} onClick={() => setShowJson(!showJson)}>
              {labels.showJson}
            </button>
            {showJson ? <CopyButton text={json} label={labels.copyJson} /> : null}
          </div>
          {showJson ? <JsonBox label="Case JSON" value={json} onChange={() => {}} check={() => []} readOnly rows={12} /> : null}
        </>
      }
    />
  );
}
