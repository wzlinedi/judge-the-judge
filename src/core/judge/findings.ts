// Applying the error rules to a reply (research.md, section 9; FR-013, FR-014).
import type { ErrorRule } from '../model';
import { extractJson } from './extract-json';
import type { RecognizedFields } from './fields';
import { evaluateRule, listOfPath, validateRules } from './rules';

export interface Finding {
  /** List path and position (`claims[]#2`, nested `a[].b[]#1.3`), or `reply` for the whole reply. */
  key: string;
  text: string;
  rules: string[];
}

export interface FindingsResult {
  readable: boolean;
  reason?: string;
  findings: Finding[];
  /** Fields that were missing or could not be compared, so that a rule could not be evaluated. */
  unknown: string[];
}

function getByPath(root: unknown, path: string): unknown {
  if (path === '') return root;
  let current: unknown = root;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    if (!Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** The items of a list path such as `a[].b[]`, each with its position chain. */
function listItems(root: unknown, list: string): Array<{ item: unknown; positions: number[] }> {
  const segments = list.split('[]').slice(0, -1); // `a[].b[]` -> ['a', '.b']
  let level: Array<{ item: unknown; positions: number[] }> = [{ item: root, positions: [] }];
  for (const raw of segments) {
    const key = raw.startsWith('.') ? raw.slice(1) : raw;
    const next: Array<{ item: unknown; positions: number[] }> = [];
    for (const { item, positions } of level) {
      const array = getByPath(item, key);
      if (Array.isArray(array)) array.forEach((child, i) => next.push({ item: child, positions: [...positions, i + 1] }));
    }
    level = next;
  }
  return level;
}

/** Reads a condition's field for an item of `list`: list fields relative to the item, others from the root. */
function readField(root: unknown, item: unknown, list: string | undefined, field: string): unknown {
  const own = listOfPath(field);
  if (own === undefined) return getByPath(root, field);
  if (list !== undefined && own === list) return getByPath(item, field.slice(list.length).replace(/^\./, ''));
  return undefined;
}

/** The list a rule is about: the list of its first condition that has one; undefined for a rule about the whole reply. */
export function ruleList(rule: ErrorRule): string | undefined {
  return rule.conditions.map((c) => listOfPath(c.field)).find((l): l is string => l !== undefined);
}

/** "Where the error is" of a rule: its own field, else the one the reply mapping names for its list. */
export function whereTheErrorIs(rule: ErrorRule, list: string, findingText: Record<string, string>): string | undefined {
  return rule.finding_text ?? findingText[list];
}

export function findFindings(
  replyText: string,
  rules: readonly ErrorRule[],
  findingText: Record<string, string>,
  recognized?: RecognizedFields,
): FindingsResult {
  const extracted = extractJson(replyText);
  if (!extracted.ok) return { readable: false, reason: extracted.message, findings: [], unknown: [] };

  const validations = recognized ? validateRules(rules, recognized) : rules.map(() => ({ usable: true as const, list: undefined }));
  const active = rules.filter((rule, i) => rule.conditions.length > 0 && validations[i]?.usable !== false);
  if (active.length === 0) {
    return { readable: false, reason: 'There is no usable error rule, so the reply cannot be read automatically.', findings: [], unknown: [] };
  }

  const root = extracted.value;
  const byKey = new Map<string, Finding>();
  const unknown: string[] = [];

  for (const rule of active) {
    const lists = [...new Set(rule.conditions.map((c) => listOfPath(c.field)).filter((l): l is string => l !== undefined))];
    const list = lists[0];
    if (list === undefined) {
      const evaluation = evaluateRule(rule, (field) => readField(root, root, undefined, field));
      unknown.push(...evaluation.unknownFields);
      if (evaluation.result === 'holds') {
        const found = byKey.get('reply') ?? { key: 'reply', text: '', rules: [] };
        found.rules.push(rule.name);
        byKey.set('reply', found);
      }
      continue;
    }
    for (const { item, positions } of listItems(root, list)) {
      const evaluation = evaluateRule(rule, (field) => readField(root, item, list, field));
      unknown.push(...evaluation.unknownFields);
      if (evaluation.result !== 'holds') continue;
      const key = `${list}#${positions.join('.')}`;
      const textField = whereTheErrorIs(rule, list, findingText);
      const raw = textField ? readField(root, item, list, textField) : undefined;
      const found = byKey.get(key) ?? { key, text: typeof raw === 'string' ? raw : raw === undefined || raw === null ? '' : String(raw), rules: [] };
      found.rules.push(rule.name);
      byKey.set(key, found);
    }
  }
  return { readable: true, findings: [...byKey.values()], unknown: [...new Set(unknown)] };
}

export interface PreviewRow {
  key: string;
  text: string;
  /** Names of the rules that hold; empty means "no finding". */
  rules: string[];
}

export type RulePreview = { readable: true; rows: PreviewRow[] } | { readable: false; reason: string };

/** For the Judge step: every part of the sample with its finding (and rule names) or "no finding". */
export function previewRules(sampleReply: string, rules: readonly ErrorRule[], findingText: Record<string, string>, recognized?: RecognizedFields): RulePreview {
  const result = findFindings(sampleReply, rules, findingText, recognized);
  if (!result.readable) return { readable: false, reason: result.reason ?? 'The sample cannot be read.' };
  const extracted = extractJson(sampleReply);
  if (!extracted.ok) return { readable: false, reason: extracted.message };
  const lists = [...new Set(rules.flatMap((r) => r.conditions.map((c) => listOfPath(c.field))).filter((l): l is string => l !== undefined))];
  const rows: PreviewRow[] = [];
  for (const list of lists) {
    for (const { item, positions } of listItems(extracted.value, list)) {
      const key = `${list}#${positions.join('.')}`;
      const hit = result.findings.find((f) => f.key === key);
      const first = rules.find((r) => ruleList(r) === list);
      const textField = first ? whereTheErrorIs(first, list, findingText) : findingText[list];
      const raw = textField ? readField(extracted.value, item, list, textField) : undefined;
      rows.push({ key, text: hit?.text ?? (typeof raw === 'string' ? raw : ''), rules: hit?.rules ?? [] });
    }
  }
  const whole = result.findings.find((f) => f.key === 'reply');
  if (whole || rules.some((r) => r.conditions.length > 0 && r.conditions.every((c) => listOfPath(c.field) === undefined))) {
    rows.push({ key: 'reply', text: '', rules: whole?.rules ?? [] });
  }
  return { readable: true, rows };
}
