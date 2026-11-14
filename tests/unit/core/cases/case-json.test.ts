// file-formats.md, section 2: the one case JSON check (FR-031, FR-041, FR-083, FR-084, FR-089, FR-090).
import { describe, expect, it } from 'vitest';
import { checkCaseJson, caseToJson } from '../../../../src/core/cases/case-json';
import type { CaseJsonCheckContext } from '../../../../src/core/model';
import { sampleEvaluation } from '../../../helpers/fixtures';

const e = sampleEvaluation();
const ctx = (over: Partial<CaseJsonCheckContext> = {}): CaseJsonCheckContext => ({
  mode: 'paste', variables: ['source_text', 'summary'], judgedText: 'summary', catalog: e.judge_set.error_catalog, existingCases: e.dataset.cases, ...over,
});
const one = (over: Record<string, unknown> = {}) => ({
  name: 'Fresh', fields: { source_text: 'Anna is a baker.', summary: 'Anna is a doctor.' },
  expected_errors: [{ category: 'factual-error', fragment: 'Anna is a doctor', description: 'Changed', difficulty: 'obvious' }], ...over,
});
const check = (value: unknown, over: Partial<CaseJsonCheckContext> = {}) => checkCaseJson(typeof value === 'string' ? value : JSON.stringify(value), ctx(over));
const messages = (c: { problems: Array<{ message: string }> }) => c.problems.map((p) => p.message).join(' | ');

describe('finding the JSON', () => {
  it('accepts the whole text, a code fence and text around the JSON', () => {
    const json = JSON.stringify(one());
    for (const text of [json, 'Here:\n```json\n' + json + '\n```\nDone.', 'Sure! ' + json + ' Hope it helps.']) {
      const r = check(text);
      expect(r.problems).toEqual([]);
      expect(r.case?.name).toBe('Fresh');
    }
  });

  it('reports unreadable JSON with line and column in the whole text', () => {
    const r = check('Intro\n{\n  "name": \n');
    expect(r.problems[0]).toMatchObject({ line: expect.any(Number), column: expect.any(Number) });
    expect(r.problems[0]!.line).toBeGreaterThanOrEqual(2);
    expect(r.case).toBeUndefined();
  });

  it('accepts {"cases":[one]} and [one] and refuses more than one, pointing to Import test cases', () => {
    expect(check({ cases: [one()] }).problems).toEqual([]);
    expect(check([one()]).problems).toEqual([]);
    const many = check([one(), one({ name: 'Second' })]);
    expect(messages(many)).toMatch(/Import test cases/);
  });

  it('refuses text that is not a case at all', () => {
    expect(check('"just text"').problems.length).toBeGreaterThan(0);
    expect(check({ nothing: true }).problems.length).toBeGreaterThan(0);
  });
});

