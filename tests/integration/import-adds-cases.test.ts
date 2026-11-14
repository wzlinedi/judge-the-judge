// FR-027 to FR-029, FR-050, FR-053: importing adds cases to the test project, also after finalizing; exporting changes nothing.
import { describe, expect, it } from 'vitest';
import { applyImport, downloadExample, exportTestCases, prepareImport } from '../../src/app/actions/test-cases-file';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, type AppState } from '../../src/app/store';
import { readTestCasesJson } from '../../src/core/io/test-cases-json';
import { sampleEvaluation } from '../helpers/fixtures';

const env = { now: () => '2026-11-14T10:00:00Z', toolVersion: '1.0.0' };
const project = (over: Partial<AppState['evaluation']> = {}, unsaved = false): AppState => ({ ...createState(), step: 'cases', unsaved, evaluation: { ...sampleEvaluation(), ...over } });
const csv = 'name,field:source_text,field:summary\nZażółć,"Gęsia, ""jaźń""","Krótko"\nBad,,\nDora,D,E\n';
const fresh = () => {
  const ports = createFakePorts();
  return ports;
};

describe('prepareImport', () => {
  it('reads a CSV and summarizes it: valid rows, invalid rows with position and reason, nothing changed yet', async () => {
    const ports = fresh();
    ports.opener.next = { name: 'cases.csv', text: csv };
    const state = project();
    const prepared = await prepareImport(state, ports);
    expect(ports.opener.lastKind).toBe('import');
    expect(prepared.outcome).toBe('ready');
    if (prepared.outcome !== 'ready') return;
    expect(prepared.fileName).toBe('cases.csv');
    expect(prepared.plan.cases.map((c) => c.name)).toEqual(['Zażółć', 'Dora']);
    expect(prepared.plan.cases.map((c) => c.id)).toEqual(['3', '4']);
    expect(prepared.plan.invalid).toEqual([{ position: 3, label: 'Bad', reason: expect.stringMatching(/no text/i) }]);
  });

  it('says when a file was read as Windows-1250', async () => {
    const ports = fresh();
    ports.opener.next = { name: 'cases.csv', text: '', bytes: new Uint8Array([...new TextEncoder().encode('name,field:source_text,field:summary\nZ,'), 0xbf, 0xf3, ...new TextEncoder().encode(',B\n')]) };
    const prepared = await prepareImport(project(), ports);
    expect(prepared.outcome === 'ready' && prepared.encodingNote).toMatch(/Windows-1250/);
    expect(prepared.outcome === 'ready' && prepared.plan.cases[0]!.fields['source_text']).toBe('żó');
  });

  it('names the columns that are ignored, and the fields and variables that do not match', async () => {
    const ports = fresh();
    ports.opener.next = { name: 'c.csv', text: 'name,id,field:source_text,field:other\nA,1,S,X\n' };
    const prepared = await prepareImport(project(), ports);
    if (prepared.outcome !== 'ready') throw new Error('not ready');
    expect(prepared.ignoredColumns).toEqual(['id']);
    expect(prepared.plan.unmatchedFields).toEqual(['other']);
    expect(prepared.plan.missingVariables).toEqual(['summary']);
  });

  it('a cancelled choice, an unreadable file and a file of more than 500 cases change nothing and say why', async () => {
    const ports = fresh();
    expect((await prepareImport(project(), ports)).outcome).toBe('cancelled');
    ports.opener.next = { name: 'x.json', text: '{ "format": ' };
    const bad = await prepareImport(project(), ports);
    expect(bad.outcome === 'invalid' && bad.problems[0]!.line).toBeDefined();
    const many = 'name,field:source_text,field:summary\n' + Array.from({ length: 499 }, (_, i) => `C${i},s,t`).join('\n');
    ports.opener.next = { name: 'many.csv', text: many };
    const tooMany = await prepareImport(project(), ports);
    expect(tooMany.outcome).toBe('invalid');
    expect(tooMany.outcome === 'invalid' && tooMany.problems[0]!.message).toMatch(/500.*501|501.*500/);
  });

  it('reads a JSON file of cases with a category that is not in the catalog and an identifier already used', async () => {
    const ports = fresh();
    const file = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [{ id: '1', name: 'New', fields: { source_text: 'S', summary: 'Tone' }, expected_errors: [{ description: 'd', category: 'tone-shift', fragment: 'Tone' }] }] };
    ports.opener.next = { name: 'cases.json', text: JSON.stringify(file) };
    const prepared = await prepareImport(project(), ports);
    if (prepared.outcome !== 'ready') throw new Error('not ready');
    expect(prepared.plan.newIdentifiers).toBe(1);
    expect(prepared.plan.missingCategories).toEqual(['tone-shift']);
    expect(prepared.plan.cases[0]!.id).toBe('3');
  });
});

