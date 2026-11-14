import { useState } from 'preact/hooks';
import type { CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { labels } from '../../labels';
import { AnswerBox, contextOf, ExpectedErrorsPart, Part } from './CaseParts';
import { SaveCaseButton } from './SaveCaseButton';
import { TestCaseFrame } from './TestCaseFrame';

export interface JsonCaseViewProps {
  state: AppState;
  /** `paste`: a new case from JSON. `correct`: only the expected errors of a saved case may change. */
  mode: 'paste' | 'correct';
  caseId?: string;
  initialText: string;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** Paste JSON and Correct expected errors (FR-041, FR-090): the box checked as it changes, and under it the list of expected errors, on one page. */
export function JsonCaseView({ state, mode, caseId, initialText, onApply, onClose }: JsonCaseViewProps) {
  const [text, setText] = useState(initialText);
  const original = caseId ? state.evaluation.dataset.cases.find((c) => c.id === caseId) : undefined;
  const check = text.trim() === '' ? undefined : checkCaseJson(text, { ...contextOf(state), mode, ...(original ? { original } : {}) });

  return (
    <TestCaseFrame
      title={mode === 'correct' ? labels.correctExpectedErrors : labels.pasteJson}
      dirty={text !== initialText}
      onClose={onClose}
      headerAction={<SaveCaseButton state={state} text={text} mode={mode} {...(caseId ? { caseId } : {})} check={check} emptyReason="Paste the JSON to save." onApply={onApply} onClose={onClose} />}
    >
      <Part number={1} title={mode === 'correct' ? 'Case JSON' : 'Paste the case JSON'}>
        {mode === 'correct' ? <p class="muted">Only the expected errors can change here; the name and the fields must stay as they are.</p> : null}
        <AnswerBox label="Case JSON" value={text} onChange={setText} check={check} rows={16} state={state} hideCleanKind />
      </Part>
      <Part number={2} title="Expected errors">
        <ExpectedErrorsPart state={state} text={text} check={check} />
      </Part>
    </TestCaseFrame>
  );
}
