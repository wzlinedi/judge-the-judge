import { useMemo, useState } from 'preact/hooks';
import { saveExpectedErrors, type CaseEdit } from '../../../app/actions/cases';
import { listCheckOf, mismatchLines, uncoveredLines } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { checkExpectedErrorsJson, expectedErrorsToJson, planExpectedErrors } from '../../../core/cases/expected-errors';
import { Dialog } from '../../components/Dialog';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { CheckLine } from './CaseData';
import { contextOf } from './CaseParts';

export interface ExpectedErrorsDialogProps {
  state: AppState;
  caseId: string;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Edit expected errors" (T254): the standard large dialog with the JSON of the list of expected errors of one case, on every case. The JSON is
 * checked as it changes; for a case with a reply Save asks first, because the marks of the changed and removed errors go.
 */
export function ExpectedErrorsDialog({ state, caseId, onApply, onClose }: ExpectedErrorsDialogProps) {
  const testCase = state.evaluation.dataset.cases.find((c) => c.id === caseId);
  const initial = useMemo(() => (testCase ? expectedErrorsToJson(testCase) : ''), [testCase]);
  const [text, setText] = useState(initial);
  const [asking, setAsking] = useState(false);
  if (!testCase) return null;

  const check = checkExpectedErrorsJson(text, { ...contextOf(state), mode: 'correct', original: testCase });
  const plan = check.errors ? planExpectedErrors(testCase.expected_errors, check.errors, state.evaluation.decisions[caseId]) : undefined;
  const hasReply = state.evaluation.replies[caseId] !== undefined;
  // the text and the list of the case with the new list (FR-080): what does not agree is asked about before saving, as for any case
  const candidate = check.errors ? { ...testCase, expected_errors: check.errors } : undefined;
  const list = candidate ? listCheckOf(state, candidate) : undefined;
  const lines = candidate && candidate.expected_errors.length > 0 && list ? mismatchLines(list) : [];
  const why = !plan ? 'Fix the problems listed under the JSON to save.' : plan.nothing ? 'Change the JSON to save.' : undefined;

  const save = () => {
    setAsking(false);
    const edit = saveExpectedErrors(state, caseId, text);
    onApply(edit);
    if (edit.state !== state) onClose();
  };

  return (
    <>
      <Dialog
        open
        wide
        title={labels.correctExpectedErrors}
        onClose={onClose}
        actions={
          <>
            {why ? (
              <span id="edit-errors-why" class="why-disabled">
                {why}
              </span>
            ) : null}
            <button type="button" onClick={onClose}>
              {labels.cancel}
            </button>
            <button type="button" class="primary" disabled={why !== undefined} aria-describedby={why ? 'edit-errors-why' : undefined} onClick={() => (hasReply || lines.length > 0 ? setAsking(true) : save())}>
              {labels.saveExpectedErrors}
            </button>
          </>
        }
      >
        <p class="muted">{`The expected errors of case ${caseId} as a list. An error keeps its mark while its "id" and its words stay as they are; leave "id" out for a new error. The name and the fields of the case cannot change here.`}</p>
        <JsonBox label="Expected errors" value={text} onChange={setText} check={() => check.problems} rows={18} />
        {candidate && list && (candidate.expected_errors.length > 0 || !list.agrees) ? <CheckLine list={list} testCase={candidate} /> : null}
        {list && uncoveredLines(list).length > 0 ? (
          <ul class="plain-list" aria-label="Changed places not in the list">
            {uncoveredLines(list).map((line) => (
              <li key={line} class="warning-text">{`Warning: ${line}`}</li>
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
        {check.notes.length > 0 ? (
          <ul class="plain-list muted" aria-label="Notes">
            {check.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </Dialog>
      <Dialog
        open={asking}
        title="Save the expected errors?"
        onClose={() => setAsking(false)}
        actions={
          <>
            <button type="button" onClick={() => setAsking(false)}>
              {labels.cancel}
            </button>
            <button type="button" class="primary" onClick={save}>
              {labels.saveExpectedErrors}
            </button>
          </>
        }
      >
        {lines.length > 0 ? (
          <>
            <p>The text and the list of expected errors do not agree:</p>
            <ul>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : null}
        {hasReply ? <p>{`This case has a reply. ${plan ? `${plural(plan.marksDropped, 'mark you set', 'marks you set')} for changed or removed errors ${plan.marksDropped === 1 ? 'is' : 'are'} dropped, ` : ''}the case is marked again from the reply, and the test cases version changes.`}</p> : null}
      </Dialog>
    </>
  );
}
