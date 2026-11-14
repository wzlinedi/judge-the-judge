// Importing and exporting test cases, and the example file (FR-027 to FR-030, FR-032, FR-050, FR-053).
// Nothing changes until `applyImport`: a cancelled or failed import leaves the test project as it was.
import { markLate } from '../../core/cases/case-actions';
import { planImport, type ImportPlan } from '../../core/cases/validate-test-cases';
import { decodeBytes } from '../../core/io/decode';
import { exampleCsv } from '../../core/io/example-csv';
import { readTestCasesCsv } from '../../core/io/test-cases-csv';
import { readTestCasesJson, writeTestCases, type DraftRow, type InvalidRow } from '../../core/io/test-cases-json';
import { findVariables } from '../../core/judge/variables';
import type { Problem, TestCase } from '../../core/model';
import type { Ports, SaveResult } from '../ports/types';
import type { AppState } from '../store';
import { withCases, type CaseEdit } from './cases';
import type { FileEnv } from './files';

export type PreparedImport =
  | { outcome: 'cancelled' }
  | { outcome: 'invalid'; problems: Problem[] }
  | {
      outcome: 'ready';
      fileName: string;
      kind: 'csv' | 'json';
      plan: ImportPlan;
      /** CSV columns that are not used. */
      ignoredColumns: string[];
      /** Said when the file was not UTF-8. */
      encodingNote?: string;
      /** Notes of the reader, such as keys that were ignored. */
      notes: string[];
    };

/** Asks for a file, reads all of it and says what the import would do. Changes nothing. */
export async function prepareImport(state: AppState, ports: Ports): Promise<PreparedImport> {
  const picked = await ports.opener.open('import');
  if (!picked) return { outcome: 'cancelled' };
  const decoded = picked.bytes ? decodeBytes(picked.bytes) : { text: picked.text, encoding: 'utf-8' as const };
  const { judge_set, dataset } = state.evaluation;
  const variables = findVariables(judge_set.prompt);

  const asJson = /^[\s﻿]*[{[]/.test(decoded.text);
  let drafts: DraftRow[];
  let invalid: InvalidRow[];
  let ignoredColumns: string[] = [];
  let notes: string[] = [];
  if (asJson) {
    const read = readTestCasesJson(decoded.text);
    if (!read.ok) return { outcome: 'invalid', problems: read.problems };
    ({ drafts, invalid } = read.value);
    notes = read.notes;
  } else {
    const read = readTestCasesCsv(decoded.text, variables);
    if (!read.ok) return { outcome: 'invalid', problems: read.problems };
    ({ drafts, invalid, ignoredColumns } = read.value);
  }

  const plan = planImport(drafts, invalid, { variables, judgedText: judge_set.judged_text, catalog: judge_set.error_catalog, existing: dataset.cases });
  if (plan.tooMany) {
    return { outcome: 'invalid', problems: [{ message: `The import would bring the test project to ${plan.tooMany.found} test cases, and the limit is ${plan.tooMany.limit}. Nothing was imported.` }] };
  }
  return {
    outcome: 'ready',
    fileName: picked.handle.name,
    kind: asJson ? 'json' : 'csv',
    plan,
    ignoredColumns,
    ...(decoded.encoding === 'windows-1250' ? { encodingNote: 'The file is not UTF-8, so it was read as Windows-1250. Check that the Polish and other special characters look right.' } : {}),
    notes: [...notes, ...plan.notes],
  };
}

/** Adds the valid cases, also after finalizing; categories the user was told about join the catalog (FR-029, FR-053). */
export function applyImport(state: AppState, plan: ImportPlan): CaseEdit {
  if (plan.cases.length === 0) return { state, note: 'There was no valid test case to import.' };
  const hasReplies = Object.keys(state.evaluation.replies).length > 0;
  const added: TestCase[] = plan.cases.map((c) => markLate(c, hasReplies, 'added'));
  const catalog = [...state.evaluation.judge_set.error_catalog, ...plan.missingCategories.map((name) => ({ name }))];
  const next = withCases(state, [...state.evaluation.dataset.cases, ...added], plan.missingCategories.length > 0 ? catalog : undefined);
  const count = `${added.length} test ${added.length === 1 ? 'case was' : 'cases were'} imported.`;
  const skipped = plan.invalid.length > 0 ? ` ${plan.invalid.length} invalid ${plan.invalid.length === 1 ? 'row was' : 'rows were'} skipped.` : '';
  const categories = plan.missingCategories.length > 0 ? ` Added to the catalog: ${plan.missingCategories.join(', ')}.` : '';
  return { state: next, note: `${count}${skipped}${categories}` };
}

export interface ExportResult {
  state: AppState;
  outcome: SaveResult['status'];
  message: string;
}

/** Writes every case to a file the user names each time; nothing is remembered and the unsaved flag stays as it is (FR-050). */
export async function exportTestCases(state: AppState, ports: Ports, env: FileEnv): Promise<ExportResult> {
  const { dataset } = state.evaluation;
  const text = writeTestCases({ name: dataset.name, cases: dataset.cases }, { toolVersion: env.toolVersion });
  const result = await ports.exportTarget.saveAs(text);
  ports.exportTarget.forget();
  if (result.status === 'saved') return { state, outcome: 'saved', message: `Exported ${dataset.cases.length} test cases to ${result.fileName}.` };
  if (result.status === 'cancelled') return { state, outcome: 'cancelled', message: 'Nothing was exported.' };
  return { state, outcome: result.status, message: 'The file could not be written. Nothing was exported.' };
}

/** The example CSV of the import window, with the variables of the current judge prompt (FR-030). */
export function downloadExample(state: AppState): { fileName: string; text: string; note?: string } {
  const example = exampleCsv(findVariables(state.evaluation.judge_set.prompt));
  return { fileName: 'test-cases-example.csv', ...example };
}
