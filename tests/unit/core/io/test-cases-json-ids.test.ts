// "`id` must be present on all cases or on none" (contracts/file-formats.md, section 3; FR-027, T418).
import { describe, expect, it } from 'vitest';
import { readTestCasesJson } from '../../../../src/core/io/test-cases-json';

const file = (cases: unknown[]) => JSON.stringify({ format: 'judge-the-judge-test-cases', schema_version: 1, name: 'x', cases });
const kase = (extra: Record<string, unknown>) => ({ name: 'a', fields: { summary: 's' }, expected_errors: [], ...extra });

describe('identifiers on some cases only (T418)', () => {
  it('refuses the file with a message that names the rule', () => {
    const read = readTestCasesJson(file([kase({ id: '1' }), kase({ name: 'b' })]));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.problems.map((p) => p.message).join(' ')).toMatch(/"id".*every case.*or none/i);
  });

  it.each([
    ['on every case', [kase({ id: '1' }), kase({ id: '2', name: 'b' })]],
    ['on no case', [kase({}), kase({ name: 'b' })]],
  ])('reads a file with identifiers %s', (_label, cases) => {
    const read = readTestCasesJson(file(cases));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(read.value.drafts).toHaveLength(2);
  });
});
