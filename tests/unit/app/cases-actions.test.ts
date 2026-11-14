// The actions of the Test cases step (FR-017, FR-023, FR-025, FR-039, FR-053, FR-078, FR-089).
import { describe, expect, it } from 'vitest';
import { correctExpectedErrors, removeCase, renameCase, saveCaseFromJson } from '../../../src/app/actions/cases';
import { createState, type AppState } from '../../../src/app/store';
import { caseToJson } from '../../../src/core/cases/case-json';
import { sampleEvaluation } from '../../helpers/fixtures';

const open = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), evaluation: { ...e, dataset: { ...e.dataset, finalized: false, version: 'stale' }, replies: {}, decisions: {} } };
};
const finalized = (replies = false): AppState => {
  const s = open();
  return { ...s, evaluation: { ...s.evaluation, dataset: { ...s.evaluation.dataset, finalized: true }, replies: replies ? sampleEvaluation().replies : {} } };
};
const json = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'Fresh', fields: { source_text: 'Anna is a baker.', summary: 'Anna is a doctor.' }, expected_errors: [{ category: 'brand-new', fragment: 'Anna is a doctor', description: 'Changed' }], ...over });

describe('saveCaseFromJson', () => {
  it('adds the case with a new identifier, marks the state unsaved and drops the stale version', () => {
    const r = saveCaseFromJson(open(), json(), { mode: 'paste' });
    expect(r.problems).toEqual([]);
    expect(r.state.evaluation.dataset.cases.map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(r.state.evaluation.dataset.cases[2]).toMatchObject({ name: 'Fresh' });
    expect(r.state.evaluation.dataset.version).toBeUndefined();
    expect(r.state.unsaved).toBe(true);
  });

  it('adds a new category to the catalog and says so', () => {
    const r = saveCaseFromJson(open(), json(), { mode: 'paste' });
    expect(r.state.evaluation.judge_set.error_catalog.map((c) => c.name)).toContain('brand-new');
    expect(r.note).toMatch(/brand-new/);
  });

  it('refuses an invalid case and changes nothing', () => {
    const state = open();
    const r = saveCaseFromJson(state, json({ name: 'anna' }), { mode: 'paste' });
    expect(r.problems?.length).toBeGreaterThan(0);
    expect(r.state).toBe(state);
  });

  it('marks a case added after the first reply', () => {
    const r = saveCaseFromJson(finalized(true), json(), { mode: 'paste' });
    expect(r.state.evaluation.dataset.cases[2]?.changed_after_first_reply).toBe('added');
  });

  it('does not mark a case added before the first reply, also after finalizing', () => {
    const r = saveCaseFromJson(finalized(false), json(), { mode: 'paste' });
    expect(r.state.evaluation.dataset.cases[2]?.changed_after_first_reply).toBeUndefined();
    expect(r.state.evaluation.dataset.finalized).toBe(true);
  });

  it('a clean answer saves under the typed name', () => {
    const r = saveCaseFromJson(open(), json({ expected_errors: [] }), { mode: 'clean', name: 'Typed' });
    expect(r.state.evaluation.dataset.cases[2]).toMatchObject({ name: 'Typed', expected_errors: [] });
  });
});

describe('rename and remove', () => {
  it('renames a case, refusing a name another case has', () => {
    const ok = renameCase(open(), '1', 'Bakery');
    expect(ok.state.evaluation.dataset.cases[0]?.name).toBe('Bakery');
    const taken = renameCase(open(), '1', ' ANNA + 2 errors ');
    expect(taken.note).toMatch(/case 2/i);
    expect(taken.state.evaluation.dataset.cases[0]?.name).toBe('Anna');
  });

  it('refuses Rename and Remove for a case with a reply after finalizing', () => {
    const state = finalized(true);
    expect(renameCase(state, '2', 'x').note).toBe('This case has a reply');
    expect(removeCase(state, '2').note).toBe('This case has a reply');
    expect(removeCase(state, '2').state).toBe(state);
  });

  it('refuses to remove a base in use, naming its cases; removes a free case', () => {
    expect(removeCase(open(), '1').note).toMatch(/Anna \+ 2 errors/);
    const removed = removeCase(open(), '2');
    expect(removed.state.evaluation.dataset.cases.map((c) => c.id)).toEqual(['1']);
    expect(removed.state.unsaved).toBe(true);
  });
});

describe('correctExpectedErrors', () => {
  it('replaces only the expected errors of a case without a reply, and marks it corrected after the first reply', () => {
    const state = finalized(false);
    const original = state.evaluation.dataset.cases[1]!;
    const edited = JSON.parse(caseToJson(original));
    edited.expected_errors[0].difficulty = 'subtle';
    const r = correctExpectedErrors(state, '2', JSON.stringify(edited));
    expect(r.problems).toEqual([]);
    expect(r.state.evaluation.dataset.cases[1]?.expected_errors[0]?.difficulty).toBe('subtle');
    expect(r.state.evaluation.dataset.cases[1]?.fields).toEqual(original.fields);
  });

  it('refuses a change to the fields or a case with a reply', () => {
    const state = finalized(false);
    const edited = JSON.parse(caseToJson(state.evaluation.dataset.cases[1]!));
    edited.fields.summary = 'changed';
    expect(correctExpectedErrors(state, '2', JSON.stringify(edited)).problems?.length).toBeGreaterThan(0);
    const withReply = finalized(true);
    expect(correctExpectedErrors(withReply, '2', caseToJson(withReply.evaluation.dataset.cases[1]!)).note).toBe('This case has a reply');
  });

  it('marks a corrected case when other cases already have replies', () => {
    const state = finalized(true);
    const { changed_after_first_reply: _mark, ...unmarked } = state.evaluation.dataset.cases[1]!;
    const cases = [state.evaluation.dataset.cases[0]!, unmarked];
    const noReply = { ...state, evaluation: { ...state.evaluation, dataset: { ...state.evaluation.dataset, cases }, replies: { '1': state.evaluation.replies['1']! } } };
    const r = correctExpectedErrors(noReply, '2', caseToJson(noReply.evaluation.dataset.cases[1]!));
    expect(r.state.evaluation.dataset.cases[1]?.changed_after_first_reply).toBe('corrected');
  });
});
