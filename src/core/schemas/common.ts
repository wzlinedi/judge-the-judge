// Common rules of every JSON file the tool reads (contracts/file-formats.md, Common rules).
import type { Problem, ReadResult } from '../model';

export interface FormatSupport {
  /** The value of `format` this reader accepts. */
  format: string;
  /** The highest `schema_version` this tool knows. */
  schemaVersion: number;
  /** Keys the format defines; anything else is reported once as a note. */
  knownKeys?: readonly string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks `format` and `schema_version` of a parsed file and reports unknown extra keys once.
 * Nothing is changed when it fails (FR-005).
 */
export function checkEnvelope(value: unknown, support: FormatSupport): ReadResult<Record<string, unknown>> {
  if (!isObject(value)) {
    return {
      ok: false,
      problems: [{ message: `The file is not a Judge the Judge file: a JSON object with "format": "${support.format}" was expected.` }],
    };
  }
  const found = value['format'];
  if (found === undefined) {
    return {
      ok: false,
      problems: [{ message: `The file has no "format". This tool reads "${support.format}".`, path: 'format' }],
    };
  }
  if (found !== support.format) {
    return {
      ok: false,
      problems: [{ message: `The file has format "${String(found)}". This tool reads "${support.format}" here.`, path: 'format' }],
    };
  }
  const version = value['schema_version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      problems: [{ message: `The file has no usable "schema_version". This tool reads versions 1 to ${support.schemaVersion}.`, path: 'schema_version' }],
    };
  }
  if (version > support.schemaVersion) {
    return {
      ok: false,
      problems: [
        {
          message: `The file uses schema version ${version}, which is newer than this tool knows. This tool reads versions up to ${support.schemaVersion}.`,
          path: 'schema_version',
        },
      ],
    };
  }
  const notes: string[] = [];
  const note = unknownKeysNote(value, support.knownKeys);
  if (note) notes.push(note);
  return { ok: true, value, notes };
}

/** One note naming the keys that are not part of the format, or undefined when there are none. */
export function unknownKeysNote(value: Record<string, unknown>, known: readonly string[] | undefined): string | undefined {
  if (!known) return undefined;
  const extra = Object.keys(value).filter((key) => !known.includes(key));
  if (extra.length === 0) return undefined;
  return `Keys the tool does not use were ignored: ${extra.join(', ')}.`;
}

/** A single-problem failure, for readers that only need a message. */
export function failure<T>(message: string, extra: Partial<Problem> = {}): ReadResult<T> {
  return { ok: false, problems: [{ message, ...extra }] };
}
