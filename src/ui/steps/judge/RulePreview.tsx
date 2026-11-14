import { previewRules } from '../../../core/judge/findings';
import { recognizeFields } from '../../../core/judge/fields';
import { validateRules } from '../../../core/judge/rules';
import type { JudgeSet } from '../../../core/model';
import { TableScroll } from '../../components/TableScroll';

/** Which parts of the sample are findings, and by which rule (FR-014). Updated as the rules change. */
export function RulePreview({ set }: { set: JudgeSet }) {
  const sample = set.sample_reply ?? '';
  const recognized = sample.trim() === '' ? null : recognizeFields(sample);
  if (!recognized?.ok || set.error_rules.length === 0) {
    return <p class="muted">Add a rule to see which parts of the sample are findings.</p>;
  }
  const preview = previewRules(sample, set.error_rules, set.reply_mapping.finding_text, recognized);
  if (!preview.readable) return <p class="muted">{`The sample reply cannot be read. ${preview.reason}`}</p>;
  const validations = validateRules(set.error_rules, recognized);
  const unfinished = validations.flatMap((v, i) => (!v.usable && v.unfinished ? [i + 1] : []));
  const broken = validations.flatMap((v, i) => (!v.usable && !v.unfinished ? [{ n: i + 1, reason: v.reason }] : []));
  return (
    <>
    {unfinished.length > 0 ? <p class="muted">{`${unfinished.map((n) => `Rule ${n}`).join(', ')} ${unfinished.length === 1 ? 'is' : 'are'} not used in this preview until every condition has a value.`}</p> : null}
    {broken.map((b) => (
      <p key={b.n} class="muted">{`Rule ${b.n} is broken: ${b.reason}`}</p>
    ))}
    <TableScroll label="Preview of the findings, table">
      <table aria-label="Preview of the findings">
        <thead>
          <tr>
            <th>Part of the sample</th>
            <th>Result</th>
            <th>Rule</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row) => (
            <tr key={row.key}>
              <td>{row.text || row.key}</td>
              <td>{row.rules.length > 0 ? 'Finding' : 'No finding'}</td>
              <td>{row.rules.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
    </>
  );
}
