import { useState } from 'preact/hooks';
import type { CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { checkCaseJson } from '../../../core/cases/case-json';
import { PromptButtons } from '../../components/PromptButtons';
import { labels } from '../../labels';
import { AnswerBox, contextOf, ExpectedErrorsPart, NameField, Part, typedNameOf, type TypedName } from './CaseParts';
import { SaveCaseButton } from './SaveCaseButton';
import { TestCaseFrame } from './TestCaseFrame';

export interface JsonCaseViewProps {
  state: AppState;
  initialText: string;
  /** The prompt that the case is made again from: "Show prompt" stands at the top of the window (T255). */
  recreatePrompt?: string | undefined;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** From JSON (FR-041, FR-090): the box checked as it changes, and under it the list of expected errors, on one page. */
export function JsonCaseView({ state, initialText, recreatePrompt, onApply, onClose }: JsonCaseViewProps) {
  const [text, setText] = useState(initialText);
  const [typed, setTyped] = useState<TypedName>(null);
  const check = text.trim() === '' ? undefined : checkCaseJson(text, { ...contextOf(state), mode: 'paste', ...(typedNameOf(typed) !== undefined ? { name: typedNameOf(typed) as string } : {}) });

  return (
    <TestCaseFrame
      title={labels.pasteJson}
      dirty={text !== initialText || typed !== null}
      onClose={onClose}
      headerAction={<SaveCaseButton state={state} text={text} mode="paste" {...(typedNameOf(typed) !== undefined ? { name: typedNameOf(typed) as string } : {})} {...(recreatePrompt ? { generationPrompt: recreatePrompt } : {})} check={check} emptyReason="Paste the JSON to save." onApply={onApply} onClose={onClose} />}
    >
      {recreatePrompt ? (
        <div class="recreate-prompt">
          <PromptButtons prompt={recreatePrompt} shownOnly />
        </div>
      ) : null}
      <Part number={1} title="Paste the case JSON">
        <div class="form-grid">
          <NameField state={state} check={check} typed={typed} onTyped={setTyped} />
        </div>
        <AnswerBox label="Case JSON" value={text} onChange={setText} check={check} rows={16} state={state} hideCleanKind />
      </Part>
      <Part number={2} title="Expected errors">
        <ExpectedErrorsPart state={state} text={text} check={check} />
      </Part>
    </TestCaseFrame>
  );
}
