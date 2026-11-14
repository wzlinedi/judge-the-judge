// The stored layout of test cases (file-formats.md, section 3).
import { z } from 'zod';
import type { TestCase, TestCases } from '../model';

export const MAX_CASES = 500;
export const MAX_FIELD_LENGTH = 100_000;

export const expectedErrorSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  category: z.string().optional(),
  fragment: z.string().optional(),
  difficulty: z.enum(['obvious', 'subtle']).optional(),
});

export const testCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  base: z.string().optional(),
  changed_after_first_reply: z.enum(['added', 'corrected']).optional(),
  generation_prompt: z.string().optional(),
  fields: z.record(z.string(), z.string().max(MAX_FIELD_LENGTH)),
  expected_errors: z.array(expectedErrorSchema),
});

export const testCasesSchema = z.object({
  name: z.string().default('Untitled test cases'),
  version: z.string().optional(),
  finalized: z.boolean().default(false),
  cases: z.array(testCaseSchema).max(MAX_CASES),
});

type ParsedCase = z.infer<typeof testCaseSchema>;

/** Gives every expected error an identifier: the next free `e<number>` in its case. */
export function assignExpectedIds(parsed: ParsedCase[]): TestCase[] {
  return parsed.map((c) => {
    const used = new Set(c.expected_errors.map((e) => e.id).filter((id): id is string => id !== undefined));
    let n = 0;
    const nextId = () => {
      do n++;
      while (used.has(`e${n}`));
      used.add(`e${n}`);
      return `e${n}`;
    };
    return {
      id: c.id,
      name: c.name,
      ...(c.base !== undefined ? { base: c.base } : {}),
      ...(c.changed_after_first_reply !== undefined ? { changed_after_first_reply: c.changed_after_first_reply } : {}),
      ...(c.generation_prompt !== undefined ? { generation_prompt: c.generation_prompt } : {}),
      fields: c.fields,
      expected_errors: c.expected_errors.map((e) => ({
        id: e.id ?? nextId(),
        description: e.description,
        ...(e.category !== undefined ? { category: e.category } : {}),
        ...(e.fragment !== undefined ? { fragment: e.fragment } : {}),
        ...(e.difficulty !== undefined ? { difficulty: e.difficulty } : {}),
      })),
    };
  });
}

/** A `field` key on an expected error is ignored; this says so once. */
export function ignoredFieldNote(rawCases: unknown): string | undefined {
  if (!Array.isArray(rawCases)) return undefined;
  const found = rawCases.some((c) => Array.isArray((c as { expected_errors?: unknown })?.expected_errors) && (c as { expected_errors: unknown[] }).expected_errors.some((e) => e !== null && typeof e === 'object' && 'field' in e));
  return found ? 'The key "field" on expected errors was ignored: an expected error always concerns the judged text.' : undefined;
}

/** The stored layout of a case, in a stable key order. */
export function storedCase(c: TestCase): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    ...(c.base !== undefined ? { base: c.base } : {}),
    ...(c.changed_after_first_reply !== undefined ? { changed_after_first_reply: c.changed_after_first_reply } : {}),
    ...(c.generation_prompt !== undefined ? { generation_prompt: c.generation_prompt } : {}),
    fields: c.fields,
    expected_errors: c.expected_errors.map((e) => ({
      id: e.id,
      ...(e.category !== undefined ? { category: e.category } : {}),
      ...(e.fragment !== undefined ? { fragment: e.fragment } : {}),
      description: e.description,
      ...(e.difficulty !== undefined ? { difficulty: e.difficulty } : {}),
    })),
  };
}

export type { TestCases };
