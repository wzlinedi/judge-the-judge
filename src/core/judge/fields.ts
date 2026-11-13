// Recognizing the structure of a judge reply (research.md, section 9; FR-011, FR-012, FR-088).
// It never says what an error is: that is only for the user's error rules.
import type { Problem } from '../model';
import { extractJson } from './extract-json';

export type FieldKind = 'text' | 'number' | 'boolean' | 'empty';

export interface ReplyField {
  path: string;
  kind: FieldKind;
  /** Up to eight distinct values seen in the sample. */
  values: string[];
  /** The nearest enclosing list, or undefined for a field outside any list. */
  list: string | undefined;
}

export interface RecognizedFields {
  ok: true;
  fields: ReplyField[];
  lists: string[];
  /** Keys that contain a dot or brackets; not supported in this version. */
  unsupportedKeys: string[];
}

export interface UnreadableSample {
  ok: false;
  message: string;
  line?: number;
  column?: number;
}

const MAX_VALUES = 8;

function kindOf(value: unknown): FieldKind | null {
  if (value === null) return 'empty';
  switch (typeof value) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return null;
  }
}

export function recognizeFields(sample: string): RecognizedFields | UnreadableSample {
  const extracted = extractJson(sample);
  if (!extracted.ok) return { ok: false, message: extracted.message, line: extracted.line, column: extracted.column };

  const fields = new Map<string, ReplyField>();
  const lists: string[] = [];
  const unsupported: string[] = [];

  const record = (path: string, value: unknown, list: string | undefined) => {
    const kind = kindOf(value);
    if (kind === null) return;
    let field = fields.get(path);
    if (!field) {
      field = { path, kind, values: [], list };
      fields.set(path, field);
    } else if (field.kind === 'empty' && kind !== 'empty') field.kind = kind;
    if (kind !== 'empty') {
      const text = String(value);
      if (!field.values.includes(text) && field.values.length < MAX_VALUES) field.values.push(text);
    }
  };

  const walk = (value: unknown, path: string, list: string | undefined) => {
    if (Array.isArray(value)) {
      const listPath = `${path}[]`;
      if (value.some((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) {
        if (!lists.includes(listPath)) lists.push(listPath);
        for (const item of value) walk(item, listPath, listPath);
      } else {
        for (const item of value) {
          if (Array.isArray(item)) walk(item, listPath, list);
          else record(listPath, item, list);
        }
      }
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (/[.[\]]/.test(key)) {
          if (!unsupported.includes(key)) unsupported.push(key);
          continue;
        }
        walk(item, path === '' || path.endsWith(']') ? (path === '' ? key : `${path}.${key}`) : `${path}.${key}`, list);
      }
      return;
    }
    if (path !== '') record(path, value, list);
  };

  walk(extracted.value, '', undefined);
  return { ok: true, fields: [...fields.values()], lists, unsupportedKeys: unsupported };
}

const WELL_KNOWN = ['text', 'claim', 'statement', 'element', 'sentence', 'part', 'quote'];

function lastSegment(path: string): string {
  const i = path.lastIndexOf('.');
  return i === -1 ? path : path.slice(i + 1);
}

/** Per list, the proposed field holding the text a finding points at. */
export function proposeFindingText(recognized: RecognizedFields): Record<string, string> {
  const result: Record<string, string> = {};
  for (const list of recognized.lists) {
    const candidates = recognized.fields.filter((f) => f.list === list && f.kind === 'text' && f.path !== list);
    if (candidates.length === 0) continue;
    let chosen: ReplyField | undefined;
    for (const name of WELL_KNOWN) {
      chosen = candidates.find((f) => lastSegment(f.path) === name);
      if (chosen) break;
    }
    if (!chosen) {
      const average = (f: ReplyField) => f.values.reduce((sum, v) => sum + v.length, 0) / Math.max(1, f.values.length);
      chosen = candidates.reduce((best, f) => (average(f) > average(best) ? f : best));
    }
    result[list] = chosen.path;
  }
  return result;
}

/** The field must belong to that list and hold text. */
export function validFindingTextField(recognized: RecognizedFields, list: string, field: string): boolean {
  return recognized.fields.some((f) => f.path === field && f.list === list && f.kind === 'text');
}

export function unreadableToProblem(sample: UnreadableSample): Problem {
  const problem: Problem = { message: sample.message };
  if (sample.line !== undefined) problem.line = sample.line;
  if (sample.column !== undefined) problem.column = sample.column;
  return problem;
}
