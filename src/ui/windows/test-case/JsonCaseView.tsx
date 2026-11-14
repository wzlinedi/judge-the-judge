import { useState } from 'preact/hooks';
import { saveCaseFromJson, correctExpectedErrors, type CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { findVariables } from '../../../core/judge/variables';
import type { CaseJsonCheck } from '../../../core/model';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { CaseData, ErrorList } from './CaseData';
import { TestCaseFrame } from './TestCaseFrame';

export interface JsonCaseViewProps {
  state: AppState;
  /** `paste`: a new case from JSON (also Clone). `correct`: only the expected errors of a saved case may change. */
  mode: 'paste' | 'correct';
  caseId?: string;
  initialText: string;
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

/** "Paste JSON" (FR-090) and, after Next, the case view (FR-085): the one JSON box checked as it changes. */
export function JsonCaseView({ state, mode, caseId, initialText, onApply, onClose }: JsonCaseViewProps) {
  const [text, setText] = useState(initialText);
  const [stage, setStage] = useState<'json' | 'case'>(mode === 'correct' ? 'case' : 'json');
  const original = caseId ? state.evaluation.dataset.cases.find((c) => c.id === caseId) : undefined;
  const check = text.trim() === '' ? undefined : checkCaseJson(text, { ...contextOf(state), mode, ...(original ? { original } : {}) });
  const valid = check !== undefined && check.case !== undefined;
  const judged = state.evaluation.judge_set.judged_text;

  const save = () => {
    const edit = mode === 'correct' && caseId ? correctExpectedErrors(state, caseId, text) : saveCaseFromJson(state, text, { mode: 'paste' });
    onApply(edit);
    if (!edit.problems || edit.problems.length === 0) {
      if (edit.state !== state) onClose();
    }
  };

  const box = (
    <>
      <JsonBox label="Case JSON" value={text} onChange={setText} check={() => check?.problems ?? []} rows={stage === 'json' ? 18 : 12} />
      {check ? <Status check={check} /> : null}
    </>
  );

  return (
    <TestCaseFrame
      title={mode === 'correct' ? labels.correctExpectedErrors : stage === 'json' ? labels.pasteJson : 'Case view'}
      dirty={text !== initialText}
      onClose={onClose}
      headerExtra={
        <>
          {stage === 'json' ? (
            <button type="button" disabled={!valid} onClick={() => setStage('case')}>
              {labels.next}
            </button>
          ) : null}
          <button type="button" class="primary" disabled={!valid} onClick={save}>
            {labels.saveCase}
          </button>
        </>
      }
      left={stage === 'json' ? box : check?.case ? <CaseData testCase={check.case} judged={judged} /> : <p class="muted">The JSON is not valid yet. Fix it in the box on the right.</p>}
      right={stage === 'json' ? undefined : (
        <>
          {check?.case ? <ErrorList testCase={check.case} /> : null}
          {box}
        </>
      )}
    />
  );
}
