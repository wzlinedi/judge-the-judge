import type { AppState } from '../../../app/store';
import { startSummary } from '../../../core/cases/start-summary';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';
import { plural, TestSize } from './TestSize';

export interface FinalizeDialogProps {
  open: boolean;
  state: AppState;
  onConfirm: () => void;
  onClose: () => void;
}

/** The summary shown before the test cases are fixed (FR-052): counts, balance, test size and every warning. Warnings do not stop it; an empty test project or prompt does. */
export function FinalizeDialog({ open, state, onConfirm, onClose }: FinalizeDialogProps) {
  const summary = startSummary(state.project);
  const f = summary.feedback;
  return (
    <Dialog
      open={open}
      title="Start the test run?"
      onClose={onClose}
      actions={
        <>
          <button type="button" onClick={onClose}>
            {labels.cancel}
          </button>
          <button type="button" class="primary" disabled={!summary.allowed} onClick={onConfirm}>
            {labels.startTestRun}
          </button>
        </>
      }
    >
      <p>{`${plural(f.total, 'test case', 'test cases')}: ${f.withErrors} with injected errors, ${f.clean} clean.`}</p>
      <TestSize feedback={f} />
      {summary.refusal ? <p role="alert" class="notice warn">{summary.refusal}</p> : null}
      {summary.warnings.length > 0 ? (
        <ul class="plain-list notice warn" aria-label="Warnings">
          {summary.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <p class="muted">
        Once the test run has started, the judge prompt and the fields of every case are fixed, with no way back, so that every reply is judged by the same prompt. You can still add test cases, correct the expected errors of a case,
        and correct the reply mapping and the error rules.
      </p>
    </Dialog>
  );
}
