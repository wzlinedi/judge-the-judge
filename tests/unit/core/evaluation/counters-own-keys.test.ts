// A category or rule name from data may be a built-in JavaScript name (S1, Constitution IX, T395):
// the counters keep it as an own entry and never touch a prototype.
import { describe, expect, it } from 'vitest';
import { countAll, type CountInput } from '../../../../src/core/evaluation/counters';
import type { Effective } from '../../../../src/core/evaluation/decisions';
import type { TestCase } from '../../../../src/core/model';

const NAMES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];

const testCase = (category: string): TestCase =>
  ({ id: 'c1', name: 'C1', fields: {}, expected_errors: [{ id: 'e1', description: 'd', category }] }) as unknown as TestCase;

function effective(over: Partial<Effective> = {}): Effective {
  return { expected: [], additional: [], approved: true, needsApproval: false, orphans: { expected: [], additional: [] }, ...over };
}

const found = (category: string): CountInput => ({
  testCase: testCase(category),
  effective: effective({ expected: [{ id: 'e1', state: 'found', source: 'automatic', attached: 1 }] }),
  status: 'pass',
});

const added = (over: { category?: string; rules?: string[]; state?: 'real_error' | 'false_positive' }): CountInput => ({
  testCase: { id: 'c2', name: 'C2', fields: {}, expected_errors: [] } as unknown as TestCase,
  effective: effective({
    additional: [{ key: 'k', text: 't', rules: over.rules ?? [], state: over.state ?? 'real_error', source: 'automatic', ...(over.category !== undefined ? { category: over.category } : {}) }],
  }),
  status: 'fail',
});

const clean = () => {
  expect(({} as Record<string, unknown>)['expected_total']).toBeUndefined();
  expect(({} as Record<string, unknown>)['real']).toBeUndefined();
  expect(({} as Record<string, unknown>)['real_errors']).toBeUndefined();
  expect(({} as Record<string, unknown>)['cases']).toBeUndefined();
};

describe('counters with a name that is a built-in JavaScript name', () => {
  it.each(NAMES)('%s as the category of an expected error: its own entry, no prototype touched', (name) => {
    const c = countAll([found(name)]);
    clean();
    expect(Object.getPrototypeOf(c.per_category)).toBe(Object.prototype);
    expect(Object.hasOwn(c.per_category, name)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(c.per_category, name)?.value).toEqual({ expected_total: 1, expected_found: 1 });
    expect(c.expected_total).toBe(1);
  });

  it.each(NAMES)('%s as the category of a case counted per case', (name) => {
    const c = countAll([found(name)], 'per_case');
    clean();
    expect(Object.getOwnPropertyDescriptor(c.case_per_category, name)?.value).toEqual({ cases: 1, flagged: 1 });
  });

  it.each(NAMES)('%s as the category of an added finding', (name) => {
    const c = countAll([added({ category: name }), added({ category: name, state: 'false_positive' })]);
    clean();
    expect(Object.getPrototypeOf(c.additional_per_category)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(c.additional_per_category, name)?.value).toEqual({ real: 1, fp: 1 });
  });

  it.each(NAMES)('%s as a rule name', (name) => {
    const c = countAll([added({ rules: [name] }), added({ rules: [name], state: 'false_positive' })]);
    clean();
    expect(Object.getPrototypeOf(c.per_rule)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(c.per_rule, name)?.value).toEqual({ real_errors: 1, false_positives: 1 });
  });
});
