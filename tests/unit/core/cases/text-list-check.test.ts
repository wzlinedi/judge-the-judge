// FR-080: do the text and the list of expected errors agree? (and FR-077's fragment lookup)
import { describe, expect, it } from 'vitest';
import { textListCheck } from '../../../../src/core/cases/text-list-check';
import { findFragment } from '../../../../src/core/cases/fragments';
import type { TestCase } from '../../../../src/core/model';

const base: TestCase = { id: '1', name: 'Anna', fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a baker. She bought a second oven in 1998.' }, expected_errors: [] };
const injected = (summary: string, errors: TestCase['expected_errors'], extra: Partial<TestCase> = {}): TestCase => ({
  id: 'new', name: 'x', base: '1', fields: { source_text: base.fields['source_text']!, summary }, expected_errors: errors, ...extra,
});
const err = (fragment: string | undefined, category: string | null = 'factual-error', description = 'changed') => ({ id: 'e', description, ...(category ? { category } : {}), ...(fragment !== undefined ? { fragment } : {}) });

describe('findFragment', () => {
  it('finds the exact text, then a case-insensitive match, and says where', () => {
    expect(findFragment('Anna is a doctor.', 'is a doctor')).toEqual({ start: 5, end: 16 });
    expect(findFragment('Anna is a Doctor.', 'is a doctor')).toEqual({ start: 5, end: 16 });
    expect(findFragment('Anna is a doctor.', 'is a lawyer')).toBeUndefined();
    expect(findFragment('Anna is a doctor.', '')).toBeUndefined();
  });
});

describe('textListCheck', () => {
  it('agrees when every changed place is covered by an expected error that is in the text', () => {
    const c = injected('Anna is a doctor. She bought a second oven in 1998.', [err('Anna is a doctor')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.agrees).toBe(true);
    expect(r.line).toBe('Text and list agree');
    expect(r.uncovered).toEqual([]);
    expect(r.notInText).toEqual([]);
    expect(r.identicalToBase).toBe(false);
  });

  it('names a changed place that no expected error covers, with its text and position', () => {
    const c = injected('Anna is a doctor. She bought a third oven in 1998.', [err('Anna is a doctor')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.agrees).toBe(false);
    expect(r.uncovered).toHaveLength(1);
    expect(r.uncovered[0]).toMatchObject({ field: 'summary', text: 'third' });
    const { start, end } = r.uncovered[0]!;
    expect(c.fields['summary']!.slice(start, end)).toBe('third');
    expect(r.line).toMatch(/1 changed place not in the list/);
  });

  it('finds no changed places without a base', () => {
    const c = { ...injected('Totally different text here.', [err('different text')]) };
    delete (c as { base?: string }).base;
    const r = textListCheck(c, undefined, 'summary');
    expect(r.uncovered).toEqual([]);
    expect(r.identicalToBase).toBe(false);
    expect(r.agrees).toBe(true);
  });

  it('marks an expected error whose fragment is not in the judged text', () => {
    const c = injected('Anna is a doctor. She bought a second oven in 1998.', [err('Anna is a doctor'), err('She sold the oven')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.notInText).toEqual([{ index: 1, fragment: 'She sold the oven' }]);
    expect(r.line).toMatch(/1 expected error not in the text/);
  });

  it('an omission is in the text when its fragment is in another field', () => {
    const c = injected('Anna is a baker.', [err('She bought a second oven in 1998', 'omission', 'The oven is left out')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.notInText).toEqual([]);
    expect(r.uncovered).toEqual([]);
    expect(r.agrees).toBe(true);
  });

  it('a removed place with no omission error in the list is named', () => {
    const c = injected('Anna is a baker.', [err(undefined, 'bias')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.uncovered.some((p) => p.removed !== undefined)).toBe(true);
  });

  it('finds a case identical to its base', () => {
    const c = injected(base.fields['summary']!, [err('Anna is a baker')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.identicalToBase).toBe(true);
    expect(r.line).toMatch(/identical to its base/i);
  });

  it('names an expected error with no fragment or no category as a note, not as a mismatch', () => {
    const c = injected('Anna is a doctor. She bought a second oven in 1998.', [err('Anna is a doctor'), err(undefined, 'bias', 'Tone of the whole text'), err('second oven', null)]);
    const r = textListCheck(c, base, 'summary');
    expect(r.notes.map((n) => n.kind)).toEqual(['no_fragment', 'no_category']);
    expect(r.notes[0]).toMatchObject({ index: 1 });
    expect(r.notes[1]).toMatchObject({ index: 2 });
    expect(r.agrees).toBe(true);
    expect(r.line).toBe('Text and list agree');
  });

  it('counts each kind in the line', () => {
    const c = injected('Anna is a doctor. She bought a third oven in 1999.', [err('Anna is a doctor'), err('missing words')]);
    const r = textListCheck(c, base, 'summary');
    expect(r.line).toMatch(/not in the list/);
    expect(r.line).toMatch(/1 expected error not in the text/);
  });

  it('compares two fields of 100,000 characters within one second', () => {
    const word = 'alpha beta gamma delta epsilon ';
    const long = word.repeat(Math.ceil(100_000 / word.length)).slice(0, 100_000);
    const changed = long.slice(0, 50_000) + ' CHANGED ' + long.slice(50_000);
    const b: TestCase = { id: '1', name: 'long', fields: { source_text: long, summary: long }, expected_errors: [] };
    const c = injected(changed, [err('CHANGED')], { fields: { source_text: long, summary: changed } });
    const started = performance.now();
    const r = textListCheck(c, b, 'summary');
    expect(performance.now() - started).toBeLessThan(1000);
    expect(r.agrees).toBe(true);
  });

  it('a very different long text is compared coarsely and still within one second', () => {
    const a = 'alpha beta gamma '.repeat(6_000).slice(0, 100_000);
    const z = 'omega sigma theta '.repeat(6_000).slice(0, 100_000);
    const b: TestCase = { id: '1', name: 'long', fields: { source_text: a, summary: a }, expected_errors: [] };
    const c = injected(z, [err('omega sigma')], { fields: { source_text: a, summary: z } });
    const started = performance.now();
    const r = textListCheck(c, b, 'summary');
    expect(performance.now() - started).toBeLessThan(1000);
    expect(r.identicalToBase).toBe(false);
  });
});
