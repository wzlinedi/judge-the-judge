// Where a finding is in the text of the judge's reply, so that the saved reply can mark its blocks (T293, FR-055).
// A finding is named by its key: `claims[]#2` (the second item of the list `claims`), `a[].b[]#1.3` (a nested list) or `reply`.
import { extractJson } from './extract-json';

export interface Span {
  start: number;
  end: number;
}

const WS = new Set([' ', '\t', '\n', '\r']);

const skipWs = (text: string, from: number): number => {
  let i = from;
  while (i < text.length && WS.has(text[i] as string)) i++;
  return i;
};

/** The end (exclusive) of the string that starts at `start`. */
function stringEnd(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') i += 2;
    else if (c === '"') return i + 1;
    else i++;
  }
  return text.length;
}

/** The end (exclusive) of the value that starts at `start`; the text is valid JSON, so no value is cut. */
function valueEnd(text: string, start: number): number {
  const c = text[start];
  if (c === '"') return stringEnd(text, start);
  if (c === '{' || c === '[') {
    let depth = 0;
    let i = start;
    while (i < text.length) {
      const d = text[i] as string;
      if (d === '"') {
        i = stringEnd(text, i);
        continue;
      }
      if (d === '{' || d === '[') depth++;
      else if (d === '}' || d === ']') {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    return text.length;
  }
  let i = start;
  while (i < text.length && !WS.has(text[i] as string) && !',}]'.includes(text[i] as string)) i++;
  return i;
}

/** The start of the value of member `name` of the object that starts at `at`. */
function memberStart(text: string, at: number, name: string): number | undefined {
  if (text[at] !== '{') return undefined;
  let i = skipWs(text, at + 1);
  while (i < text.length && text[i] !== '}') {
    const keyEnd = stringEnd(text, i);
    const key = JSON.parse(text.slice(i, keyEnd)) as string;
    i = skipWs(text, keyEnd);
    i = skipWs(text, i + 1); // the colon
    if (key === name) return i;
    i = skipWs(text, valueEnd(text, i));
    if (text[i] === ',') i = skipWs(text, i + 1);
  }
  return undefined;
}

/** The start of item number `index` (0 is the first) of the array that starts at `at`. */
function elementStart(text: string, at: number, index: number): number | undefined {
  if (text[at] !== '[') return undefined;
  let i = skipWs(text, at + 1);
  for (let n = 0; i < text.length && text[i] !== ']'; n++) {
    if (n === index) return i;
    i = skipWs(text, valueEnd(text, i));
    if (text[i] === ',') i = skipWs(text, i + 1);
  }
  return undefined;
}

/** The place of a finding in the reply text; undefined when the reply is not JSON or the finding is not in it. */
export function locateFinding(replyText: string, key: string): Span | undefined {
  const read = extractJson(replyText);
  if (!read.ok) return undefined;
  if (key === 'reply') return { start: read.start, end: read.end };
  const [list, chain] = key.split('#');
  if (list === undefined || chain === undefined) return undefined;
  const names = list.split('[]').slice(0, -1);
  const positions = chain.split('.').map(Number);
  let at = read.start;
  for (const [level, raw] of names.entries()) {
    for (const part of (raw.startsWith('.') ? raw.slice(1) : raw).split('.')) {
      if (part === '') continue;
      const next = memberStart(replyText, at, part);
      if (next === undefined) return undefined;
      at = next;
    }
    const position = positions[level];
    if (position === undefined || !Number.isInteger(position) || position < 1) return undefined;
    const item = elementStart(replyText, at, position - 1);
    if (item === undefined) return undefined;
    at = item;
  }
  return { start: at, end: valueEnd(replyText, at) };
}
