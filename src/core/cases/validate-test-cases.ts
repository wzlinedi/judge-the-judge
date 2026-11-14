// The plan of an import: what is valid, what is not, and what the summary has to say (FR-027 to FR-033, FR-079).
// Nothing here changes a test project: the plan is applied, or dropped, by the caller.
import type { Category, ExpectedError, TestCase } from '../model';
import { MAX_CASES } from '../schemas/test-case';
import type { DraftCase, DraftRow, InvalidRow } from '../io/test-cases-json';
import { nextCaseId } from './identifiers';
import { normalizeName, validateCase } from './validate';

export interface ImportContext {
  variables: readonly string[];
  judgedText: string | undefined;
  catalog: readonly Category[];
  existing: readonly TestCase[];
}

export interface ImportPlan {
  /** The valid cases, with their new identifiers, ready to be added. */
  cases: TestCase[];
  invalid: InvalidRow[];
  clean: number;
  injected: number;
  /** How many identifiers were replaced because the test project already uses them. */
  newIdentifiers: number;
  missingCategories: string[];
  unmatchedFields: string[];
  missingVariables: string[];
  /** Names that the imported cases share with others (the cases are kept, both warn). */
  duplicateNames: string[];
  tooMany?: { limit: number; found: number };
  notes: string[];
}

const unique = <T>(items: readonly T[]): T[] => Array.from(new Set(items));

/** Gives every expected error an identifier, the next free `e<number>` of its case. */
function withErrorIds(errors: DraftCase['expected_errors']): ExpectedError[] {
  const used = new Set(errors.map((e) => e.id).filter((id): id is string => id !== undefined));
  let n = 0;
  const next = () => {
    do n++;
    while (used.has(`e${n}`));
    used.add(`e${n}`);
    return `e${n}`;
  };
  return errors.map((e) => ({ ...e, id: e.id ?? next() }));
}

export function planImport(rows: readonly DraftRow[], preInvalid: readonly InvalidRow[], context: ImportContext): ImportPlan {
  const invalid: InvalidRow[] = [...preInvalid];
  const notes: string[] = [];

  // 1. The checks that concern one case alone.
  const alone: DraftRow[] = [];
  for (const row of rows) {
    const { base: _unchecked, id: _file, ...alonePart } = row.draft;
    const check = validateCase({ ...alonePart, expected_errors: withErrorIds(row.draft.expected_errors) }, { variables: context.variables, judgedText: context.judgedText, catalog: context.catalog, others: [] });
    if (check.problems.length > 0) {
      invalid.push({ position: row.position, label: row.draft.name || `Case ${row.position}`, reason: check.problems.map((p) => p.message).join(' ') });
    } else alone.push(row);
  }

  // 2. Identifiers: the one in the file when it is free, otherwise the next free one.
  const taken = new Set(context.existing.map((c) => c.id));
  const assigned = new Map<DraftRow, string>();
  const idOf = new Map<string, string>(); // the identifier in the file -> the one in the test project
  let replaced = 0;
  for (const row of alone) {
    const wanted = row.draft.id;
    let id: string;
    if (wanted !== undefined && wanted !== '' && !taken.has(wanted)) id = wanted;
    else {
      id = nextCaseId([...context.existing, ...[...assigned.values()].map((x) => ({ id: x }))], taken);
      if (wanted !== undefined && wanted !== '') replaced++;
    }
    taken.add(id);
    assigned.set(row, id);
    if (wanted !== undefined && wanted !== '') idOf.set(wanted, id);
  }

  // 3. Bases follow the new identifiers; a case identical to its base is invalid.
  const cleanExisting = new Set(context.existing.filter((c) => c.expected_errors.length === 0).map((c) => c.id));
  const cases: TestCase[] = [];
  const byId = new Map<string, TestCase>();
  for (const row of alone) byId.set(assigned.get(row) as string, { ...row.draft, id: assigned.get(row) as string, expected_errors: withErrorIds(row.draft.expected_errors) });
  for (const row of alone) {
    const id = assigned.get(row) as string;
    const { id: _old, base: wanted, ...rest } = row.draft;
    let base: string | undefined;
    if (wanted !== undefined) {
      const inFile = idOf.get(wanted);
      const target = inFile !== undefined ? byId.get(inFile) : undefined;
      if (target && target.expected_errors.length === 0) base = target.id;
      else if (inFile === undefined && cleanExisting.has(wanted)) base = wanted;
      else notes.push(`The base "${wanted}" of "${row.draft.name || `case ${row.position}`}" is not a clean case here, so the case has no base.`);
    }
    const baseCase = base !== undefined ? (byId.get(base) ?? context.existing.find((c) => c.id === base)) : undefined;
    if (baseCase && rest.expected_errors.length > 0 && Object.keys(baseCase.fields).length === Object.keys(rest.fields).length && Object.entries(rest.fields).every(([k, v]) => baseCase.fields[k] === v)) {
      invalid.push({ position: row.position, label: row.draft.name || `Case ${row.position}`, reason: `The case is identical to its base case ${baseCase.id}. Change the text where the errors are.` });
      continue;
    }
    cases.push({ ...rest, id, ...(base !== undefined ? { base } : {}), expected_errors: (byId.get(id) as TestCase).expected_errors });
  }

  const shown = new Map<string, string>(); // normalized name -> the name as first written
  const count = new Map<string, number>();
  for (const c of [...context.existing, ...cases]) {
    const key = normalizeName(c.name);
    if (key === '') continue;
    if (!shown.has(key)) shown.set(key, c.name.trim());
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const duplicateNames = unique(cases.map((c) => normalizeName(c.name)).filter((key) => key !== '' && (count.get(key) ?? 0) > 1)).map((key) => shown.get(key) as string);

  const found = context.existing.length + cases.length;
  return {
    cases,
    invalid,
    clean: cases.filter((c) => c.expected_errors.length === 0).length,
    injected: cases.filter((c) => c.expected_errors.length > 0).length,
    newIdentifiers: replaced,
    missingCategories: unique(cases.flatMap((c) => c.expected_errors.map((e) => e.category ?? '')).filter((c) => c !== '' && !context.catalog.some((k) => k.name === c))),
    unmatchedFields: unique(cases.flatMap((c) => Object.keys(c.fields)).filter((f) => !context.variables.includes(f))),
    missingVariables: context.variables.filter((v) => cases.some((c) => !(v in c.fields))),
    duplicateNames,
    ...(found > MAX_CASES ? { tooMany: { limit: MAX_CASES, found } } : {}),
    notes,
  };
}
