// A prompt variable may be a built-in JavaScript name (S1, Constitution IX); a case is checked against its own fields only (T393).
import { describe, expect, it } from 'vitest';
import { validateCase } from '../../../../src/core/cases/validate';
import { sampleProject } from '../../../helpers/fixtures';

const e = sampleProject();
const NAMES = ['constructor', 'toString', 'hasOwnProperty', '__proto__'];

describe('validateCase with a variable that is a built-in JavaScript name', () => {
  it.each(NAMES)('{{%s}}: a case with no such field gets the warning "no field for the variable", and no crash', (name) => {
    const context = { variables: ['summary', name], judgedText: 'summary', catalog: e.judge_set.error_catalog, others: [] };
    const result = validateCase({ name: 'A', fields: { summary: 'Anna is a doctor.' }, expected_errors: [] }, context);
    expect(result.warnings.some((w) => w.message.includes(`no field for the variable "${name}"`))).toBe(true);
    expect(result.problems.some((p) => p.message.includes(`"${name}" is empty`))).toBe(false);
  });
});
