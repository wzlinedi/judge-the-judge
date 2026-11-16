import { labels } from '../../labels';

interface Format {
  what: string;
  format: string;
  schema: string;
  example: string;
  use: string;
  /** What follows the name of the button. */
  note?: string;
}

/** The files the tool reads, with the name each carries in its `format` key (contracts/file-formats.md). docs/schemas holds one JSON Schema for each. */
const FORMATS: readonly Format[] = [
  { what: 'Test project', format: 'judge-the-judge-test-project', schema: 'test-project.schema.json', example: 'examples/demo/test-project.json', use: labels.loadTestProject },
  { what: 'Test cases', format: 'judge-the-judge-test-cases', schema: 'test-cases.schema.json', example: 'examples/files/test-cases-example.json', use: labels.importTestCases },
  { what: 'One test case', format: '', schema: 'case.schema.json', example: 'examples/files/case-example.json', use: 'Paste JSON' },
  { what: 'Metric definition', format: 'judge-the-judge-metric', schema: 'metric.schema.json', example: 'examples/metrics/bias-example.json', use: labels.loadTestProject, note: ', as the metric of a test project file (docs/how-to-add-a-metric.md)' },
];

export function FileFormats() {
  return (
    <section aria-labelledby="help-formats">
      <h3 id="help-formats">Files and their formats</h3>
      <p>
        Every file the tool reads is JSON, except the spreadsheet of clean cases. A JSON file says what it is in its <code>format</code> key and has a{' '}
        <code>schema_version</code>, a whole number that starts at 1. The files are plain text: you can read them, and keep them in version control.
      </p>
      <ul>
        {FORMATS.map((f) => (
          <li key={f.what}>
            <strong>{f.what}</strong>
            {f.format ? (
              <>
                : <code>{f.format}</code>
              </>
            ) : (
              <>: no <code>format</code> key, it is the case itself</>
            )}
            , opened with <strong>{f.use}</strong>{f.note ?? ''}. Example: <code>{f.example}</code>. Layout: <code>docs/schemas/{f.schema}</code>.
          </li>
        ))}
        <li>
          <strong>Spreadsheet of clean cases</strong>: a CSV file with an optional <code>name</code> column and a <code>field:&lt;variable&gt;</code> column for each variable, opened with{' '}
          <strong>{labels.importTestCases}</strong>. The window has <strong>Download example file</strong>.
        </li>
        <li>
          <strong>Report</strong>: an HTML file for people to read. The tool writes it and never reads it.
        </li>
      </ul>
      <p>
        <strong>The layouts.</strong> The folder <code>docs/schemas</code> in the source of the tool holds one JSON Schema for each JSON format above, made from the same rules the tool reads
        with. The example files are in its <code>examples</code> folder. An editor that knows JSON Schema can then check a file you write by hand, and tell you where it is wrong.
      </p>
      <p>
        <strong>What the tool does with a file it does not fully know.</strong> A file with another <code>format</code>, or with a <code>schema_version</code> newer than the
        tool, is refused with a message that says what was found and what is supported, and nothing changes. A key the tool does not use does no harm: the file loads and the
        message says &ldquo;Keys the tool does not use were ignored&rdquo;, with their names. When a file is not valid, the message says where: the line and column for text that is not
        readable JSON, or the name of the field, such as <code>fields.summary</code> or <code>expected_errors[2].description</code>. A load never half-applies: either the whole file is
        read or nothing changes.
      </p>
    </section>
  );
}
