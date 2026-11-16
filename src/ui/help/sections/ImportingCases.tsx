import csvExample from '../../../../examples/files/test-cases-example.csv?raw';
import jsonExample from '../../../../examples/files/test-cases-example.json?raw';
import { labels } from '../../labels';

/** The examples are the files the tests validate (Principle VIII); the byte order mark of the CSV is not shown. */
export function ImportingCases() {
  return (
    <section aria-labelledby="help-import">
      <h3 id="help-import">Importing test cases from a file</h3>
      <p>
        <strong>{labels.importTestCases}</strong> in the More menu adds many test cases at once from one CSV or JSON file. The whole file is checked first and you read a
        summary before anything is added: how many cases can be imported (clean and with injected errors), the invalid rows with their position and reason, fields that
        match no variable of the judge prompt, variables that have no field, categories that are not in the catalog and the identifiers that were already used. Then you
        import the valid cases or cancel, and a cancelled or failed import changes nothing. The cases are added to the ones you already have, also after the test run
        has started; they then start as Not run and are marked &ldquo;added after first reply&rdquo; once replies exist. A test project may hold at most 500 cases.
      </p>
      <p>
        <strong>The CSV.</strong> A spreadsheet is the easy way to bring in many clean cases. It has an optional <code>name</code> column and one column{' '}
        <code>field:&lt;variable&gt;</code> for each variable of your judge prompt; every row becomes a clean case. Any other column is ignored and named in the summary.
        Cells may hold commas, quotes, line breaks and Polish or other characters; the file may be UTF-8 (with or without a byte order mark), or Windows-1250, which is
        then said in the summary. <strong>{labels.downloadExampleFile}</strong> in the import window gives you this file with the variables of your current prompt:
      </p>
      <pre class="example">{csvExample.replace(/^﻿/, '').trimEnd()}</pre>
      <p>
        <strong>The JSON.</strong> Cases with expected errors come in as JSON, in the layout the cases have inside a test project file. <code>id</code> and{' '}
        <code>base</code> are optional: an identifier that is already used is replaced by a new one and a <code>base</code> follows it. A name that is already used is kept
        and both cases show a warning. A test project file can be imported too, through its cases.
      </p>
      <pre class="example">{jsonExample.trimEnd()}</pre>
      <p>
        <strong>{labels.exportTestCases}</strong> writes every case, clean ones included, to a JSON file that <strong>{labels.importTestCases}</strong> reads back. It asks for
        a file name every time. It is an export, not a save: it does not clear the indicator of unsaved changes, and only <strong>{labels.saveTestProject}</strong> saves the
        whole work.
      </p>
    </section>
  );
}
