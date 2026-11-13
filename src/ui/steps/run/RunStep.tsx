import { useState } from 'preact/hooks';
import type { ReviewedCase } from '../../../core/evaluation/results';
import type { Evaluation } from '../../../core/model';
import { EmptyState } from '../../components/EmptyState';
import { StatusMark } from '../../components/StatusMark';
import { labels } from '../../labels';

export interface RunStepProps {
  evaluation: Evaluation;
  reviewed: ReviewedCase[];
  fileName: string | null;
  repliesSinceSave: number;
  onOpen: (caseId: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
}

type Show = 'all' | 'awaiting-first' | 'only-awaiting';

/** Items the user still has to settle in a case: undecided marks and the approval of an unreadable reply. */
export function itemsToDecide(r: ReviewedCase): number {
  if (!r.effective) return 0;
  const undecided = r.effective.expected.filter((e) => e.state === 'undecided').length + r.effective.additional.filter((a) => a.state === 'undecided').length;
  return undecided + (r.effective.needsApproval && !r.effective.approved && undecided === 0 ? 1 : 0);
}

export function RunStep({ evaluation, reviewed, fileName, repliesSinceSave, onOpen, onSave, onSaveAs }: RunStepProps) {
  const [show, setShow] = useState<Show>('all');
  const decided = reviewed.filter((r) => r.status === 'pass' || r.status === 'fail').length;
  const received = reviewed.filter((r) => r.status !== 'not_run').length;
  const toDecide = reviewed.reduce((sum, r) => sum + itemsToDecide(r), 0);

  const rows =
    show === 'only-awaiting'
      ? reviewed.filter((r) => r.status === 'awaiting')
      : show === 'awaiting-first'
        ? [...reviewed.filter((r) => r.status === 'awaiting'), ...reviewed.filter((r) => r.status !== 'awaiting')]
        : reviewed;

  if (evaluation.dataset.cases.length === 0) {
    return <EmptyState title="There are no test cases to run">Add and finalize test cases on the Test cases step first.</EmptyState>;
  }

  return (
    <div class="run-step">
      <section class="card" aria-label="Evaluation file">
        <h2>Evaluation file</h2>
        <p>
          <span class="muted">File: </span>
          <span>{fileName ?? 'no file chosen yet'}</span>
        </p>
        <div class="button-row">
          <button type="button" class="primary" onClick={onSave}>
            {labels.saveEvaluation}
          </button>
          <button type="button" onClick={onSaveAs}>
            {labels.saveEvaluationAs}
          </button>
        </div>
      </section>

      <section class="card" aria-label="Progress">
        <h2>Progress</h2>
        <p>{`${received} of ${reviewed.length} replies received`}</p>
        <p>{`${decided} of ${reviewed.length} cases decided`}</p>
        <p>{`${toDecide} ${toDecide === 1 ? 'item' : 'items'} still to decide`}</p>
        <p>{`${repliesSinceSave} ${repliesSinceSave === 1 ? 'reply' : 'replies'} not saved to a file`}</p>
      </section>

      <section class="card" aria-label="Cases">
        <div class="list-head">
          <h2>Cases</h2>
          <label>
            Show{' '}
            <select value={show} onChange={(event) => setShow((event.currentTarget as HTMLSelectElement).value as Show)}>
              <option value="all">All cases</option>
              <option value="awaiting-first">Awaiting verification first</option>
              <option value="only-awaiting">Only awaiting verification</option>
            </select>
          </label>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Expected errors</th>
                <th>Status</th>
                <th>Items to decide</th>
                <th>
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.testCase.id}>
                  <td>{r.testCase.id}</td>
                  <td>
                    {r.testCase.name}
                    {r.testCase.changed_after_first_reply ? <span class="muted">{` (${r.testCase.changed_after_first_reply} after first reply)`}</span> : null}
                  </td>
                  <td>{r.testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</td>
                  <td>{r.testCase.expected_errors.length}</td>
                  <td>
                    <StatusMark status={r.status} />
                  </td>
                  <td>{itemsToDecide(r)}</td>
                  <td>
                    <button type="button" onClick={() => onOpen(r.testCase.id)}>
                      {labels.open}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
