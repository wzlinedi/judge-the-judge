// Reading the shortened CSV (file-formats.md, section 4; FR-027, FR-031): every row is a clean case.
import Papa from 'papaparse';
import type { ReadResult } from '../model';
import type { DraftRow, InvalidRow } from './test-cases-json';

export const MAX_FIELD_LENGTH = 100_000;

export interface CsvRead {
  drafts: DraftRow[];
  invalid: InvalidRow[];
  /** Columns that are neither `name` nor `field:…`; they are not used. */
  ignoredColumns: string[];
  /** `field:` columns that match no variable of the judge prompt; they are kept and never sent to the judge. */
  unmatchedFields: string[];
  /** Variables of the judge prompt that have no column. */
  missingVariables: string[];
}

const FIELD_PREFIX = /^field:/i;

const QUOTE_FIX =
  'A cell has a quote inside it that is not doubled, so the reader cannot tell where the cell ends. Write each quote that belongs to the text twice (for example "He said ""hi"""), or fix the cell in your spreadsheet program and save the file again.';

/**
 * One line per place in the file, not one per message of the reader: it repeats a message for every quote in a row. A quote error names the
 * row (the position in the file, the header being row 1) and the name of the case there, and says what to write instead.
 */
function fatalProblems(errors: readonly Papa.ParseError[], data: readonly Record<string, string>[]): Array<{ message: string }> {
  const lines = new Set<string>();
  for (const e of errors) {
    // Papa Parse counts the header line in the row of a quote error, and not in the row of any other error
    const position = e.row === undefined ? undefined : e.code === 'InvalidQuotes' ? e.row + 1 : e.row + 2;
    const record = e.row === undefined ? undefined : data[e.code === 'InvalidQuotes' ? e.row - 1 : e.row];
    const name = Object.entries(record ?? {}).find(([column]) => column.toLowerCase() === 'name')?.[1]?.trim();
    const where = position === undefined ? '' : `Row ${position}${name ? ` (${name})` : ''}: `;
    lines.add(`${where}${e.code === 'InvalidQuotes' ? QUOTE_FIX : e.message}`);
  }
  return [...lines].map((message) => ({ message }));
}

export function readTestCasesCsv(text: string, variables: readonly string[]): ReadResult<CsvRead> {
  if (text.trim() === '') return { ok: false, problems: [{ message: 'The file is empty.' }] };
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, transformHeader: (h) => h.trim() });
  const fatal = parsed.errors.filter((e) => e.type !== 'FieldMismatch' && e.code !== 'UndetectableDelimiter');
  if (fatal.length > 0) return { ok: false, problems: fatalProblems(fatal, parsed.data) };
  const columns = parsed.meta.fields ?? [];
  const nameColumn = columns.find((c) => c.toLowerCase() === 'name');
  const fieldColumns = columns.filter((c) => FIELD_PREFIX.test(c));
  if (fieldColumns.length === 0) {
    return { ok: false, problems: [{ message: 'The file has no column that starts with "field:". Download the example file to see the layout.' }] };
  }
  if (parsed.data.every((row) => Object.values(row).every((cell) => (cell ?? '').trim() === ''))) return { ok: false, problems: [{ message: 'The file has a header but no rows: there is no case in it.' }] };

  const names = fieldColumns.map((c) => c.replace(FIELD_PREFIX, ''));
  const drafts: DraftRow[] = [];
  const invalid: InvalidRow[] = [];
  parsed.data.forEach((row, index) => {
    if (Object.values(row).every((cell) => (cell ?? '').trim() === '')) return; // a blank line keeps its row number
    const position = index + 2;
    const name = (nameColumn ? (row[nameColumn] ?? '') : '').trim();
    const label = name !== '' ? name : `Row ${position}`;
    const fields: Record<string, string> = {};
    fieldColumns.forEach((column, i) => {
      fields[names[i] as string] = row[column] ?? '';
    });
    const long = Object.entries(fields).find(([, value]) => value.length > MAX_FIELD_LENGTH);
    if (long) return void invalid.push({ position, label, reason: `The field "${long[0]}" is longer than 100,000 characters, which is the limit.` });
    if (!Object.values(fields).some((value) => value.trim() !== '')) return void invalid.push({ position, label, reason: 'The row has no text in any field.' });
    const empty = variables.find((v) => v in fields && (fields[v] as string).trim() === '');
    if (empty) return void invalid.push({ position, label, reason: `The field "${empty}" is empty.` });
    drafts.push({ position, draft: { name, fields, expected_errors: [] } });
  });

  return {
    ok: true,
    notes: [],
    value: {
      drafts,
      invalid,
      ignoredColumns: columns.filter((c) => c !== nameColumn && !FIELD_PREFIX.test(c)),
      unmatchedFields: names.filter((n) => !variables.includes(n)),
      missingVariables: variables.filter((v) => !names.includes(v)),
    },
  };
}
