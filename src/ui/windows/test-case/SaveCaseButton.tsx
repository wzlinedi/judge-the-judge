import { useState } from 'preact/hooks';
import { correctExpectedErrors, saveCaseFromJson, type CaseEdit } from '../../../app/actions/cases';
import { listCheckOf, mismatchLines } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import type { CaseJsonCheck } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export interface SaveCaseButtonProps {
  state: AppState;
  text: string;
  mode: 'paste' | 'inject' | 'correct';
  caseId?: string;
  base?: string;
  errorsToPrepare?: number;
  check: CaseJsonCheck | undefined;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

/** "Save case" (FR-085): enabled only while the JSON is valid; a mismatch of FR-080 asks first. */
export function SaveCaseButton({ state, text, mode, caseId, base, errorsToPrepare, check, onApply, onClose }: SaveCaseButtonProps) {
  const [asking, setAsking] = useState<string[] | null>(null);

  const save = () => {
    setAsking(null);
    const edit =
      mode === 'correct' && caseId
        ? correctExpectedErrors(state, caseId, text)
        : saveCaseFromJson(state, text, { mode: mode === 'inject' ? 'inject' : 'paste', ...(base !== undefined && base !== '' ? { base } : {}), ...(errorsToPrepare !== undefined ? { errorsToPrepare } : {}) });
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
      <button type="button" class="primary" disabled={check?.case === undefined} onClick={press}>
        {labels.saveCase}
      </button>
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
