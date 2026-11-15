import { useState } from 'preact/hooks';
import { saveCaseFromJson, type CaseEdit } from '../../../app/actions/cases';
import { listCheckOf, mismatchLines } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import type { CaseJsonCheck } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
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

/** "Save case" (FR-085) at the bottom of the window: enabled only while the JSON is valid and, when it is not, saying why; a mismatch of FR-080 asks first. */
export function SaveCaseButton({ state, text, mode, base, errorsToPrepare, generationPrompt, name, check, emptyReason, onApply, onClose }: SaveCaseButtonProps) {
  const [asking, setAsking] = useState<string[] | null>(null);

  const save = () => {
    setAsking(null);
    const edit = saveCaseFromJson(state, text, { mode, ...(base !== undefined && base !== '' ? { base } : {}), ...(errorsToPrepare !== undefined ? { errorsToPrepare } : {}), ...(name !== undefined ? { name } : {}), ...(generationPrompt !== undefined ? { generationPrompt } : {}) });
    onApply(edit);
    if ((!edit.problems || edit.problems.length === 0) && edit.state !== state) onClose();
  };

  const press = () => {
    const lines = check?.case && check.case.expected_errors.length > 0 ? mismatchLines(listCheckOf(state, check.case)) : [];
    if (lines.length > 0) setAsking(lines);
    else save();
  };

  return (
    <>
      <button type="button" class="primary" disabled={check?.case === undefined} aria-describedby={check?.case === undefined ? 'save-why' : undefined} onClick={press}>
        {labels.saveCase}
      </button>
      {check?.case === undefined ? (
        <span id="save-why" class="why-disabled">
          {check ? 'Fix the problems listed under the JSON to save.' : emptyReason}
        </span>
      ) : null}
      <Dialog
        open={asking !== null}
        title="Save with a mismatch?"
        onClose={() => setAsking(null)}
        actions={
          <>
            <button type="button" onClick={() => setAsking(null)}>
              Go back
            </button>
            <button type="button" class="primary" onClick={save}>
              Save anyway
            </button>
          </>
        }
      >
        <p>The text and the list of expected errors do not agree:</p>
        <ul>
          {(asking ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>You can change the JSON to resolve this, or save the case as it is.</p>
      </Dialog>
    </>
  );
}
