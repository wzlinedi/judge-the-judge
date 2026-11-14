import { labels } from '../../labels';
import { TestCaseFrame } from './TestCaseFrame';

export interface AddChoiceProps {
  onChoose: (choice: 'paste' | 'clean' | 'inject') => void;
  onClose: () => void;
}

/** The first thing "Add test case" shows: three choices, all always available (FR-038). */
export function AddChoice({ onChoose, onClose }: AddChoiceProps) {
  return (
    <TestCaseFrame
      title="Add test case"
      dirty={false}
      onClose={onClose}
      left={
        <div class="choice-list">
          <button type="button" onClick={() => onChoose('paste')}>
            {labels.pasteJson}
          </button>
          <p class="muted">A case you already have as JSON.</p>
          <button type="button" onClick={() => onChoose('clean')}>
            {labels.cleanCase}
          </button>
          <p class="muted">Ask your LLM for a text with no errors.</p>
          <button type="button" onClick={() => onChoose('inject')}>
            {labels.caseWithInjectedErrors}
          </button>
          <p class="muted">Change a clean case so that it holds errors you know.</p>
        </div>
      }
    />
  );
}

export function InjectPlaceholder({ onChoose, onClose }: AddChoiceProps) {
  return (
    <TestCaseFrame
      title={labels.caseWithInjectedErrors}
      dirty={false}
      onClose={onClose}
      left={
        <div class="choice-list">
          <p>Preparing a case with injected errors step by step comes in a later version of the tool.</p>
          <p>Until then, prepare the case with your LLM and add it with the button below.</p>
          <button type="button" onClick={() => onChoose('paste')}>
            {labels.pasteJson}
          </button>
        </div>
      }
    />
  );
}
