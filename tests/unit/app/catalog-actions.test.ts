// The catalog actions (FR-015, FR-024).
import { describe, expect, it } from 'vitest';
import { addCategory, removeCategory, renameCategoryAction, setCategoryDetails } from '../../../src/app/actions/catalog';
import { createState, type AppState } from '../../../src/app/store';
import { withoutTestRun } from '../../../src/core/cases/test-run';
import { sampleProject } from '../../helpers/fixtures';

const open = (started = false): AppState => {
  const e = started ? sampleProject() : withoutTestRun(sampleProject());
  return { ...createState(), step: 'cases', project: { ...e, dataset: { ...e.dataset, version: 'stale' } } };
};

describe('catalog actions', () => {
  it('adds one category: the name in lower case with dashes, with its description (T248)', () => {
    const r = addCategory(open(), 'Brand New', ' a description ');
    expect(r.state.project.judge_set.error_catalog.at(-1)).toEqual({ name: 'brand-new', description: 'a description' });
    expect(r.state.unsaved).toBe(true);
    expect(addCategory(open(), 'tone', '').state.project.judge_set.error_catalog.at(-1)).toEqual({ name: 'tone' });
  });

  it('refuses an empty name and a name already in the catalog, and says why', () => {
    const state = open();
    expect(addCategory(state, '   ', 'x')).toEqual({ state, note: 'Type a name for the category.' });
    expect(addCategory(state, 'Factual Error', '')).toEqual({ state, note: 'The category "factual-error" is already in the catalog.' });
  });

  it('edits the description of a category, which holds its examples', () => {
    const r = setCategoryDetails(open(), 'wrong-number', { description: 'new d. Example: 5 becomes 6' });
    expect(r.state.project.judge_set.error_catalog.find((c) => c.name === 'wrong-number')).toEqual({ name: 'wrong-number', description: 'new d. Example: 5 becomes 6' });
    expect(setCategoryDetails(open(), 'wrong-number', { description: '' }).state.project.judge_set.error_catalog.find((c) => c.name === 'wrong-number')).toEqual({ name: 'wrong-number' });
  });

  it('renames in the catalog and every expected error, drops the stale version, and refuses a taken name', () => {
    const r = renameCategoryAction(open(), 'factual-error', 'Wrong Fact');
    expect(r.state.project.dataset.cases[1]?.expected_errors[0]?.category).toBe('wrong-fact');
    expect(r.state.project.dataset.version).toBeUndefined();
    const taken = renameCategoryAction(open(), 'factual-error', 'wrong-number');
    expect(taken.note).toMatch(/already/);
    expect(taken.state.project.judge_set.error_catalog.map((c) => c.name)).toContain('factual-error');
  });

  it('allows a rename after the start, when the cases have replies', () => {
    const r = renameCategoryAction(open(true), 'factual-error', 'renamed');
    expect(r.state.project.dataset.cases[1]?.expected_errors[0]?.category).toBe('renamed');
  });

  it('removes an unused category at once, with nothing to say', () => {
    const ok = removeCategory(open(), 'misattribution');
    expect(ok.state.project.judge_set.error_catalog.some((c) => c.name === 'misattribution')).toBe(false);
    expect(ok.note).toBeUndefined();
    expect(ok.state.project.dataset.version).toBe('stale');
  });

  it('removes a used category too: its expected errors stay without the category, and the test cases version is dropped (T248)', () => {
    const before = open();
    const used = removeCategory(before, 'factual-error');
    expect(used.state.project.judge_set.error_catalog.some((c) => c.name === 'factual-error')).toBe(false);
    const changed = used.state.project.dataset.cases[1]!;
    expect(changed.expected_errors).toHaveLength(before.project.dataset.cases[1]!.expected_errors.length);
    expect(changed.expected_errors[0]).not.toHaveProperty('category');
    expect(changed.changed_after_first_reply).toBe(before.project.dataset.cases[1]!.changed_after_first_reply);
    expect(used.state.project.dataset.version).toBeUndefined();
    expect(used.note).toBe('Removed "factual-error". The expected errors of 1 test case lost the category.');
  });

  it('after the first reply the changed cases are marked as corrected, and findings added by hand lose the category too', () => {
    const start = open(true);
    const plain = start.project.dataset.cases.map(({ changed_after_first_reply: _mark, ...c }) => c);
    const withFinding: AppState = { ...start, project: { ...start.project, dataset: { ...start.project.dataset, cases: plain }, testRun: { ...start.project.testRun!, decisions: { '2': { expected: {}, additional: {}, added_findings: [{ text: 'x', category: 'factual-error', state: 'false_positive', source: 'manual' }], approved: false, note: '' } } } } };
    const r = removeCategory(withFinding, 'factual-error');
    expect(r.state.project.dataset.cases[1]?.changed_after_first_reply).toBe('corrected');
    expect(r.state.project.testRun?.decisions['2']?.added_findings[0]).toEqual({ text: 'x', state: 'false_positive', source: 'manual' });
  });
});
