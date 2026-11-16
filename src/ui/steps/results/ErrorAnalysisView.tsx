import { errorAnalysis, SMALL_GROUP_NOTE, type AdditionalRow, type GroupRow } from '../../../core/evaluation/analysis';
import { PER_CASE_WHY } from '../../../core/evaluation/counting-note';
import type { Results } from '../../../core/evaluation/results';
import { TableScroll } from '../../components/TableScroll';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

function Groups({ label, rows, perCase }: { label: string; rows: GroupRow[]; perCase: boolean }) {
  return (
    <TableScroll label={`${label}, table`}>
      <table aria-label={label}>
        <thead>
          <tr>
            <th>Group</th>
            <th class="num">{perCase ? 'Cases with errors' : 'Expected errors'}</th>
            <th class="num">{perCase ? 'Flagged' : 'Found'}</th>
            <th class="num">{perCase ? 'Not flagged' : 'Not found'}</th>
            {perCase ? null : <th class="num">Detection rate</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td class="num">{r.expected}</td>
              <td class="num">{r.found}</td>
              <td class="num">{r.missed}</td>
              {perCase ? null : <td class="num">{r.rate === null ? '–' : pct(r.rate)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Additional({ label, first, rows }: { label: string; first: string; rows: ReadonlyArray<AdditionalRow | { name: string; real: number; fp: number }> }) {
  return (
    <TableScroll label={`${label}, table`}>
      <table aria-label={label}>
        <thead>
          <tr>
            <th>{first}</th>
            <th class="num">Genuine errors</th>
            <th class="num">False positives</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3}>None</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td class="num">{r.real}</td>
                <td class="num">{r.fp}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** The Error analysis view (FR-070): the detection rate of every group (T268); additional findings are counted apart, with counts only. */
export function ErrorAnalysisView({ results }: { results: Results }) {
  const perCase = results.evaluated_per === 'case';
  const a = errorAnalysis(results.counters, perCase);
  return (
    <div class="analysis-view">
      <h2 class="visually-hidden">Error analysis</h2>
      <h3>By category</h3>
      <Groups label="By category" rows={a.byCategory} perCase={perCase} />
      <h3>By difficulty</h3>
      <Groups label="By difficulty" rows={a.byDifficulty} perCase={perCase} />
      <p class="muted">{perCase ? PER_CASE_WHY : SMALL_GROUP_NOTE}</p>
      <h3>Additional findings per rule</h3>
      <Additional label="Additional findings per rule" first="Rule" rows={a.perRule.map((r) => ({ name: r.rule, real: r.real, fp: r.fp }))} />
      <h3>Additional findings per category</h3>
      <Additional label="Additional findings per category" first="Category" rows={a.additionalByCategory} />
      <h3>Additional findings per difficulty</h3>
      <Additional label="Additional findings per difficulty" first="Difficulty" rows={a.additionalByDifficulty} />
    </div>
  );
}
