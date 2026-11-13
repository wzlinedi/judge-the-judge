// Test cases version: the cases in order (identifier, name, base, fields, expected errors).
// The name of the test cases and the late-change marks are not part of it (research.md, 14).
import { contentVersion } from '../hash';
import type { TestCase } from '../model';

export function testCasesVersion(cases: readonly TestCase[]): Promise<string> {
  return contentVersion(
    cases.map((c) => ({ id: c.id, name: c.name, base: c.base, fields: c.fields, expected_errors: c.expected_errors })),
  );
}
