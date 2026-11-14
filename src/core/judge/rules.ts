// Error rules (research.md, section 9; FR-013, FR-014): evaluation is three-valued, so a field the
// reply does not contain is "unknown" and the tool never guesses.
import type { Condition, ErrorRule } from '../model';
import type { RecognizedFields } from './fields';

export type Tri = 'holds' | 'fails' | 'unknown';

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && NUMBER.test(value.trim())) return Number(value.trim());
  return null;
}

function sameText(value: unknown, typed: string): boolean | null {
  if (typeof value === 'boolean') return String(value) === typed.trim().toLowerCase();
  if (typeof value === 'string' || typeof value === 'number') {
    const a = asNumber(value);
    const b = asNumber(typed);
    if (a !== null && b !== null) return a === b;
    return String(value).trim().toLowerCase() === typed.trim().toLowerCase();
  }
  return null;
}

/** `value` is undefined when the field is absent from the reply. */
export function evaluateCondition(condition: Condition, value: unknown): Tri {
  if (value === undefined) return 'unknown';
  const typed = condition.value ?? '';
  switch (condition.comparison) {
    case 'is_empty':
    case 'is_not_empty': {
      const empty = value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
      return (condition.comparison === 'is_empty') === empty ? 'holds' : 'fails';
    }
    case 'equals':
    case 'not_equals': {
      const same = sameText(value, typed);
      if (same === null) return 'unknown';
      return (condition.comparison === 'equals') === same ? 'holds' : 'fails';
    }
    case 'greater_than':
    case 'less_than': {
      const a = asNumber(value);
      const b = asNumber(typed);
      if (a === null || b === null) return 'unknown';
      return (condition.comparison === 'greater_than' ? a > b : a < b) ? 'holds' : 'fails';
    }
  }
}

export interface RuleEvaluation {
  result: Tri;
  /** Paths of the fields that were absent or could not be compared. */
  unknownFields: string[];
}

export function evaluateRule(rule: ErrorRule, read: (field: string) => unknown): RuleEvaluation {
  const results = rule.conditions.map((c) => ({ c, r: evaluateCondition(c, read(c.field)) }));
  const unknownFields = results.filter((x) => x.r === 'unknown').map((x) => x.c.field);
  let result: Tri;
  if (rule.match === 'any') {
    result = results.some((x) => x.r === 'holds') ? 'holds' : unknownFields.length > 0 ? 'unknown' : 'fails';
  } else {
    result = results.some((x) => x.r === 'fails') ? 'fails' : unknownFields.length > 0 ? 'unknown' : 'holds';
  }
  return { result, unknownFields: [...new Set(unknownFields)] };
}

export function isListPath(path: string): boolean {
  return path.includes('[]');
}

/** The nearest enclosing list of a field path: `a[].b[].c` -> `a[].b[]`. */
export function listOfPath(path: string): string | undefined {
  const i = path.lastIndexOf('[]');
  return i === -1 ? undefined : path.slice(0, i + 2);
}

/** `unfinished` is set when the only thing missing is a value a condition still waits for: the rule is not used yet, but it is not broken. */
export type RuleValidation = { usable: true; list: string | undefined } | { usable: false; reason: string; unfinished?: true };

export function needsValue(condition: Condition): boolean {
  return condition.comparison !== 'is_empty' && condition.comparison !== 'is_not_empty';
}

export function hasNoValue(condition: Condition): boolean {
  return needsValue(condition) && (condition.value === undefined || condition.value === '');
}

export function validateRules(rules: readonly ErrorRule[], recognized: RecognizedFields): RuleValidation[] {
  const known = new Set(recognized.fields.map((f) => f.path));
  return rules.map((rule) => {
    if (rule.conditions.length === 0) return { usable: false, reason: `"${rule.name}" has no conditions.` };
    const lists = new Set<string>();
    for (const condition of rule.conditions) {
      if (!known.has(condition.field)) {
        return { usable: false, reason: `"${rule.name}" uses the field ${condition.field}, which the sample reply does not contain.` };
      }
      const list = listOfPath(condition.field);
      if (list) lists.add(list);
    }
    if (lists.size > 1) return { usable: false, reason: `"${rule.name}" uses two lists (${[...lists].join(' and ')}); one rule can use only one.` };
    const waiting = rule.conditions.find(hasNoValue);
    if (waiting) return { usable: false, unfinished: true, reason: `"${rule.name}" has a condition on ${waiting.field} with no value.` };
    return { usable: true, list: [...lists][0] };
  });
}
