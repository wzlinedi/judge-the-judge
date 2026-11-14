import { previewRules } from '../../../core/judge/findings';
import { recognizeFields } from '../../../core/judge/fields';
import type { JudgeSet } from '../../../core/model';

/** Which parts of the sample are findings, and by which rule (FR-014). Updated as the rules change. */
export function RulePreview({ set }: { set: JudgeSet }) {
  const sample = set.sample_reply ?? '';
  const recognized = sample.trim() === '' ? null : recognizeFields(sample);
  if (!recognized?.ok || set.error_rules.length === 0) {
    return <p class="muted">Add a rule to see which parts of the sample are findings.</p>;
  }
  const preview = previewRules(sample, set.error_rules, set.reply_mapping.finding_text, recognized);
  if (!preview.readable) return <p class="muted">No rule can be used yet, so the preview is empty.</p>;
  return (
    <div class="table-scroll">
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
    </div>
  );
}
