// Identifiers of cases and of their expected errors (FR-033).
import type { ExpectedError, TestCase } from '../model';

export function nextCaseId(existing: readonly Pick<TestCase, 'id'>[], taken: ReadonlySet<string> = new Set()): string {
  const numbers = existing.map((c) => Number(c.id)).filter((n) => Number.isInteger(n) && n > 0);
  let n = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  while (taken.has(String(n))) n++;
  return String(n);
}

/** The name a new case gets when nobody gives one: "Case N", N being the identifier it will get (T239). */
export function defaultCaseName(existing: readonly Pick<TestCase, 'id'>[]): string {
  return `Case ${nextCaseId(existing)}`;
}

type Draft = Omit<TestCase, 'id' | 'expected_errors'> & { id?: string; expected_errors: Array<Omit<ExpectedError, 'id'> & { id?: string }> };

/** Gives every case without an identifier the next free one, and every expected error one within its case. */
export function assignIdentifiers(drafts: readonly Draft[], existing: readonly TestCase[]): TestCase[] {
  const taken = new Set(existing.map((c) => c.id));
  const result: TestCase[] = [];
  for (const draft of drafts) {
    let id = draft.id;
    if (id === undefined || id === '' || taken.has(id)) id = nextCaseId([...existing, ...result].map((c) => ({ id: c.id })), taken);
    taken.add(id);
    const used = new Set(draft.expected_errors.map((e) => e.id).filter((x): x is string => x !== undefined));
    let n = 0;
    const next = () => {
      do n++;
      while (used.has(`e${n}`));
      used.add(`e${n}`);
      return `e${n}`;
    };
    result.push({ ...draft, id, expected_errors: draft.expected_errors.map((e) => ({ ...e, id: e.id ?? next() })) });
  }
  return result;
}
