// What is wrong with one case, and what only deserves a warning (FR-037, FR-047, FR-079).
import type { Category, Problem, TestCase } from '../model';

export const MAX_FIELD_LENGTH = 100_000;
export const WARN_FIELD_LENGTH = 30_000;

export interface CaseContext {
  variables: readonly string[];
  judgedText: string | undefined;
  catalog: readonly Category[];
  /** Every other case of the test project (not the one being checked). */
  others: readonly TestCase[];
}

export interface CaseValidation {
  problems: Problem[];
  warnings: Problem[];
}

export const normalizeName = (name: string): string => name.trim().toLowerCase();

export function validateCase(testCase: Omit<TestCase, 'id'> & { id?: string }, context: CaseContext): CaseValidation {
  const problems: Problem[] = [];
  const warnings: Problem[] = [];
  const fields = testCase.fields;
  const variables = new Set(context.variables);

  if (!Object.values(fields).some((v) => v.trim() !== '')) {
    problems.push({ message: 'The case has no text in any field. Give it a text for each variable.', path: 'fields' });
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value.length > MAX_FIELD_LENGTH) {
      problems.push({ message: `The field is longer than 100,000 characters, which is the limit.`, path: `fields.${key}` });
    } else if (value.length > WARN_FIELD_LENGTH) {
      warnings.push({ message: `The field is longer than 30,000 characters, so the composed prompt may not fit the model's context limit.`, path: `fields.${key}` });
    }
  }
  for (const variable of context.variables) {
    const value = Object.hasOwn(fields, variable) ? fields[variable] : undefined;
    if (value === undefined) warnings.push({ message: `The case has no field for the variable "${variable}"; it will be empty in the prompt.`, path: `fields.${variable}` });
    else if (value.trim() === '' && Object.values(fields).some((v) => v.trim() !== '')) {
      problems.push({ message: `The field "${variable}" is empty.`, path: `fields.${variable}` });
    }
  }
  for (const key of Object.keys(fields)) {
    if (!variables.has(key)) warnings.push({ message: `The field "${key}" matches no variable of the prompt. It is kept and never sent to the judge.`, path: `fields.${key}` });
  }

  const name = normalizeName(testCase.name);
  if (name !== '') {
    const same = context.others.find((c) => normalizeName(c.name) === name && c.id !== testCase.id);
    if (same) problems.push({ message: `The name "${testCase.name.trim()}" is already used by case ${same.id}.`, path: 'name' });
  }

  testCase.expected_errors.forEach((error, i) => {
    const at = `expected_errors[${i}]`;
    if (error.description.trim() === '') problems.push({ message: 'The expected error has no description.', path: `${at}.description` });
    if (error.category !== undefined && error.category !== '' && !context.catalog.some((c) => c.name === error.category)) {
      warnings.push({ message: `The category "${error.category}" is not in the catalog yet.`, path: `${at}.category` });
    }
  });

  if (testCase.base !== undefined) {
    const base = context.others.find((c) => c.id === testCase.base);
    if (!base) {
      warnings.push({ message: `The base "${testCase.base}" is not a test case of this project.`, path: 'base' });
    }
  }
  return { problems, warnings };
}
