// The catalog actions (FR-015, FR-024).
import { describe, expect, it } from 'vitest';
import { addCategoriesFromText, removeCategory, renameCategoryAction, setCategoryDetails } from '../../../src/app/actions/catalog';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const open = (finalized = false): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized, version: 'stale' }, replies: finalized ? e.replies : {}, decisions: {} } };
};

describe('catalog actions', () => {
  it('adds categories from a typed list and reports what was skipped', () => {
    const r = addCategoriesFromText(open(), 'Brand New - a description\nfactual-error\n');
    expect(r.state.evaluation.judge_set.error_catalog.find((c) => c.name === 'brand-new')?.description).toBe('a description');
    expect(r.note).toMatch(/brand-new/);
    expect(r.note).toMatch(/already.*factual-error/i);
    expect(r.state.unsaved).toBe(true);
  });

  it('says so when nothing was added', () => {
    const state = open();
    const r = addCategoriesFromText(state, '   ');
    expect(r.state).toBe(state);
    expect(r.note).toBeDefined();
  });

  it('edits the description and example of a category', () => {
    const r = setCategoryDetails(open(), 'wrong-number', { description: 'new d', example: 'new e' });
    expect(r.state.evaluation.judge_set.error_catalog.find((c) => c.name === 'wrong-number')).toMatchObject({ description: 'new d', example: 'new e' });
  });

  it('renames in the catalog and every expected error, drops the stale version, and refuses a taken name', () => {
    const r = renameCategoryAction(open(), 'factual-error', 'Wrong Fact');
    expect(r.state.evaluation.dataset.cases[1]?.expected_errors[0]?.category).toBe('wrong-fact');
    expect(r.state.evaluation.dataset.version).toBeUndefined();
    const taken = renameCategoryAction(open(), 'factual-error', 'wrong-number');
    expect(taken.note).toMatch(/already/);
    expect(taken.state.evaluation.judge_set.error_catalog.map((c) => c.name)).toContain('factual-error');
  });

  it('allows a rename after finalizing, when the cases have replies', () => {
    const r = renameCategoryAction(open(true), 'factual-error', 'renamed');
    expect(r.state.evaluation.dataset.cases[1]?.expected_errors[0]?.category).toBe('renamed');
  });

  it('removes an unused category at once and refuses a used one with the reason', () => {
    const ok = removeCategory(open(), 'misattribution');
    expect(ok.state.evaluation.judge_set.error_catalog.some((c) => c.name === 'misattribution')).toBe(false);
    const used = removeCategory(open(), 'factual-error');
    expect(used.note).toBe('Used by 1 test case. Remove that test case first, or rename the category.');
    expect(used.state.evaluation.judge_set.error_catalog.some((c) => c.name === 'factual-error')).toBe(true);
  });
});
