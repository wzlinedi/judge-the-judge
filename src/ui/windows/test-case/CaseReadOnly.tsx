import { useRef, useState } from 'preact/hooks';
import { listCheckOf } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { composePrompt } from '../../../core/judge/compose';
import { CaseWindowFrame } from '../../components/CaseWindowFrame';
import { CopyButton } from '../../components/CopyButton';
import { Dialog } from '../../components/Dialog';
import { PromptButtons } from '../../components/PromptButtons';
import { labels } from '../../labels';
import { useShowIssue } from '../case-window/useShowIssue';
import { baseNameOf, CaseData, CheckLine, ErrorList } from './CaseData';

export interface CaseReadOnlyProps {
  state: AppState;
  caseId: string;
  onNavigate: (caseId: string) => void;
  onCorrect: (caseId: string) => void;
  /** Opens an empty "From JSON" window, after the original prompt was copied. */
  onRecreate: () => void;
  onClose: () => void;
}

/** "Open": a saved case read-only (FR-086). Nothing in it can be edited. */
export function CaseReadOnly({ state, caseId, onNavigate, onCorrect, onRecreate, onClose }: CaseReadOnlyProps) {
  const [recreating, setRecreating] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const { strong, shown, show: showInText } = useShowIssue(textRef);
  const { dataset, replies, judge_set } = state.evaluation;
  const index = dataset.cases.findIndex((c) => c.id === caseId);
  const testCase = dataset.cases[index];
  if (!testCase) return null;
  const reply = replies[caseId];
  const prompt = reply?.prompt ?? composePrompt(judge_set.prompt, testCase).text;
  const original = testCase.generation_prompt;
  const list = testCase.expected_errors.length > 0 ? listCheckOf(state, testCase) : undefined;
  const copyAndRecreate = async () => {
    try {
      await navigator.clipboard.writeText(original ?? '');
    } catch {
      // the browser may refuse the copy; the window still opens and the prompt stays in the dialog until then
    }
    setRecreating(false);
    onRecreate();
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
          <button type="button" disabled={original === undefined} aria-describedby={original === undefined ? 'recreate-why' : undefined} onClick={() => setRecreating(true)}>
            {labels.recreateTestCase}
          </button>
          {original === undefined ? (
            <span id="recreate-why" class="why-disabled">
              This case does not keep the prompt it was made with.
            </span>
          ) : null}
          {dataset.finalized && !reply ? (
            <button type="button" onClick={() => onCorrect(caseId)}>
              {labels.correctExpectedErrors}
            </button>
          ) : null}
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
            {dataset.finalized && reply ? <p class="muted">This case has a reply, so its expected errors cannot be corrected.</p> : null}
          </section>
        </>
      }
      overlay={
        <Dialog
          open={recreating}
          title="Original prompt"
          wide
          onClose={() => setRecreating(false)}
          actions={
            <>
              <CopyButton text={original ?? ''} label="Copy" />
              <button type="button" class="primary" onClick={() => void copyAndRecreate()}>
                {labels.copyAndRecreate}
              </button>
              <button type="button" onClick={() => setRecreating(false)}>
                {labels.close}
              </button>
            </>
          }
        >
          <textarea class="json prompt-full" rows={4} readOnly value={original ?? ''} aria-label="Original prompt" />
        </Dialog>
      }
    />
  );
}
