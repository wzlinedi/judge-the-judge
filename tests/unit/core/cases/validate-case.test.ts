// FR-037, FR-047, FR-079: what is wrong with one case.
import { describe, expect, it } from 'vitest';
import { validateCase, type CaseContext } from '../../../../src/core/cases/validate';
import type { TestCase } from '../../../../src/core/model';
import { sampleProject } from '../../../helpers/fixtures';

const e = sampleProject();
const context = (over: Partial<CaseContext> = {}): CaseContext => ({
  variables: ['source_text', 'summary'],
  judgedText: 'summary',
  catalog: e.judge_set.error_catalog,
  others: e.dataset.cases,
  ...over,
});
const good = (over: Partial<TestCase> = {}): TestCase => ({
  id: '9', name: 'New', fields: { source_text: 'Anna is a baker.', summary: 'Anna is a doctor.' },
  expected_errors: [{ id: 'e1', description: 'Changed', category: 'factual-error', fragment: 'Anna is a doctor', difficulty: 'obvious' }], ...over,
});
const texts = (list: Array<{ message: string }>) => list.map((p) => p.message).join(' | ');

describe('validateCase problems', () => {
  it('accepts a good case', () => {
    expect(validateCase(good(), context())).toEqual({ problems: [], warnings: [] });
  });

  it('refuses a case with no non-empty field', () => {
    const r = validateCase(good({ fields: { source_text: ' ', summary: '' } }), context());
    expect(r.problems.length).toBeGreaterThan(0);
    expect(texts(r.problems)).toMatch(/no text/i);
  });

  it('refuses an empty field of a variable with its path', () => {
    const r = validateCase(good({ fields: { source_text: 'x', summary: '' } }), context());
    expect(r.problems.find((p) => p.path === 'fields.summary')).toBeDefined();
  });

  it('refuses an expected error without a description, with its path', () => {
    const r = validateCase(good({ expected_errors: [{ id: 'e1', description: '  ' }] }), context());
    expect(r.problems.find((p) => p.path === 'expected_errors[0].description')).toBeDefined();
  });

  it('refuses a field above 100,000 characters and states the limit; warns above 30,000', () => {
    const big = validateCase(good({ fields: { source_text: 'x'.repeat(100_001), summary: 'ok' } }), context());
    expect(texts(big.problems)).toContain('100,000');
    const mid = validateCase(good({ fields: { source_text: 'x'.repeat(30_001), summary: 'Anna is a doctor.' } }), context());
    expect(mid.problems).toEqual([]);
    expect(texts(mid.warnings)).toMatch(/30,000/);
  });

  it('refuses a name used by another case, compared without case and spaces, naming its number', () => {
    const r = validateCase(good({ name: '  anna ' }), context());
    expect(texts(r.problems)).toMatch(/case 1/i);
    expect(r.problems.find((p) => p.path === 'name')).toBeDefined();
  });

  it('allows an empty name and the case\'s own name', () => {
    expect(validateCase(good({ name: '' }), context()).problems).toEqual([]);
    expect(validateCase(good({ id: '1', name: 'Anna' }), context({ others: e.dataset.cases.filter((c) => c.id !== '1') })).problems).toEqual([]);
  });

  it('accepts a case identical to its base (T286)', () => {
    const base = e.dataset.cases[0]!;
    const r = validateCase(good({ base: base.id, fields: { ...base.fields } }), context());
    expect(r.problems).toEqual([]);
  });
});

describe('validateCase warnings', () => {
  it('warns about a variable with no field', () => {
    const r = validateCase(good({ fields: { summary: 'Anna is a doctor.' } }), context());
    expect(texts([...r.problems, ...r.warnings])).toMatch(/source_text/);
  });

  it('warns about a field that matches no variable and keeps the case valid', () => {
    const r = validateCase(good({ fields: { source_text: 'a', summary: 'Anna is a doctor.', extra: 'zzz' } }), context());
    expect(r.problems).toEqual([]);
    expect(texts(r.warnings)).toMatch(/extra/);
  });

  it('does not warn about a fragment that is in no text: the text is not checked against the list (T286)', () => {
    const missing = validateCase(good({ expected_errors: [{ id: 'e1', description: 'd', fragment: 'not anywhere' }] }), context());
    expect(missing.warnings.filter((w) => /fragment/i.test(w.message))).toEqual([]);
  });

  it('warns about an unknown category and an unknown base', () => {
    const r = validateCase(good({ base: 'nope', expected_errors: [{ id: 'e1', description: 'd', category: 'brand-new', fragment: 'Anna is a doctor' }] }), context());
    expect(texts(r.warnings)).toMatch(/brand-new/);
    expect(texts(r.warnings)).toMatch(/base/i);
  });
});
