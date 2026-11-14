import { useState } from 'preact/hooks';
import type { PreparedImport } from '../../../app/actions/test-cases-file';
import { normalizeCategoryName } from '../../../core/cases/catalog';
import type { Problem } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { ErrorMessage } from '../../components/ErrorMessage';
import { Explain } from '../../components/Explain';
import { labels } from '../../labels';

export interface ImportWindowProps {
  open: boolean;
  onChoose: () => Promise<PreparedImport>;
  /** Saves the example file and returns what the window says about it. */
  onDownloadExample: () => { fileName: string; note?: string };
  onImport: (prepared: Extract<PreparedImport, { outcome: 'ready' }>) => void;
  onClose: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Summary({ prepared }: { prepared: Extract<PreparedImport, { outcome: 'ready' }> }) {
  const { plan } = prepared;
  const total = plan.cases.length;
  return (
    <div class="import-summary">
      <p>
        <strong>{total === 0 ? 'Nothing can be imported.' : `${plural(total, 'test case', 'test cases')} can be imported.`}</strong>{' '}
        {total > 0 ? `${plan.clean} clean, ${plan.injected} with injected errors.` : null}
      </p>
      <p class="muted">{`File: ${prepared.fileName}`}</p>
      {prepared.encodingNote ? <p class="warning-text">{prepared.encodingNote}</p> : null}
      {plan.invalid.length > 0 ? (
        <>
          <h3>{`${plural(plan.invalid.length, 'invalid row', 'invalid rows')}, skipped`}</h3>
          <ul class="plain-list" aria-label="Invalid rows">
            {plan.invalid.map((row) => (
              <li key={row.position} class="warning-text">
                {`${prepared.kind === 'csv' ? 'Row' : 'Case'} ${row.position} (${row.label}): ${row.reason}`}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ul class="plain-list" aria-label="About the file">
        {prepared.ignoredColumns.length > 0 ? <li>{`Ignored columns: ${prepared.ignoredColumns.join(', ')}.`}</li> : null}
        {plan.unmatchedFields.length > 0 ? <li>{`Fields that match no variable of the judge prompt (kept, never sent to the judge): ${plan.unmatchedFields.join(', ')}.`}</li> : null}
        {plan.missingVariables.length > 0 ? <li>{`Variables of the judge prompt with no field in some cases (they are empty there): ${plan.missingVariables.join(', ')}.`}</li> : null}
        {plan.missingCategories.length > 0 ? <li>{`Categories that are not in the catalog: ${plan.missingCategories.join(', ')}. Importing adds them to the catalog; Cancel imports nothing.`}</li> : null}
        {plan.missingCategories.some((name) => normalizeCategoryName(name) !== name) ? (
          <li class="warning-text">{`Category names are written in lower case with dashes in the catalog; these are not: ${plan.missingCategories.filter((name) => normalizeCategoryName(name) !== name).join(', ')}. They are added as they are, and you can rename them in Error categories.`}</li>
        ) : null}
        {plan.newIdentifiers > 0 ? <li>{`${plural(plan.newIdentifiers, 'identifier was', 'identifiers were')} already used and got a new one.`}</li> : null}
        {plan.duplicateNames.length > 0 ? <li class="warning-text">{`Names also used by another case: ${plan.duplicateNames.join(', ')}. Both cases show a warning; rename one of them.`}</li> : null}
        {prepared.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

/** "Import test cases" (FR-027 to FR-030): choose a file, read the summary, then import the valid cases or cancel. */
export function ImportWindow({ open, onChoose, onDownloadExample, onImport, onClose }: ImportWindowProps) {
  const [prepared, setPrepared] = useState<Extract<PreparedImport, { outcome: 'ready' }> | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [downloaded, setDownloaded] = useState<{ fileName: string; note?: string } | null>(null);

  const choose = async () => {
    const result = await onChoose();
    if (result.outcome === 'ready') {
      setPrepared(result);
      setProblems([]);
    } else if (result.outcome === 'invalid') {
      setPrepared(null);
      setProblems(result.problems);
    }
  };

  return (
    <Dialog
      open={open}
      title={labels.importTestCases}
      onClose={onClose}
      actions={
        <>
          <button type="button" onClick={onClose}>
            {labels.cancel}
          </button>
          {prepared ? (
            <button type="button" class="primary" disabled={prepared.plan.cases.length === 0} onClick={() => onImport(prepared)}>
              {labels.importTestCases}
            </button>
          ) : (
            <button type="button" class="primary" onClick={() => void choose()}>
              Choose file…
            </button>
          )}
        </>
      }
    >
      {prepared ? (
        <>
          <Summary prepared={prepared} />
          <p class="import-another">
            <button type="button" class="link-button" onClick={() => void choose()}>
              Choose another file
            </button>
          </p>
        </>
      ) : (
        <>
          <p>Add many test cases from one CSV or JSON file. The whole file is checked first and you see a summary before anything is added.</p>
          <div class="download-row">
            <button type="button" onClick={() => setDownloaded(onDownloadExample())}>
              {labels.downloadExampleFile}
            </button>{' '}
            <Explain>
              <p>The file is an example that shows how to lay out clean test cases in a spreadsheet so that they can be imported here. One row is one test case.</p>
              <ul>
                <li>
                  <strong>name</strong>: the name of the case. It can be left empty.
                </li>
                <li>
                  <strong>field:</strong> followed by a variable of the judge prompt, for example <strong>field:source_text</strong>: the text of that field. Write one such column for every variable of the prompt.
                </li>
                <li>Any other column is ignored, and the summary names it.</li>
              </ul>
              <p>A quote that is part of a text is written twice (""). A JSON file is also accepted; it can hold cases with expected errors.</p>
            </Explain>
          </div>
          {downloaded ? (
            <p class="muted" role="status" aria-label="Example file">
              {`Saved ${downloaded.fileName}: look for it in your Downloads folder, or where your browser puts files.${downloaded.note ? ` ${downloaded.note}` : ''}`}
            </p>
          ) : null}
          <ErrorMessage problems={problems} title="The file was not read. Nothing has changed." />
        </>
      )}
    </Dialog>
  );
}
