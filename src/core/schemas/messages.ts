// Plain sentences for validation problems (FR-005, FR-084): the place, then what to fix.
import type { ZodError, ZodIssue } from 'zod';
import type { Problem } from '../model';
import { PROTO_STAND_IN } from './own-record';

/** A key `__proto__` is checked under a stand-in name (own-record.ts); a message names the key as written in the file. */
const shown = (part: PropertyKey): PropertyKey => (part === PROTO_STAND_IN ? '__proto__' : part);

/** `fields.summary`, `expected_errors[2].description`: keys joined by dots, indexes in brackets. */
export function pathText(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const raw of path) {
    const part = shown(raw);
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${String(part)}` : String(part);
  }
  return out;
}

function valueAt(input: unknown, path: ReadonlyArray<PropertyKey>): unknown {
  let current: unknown = input;
  for (const part of path) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    current = (current as Record<PropertyKey, unknown>)[part];
  }
  return current;
}

function describeKind(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'an empty value';
  if (Array.isArray(value)) return 'a list';
  switch (typeof value) {
    case 'string':
      return 'text';
    case 'number':
      return 'a number';
    case 'boolean':
      return 'true or false';
    default:
      return 'an object';
  }
}

function expectedKind(expected: string): string {
  switch (expected) {
    case 'string':
      return 'text';
    case 'number':
    case 'int':
      return 'a number';
    case 'boolean':
      return 'true or false';
    case 'array':
      return 'a list';
    case 'object':
    case 'record':
      return 'an object';
    default:
      return expected;
  }
}

/** 100000 as 100,000, the way the limits are written elsewhere in the tool. */
function grouped(value: unknown): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function sentenceFor(issue: ZodIssue, input: unknown): string {
  const where = pathText(issue.path);
  const label = where || 'The file';
  const anyIssue = issue as unknown as Record<string, unknown>;
  switch (issue.code) {
    case 'invalid_type': {
      const found = valueAt(input, issue.path);
      if (found === undefined) return `${label} is missing. Add it.`;
      return `${label} should be ${expectedKind(String(anyIssue['expected']))}, but ${describeKind(found)} was found.`;
    }
    case 'too_small':
      if (anyIssue['origin'] === 'string' && Number(anyIssue['minimum']) <= 1) return `${label} is empty. Write something there.`;
      return `${label} is too small: at least ${grouped(anyIssue['minimum'])} is needed.`;
    case 'too_big':
      if (anyIssue['origin'] === 'string') return `${label} is too long: at most ${grouped(anyIssue['maximum'])} characters.`;
      return `${label} is too big: at most ${grouped(anyIssue['maximum'])} are allowed.`;
    case 'invalid_value': {
      const values = Array.isArray(anyIssue['values']) ? (anyIssue['values'] as unknown[]).map((v) => `"${String(v)}"`).join(', ') : '';
      const found = valueAt(input, issue.path);
      return `${label} must be one of ${values}${found === undefined ? '' : `, but "${String(found)}" was found`}.`;
    }
    case 'unrecognized_keys':
      return `${label} has keys the tool does not know: ${(anyIssue['keys'] as string[]).map((k) => String(shown(k))).join(', ')}.`;
    default:
      return where ? `${where}: ${issue.message}` : issue.message;
  }
}

/** Turns a Zod error into plain problems that name the place and what to fix. */
export function zodProblems(error: ZodError, input?: unknown): Problem[] {
  return error.issues.map((issue) => {
    const problem: Problem = { message: sentenceFor(issue, input) };
    const where = pathText(issue.path);
    if (where) problem.path = where;
    return problem;
  });
}
