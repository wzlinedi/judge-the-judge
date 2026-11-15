import { useState } from 'preact/hooks';
import type { ReviewedCase } from '../../../core/evaluation/results';
import type { TestProject } from '../../../core/model';
import { EmptyState } from '../../components/EmptyState';
import { StatusMark } from '../../components/StatusMark';
import { testProjectFeedback } from '../../../core/cases/feedback';
import { labels } from '../../labels';
import { JudgeSummary } from './JudgeSummary';
import { SaveReminder } from './SaveReminder';
import { useVersions } from './useVersions';
import { TableScroll } from '../../components/TableScroll';

export interface RunStepProps {
  evaluation: TestProject;
  reviewed: ReviewedCase[];
  repliesSinceSave: number;
  onOpen: (caseId: string) => void;
  /** Opens the window to add a test case; the button stands above the list of cases (FR-053). */
  onAdd: () => void;
  onModelDetails: (text: string) => void;
}

type Show = 'all' | 'awaiting-first' | 'only-awaiting';

/** Items the user still has to settle in a case: undecided marks and the approval of an unreadable reply. */
export function itemsToDecide(r: ReviewedCase): number {
  if (!r.effective) return 0;
  const undecided = r.effective.expected.filter((e) => e.state === 'undecided').length + r.effective.additional.filter((a) => a.state === 'undecided').length;
  return undecided + (r.effective.needsApproval && !r.effective.approved && undecided === 0 ? 1 : 0);
}

/** The judge's findings that point at no expected error, and the findings the user added by hand (FR-054, T263); both 0 before the reply. */
export function findingCounts(r: ReviewedCase): { additional: number; byHand: number } {
  const all = r.effective?.additional ?? [];
  const byHand = all.filter((a) => a.added !== undefined).length;
  return { additional: all.length - byHand, byHand };
}

export function RunStep({ evaluation, reviewed, repliesSinceSave, onOpen, onAdd, onModelDetails }: RunStepProps) {
  const [show, setShow] = useState<Show>('all');
  const versions = useVersions(evaluation);
  const full = testProjectFeedback(evaluation).capacity.full;
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
    return <EmptyState title="There are no test cases to run">Add test cases and start the test run on the Test cases step first.</EmptyState>;
  }

  return (
    <div class="run-step">
      <JudgeSummary judgeVersion={versions.judge} testProjectName={evaluation.dataset.name} testCasesVersion={versions.cases} judgedText={evaluation.judge_set.judged_text} />

      <section class="card">
        <h2>
          <label for="model-details">Model details</label>
        </h2>
        <textarea id="model-details" rows={3} value={evaluation.testRun?.model_note ?? ''} spellcheck={false} onInput={(event) => onModelDetails((event.currentTarget as HTMLTextAreaElement).value)} />
        <p class="muted">Optional. Write the model name, the temperature and other settings in any form; the tool does not read them. They are saved with the result.</p>
      </section>

      <section class="card" aria-label="Progress">
        <h2>Progress</h2>
        <p>{`${received} of ${reviewed.length} replies received`}</p>
        <p>{`${decided} of ${reviewed.length} cases decided`}</p>
        <p>{`${toDecide} ${toDecide === 1 ? 'item' : 'items'} still to decide`}</p>
        <p>{`${repliesSinceSave} ${repliesSinceSave === 1 ? 'reply' : 'replies'} not saved to a file`}</p>
        <SaveReminder repliesSinceSave={repliesSinceSave} />
      </section>

      <section class="card" aria-label="Cases">
        <div class="list-head">
          <h2>Cases</h2>
          <button type="button" onClick={onAdd} disabled={full}>
            {labels.addTestCase}
          </button>
          <label>
            Show{' '}
            <select value={show} onChange={(event) => setShow((event.currentTarget as HTMLSelectElement).value as Show)}>
              <option value="all">All cases</option>
              <option value="awaiting-first">Awaiting verification first</option>
              <option value="only-awaiting">Only awaiting verification</option>
            </select>
          </label>
        </div>
        <TableScroll label="Test cases to run">
          <table>
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Expected errors</th>
                <th>Additional findings</th>
                <th>Added by hand</th>
                <th>Status</th>
                <th>Items to decide</th>
                <th>
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const counts = findingCounts(r);
                return (
                <tr key={r.testCase.id}>
                  <td>{r.testCase.id}</td>
                  <td>
                    {r.testCase.name}
                    {r.testCase.changed_after_first_reply ? <span class="muted">{` (${r.testCase.changed_after_first_reply} after first reply)`}</span> : null}
                  </td>
                  <td>{r.testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</td>
                  <td>{r.testCase.expected_errors.length}</td>
                  <td>{counts.additional}</td>
                  <td>{counts.byHand}</td>
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
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </section>
    </div>
  );
}
