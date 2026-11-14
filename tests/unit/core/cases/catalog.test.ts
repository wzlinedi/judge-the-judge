// FR-015: the error catalog.
import { describe, expect, it } from 'vitest';
import { addCategories, canRemoveCategory, categoryUses, normalizeCategoryName, parseCategoryList, renameCategory } from '../../../../src/core/cases/catalog';
import { sampleEvaluation } from '../../../helpers/fixtures';

const e = sampleEvaluation();
const catalog = e.judge_set.error_catalog;
const cases = e.dataset.cases; // case 2 uses factual-error and wrong-number

describe('normalizeCategoryName', () => {
  it('writes lower case with dashes', () => {
    expect(normalizeCategoryName('  Wrong Number ')).toBe('wrong-number');
    expect(normalizeCategoryName('Missing   Step')).toBe('missing-step');
    expect(normalizeCategoryName('already-fine')).toBe('already-fine');
    expect(normalizeCategoryName('-Odd--Name-')).toBe('odd-name');
  });
});

describe('parseCategoryList', () => {
  it('reads one category per line with an optional description after " - ", ":" or "|"', () => {
    const entries = parseCategoryList('Plain\nwith dash - a description\nwith colon: another one\nwith bar | third one\n\n   \n');
    expect(entries).toEqual([
      { name: 'plain' },
      { name: 'with-dash', description: 'a description' },
      { name: 'with-colon', description: 'another one' },
      { name: 'with-bar', description: 'third one' },
    ]);
  });

  it('keeps dashes inside a name', () => {
    expect(parseCategoryList('wrong-number')).toEqual([{ name: 'wrong-number' }]);
  });
});

describe('addCategories', () => {
  it('adds new names and skips and reports the ones already present, also inside the list', () => {
    const result = addCategories(catalog, [{ name: 'brand-new', description: 'd' }, { name: 'factual-error' }, { name: 'brand-new' }, { name: 'Another One' }]);
    expect(result.added).toEqual(['brand-new', 'another-one']);
    expect(result.skipped).toEqual(['factual-error', 'brand-new']);
    expect(result.catalog.map((c) => c.name)).toEqual([...catalog.map((c) => c.name), 'brand-new', 'another-one']);
    expect(result.catalog.find((c) => c.name === 'brand-new')?.description).toBe('d');
    expect(catalog.some((c) => c.name === 'brand-new')).toBe(false);
  });

  it('ignores empty names', () => {
    expect(addCategories(catalog, [{ name: '  ' }]).added).toEqual([]);
  });
});

describe('categoryUses', () => {
  it('counts test cases, a case once however many of its errors have the category', () => {
    const two = [{ ...cases[1]!, expected_errors: [...cases[1]!.expected_errors, { id: 'e3', description: 'x', category: 'factual-error' }] }];
    expect(categoryUses(two, 'factual-error')).toBe(1);
    expect(categoryUses(cases, 'wrong-number')).toBe(1);
    expect(categoryUses(cases, 'nothing')).toBe(0);
  });
});

describe('canRemoveCategory', () => {
  it('allows removing an unused category at once', () => {
    expect(canRemoveCategory(catalog, cases, {}, false, 'misattribution')).toEqual({ allowed: true });
  });

  it('refuses a used category with the way out', () => {
    expect(canRemoveCategory(catalog, cases, {}, false, 'factual-error')).toEqual({
      allowed: false,
      reason: 'Used by 1 test case. Remove that test case first, or rename the category.',
    });
  });

  it('says "It can be renamed." after finalizing when every case that uses it has a reply', () => {
    const r = canRemoveCategory(catalog, cases, e.replies, true, 'factual-error');
    expect(r).toEqual({ allowed: false, reason: 'Used by 1 test case. It can be renamed.' });
  });

  it('uses the plural for several cases', () => {
    const more = [...cases, { ...cases[1]!, id: '9', name: 'Other' }];
    expect(canRemoveCategory(catalog, more, {}, false, 'factual-error')).toMatchObject({ allowed: false, reason: expect.stringContaining('Used by 2 test cases. Remove those test cases first') });
  });
});

describe('renameCategory', () => {
  it('renames in the catalog and in every expected error that uses it', () => {
    const r = renameCategory(catalog, cases, 'factual-error', 'Wrong Fact');
    if (!r.ok) throw new Error(r.reason);
    expect(r.catalog.map((c) => c.name)).toContain('wrong-fact');
    expect(r.catalog.map((c) => c.name)).not.toContain('factual-error');
    expect(r.cases[1]?.expected_errors[0]?.category).toBe('wrong-fact');
    expect(r.cases[1]?.expected_errors[1]?.category).toBe('wrong-number');
    expect(cases[1]?.expected_errors[0]?.category).toBe('factual-error');
  });

  it('keeps the description and example', () => {
    const r = renameCategory(catalog, cases, 'wrong-number', 'bad-number');
    if (!r.ok) throw new Error(r.reason);
    expect(r.catalog.find((c) => c.name === 'bad-number')?.description).toBe(catalog.find((c) => c.name === 'wrong-number')?.description);
  });

  it('refuses a name already in the catalog, an empty name and an unknown category', () => {
    expect(renameCategory(catalog, cases, 'factual-error', 'Wrong-Number')).toMatchObject({ ok: false, reason: expect.stringMatching(/already/) });
    expect(renameCategory(catalog, cases, 'factual-error', '  ')).toMatchObject({ ok: false });
    expect(renameCategory(catalog, cases, 'ghost', 'x')).toMatchObject({ ok: false });
  });
});
