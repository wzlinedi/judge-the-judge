// FR-015: the error catalog.
import { describe, expect, it } from 'vitest';
import { addCategories, categoryUses, joinCategoryExamples, removeCategoryEverywhere, normalizeCategoryName, parseCategoryList, renameCategory } from '../../../../src/core/cases/catalog';
import { sampleProject } from '../../../helpers/fixtures';

const e = sampleProject();
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

describe('removeCategoryEverywhere (T248)', () => {
  it('removes an unused category and changes no case', () => {
    const r = removeCategoryEverywhere(catalog, cases, 'misattribution');
    expect(r.catalog.map((c) => c.name)).not.toContain('misattribution');
    expect(r.uses).toBe(0);
    expect(r.cases.every((c, i) => c === cases[i])).toBe(true);
  });

  it('removes a used category: the expected errors stay and lose the category, the others keep theirs', () => {
    const r = removeCategoryEverywhere(catalog, cases, 'factual-error');
    expect(r.uses).toBe(1);
    expect(r.catalog.map((c) => c.name)).not.toContain('factual-error');
    expect(r.cases[1]?.expected_errors).toHaveLength(cases[1]!.expected_errors.length);
    expect(r.cases[1]?.expected_errors[0]).not.toHaveProperty('category');
    expect(r.cases[1]?.expected_errors[0]?.description).toBe(cases[1]!.expected_errors[0]!.description);
    expect(r.cases[1]?.expected_errors[1]?.category).toBe('wrong-number');
    expect(cases[1]?.expected_errors[0]?.category).toBe('factual-error');
  });
});

describe('joinCategoryExamples (T248)', () => {
  it('joins the short example of an older file to the description, and drops the key', () => {
    expect(joinCategoryExamples([{ name: 'a', description: 'A wrong year.', example: '1998 becomes 2005' }])).toEqual([{ name: 'a', description: 'A wrong year. Example: 1998 becomes 2005' }]);
    expect(joinCategoryExamples([{ name: 'a', description: 'A wrong year', example: 'x' }])).toEqual([{ name: 'a', description: 'A wrong year. Example: x' }]);
    expect(joinCategoryExamples([{ name: 'a', example: 'x' }])).toEqual([{ name: 'a', description: 'Example: x' }]);
  });

  it('leaves a category without an example as it is', () => {
    expect(joinCategoryExamples([{ name: 'a', description: ' kept as typed ' }, { name: 'b' }])).toEqual([{ name: 'a', description: ' kept as typed ' }, { name: 'b' }]);
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

  it('keeps the description', () => {
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
