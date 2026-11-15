import { saveCaseFromJson, type CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import type { CaseJsonCheck } from '../../../core/model';
import { labels } from '../../labels';

export interface SaveCaseButtonProps {
  state: AppState;
  text: string;
  mode: 'paste' | 'inject';
  base?: string;
  errorsToPrepare?: number;
  /** The prompt of the window, kept with the case (T238). */
  generationPrompt?: string;
  /** The name the user typed in "Test case name"; none while the field is untouched (T239). */
  name?: string;
  check: CaseJsonCheck | undefined;
  /** Why the button is disabled while there is nothing in the box yet. */
  emptyReason: string;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** "Save case" (FR-085) at the bottom of the window: enabled only while the JSON is valid and, when it is not, saying why; it asks nothing about the text and the list (T286). */
export function SaveCaseButton({ state, text, mode, base, errorsToPrepare, generationPrompt, name, check, emptyReason, onApply, onClose }: SaveCaseButtonProps) {
  const save = () => {
    const edit = saveCaseFromJson(state, text, { mode, ...(base !== undefined && base !== '' ? { base } : {}), ...(errorsToPrepare !== undefined ? { errorsToPrepare } : {}), ...(name !== undefined ? { name } : {}), ...(generationPrompt !== undefined ? { generationPrompt } : {}) });
    onApply(edit);
    if ((!edit.problems || edit.problems.length === 0) && edit.state !== state) onClose();
  };

  return (
    <>
      <button type="button" class="primary" disabled={check?.case === undefined} aria-describedby={check?.case === undefined ? 'save-why' : undefined} onClick={save}>
        {labels.saveCase}
      </button>
      {check?.case === undefined ? (
        <span id="save-why" class="why-disabled">
          {check ? 'Fix the problems listed under the JSON to save.' : emptyReason}
        </span>
      ) : null}
    </>
  );
}