describe('fields and expected errors', () => {
  it('requires a non-empty text for every variable, with the field path', () => {
    const r = check(one({ fields: { source_text: 'x' } }));
    expect(r.problems.find((p) => p.path === 'fields.summary')).toBeDefined();
    const empty = check(one({ fields: { source_text: 'x', summary: '  ' } }));
    expect(empty.problems.find((p) => p.path === 'fields.summary')).toBeDefined();
  });

  it('refuses a field that is not text, or too long', () => {
    expect(check(one({ fields: { source_text: 5, summary: 'x' } })).problems.find((p) => p.path === 'fields.source_text')).toBeDefined();
    expect(messages(check(one({ fields: { source_text: 'x'.repeat(100_001), summary: 'x' } })))).toContain('100,000');
  });

  it('names a key that is not a variable as a warning and keeps it', () => {
    const r = check(one({ fields: { source_text: 'a', summary: 'Anna is a doctor.', unused: 'u' } }));
    expect(r.problems).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/unused/);
    expect(r.case?.fields['unused']).toBe('u');
  });

  it('needs a description on every expected error, with its path', () => {
    const r = check(one({ expected_errors: [{ fragment: 'x' }, { description: 'ok' }] }));
    expect(r.problems.map((p) => p.path)).toEqual(['expected_errors[0].description']);
  });

  it('warns about a missing fragment or category, notes an unknown category and refuses a bad difficulty', () => {
    const r = check(one({ expected_errors: [{ description: 'whole text is biased' }, { description: 'd', category: 'new-kind', fragment: 'Anna is a doctor' }] }));
    expect(r.problems).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/fragment/);
    expect(r.warnings.join(' ')).toMatch(/category/);
    expect(r.notes.join(' ')).toMatch(/new-kind.*added to the catalog/i);
    expect(check(one({ expected_errors: [{ description: 'd', difficulty: 'hard' }] })).problems.find((p) => p.path === 'expected_errors[0].difficulty')).toBeDefined();
  });

  it('keeps an optional source_fragment, the words of another field that the error contradicts (T250)', () => {
    const r = check(one({ expected_errors: [{ category: 'factual-error', fragment: 'Anna is a doctor', source_fragment: 'Anna is a baker', description: 'Changed' }] }));
    expect(r.problems).toEqual([]);
    expect(r.warnings.join(' ')).not.toMatch(/source fragment/);
    expect(r.case?.expected_errors[0]).toMatchObject({ fragment: 'Anna is a doctor', source_fragment: 'Anna is a baker' });
    expect(check(one()).case?.expected_errors[0]).not.toHaveProperty('source_fragment');
    expect(check(one({ expected_errors: [{ description: 'd', fragment: 'Anna is a doctor', category: 'factual-error', source_fragment: '' }] })).case?.expected_errors[0]).not.toHaveProperty('source_fragment');
  });

  it('warns, and still accepts the case, when the source_fragment is in no field', () => {
    const r = check(one({ expected_errors: [{ category: 'factual-error', fragment: 'Anna is a doctor', source_fragment: 'Anna is a pilot', description: 'Changed' }] }));
    expect(r.problems).toEqual([]);
    expect(r.case).toBeDefined();
    expect(r.warnings).toContain('expected_errors[0]: the source fragment is in no field of the case, so it cannot be shown in the text.');
  });

  it('ignores id and gives the expected errors identifiers', () => {
    const r = check(one({ id: '77' }));
    expect(r.case).not.toHaveProperty('id');
    expect(r.case?.expected_errors.map((x) => x.id)).toEqual(['e1']);
  });

  it('says which kind the case will have', () => {
    expect(check(one()).kind).toBe('Injected errors');
    expect(check(one({ expected_errors: [] })).kind).toBe('Clean');
  });

  it('refuses a name another case has, and makes a name when it is empty', () => {
    expect(messages(check(one({ name: 'anna' })))).toMatch(/case 1/i);
    const named = check(one({ name: '' }));
    expect(named.problems).toEqual([]);
    expect(named.case?.name).toBe('Case 3');
  });

  it('names a case after the identifier it will get, not after the number of cases (T239)', () => {
    const gap = check(one({ name: '' }), { existingCases: [{ id: '1', name: 'a', fields: {}, expected_errors: [] }, { id: '5', name: 'b', fields: {}, expected_errors: [] }] });
    expect(gap.case?.name).toBe('Case 6');
  });
});

