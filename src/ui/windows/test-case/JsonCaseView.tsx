import { useRef, useState } from 'preact/hooks';
import type { CaseEdit } from '../../../app/actions/cases';
import { listCheckOf } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { findVariables } from '../../../core/judge/variables';
import type { CaseJsonCheck, TestCase } from '../../../core/model';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { baseNameOf, CaseData, CheckLine, ErrorList } from './CaseData';
import { SaveCaseButton } from './SaveCaseButton';
import { TestCaseFrame } from './TestCaseFrame';

export interface JsonCaseViewProps {
  state: AppState;
  /** `paste`: a new case from JSON (also Clone). `inject`: parts 2 and 3 of a case with injected errors. `correct`: only the expected errors of a saved case may change. */
  mode: 'paste' | 'inject' | 'correct';
  caseId?: string;
  initialText: string;
  /** Keeps the text outside the view, so that Back to part 1 does not lose it. */
  onTextChange?: (text: string) => void;
  base?: string;
  errorsToPrepare?: number;
  /** Back from the JSON box (part 2) to part 1. */
  onBack?: () => void;
  /** True when something before this view was typed (part 1). */
  touched?: boolean;
  title?: string;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

export function contextOf(state: AppState) {
  const { judge_set, dataset } = state.evaluation;
  return { variables: findVariables(judge_set.prompt), judgedText: judge_set.judged_text, catalog: judge_set.error_catalog, existingCases: dataset.cases };
}

export function Status({ check }: { check: CaseJsonCheck }) {
  return (
    <div class="check-status">
      {check.problems.length === 0 && check.kind ? (
        <p class="muted">{check.kind === 'Clean' ? 'This will be saved as a clean case.' : 'This will be saved as a case with injected errors.'}</p>
      ) : null}
      {check.notes.length > 0 ? (
        <ul class="plain-list" aria-label="Notes">
          {check.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {check.warnings.length > 0 ? (
        <ul class="plain-list" aria-label="Warnings">
          {check.warnings.map((w) => (
            <li key={w} class="warning-text">{`Warning: ${w}`}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The JSON box (FR-041, FR-090) and, after Next, the case view (FR-085): the one JSON box checked as it changes. */
export function JsonCaseView({ state, mode, caseId, initialText, onTextChange, base, errorsToPrepare, onBack, touched, title, onApply, onClose }: JsonCaseViewProps) {
  const [text, setText] = useState(initialText);
  const [stage, setStage] = useState<'json' | 'case'>(mode === 'correct' ? 'case' : 'json');
  const [strong, setStrong] = useState<string | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const lastValid = useRef<Omit<TestCase, 'id'> | undefined>(undefined);
  const original = caseId ? state.evaluation.dataset.cases.find((c) => c.id === caseId) : undefined;
  const check = text.trim() === '' ? undefined : checkCaseJson(text, { ...contextOf(state), mode, ...(base !== undefined && base !== '' ? { base } : {}), ...(errorsToPrepare !== undefined ? { errorsToPrepare } : {}), ...(original ? { original } : {}) });
  const valid = check !== undefined && check.case !== undefined;
  const judged = state.evaluation.judge_set.judged_text;
  if (check?.case) lastValid.current = check.case;
  const shown = check?.case ?? lastValid.current;
  const outOfDate = stage === 'case' && shown !== undefined && !valid;
  const list = shown ? listCheckOf(state, shown) : undefined;

  const change = (value: string) => {
    setText(value);
    onTextChange?.(value);
  };
  const showInText = (expectedId: string) => {
    setStrong(expectedId);
    const element = textRef.current?.querySelector<HTMLElement>(`mark[data-error="${expectedId}"]`);
    element?.scrollIntoView?.({ block: 'center' });
    element?.focus();
  };

  const hint =
    mode === 'inject'
      ? stage === 'json'
        ? 'Part 2 of 3. Paste the answer of your LLM into the box. It is checked as you paste it, and Next is enabled when it is valid.'
        : 'Part 3 of 3. Check the case, then save it. To change anything, change the JSON in the box.'
      : undefined;
  const box = (
    <>
      {hint && stage === 'json' ? <p class="muted">{hint}</p> : null}
      <JsonBox label="Case JSON" value={text} onChange={change} check={() => check?.problems ?? []} rows={stage === 'json' ? 18 : 12} />
      {check ? <Status check={check} /> : null}
    </>
  );

  const heading = title ?? (mode === 'correct' ? labels.correctExpectedErrors : stage === 'json' ? (mode === 'inject' ? labels.caseWithInjectedErrors : labels.pasteJson) : 'Case view');
  const back = stage === 'case' && mode !== 'correct' ? () => setStage('json') : stage === 'json' ? onBack : undefined;

  return (
    <TestCaseFrame
      title={heading}
      dirty={(touched ?? false) || (mode === 'inject' ? text !== '' : text !== initialText)}
      onClose={onClose}
      headerExtra={
        <>
          {back ? (
            <button type="button" onClick={back}>
              {labels.back}
            </button>
          ) : null}
          {stage === 'json' ? (
            <button type="button" disabled={!valid} onClick={() => setStage('case')}>
              {labels.next}
            </button>
          ) : null}
          <SaveCaseButton state={state} text={text} mode={mode} {...(caseId ? { caseId } : {})} {...(base !== undefined ? { base } : {})} {...(errorsToPrepare !== undefined ? { errorsToPrepare } : {})} check={check} onApply={onApply} onClose={onClose} />
        </>
      }
      left={
        stage === 'json' ? (
          box
        ) : shown ? (
          <>
            {outOfDate ? <p class="out-of-date warning-text">Out of date</p> : null}
            <CaseData testCase={shown} judged={judged} uncovered={list?.uncovered ?? []} strong={strong} rootRef={textRef} baseName={baseNameOf(state, shown.base)} />
          </>
        ) : (
          <p class="muted">The JSON is not valid yet. Fix it in the box on the right.</p>
        )
      }
      right={
        stage === 'json' ? undefined : (
          <>
            {hint ? <p class="muted">{hint}</p> : null}
            {shown && list ? (
              <>
                <CheckLine list={list} testCase={shown} />
                <ErrorList testCase={shown} onShow={showInText} notInText={new Set(list.notInText.map((m) => m.index))} />
              </>
            ) : null}
            {box}
          </>
        )
      }
    />
  );
}
