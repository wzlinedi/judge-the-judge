import { useRef, useState } from 'preact/hooks';
import { listCheckOf } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { composePrompt } from '../../../core/judge/compose';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { PromptButtons } from '../../components/PromptButtons';
import { labels } from '../../labels';
import { useShowIssue } from '../case-window/useShowIssue';
import type { CaseEdit } from '../../../app/actions/cases';
import { ExpectedErrorsDialog } from './ExpectedErrorsDialog';
import { baseNameOf, CaseData, CheckLine, ErrorList } from './CaseData';

export interface CaseReadOnlyProps {
  state: AppState;
  caseId: string;
  onNavigate: (caseId: string) => void;
  onApply: (edit: CaseEdit) => void;
  /** Opens an empty "From JSON" window, after the original prompt was copied; the window shows that prompt with "Show prompt" (T255). */
  onClose: () => void;
}

/** "Open": a saved case read-only (FR-086). Nothing in it can be edited. */
export function CaseReadOnly({ state, caseId, onNavigate, onApply, onClose }: CaseReadOnlyProps) {
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const { strong, shown, show: showInText } = useShowIssue(textRef);
  const { dataset, replies, judge_set } = state.evaluation;
  const index = dataset.cases.findIndex((c) => c.id === caseId);
  const testCase = dataset.cases[index];
  if (!testCase) return null;
  const reply = replies[caseId];
  const prompt = reply?.prompt ?? composePrompt(judge_set.prompt, testCase).text;
  const list = testCase.expected_errors.length > 0 ? listCheckOf(state, testCase) : undefined;
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
          <button type="button" onClick={() => setEditing(true)}>
            {labels.correctExpectedErrors}
          </button>
        </>
      }
      left={
        <>
          <section class="frame" aria-label="Case data">
            <CaseData testCase={testCase} judged={judge_set.judged_text} uncovered={list?.uncovered ?? []} strong={strong} shown={shown} rootRef={textRef} baseName={baseNameOf(state, testCase.base)} />
          </section>
          <section class="frame" aria-label="Prompt">
            <h3>Prompt</h3>
            <PromptButtons prompt={prompt} />
          </section>
        </>
      }
      right={
        <>
          <section class="frame" aria-label="Expected errors">
            <h3>Expected errors</h3>
            {list ? <CheckLine list={list} testCase={testCase} /> : null}
            <ErrorList testCase={testCase} judged={judge_set.judged_text} onShow={showInText} />
          </section>
        </>
      }
      overlay={
        <>
        {editing ? <ExpectedErrorsDialog state={state} caseId={caseId} onApply={onApply} onClose={() => setEditing(false)} /> : null}
        </>
      }
    />
  );
}