describe('modes', () => {
  const clean = e.dataset.cases[0]!;

  it('paste: keeps a base that names a clean case (by id or exact name), otherwise drops it with a note', () => {
    expect(check(one({ base: '1', fields: { source_text: 'Anna is a baker.', summary: 'Anna is a doctor.' } })).case?.base).toBe('1');
    expect(check(one({ base: 'Anna' })).case?.base).toBe('1');
    const unknown = check(one({ base: 'nothing' }));
    expect(unknown.case?.base).toBeUndefined();
    expect(unknown.notes.join(' ')).toMatch(/base/i);
    const notClean = check(one({ base: '2' }));
    expect(notClean.case?.base).toBeUndefined();
  });

  it('inject: the base of the window wins and a different base in the JSON is named in a note', () => {
    const r = check(one({ base: 'Other' }), { mode: 'inject', base: '1' });
    expect(r.case?.base).toBe('1');
    expect(r.notes.join(' ')).toMatch(/base/i);
  });

  it('refuses a case identical to its base', () => {
    const r = check(one({ fields: { ...clean.fields } }), { mode: 'inject', base: '1' });
    expect(messages(r)).toMatch(/identical to its base/i);
  });

  it('inject: notes the difference from the number of errors to prepare', () => {
    const r = check(one(), { mode: 'inject', base: '1', errorsToPrepare: 3 });
    expect(r.notes.join(' ')).toMatch(/1 expected error.*3/);
  });

  it('inject: a JSON with no expected errors is accepted and will be saved as a clean case', () => {
    const r = check(one({ expected_errors: [] }), { mode: 'inject', base: '1', errorsToPrepare: 2 });
    expect(r.problems).toEqual([]);
    expect(r.kind).toBe('Clean');
    expect(r.case?.base).toBe('1');
  });

  it('inject: the base named by its id or name in the JSON is not a note when it is the picked one', () => {
    expect(check(one({ base: '1' }), { mode: 'inject', base: '1' }).notes.join(' ')).not.toMatch(/ignored/);
    expect(check(one({ base: 'Anna' }), { mode: 'inject', base: '1' }).notes.join(' ')).not.toMatch(/ignored/);
  });

  it('inject: a category of an answer that is not in the catalog is a note, and the case is still valid', () => {
    const r = check(one({ expected_errors: [{ category: 'tone-shift', fragment: 'Anna is a doctor', description: 'Changed' }] }), { mode: 'inject', base: '1' });
    expect(r.problems).toEqual([]);
    expect(r.notes.join(' ')).toMatch(/tone-shift.*catalog/);
  });

  it('clean: expected errors are a problem pointing to From JSON', () => {
    expect(messages(check(one(), { mode: 'clean' }))).toMatch(/From JSON/);
    expect(check(one({ expected_errors: [] }), { mode: 'clean' }).problems).toEqual([]);
  });

  it('clean: a typed name replaces the name of the answer', () => {
    expect(check(one({ expected_errors: [] }), { mode: 'clean', name: 'My name' }).case?.name).toBe('My name');
  });

  it('correct: only the expected errors may change', () => {
    const original = e.dataset.cases[1]!;
    const json = JSON.parse(caseToJson(original));
    expect(check(json, { mode: 'correct', original, existingCases: e.dataset.cases.filter((c) => c.id !== original.id) }).problems).toEqual([]);
    const changedField = { ...json, fields: { ...json.fields, summary: 'something else' } };
    expect(messages(check(changedField, { mode: 'correct', original, existingCases: [] }))).toMatch(/fields/);
    const renamed = { ...json, name: 'Renamed' };
    expect(messages(check(renamed, { mode: 'correct', original, existingCases: [] }))).toMatch(/name/i);
  });
});

describe('caseToJson (SC-036)', () => {
  it('writes name, base only when set, fields and expected errors without id', () => {
    const [clean, injected] = e.dataset.cases;
    const a = JSON.parse(caseToJson(clean!));
    expect(a).toEqual({ name: 'Anna', fields: clean!.fields, expected_errors: [] });
    const b = JSON.parse(caseToJson({ ...injected!, base: '1' }));
    expect(b.base).toBe('1');
    expect(b).not.toHaveProperty('id');
    expect(b.expected_errors[0]).not.toHaveProperty('id');
  });

  it('writes source_fragment after fragment when the error has one, and reads it back (T250)', () => {
    const injected = e.dataset.cases[1]!;
    const withSource = { ...injected, expected_errors: injected.expected_errors.map((x, i) => (i === 0 ? { ...x, source_fragment: 'Anna is a baker' } : x)) };
    const written = JSON.parse(caseToJson(withSource));
    expect(Object.keys(written.expected_errors[0])).toEqual(['category', 'fragment', 'source_fragment', 'description', 'difficulty']);
    expect(written.expected_errors[1]).not.toHaveProperty('source_fragment');
    const r = checkCaseJson(caseToJson(withSource), ctx({ mode: 'paste', existingCases: [] }));
    expect(r.case?.expected_errors[0]?.source_fragment).toBe('Anna is a baker');
  });

  it('checkCaseJson of its output gives the same fields and expected errors', () => {
    const injected = e.dataset.cases[1]!;
    const r = checkCaseJson(caseToJson(injected), ctx({ mode: 'paste', existingCases: [] }));
    expect(r.problems).toEqual([]);
    expect(r.case?.fields).toEqual(injected.fields);
    expect(r.case?.expected_errors.map(({ id: _id, ...rest }) => rest)).toEqual(injected.expected_errors.map(({ id: _id, ...rest }) => rest));
  });
});
