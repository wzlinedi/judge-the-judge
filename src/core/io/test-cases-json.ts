// Reading and writing the test-case file (file-formats.md, section 3; FR-027, FR-050).
import { z } from 'zod';
import type { ExpectedError, ReadResult, TestCase } from '../model';
import { extractJson } from '../judge/extract-json';
import { checkEnvelope } from '../schemas/common';
import { EVALUATION_FORMAT } from '../schemas/evaluation';
import { zodProblems } from '../schemas/messages';
import { assignExpectedIds, ignoredFieldNote, storedCase, testCaseSchema } from '../schemas/test-case';
import { TEST_CASES_FORMAT, TEST_CASES_KEYS, TEST_CASES_SCHEMA_VERSION } from '../schemas/test-cases';
import { TEST_PROJECT_FORMAT } from '../schemas/test-project';

/** A case as it comes from a file: the identifier may be missing, and nothing is checked against a test project yet. */
export type DraftCase = Omit<TestCase, 'id' | 'expected_errors'> & { id?: string; expected_errors: Array<Omit<ExpectedError, 'id'> & { id?: string }> };

export interface InvalidRow {
  /** The case number in a JSON file, the row number (the header is row 1) in a CSV file. */
  position: number;
  label: string;
  reason: string;
}

export interface DraftRow {
  position: number;
  draft: DraftCase;
}

export interface ParsedCases {
  name?: string;
  drafts: DraftRow[];
  invalid: InvalidRow[];
}

export function writeTestCases(parts: { name: string; cases: readonly TestCase[] }, meta: { toolVersion: string }): string {
  const file = {
    format: TEST_CASES_FORMAT,
    schema_version: TEST_CASES_SCHEMA_VERSION,
    tool_version: meta.toolVersion,
    name: parts.name,
    cases: parts.cases.map(storedCase),
  };
  return JSON.stringify(file, null, 2) + '\n';
}

/** A case of a test-case file: the identifier may be missing and so may the name. */
export const importCase = testCaseSchema.extend({ id: z.string().min(1).optional(), name: z.string().default('') });

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

function draftFrom(parsed: z.infer<typeof importCase>): DraftCase {
  const [withIds] = assignExpectedIds([{ ...parsed, id: parsed.id ?? '_' }]);
  const { id: _placeholder, ...rest } = withIds as TestCase;
  return { ...rest, ...(parsed.id !== undefined ? { id: parsed.id } : {}) };
}

/** Reads a test-case file, or a test project file through its `dataset.cases`. A case that is not valid is listed, not fatal. */
export function readTestCasesJson(text: string): ReadResult<ParsedCases> {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { ok: false, problems: [{ message: `The file is not readable JSON. ${extracted.message}`, line: extracted.line, column: extracted.column }] };
  }
  const raw = extracted.value;
  const kind = isObject(raw) ? raw['format'] : undefined;
  if (kind === EVALUATION_FORMAT) return { ok: false, problems: [{ message: 'This is an evaluation file. Use "Load evaluation…" to open it.', path: 'format' }] };

  let notes: string[] = [];
  let name: string | undefined;
  let rawCases: unknown;
  if (kind === TEST_PROJECT_FORMAT && isObject(raw)) {
    const dataset = raw['dataset'];
    rawCases = isObject(dataset) ? dataset['cases'] : undefined;
    if (isObject(dataset) && typeof dataset['name'] === 'string') name = dataset['name'];
  } else {
    const envelope = checkEnvelope(raw, { format: TEST_CASES_FORMAT, schemaVersion: TEST_CASES_SCHEMA_VERSION, knownKeys: TEST_CASES_KEYS });
    if (!envelope.ok) return envelope;
    notes = [...envelope.notes];
    rawCases = envelope.value['cases'];
    if (typeof envelope.value['name'] === 'string') name = envelope.value['name'];
  }
  if (!Array.isArray(rawCases)) return { ok: false, problems: [{ message: 'The file has no list of "cases".', path: 'cases' }] };
  if (rawCases.length === 0) return { ok: false, problems: [{ message: 'The file holds no test case.', path: 'cases' }] };

  const fieldNote = ignoredFieldNote(rawCases);
  if (fieldNote) notes.push(fieldNote);

  const drafts: DraftRow[] = [];
  const invalid: InvalidRow[] = [];
  const seen = new Map<string, number>();
  rawCases.forEach((item, index) => {
    const position = index + 1;
    const label = isObject(item) && typeof item['name'] === 'string' && item['name'] !== '' ? item['name'] : `Case ${position}`;
    const prepared = isObject(item) && typeof item['id'] === 'number' ? { ...item, id: String(item['id']) } : item;
    const parsed = importCase.safeParse(prepared);
    if (!parsed.success) {
      const reason = zodProblems(parsed.error, prepared)
        .map((p) => (p.path && !p.message.startsWith(p.path) ? `${p.path}: ${p.message}` : p.message))
        .join(' ');
      invalid.push({ position, label, reason });
      return;
    }
    const id = parsed.data.id;
    if (id !== undefined) {
      const first = seen.get(id);
      if (first !== undefined) {
        invalid.push({ position, label, reason: `The identifier ${id} is already used by case ${first} of this file.` });
        return;
      }
      seen.set(id, position);
    }
    drafts.push({ position, draft: draftFrom(parsed.data) });
  });
  return { ok: true, value: { ...(name !== undefined ? { name } : {}), drafts, invalid }, notes };
}
