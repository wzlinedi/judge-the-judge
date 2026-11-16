// Keys that come from data may be `__proto__` (S1, Constitution IX, T406): a case id, an error id, a field or parameter name.
// The JSON reader keeps such a key as an own key, but Zod drops it from a record and from an object without a word, and
// does not check its value. So before a file is checked every own key `__proto__` is renamed to a stand-in, and after the
// check the stand-in is given back as an own key. The schemas, and the JSON Schema files made from them, do not change.
import type { z } from 'zod';

/** The name a key `__proto__` has while the data is checked. It starts with a NUL, so no ordinary file holds it. */
export const PROTO_STAND_IN = '\u0000__proto__';

/** A copy of the tree in which every own key `from` is named `to`; a part with no such key is the same object as before. */
function renamed(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const next = renamed(item, from, to);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? items : value;
  }
  if (value === null || typeof value !== 'object') return value;
  let changed = Object.hasOwn(value, from);
  const entries = Object.keys(value).map((key): [string, unknown] => {
    const item = (value as Record<string, unknown>)[key];
    const next = renamed(item, from, to);
    if (next !== item) changed = true;
    return [key === from ? to : key, next];
  });
  if (!changed) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of entries) Object.defineProperty(out, key, { value: item, enumerable: true, writable: true, configurable: true });
  return out;
}

export type OwnKeysParse<T> = { success: true; data: T } | { success: false; error: z.ZodError; input: unknown };

/** `schema.safeParse(input)` that keeps every own key `__proto__` of the data. On failure, `input` is what was checked. */
export function safeParseOwnKeys<S extends z.ZodType>(schema: S, input: unknown): OwnKeysParse<z.output<S>> {
  const hidden = renamed(input, '__proto__', PROTO_STAND_IN);
  const parsed = schema.safeParse(hidden);
  if (!parsed.success) return { success: false, error: parsed.error, input: hidden };
  return { success: true, data: renamed(parsed.data, PROTO_STAND_IN, '__proto__') as z.output<S> };
}
