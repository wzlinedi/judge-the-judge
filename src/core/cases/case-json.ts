// The one case JSON layout and its check (file-formats.md, section 2; FR-031, FR-041, FR-083, FR-084, FR-089, FR-090).
import { extractJson } from '../judge/extract-json';
import type { CaseJsonCheck, CaseJsonCheckContext, Difficulty, ExpectedError, Problem, TestCase } from '../model';
import { validateCase } from './validate';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const text = (p: Problem): string => p.message;

/** The case JSON of "Show JSON", "Copy JSON" and "Clone": no identifiers, `base` only when set. */
export function caseToJson(testCase: TestCase): string {
  const json = {
    name: testCase.name,
    ...(testCase.base !== undefined ? { base: testCase.base } : {}),
    fields: testCase.fields,
    expected_errors: testCase.expected_errors.map((e) => ({
      ...(e.category !== undefined ? { category: e.category } : {}),
      ...(e.fragment !== undefined ? { fragment: e.fragment } : {}),
      description: e.description,
      ...(e.difficulty !== undefined ? { difficulty: e.difficulty } : {}),
    })),
  };
  return JSON.stringify(json, null, 2);
}

function pickOne(value: unknown, problems: Problem[]): unknown {
  if (Array.isArray(value)) {
    if (value.length === 1) return value[0];
    problems.push({ message: value.length === 0 ? 'The list holds no case.' : `The JSON holds ${value.length} cases. Use "Import test cases" for more than one case.` });
    return undefined;
  }
  if (isObject(value) && 'cases' in value && Array.isArray(value['cases'])) return pickOne(value['cases'], problems);
  return value;
}

