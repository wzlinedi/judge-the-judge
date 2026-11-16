// Getting the JSON out of a text (research.md, section 9; FR-084): the whole text, the content of a
// code fence, or the first balanced block. A broken outer JSON is reported with its line and column
// in the whole text and an inner part is never read as the answer.

export type ExtractResult =
  | { ok: true; value: unknown; json: string; start: number; end: number }
  | { ok: false; reason: 'empty' | 'no_json' | 'invalid'; message: string; line?: number; column?: number };

type Parsed = { ok: true; value: unknown; end: number } | { ok: false; offset: number; message: string };

const WS = new Set([' ', '\t', '\n', '\r']);

/** Deeper nesting is refused, so a hostile text cannot exhaust the call stack (code review S3). */
const MAX_DEPTH = 100;
const TOO_DEEP = `The JSON is nested more than ${MAX_DEPTH} levels deep`;

/** A strict JSON parser that reports the offset of the first problem (JSON.parse messages vary). */
function parseJson(text: string, from: number): Parsed {
  let i = from;
  let depth = 0;
  const fail = (offset: number, message: string): Parsed => ({ ok: false, offset, message });

  const skip = () => {
    while (i < text.length && WS.has(text[i] as string)) i++;
  };

  const value = (): Parsed => {
    skip();
    const c = text[i];
    if (c === undefined) return fail(i, 'The text ends where a value was expected.');
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    for (const [word, v] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(word, i)) {
        i += word.length;
        return { ok: true, value: v, end: i };
      }
    }
    return fail(i, `Unexpected "${c}" where a value was expected.`);
  };

  const string = (): Parsed => {
    const start = i;
    i++;
    let out = '';
    while (i < text.length) {
      const c = text[i] as string;
      if (c === '"') {
        i++;
        return { ok: true, value: out, end: i };
      }
      if (c === '\\') {
        const e = text[i + 1];
        const simple: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        if (e !== undefined && e in simple) {
          out += simple[e];
          i += 2;
        } else if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
          out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16));
          i += 6;
        } else {
          return fail(i, 'A text contains a "\\" that is not a valid escape.');
        }
      } else if (c < ' ') {
        return fail(i, 'A text contains a line break or control character; write it as \\n.');
      } else {
        out += c;
        i++;
      }
    }
    return fail(start, 'A text is not closed with a quote.');
  };

  const number = (): Parsed => {
    const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(i));
    if (!m) return fail(i, 'A number is not written correctly.');
    i += m[0].length;
    return { ok: true, value: Number(m[0]), end: i };
  };

  const tooDeep = (): Parsed => fail(i, TOO_DEEP);

  const array = (): Parsed => {
    if (depth >= MAX_DEPTH) return tooDeep();
    depth++;
    const result = arrayItems();
    depth--;
    return result;
  };

  const arrayItems = (): Parsed => {
    i++;
    const items: unknown[] = [];
    skip();
    if (text[i] === ']') {
      i++;
      return { ok: true, value: items, end: i };
    }
    for (;;) {
      const v = value();
      if (!v.ok) return v;
      items.push(v.value);
      skip();
      const c = text[i];
      if (c === ',') {
        i++;
        continue;
      }
      if (c === ']') {
        i++;
        return { ok: true, value: items, end: i };
      }
      return fail(i, c === undefined ? 'The list is not closed with "]".' : `Expected "," or "]" but found "${c}".`);
    }
  };

  const object = (): Parsed => {
    if (depth >= MAX_DEPTH) return tooDeep();
    depth++;
    const result = objectMembers();
    depth--;
    return result;
  };

  const objectMembers = (): Parsed => {
    i++;
    const obj: Record<string, unknown> = {};
    skip();
    if (text[i] === '}') {
      i++;
      return { ok: true, value: obj, end: i };
    }
    for (;;) {
      skip();
      if (text[i] !== '"') return fail(i, text[i] === undefined ? 'The object is not closed with "}".' : `Expected a key in quotes but found "${text[i]}".`);
      const k = string();
      if (!k.ok) return k;
      skip();
      if (text[i] !== ':') return fail(i, text[i] === undefined ? 'The text ends after a key.' : `Expected ":" after the key but found "${text[i]}".`);
      i++;
      const v = value();
      if (!v.ok) return v;
      Object.defineProperty(obj, k.value as string, { value: v.value, enumerable: true, writable: true, configurable: true });
      skip();
      const c = text[i];
      if (c === ',') {
        i++;
        continue;
      }
      if (c === '}') {
        i++;
        return { ok: true, value: obj, end: i };
      }
      return fail(i, c === undefined ? 'The object is not closed with "}".' : `Expected "," or "}" but found "${c}".`);
    }
  };

  const result = value();
  return result;
}

function parseWhole(text: string, from: number, to: number): Parsed {
  const slice = text.slice(0, to);
  const r = parseJson(slice, from);
  if (!r.ok) return r;
  let i = r.end;
  while (i < slice.length && WS.has(slice[i] as string)) i++;
  if (i < slice.length) return { ok: false, offset: i, message: `Unexpected "${slice[i]}" after the JSON.` };
  return r;
}

function position(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else column++;
  }
  return { line, column };
}

/** The end (exclusive) of the balanced block that starts at `start`, honoring strings; -1 if unclosed. */
function balancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i] as string;
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function invalid(text: string, offset: number, message: string): ExtractResult {
  const { line, column } = position(text, offset);
  if (message === TOO_DEEP) return { ok: false, reason: 'invalid', message: `${message} (line ${line}, column ${column}).`, line, column };
  return { ok: false, reason: 'invalid', message: `${message} (line ${line}, column ${column})`, line, column };
}

export function extractJson(text: string): ExtractResult {
  if (text.trim() === '') return { ok: false, reason: 'empty', message: 'There is no text.' };

  // 1. The whole text
  const startWhole = text.search(/\S/);
  const whole = parseWhole(text, startWhole, text.length);
  if (whole.ok) return { ok: true, value: whole.value, json: text.trim(), start: startWhole, end: text.trimEnd().length };

  // 2. The content of a code fence
  const fence = /```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)```/g;
  for (const m of text.matchAll(fence)) {
    const body = m[1] ?? '';
    const bodyStart = (m.index ?? 0) + m[0].indexOf(body);
    if (body.trim() === '') continue;
    const from = bodyStart + body.search(/\S/);
    const r = parseWhole(text, from, bodyStart + body.length);
    if (r.ok) return { ok: true, value: r.value, json: text.slice(from, bodyStart + body.length).trim(), start: from, end: bodyStart + body.trimEnd().length };
  }

  // 3. From the first "{" or "[": its balanced block, else up to the last "}" or "]"
  const first = text.search(/[{[]/);
  if (first === -1) return { ok: false, reason: 'no_json', message: 'No JSON was found in the text.' };
  const end = balancedEnd(text, first);
  if (end !== -1) {
    const r = parseWhole(text, first, end);
    if (r.ok) return { ok: true, value: r.value, json: text.slice(first, end), start: first, end };
    return invalid(text, r.offset, r.message);
  }
  const last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (last > first) {
    const r = parseWhole(text, first, last + 1);
    if (r.ok) return { ok: true, value: r.value, json: text.slice(first, last + 1), start: first, end: last + 1 };
    return invalid(text, r.offset, r.message);
  }
  const r = parseJson(text, first);
  if (!r.ok) return invalid(text, r.offset, r.message);
  return invalid(text, text.length, 'The JSON is not closed.');
}
