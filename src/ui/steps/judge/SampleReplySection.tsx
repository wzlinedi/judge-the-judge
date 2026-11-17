import { useId, useRef } from 'preact/hooks';
import { setSampleReply } from '../../../app/actions/judge';
import { recognizeFields, unreadableToProblem, type RecognizedFields } from '../../../core/judge/fields';
import { Explain } from '../../components/Explain';
import { JsonBox } from '../../components/JsonBox';
import type { SectionProps } from './PromptSection';
import { TableScroll } from '../../components/TableScroll';
import { Eyebrow, EYEBROWS } from '../../components/Eyebrow';

/** The sample reply is read as soon as it changes; the fields of the last readable one stay while the text is broken (FR-011, SC-037). */
export function SampleReplySection({ state, onEdit }: SectionProps) {
  const id = useId();
  const set = state.project.judge_set;
  const sample = set.sample_reply ?? '';
  const last = useRef<RecognizedFields | null>(null);
  const read = sample.trim() === '' ? null : recognizeFields(sample);
  if (read?.ok) last.current = read;
  if (sample.trim() === '') last.current = null;
  const fields = last.current;

  return (
    <section class="card" aria-labelledby={`${id}-h`}>
      <Eyebrow text={EYEBROWS.sampleOutput} />
      <h2 id={`${id}-h`}>Sample reply and fields</h2>
      <JsonBox
        label="Sample reply"
        value={sample}
        onChange={(text) => onEdit(setSampleReply(state, text))}
        check={(text) => {
          const result = recognizeFields(text);
          return result.ok ? [] : [unreadableToProblem(result)];
        }}
        rows={8}
      />
      <Explain>Paste one real reply of your judge. The tool reads its fields; you say below which of them mean an error.</Explain>
      {fields ? (
        <>
          <TableScroll label="Fields of the sample reply, table">
            <table aria-label="Fields of the sample reply">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Kind</th>
                  <th>Values seen</th>
                </tr>
              </thead>
              <tbody>
                {fields.fields.map((f) => (
                  <tr key={f.path}>
                    <td>
                      <code>{f.path}</code>
                    </td>
                    <td>{f.kind}</td>
                    <td>{f.values.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <p class="muted">The values are examples from your sample, not a closed list: the judge may return others, and a rule can use any value.</p>
        </>
      ) : null}
    </section>
  );
}
