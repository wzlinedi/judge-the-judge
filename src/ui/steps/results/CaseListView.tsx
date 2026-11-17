import type { ReviewedCase } from '../../../core/evaluation/results';
import { SOURCE_LABELS } from '../../../core/evaluation/source-labels';
import { StatusMark } from '../../components/StatusMark';
import { labels } from '../../labels';
import { TableScroll } from '../../components/TableScroll';
import { Eyebrow, EYEBROWS } from '../../components/Eyebrow';

/** The sources of the decisions of a case, each once; "Automatic" when nothing was set by hand. */
export function sourcesOf(r: ReviewedCase): string {
  const sources = new Set<string>();
  for (const e of r.effective?.expected ?? []) if (e.state !== 'undecided') sources.add(SOURCE_LABELS[e.source]);
  for (const a of r.effective?.additional ?? []) if (a.state !== 'undecided') sources.add(SOURCE_LABELS[a.source]);
  if (sources.size === 0) sources.add(SOURCE_LABELS.automatic);
  return [...sources].join(', ');
}

function reported(r: ReviewedCase): string {
  if (!r.effective) return 'No reply yet';
  const found = r.effective.expected.filter((e) => e.state === 'found').length;
  const total = r.testCase.expected_errors.length;
  const findings = r.findings.length + r.effective.additional.filter((a) => a.added !== undefined).length;
  const head = `${findings} ${findings === 1 ? 'finding' : 'findings'} reported`;
  return total === 0 ? head : `${head}; ${found} of ${total} expected errors found`;
}

export interface CaseListViewProps {
  reviewed: ReviewedCase[];
  onOpen: (caseId: string) => void;
}

/** The Test case list (FR-071): every case with what the judge reported, its status and the sources of its decisions. */
export function CaseListView({ reviewed, onOpen }: CaseListViewProps) {
  return (
    <div class="case-list-view">
      <Eyebrow text={EYEBROWS.caseList} />
      <h2 class="visually-hidden">Test case list</h2>
      <TableScroll label="Table of test cases">
        <table aria-label="Test cases">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Kind</th>
              <th class="num">Expected errors</th>
              <th>The judge reported</th>
              <th>Status</th>
              <th>Decisions</th>
              <th>
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reviewed.map((r) => {
              const added = (r.effective?.additional ?? []).filter((a) => a.added !== undefined);
              return (
                <tr key={r.testCase.id}>
                  <td>{r.testCase.id}</td>
                  <td>{r.testCase.name}</td>
                  <td>{r.testCase.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}</td>
                  <td class="num">{r.testCase.expected_errors.length}</td>
                  <td>
                    {reported(r)}
                    {added.map((a) => (
                      <p key={a.key} class="muted">
                        {`Added: “${a.text}”`}
                        {a.category || a.difficulty ? ` (${[a.category, a.difficulty].filter(Boolean).join(' · ')})` : ''}
                      </p>
                    ))}
                  </td>
                  <td>
                    <StatusMark status={r.status} />
                  </td>
                  <td>{r.effective ? sourcesOf(r) : '–'}</td>
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
    </div>
  );
}
