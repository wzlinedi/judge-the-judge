// The actions of the Test cases step (FR-017, FR-023, FR-025, FR-039, FR-053, FR-078, FR-089).
import { describe, expect, it } from 'vitest';
import { removalImpact, removeCase, renameCase, saveCaseFromJson, saveExpectedErrors } from '../../../src/app/actions/cases';
import { expectedErrorsToJson } from '../../../src/core/cases/expected-errors';
import { createState, type AppState } from '../../../src/app/store';
import { emptyTestRun, withoutTestRun } from '../../../src/core/cases/test-run';
import { sampleProject, withRun } from '../../helpers/fixtures';

const open = (): AppState => {
  const e = sampleProject();
  return { ...createState(), project: { ...withoutTestRun(e), dataset: { ...e.dataset, version: 'stale' } } };
};
const started = (replies = false): AppState => {
  const s = open();
  return { ...s, project: { ...s.project, testRun: { ...emptyTestRun(), replies: replies ? sampleProject().testRun!.replies : {} } } };
};
const json = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'Fresh', fields: { source_text: 'Anna is a baker.', summary: 'Anna is a doctor.' }, expected_errors: [{ category: 'brand-new', fragment: 'Anna is a doctor', description: 'Changed' }], ...over });

describe('saveCaseFromJson', () => {
  it('adds the case with a new identifier, marks the state unsaved and drops the stale version', () => {
    const r = saveCaseFromJson(open(), json(), { mode: 'paste' });
    expect(r.problems).toEqual([]);
    expect(r.state.project.dataset.cases.map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(r.state.project.dataset.cases[2]).toMatchObject({ name: 'Fresh' });
    expect(r.state.project.dataset.version).toBeUndefined();
    expect(r.state.unsaved).toBe(true);
  });

  it('adds a new category to the catalog and says so', () => {
    const r = saveCaseFromJson(open(), json(), { mode: 'paste' });
    expect(r.state.project.judge_set.error_catalog.map((c) => c.name)).toContain('brand-new');
    expect(r.note).toMatch(/brand-new/);
  });

  it('refuses an invalid case and changes nothing', () => {
    const state = open();
    const r = saveCaseFromJson(state, json({ name: 'anna' }), { mode: 'paste' });
    expect(r.problems?.length).toBeGreaterThan(0);
    expect(r.state).toBe(state);
  });

  it('marks a case added after the first reply', () => {
    const r = saveCaseFromJson(started(true), json(), { mode: 'paste' });
    expect(r.state.project.dataset.cases[2]?.changed_after_first_reply).toBe('added');
  });

  it('does not mark a case added before the first reply, also after the start', () => {
    const r = saveCaseFromJson(started(false), json(), { mode: 'paste' });
    expect(r.state.project.dataset.cases[2]?.changed_after_first_reply).toBeUndefined();
    expect(r.state.project.testRun).toBeDefined();
  });

  it('a clean answer saves under the typed name', () => {
    const r = saveCaseFromJson(open(), json({ expected_errors: [] }), { mode: 'clean', name: 'Typed' });
    expect(r.state.project.dataset.cases[2]).toMatchObject({ name: 'Typed', expected_errors: [] });
  });
});

describe('rename and remove', () => {
  it('renames a case, refusing a name another case has', () => {
    const ok = renameCase(open(), '1', 'Bakery');
    expect(ok.state.project.dataset.cases[0]?.name).toBe('Bakery');
    const taken = renameCase(open(), '1', ' ANNA + 2 errors ');
    expect(taken.note).toMatch(/case 2/i);
    expect(taken.state.project.dataset.cases[0]?.name).toBe('Anna');
  });

  it('renames a case that has a reply, and the reply stays (T234)', () => {
    const state = started(true);
    const renamed = renameCase(state, '2', 'x');
    expect(renamed.note).toBeUndefined();
    expect(renamed.state.project.dataset.cases.find((c) => c.id === '2')?.name).toBe('x');
    expect(renamed.state.project.testRun!.replies['2']).toBeDefined();
  });

  it('removes a case that has a reply together with its reply and its decisions (T234)', () => {
    const base = started(true);
    const state: AppState = { ...base, project: withRun(base.project, { decisions: { '2': { expected: {}, additional: {}, added_findings: [], approved: true, note: '' }, '1': { expected: {}, additional: {}, added_findings: [], approved: false, note: '' } } }) };
    const removed = removeCase(state, '2');
    expect(removed.note).toBeUndefined();
    expect(removed.state.project.dataset.cases.map((c) => c.id)).toEqual(['1']);
    expect(removed.state.project.testRun!.replies['2']).toBeUndefined();
    expect(removed.state.project.testRun!.decisions['2']).toBeUndefined();
    expect(removed.state.project.testRun!.decisions['1']).toBeDefined();
  });

  it('says what removing a case takes with it: its reply and the number of its decisions (T234)', () => {
    const base = started(true);
    const decisions = { '2': { expected: { e1: { state: 'found' }, e2: { state: 'missed' } }, additional: { 'claims[]#2': { state: 'false_positive' } }, added_findings: [{ text: 'x' }], approved: false, note: '' } } as unknown as NonNullable<AppState['project']['testRun']>['decisions'];
    const state: AppState = { ...base, project: withRun(base.project, { decisions }) };
    expect(removalImpact(state, '2')).toEqual({ hasReply: true, decisions: 4 });
    expect(removalImpact(started(false), '2')).toEqual({ hasReply: false, decisions: 0 });
  });

  it('removes a base that other cases use: they lose `base`, are not marked corrected, and the version is dropped (T283)', () => {
    const base = started(true);
    const cases = base.project.dataset.cases.map((c) => (c.id === '2' ? { ...c, base: '1' } : c));
    const state: AppState = { ...base, project: { ...base.project, dataset: { ...base.project.dataset, cases, version: 'v1' } } };
    const removed = removeCase(state, '1');
    expect(removed.note).toBeUndefined();
    const left = removed.state.project.dataset.cases;
    expect(left.map((c) => c.id)).toEqual(['2']);
    expect(left[0]).not.toHaveProperty('base');
    expect(left[0]?.changed_after_first_reply).toBe(state.project.dataset.cases.find((c) => c.id === '2')?.changed_after_first_reply);
    expect(removed.state.project.dataset.version).toBeUndefined();
    expect(removed.state.unsaved).toBe(true);
  });

  it('removes a free case', () => {
    const removed = removeCase(open(), '2');
    expect(removed.state.project.dataset.cases.map((c) => c.id)).toEqual(['1']);
    expect(removed.state.unsaved).toBe(true);
  });
});

describe('saveExpectedErrors (T254)', () => {
  const listOf = (state: AppState, id: string) => JSON.parse(expectedErrorsToJson(state.project.dataset.cases.find((c) => c.id === id)!)) as Array<Record<string, unknown>>;
  const withMark = (state: AppState, id: string, errorId: string): AppState => ({ ...state, project: withRun(state.project, { decisions: { [id]: { expected: { [errorId]: { state: 'found', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' } } }) });

  it('replaces only the expected errors of a case without a reply, drops the version and keeps the fields', () => {
    const state = started(false);
    const original = state.project.dataset.cases[1]!;
    const items = listOf(state, '2');
    items[0]!['difficulty'] = 'subtle';
    const r = saveExpectedErrors(state, '2', JSON.stringify(items));
    expect(r.problems ?? []).toEqual([]);
    const saved = r.state.project.dataset.cases[1]!;
    expect(saved.expected_errors[0]?.difficulty).toBe('subtle');
    expect(saved.expected_errors[0]?.id).toBe(original.expected_errors[0]?.id);
    expect(saved.fields).toEqual(original.fields);
    expect(r.state.project.dataset.version).toBeUndefined();
    expect(r.state.unsaved).toBe(true);
  });

  it('works on a case that has a reply too: the marks of the changed and removed errors go, the other marks stay (T254)', () => {
    const reset = started(true);
    const base: AppState = { ...reset, project: { ...reset.project, dataset: { ...reset.project.dataset, cases: reset.project.dataset.cases.map(({ changed_after_first_reply: _mark, ...c }) => c) } } };
    const first = base.project.dataset.cases[1]!.expected_errors[0]!.id;
    const second = base.project.dataset.cases[1]!.expected_errors[1]!.id;
    const state: AppState = { ...base, project: withRun(base.project, { decisions: { '2': { expected: { [first]: { state: 'found', source: 'manual' }, [second]: { state: 'missed', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' } } }) };
    const items = listOf(state, '2');
    items[0]!['difficulty'] = items[0]!['difficulty'] === 'subtle' ? 'obvious' : 'subtle';
    const r = saveExpectedErrors(state, '2', JSON.stringify(items));
    expect(r.problems ?? []).toEqual([]);
    expect(r.state.project.testRun!.decisions['2']!.expected[first]).toBeUndefined();
    expect(r.state.project.testRun!.decisions['2']!.expected[second]).toEqual({ state: 'missed', source: 'manual' });
    expect(r.state.project.testRun!.replies).toEqual(state.project.testRun!.replies);
    expect(r.state.project.dataset.cases[1]?.changed_after_first_reply).toBe('corrected');
  });

  it('adds, removes and renumbers: a new error gets a free identifier, a removed one loses its mark, an empty list makes a clean case', () => {
    const state = withMark(started(true), '2', 'e2');
    const items = listOf(state, '2');
    const r = saveExpectedErrors(state, '2', JSON.stringify([items[0], { description: 'a third', fragment: 'Anna is a doctor' }]));
    const ids = r.state.project.dataset.cases[1]!.expected_errors.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(r.state.project.testRun!.decisions['2']!.expected['e2']).toBeUndefined();
    expect(saveExpectedErrors(state, '2', '[]').state.project.dataset.cases[1]!.expected_errors).toEqual([]);
  });

  it('a new category joins the catalog; unchanged text changes nothing and says so', () => {
    const state = started(false);
    const items = listOf(state, '2');
    const r = saveExpectedErrors(state, '2', JSON.stringify([{ ...items[0], category: 'brand-new' }, items[1]]));
    expect(r.state.project.judge_set.error_catalog.map((c) => c.name)).toContain('brand-new');
    const same = saveExpectedErrors(state, '2', JSON.stringify(items));
    expect(same.state).toBe(state);
    expect(same.note).toBe('Nothing changed.');
  });

  it('refuses a list with a problem and says where it is; the state is untouched', () => {
    const state = started(false);
    const r = saveExpectedErrors(state, '2', JSON.stringify([{ category: 'x' }]));
    expect(r.state).toBe(state);
    expect(r.problems?.map((p) => p.path)).toContain('expected_errors[0].description');
    expect(saveExpectedErrors(state, 'nope', '[]').note).toBe('This case no longer exists.');
  });
});

describe('generation_prompt (T238)', () => {
  it('is kept with a case saved with a prompt, survives a save and load of the test project, and is not part of the test cases version', async () => {
    const { testCasesVersion } = await import('../../../src/core/cases/version');
    const { writeTestProject, readTestProject } = await import('../../../src/core/io/test-project-file');
    const state = open();
    const plain = saveCaseFromJson(state, json(), { mode: 'paste' });
    const withPrompt = saveCaseFromJson(state, json(), { mode: 'inject', generationPrompt: 'Make a case.' });
    expect(plain.state.project.dataset.cases[2]).not.toHaveProperty('generation_prompt');
    expect(withPrompt.state.project.dataset.cases[2]?.generation_prompt).toBe('Make a case.');
    expect(await testCasesVersion(withPrompt.state.project.dataset.cases)).toBe(await testCasesVersion(plain.state.project.dataset.cases));

    const parts = withPrompt.state.project;
    const text = writeTestProject(parts, null, { now: '2026-01-01T00:00:00Z', toolVersion: 't', judgeVersion: 'j', testCasesVersion: 'v' });
    const back = readTestProject(text);
    expect(back.ok && back.value.project.dataset.cases[2]?.generation_prompt).toBe('Make a case.');
  });

  it('is kept when the expected errors of the case are corrected', () => {
    const base = open();
    const saved = saveCaseFromJson(base, json(), { mode: 'inject', generationPrompt: 'Make a case.' }).state;
    const id = saved.project.dataset.cases[2]!.id;
    const done = saveExpectedErrors({ ...saved, project: { ...saved.project, testRun: emptyTestRun() } }, id, JSON.stringify([{ ...JSON.parse(expectedErrorsToJson(saved.project.dataset.cases[2]!))[0], difficulty: 'subtle' }]));
    expect(done.state.project.dataset.cases[2]?.generation_prompt).toBe('Make a case.');
  });
});