describe('applyImport', () => {
  const plan = async (state: AppState, text = csv) => {
    const ports = fresh();
    ports.opener.next = { name: 'c.csv', text };
    const prepared = await prepareImport(state, ports);
    if (prepared.outcome !== 'ready') throw new Error('not ready');
    return prepared.plan;
  };

  it('adds the valid cases to the ones already there and marks the work as unsaved', async () => {
    const state = project({ replies: {}, decisions: {} }, false);
    const edit = applyImport(state, await plan(state));
    expect(edit.state.evaluation.dataset.cases.map((c) => c.name)).toEqual(['Anna', 'Anna + 2 errors', 'Zażółć', 'Dora']);
    expect(edit.state.unsaved).toBe(true);
    expect(edit.note).toMatch(/2 test cases/);
    expect(edit.state.evaluation.dataset.version).toBeUndefined();
    expect(edit.state.evaluation.dataset.cases.some((c) => c.changed_after_first_reply === 'added' && ['Zażółć', 'Dora'].includes(c.name))).toBe(false);
  });

  it('after finalizing: the new cases start as Not run, are marked "added" once replies exist, and the replies and decisions of the others are kept', async () => {
    const state = project();
    expect(state.evaluation.dataset.finalized).toBe(true);
    const edit = applyImport(state, await plan(state));
    const next = edit.state.evaluation;
    expect(next.dataset.finalized).toBe(true);
    expect(next.replies).toEqual(state.evaluation.replies);
    expect(next.decisions).toEqual(state.evaluation.decisions);
    const added = next.dataset.cases.filter((c) => ['Zażółć', 'Dora'].includes(c.name));
    expect(added.every((c) => c.changed_after_first_reply === 'added' && next.replies[c.id] === undefined)).toBe(true);
  });

  it('adds a missing category to the catalog only through the import, and says so', async () => {
    const state = project({ replies: {}, decisions: {} });
    const ports = fresh();
    const file = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [{ name: 'N', fields: { source_text: 'S', summary: 'Tone' }, expected_errors: [{ description: 'd', category: 'tone-shift', fragment: 'Tone' }] }] };
    ports.opener.next = { name: 'c.json', text: JSON.stringify(file) };
    const prepared = await prepareImport(state, ports);
    if (prepared.outcome !== 'ready') throw new Error('not ready');
    expect(state.evaluation.judge_set.error_catalog.some((c) => c.name === 'tone-shift')).toBe(false);
    const edit = applyImport(state, prepared.plan);
    expect(edit.state.evaluation.judge_set.error_catalog.some((c) => c.name === 'tone-shift')).toBe(true);
    expect(edit.note).toMatch(/tone-shift/);
  });
});

describe('exportTestCases', () => {
  it('writes every case, asks for a file each time, remembers none, and leaves the unsaved flag as it was', async () => {
    const ports = fresh();
    const state = project({}, true);
    const first = await exportTestCases(state, ports, env);
    expect(first.outcome).toBe('saved');
    expect(first.state).toBe(state);
    expect(ports.exportTarget.asked).toBe(1);
    expect(ports.exportTarget.fileName).toBeNull();
    const read = readTestCasesJson(ports.exportTarget.lastText ?? '');
    expect(read.ok && read.value.drafts).toHaveLength(2);
    await exportTestCases(project({}, false), ports, env);
    expect(ports.exportTarget.asked).toBe(2);
    expect(ports.testProjectTarget.fileName).toBeNull();
  });

  it('says so when the user cancels', async () => {
    const ports = fresh();
    ports.exportTarget.nextResult = { status: 'cancelled' };
    const result = await exportTestCases(project(), ports, env);
    expect(result.outcome).toBe('cancelled');
    expect(result.message).toMatch(/nothing was exported/i);
  });
});

describe('downloadExample', () => {
  it('gives the example CSV for the variables of the current prompt', () => {
    const { fileName, text } = downloadExample(project());
    expect(fileName).toMatch(/\.csv$/);
    expect(text).toContain('field:source_text');
    expect(text).toContain('field:summary');
  });
});