export function checkCaseJson(input: string, context: CaseJsonCheckContext): CaseJsonCheck {
  const problems: Problem[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  const extracted = extractJson(input);
  if (!extracted.ok) {
    problems.push({ message: extracted.reason === 'empty' ? 'There is no text.' : extracted.message, ...(extracted.line !== undefined ? { line: extracted.line, column: extracted.column ?? 1 } : {}) });
    return { problems, warnings, notes };
  }
  const raw = pickOne(extracted.value, problems);
  if (problems.length > 0) return { problems, warnings, notes };
  if (!isObject(raw)) {
    problems.push({ message: 'The JSON is not one test case: an object with "name", "fields" and "expected_errors" was expected.' });
    return { problems, warnings, notes };
  }
  if (!isObject(raw['fields']) || raw['expected_errors'] === undefined && !('fields' in raw)) {
    problems.push({ message: 'The JSON is not one test case: it has no "fields".', path: 'fields' });
    return { problems, warnings, notes };
  }

  // fields: only text
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw['fields'])) {
    if (typeof value === 'string') fields[key] = value;
    else problems.push({ message: 'The field must be text.', path: `fields.${key}` });
  }
  for (const variable of context.variables) {
    if (!(variable in (raw['fields'] as object))) problems.push({ message: `The field for the variable "${variable}" is missing.`, path: `fields.${variable}` });
  }

  // expected errors
  const rawErrors = raw['expected_errors'] === undefined ? [] : raw['expected_errors'];
  const errors: ExpectedError[] = [];
  if (!Array.isArray(rawErrors)) {
    problems.push({ message: '"expected_errors" must be a list.', path: 'expected_errors' });
  } else {
    rawErrors.forEach((item, i) => {
      const at = `expected_errors[${i}]`;
      if (!isObject(item)) {
        problems.push({ message: 'An expected error must be an object.', path: at });
        return;
      }
      const description = typeof item['description'] === 'string' ? item['description'] : '';
      if (description.trim() === '') problems.push({ message: 'The expected error has no description.', path: `${at}.description` });
      const difficulty = item['difficulty'];
      if (difficulty !== undefined && difficulty !== 'obvious' && difficulty !== 'subtle') {
        problems.push({ message: 'The difficulty must be "obvious" or "subtle".', path: `${at}.difficulty` });
      }
      const fragment = typeof item['fragment'] === 'string' && item['fragment'] !== '' ? item['fragment'] : undefined;
      const category = typeof item['category'] === 'string' && item['category'] !== '' ? item['category'] : undefined;
      if (fragment === undefined) warnings.push(`${at}: there is no fragment, so it cannot be matched automatically and is decided by hand on Run.`);
      if (category === undefined) warnings.push(`${at}: there is no category, so it is not grouped in the error analysis.`);
      else if (!context.catalog.some((c) => c.name === category)) notes.push(`The category "${category}" is new and is added to the catalog when the case is saved.`);
      errors.push({ id: `e${i + 1}`, description, ...(category !== undefined ? { category } : {}), ...(fragment !== undefined ? { fragment } : {}), ...(difficulty === 'obvious' || difficulty === 'subtle' ? { difficulty: difficulty as Difficulty } : {}) });
    });
  }

  // name
  const typedName = context.name?.trim();
  let name = typedName ? typedName : typeof raw['name'] === 'string' ? raw['name'].trim() : '';

  // base, by mode
  const named = typeof raw['base'] === 'string' ? raw['base'] : undefined;
  const cleanCases = context.existingCases.filter((c) => c.expected_errors.length === 0);
  const findBase = (reference: string) => cleanCases.find((c) => c.id === reference) ?? cleanCases.find((c) => c.name === reference);
  let base: string | undefined;
  if (context.mode === 'paste') {
    if (named !== undefined) {
      base = findBase(named)?.id;
      if (base === undefined) notes.push(`The base "${named}" is not a clean case of this project, so the case has no base.`);
    }
  } else if (context.mode === 'inject') {
    base = context.base;
    if (named !== undefined && named !== context.base && findBase(named)?.id !== context.base) notes.push(`The base "${named}" in the JSON is ignored: the base you picked for this case is used.`);
  } else if (context.mode === 'correct') {
    base = context.original?.base;
  }

  if (context.mode === 'clean' && errors.length > 0) {
    problems.push({ message: 'A clean case has no expected errors. Use "Paste JSON" for a case with expected errors.', path: 'expected_errors' });
  }

  if (context.mode === 'correct' && context.original) {
    if (name !== '' && name !== context.original.name) problems.push({ message: 'Only the expected errors can be corrected. The name cannot change here.', path: 'name' });
    for (const key of new Set([...Object.keys(fields), ...Object.keys(context.original.fields)])) {
      if (fields[key] !== context.original.fields[key]) {
        problems.push({ message: 'Only the expected errors can be corrected. The fields cannot change.', path: `fields.${key}` });
        break;
      }
    }
    name = context.original.name;
  }

  if (context.mode === 'inject' && context.errorsToPrepare !== undefined && errors.length !== context.errorsToPrepare) {
    notes.push(`The answer has ${errors.length} expected ${errors.length === 1 ? 'error' : 'errors'}; ${context.errorsToPrepare} ${context.errorsToPrepare === 1 ? 'was' : 'were'} listed to prepare.`);
  }

  if (name === '') {
    const baseName = base !== undefined ? context.existingCases.find((c) => c.id === base)?.name : undefined;
    name = baseName !== undefined && errors.length > 0 ? `${baseName} + ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}` : `Case ${nextNumber(context.existingCases)}`;
  }

  const others = context.mode === 'correct' && context.original ? context.existingCases.filter((c) => c.id !== context.original?.id) : context.existingCases;
  const candidate: Omit<TestCase, 'id'> = { name, ...(base !== undefined ? { base } : {}), fields, expected_errors: errors };
  const validation = validateCase(candidate, { variables: context.variables, judgedText: context.judgedText, catalog: context.catalog, others });

  // Problems and warnings the shared check already reported for the fields
  const seen = new Set(problems.map((p) => `${p.path ?? ''}|${text(p)}`));
  for (const p of validation.problems) {
    if (p.path?.startsWith('fields.') && problems.some((q) => q.path === p.path)) continue;
    if (!seen.has(`${p.path ?? ''}|${text(p)}`)) problems.push(p);
  }
  for (const w of validation.warnings) {
    if (w.path?.startsWith('fields.') && problems.some((q) => q.path === w.path)) continue; // already a problem
    if (w.path?.endsWith('.category')) continue; // named as a note: it joins the catalog on saving
    if (w.path === 'base' && base === undefined) continue;
    warnings.push(w.path ? `${w.path}: ${w.message}` : w.message);
  }

  const kind = errors.length === 0 ? ('Clean' as const) : ('Injected errors' as const);
  return problems.length > 0 ? { problems, warnings, notes, kind } : { problems, warnings, notes, kind, case: candidate };
}

function nextNumber(cases: readonly TestCase[]): number {
  return cases.length + 1;
}
