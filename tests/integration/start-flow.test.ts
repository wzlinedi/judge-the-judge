// User Story 11: imported and added cases join one test project, the test run is started, and what stays fixed or open afterwards
// (FR-039, FR-049, FR-052, FR-053, FR-076, FR-089).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { removeCase, renameCase, saveCaseFromJson, saveExpectedErrors } from '../../src/app/actions/cases';
import { startTestRun } from '../../src/app/actions/start';
import { setJudgedText, setRuleWhere, setPrompt, updateRule } from '../../src/app/actions/judge';
import { saveReply } from '../../src/app/actions/replies';
import { applyImport, prepareImport } from '../../src/app/actions/test-cases-file';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, type AppState } from '../../src/app/store';
import { withoutTestRun } from '../../src/core/cases/test-run';
import { sampleProject } from '../helpers/fixtures';

const source = 'Anna is a baker. She bought a second oven in 1998.';
const json = (name: string, summary: string, errors: unknown[] = []) => JSON.stringify({ name, fields: { source_text: source, summary }, expected_errors: errors });
const doctor = { category: 'factual-error', fragment: 'Anna is a doctor', description: 'Profession changed', difficulty: 'subtle' };
const rows = 'name,field:source_text,field:summary\n' + Array.from({ length: 10 }, (_, i) => `Imported ${i + 1},${source},Summary number ${i + 1}`).join('\n') + '\n';

/** An open test project (nothing started, no cases) with the judge of the sample. */
const open = (): AppState => {
  const e = sampleProject();
  return { ...createState(), step: 'cases', project: { ...withoutTestRun(e), dataset: { name: 'Book summaries', cases: [] } } };
};

const imported = async (state: AppState, text = rows): Promise<AppState> => {
  const ports = createFakePorts();
  ports.opener.next = { name: 'cases.csv', text };
  const prepared = await prepareImport(state, ports);
  if (prepared.outcome !== 'ready') throw new Error('not ready');
  return applyImport(state, prepared.plan).state;
};

const twelve = async (): Promise<AppState> => {
  let state = await imported(open());
  state = saveCaseFromJson(state, json('Added clean', 'Anna works as a baker.'), { mode: 'paste' }).state;
  state = saveCaseFromJson(state, json('Added with error', 'Anna is a doctor. She bought a second oven in 1998.', [doctor]), { mode: 'paste' }).state;
  return state;
};

const started = async (): Promise<AppState> => {
  const done = startTestRun(await twelve());
  if (done.state.project.testRun === undefined) throw new Error('not started');
  return done.state;
};

describe('cases from a file and cases made in the tool', () => {
  it('10 imported and 2 added cases are one test project of 12 cases with their own identifiers', async () => {
    const state = await twelve();
    expect(state.project.dataset.cases).toHaveLength(12);
    expect(state.project.dataset.cases.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(state.project.testRun).toBeUndefined();
  });
});

describe('startTestRun', () => {
  it('starts the test run, marks the work unsaved and keeps everything it was', async () => {
    const before = await twelve();
    const done = startTestRun(before);
    expect(done.state.project.testRun).toBeDefined();
    expect(done.state.project.dataset.cases).toEqual(before.project.dataset.cases);
    expect(done.state.unsaved).toBe(true);
  });

  it('is refused for empty test cases and for an empty prompt, and changes nothing', async () => {
    const empty = open();
    const none = startTestRun(empty);
    expect(none.state).toBe(empty);
    expect(none.note).toMatch(/no test cases/i);
    const state = await twelve();
    const blank = startTestRun({ ...state, project: { ...state.project, judge_set: { ...state.project.judge_set, prompt: '' } } });
    expect(blank.state.project.testRun).toBeUndefined();
    expect(blank.note).toMatch(/judge prompt is empty/i);
  });

  it('does not stop at a warning: a project of one kind starts', () => {
    const state = open();
    const one = saveCaseFromJson(state, json('Only', 'Anna works as a baker.'), { mode: 'paste' }).state;
    expect(startTestRun(one).state.project.testRun).toBeDefined();
  });
});

describe('what is fixed after the start', () => {
  it('the judge prompt and the judged text cannot be changed', async () => {
    const state = await started();
    const prompt = setPrompt(state, 'Another prompt {{summary}}');
    expect(prompt.state).toBe(state);
    expect(prompt.note).toBe('The test run has started, so the prompt is fixed.');
    const judged = setJudgedText(state, 'source_text');
    expect(judged.state).toBe(state);
  });

  it('the fields and the name of a case are fixed: the JSON of the expected errors has no place for them', async () => {
    const state = await started();
    const original = state.project.dataset.cases.find((c) => c.id === '12')!;
    const withFields = JSON.stringify({ fields: { ...original.fields, summary: 'Anna is a lawyer.' }, expected_errors: original.expected_errors });
    const saved = saveExpectedErrors(state, '12', withFields);
    expect(saved.state.project.dataset.cases.find((c) => c.id === '12')?.fields).toEqual(original.fields);
  });

  it('replies are accepted only after the start', async () => {
    const reply = sampleProject().testRun!.replies['1']!.reply;
    const before = await saveReply(await twelve(), '1', reply);
    expect(before.status).toBe('refused');
    expect(before.message).toMatch(/Start the test run first/);
    const after = await saveReply(await started(), '1', reply);
    expect(after.status).toBe('saved');
  });
});

describe('what may still change after the start', () => {
  it('cases may still be added and imported; they start without a reply and the others stay as they are', async () => {
    let state = await started();
    state = saveCaseFromJson(state, json('Thirteenth', 'Anna works as a baker, as before.'), { mode: 'paste' }).state;
    expect(state.project.dataset.cases).toHaveLength(13);
    expect(state.project.testRun).toBeDefined();

    state = await imported(state, 'name,field:source_text,field:summary\nLater import,Source,Another text\n');
    expect(state.project.dataset.cases).toHaveLength(14);
    expect(state.project.testRun).toBeDefined();
  });

  it('every case may be renamed, removed (a case with a reply with its reply) and have its expected errors edited', async () => {
    let state = await started();
    const reply = sampleProject().testRun!.replies['1']!.reply;
    state = (await saveReply(state, '1', reply)).state;

    expect(renameCase(state, '2', 'Renamed').state.project.dataset.cases.find((c) => c.id === '2')?.name).toBe('Renamed');
    expect(removeCase(state, '3').state.project.dataset.cases).toHaveLength(11);
    const corrected = saveExpectedErrors(state, '12', JSON.stringify([{ ...doctor, difficulty: 'obvious' }]));
    expect(corrected.state.project.dataset.cases.find((c) => c.id === '12')?.expected_errors[0]?.difficulty).toBe('obvious');

    expect(renameCase(state, '1', 'No').state.project.dataset.cases.find((c) => c.id === '1')?.name).toBe('No');
    const removed = removeCase(state, '1').state.project;
    expect(removed.dataset.cases.some((c) => c.id === '1')).toBe(false);
    expect(removed.testRun!.replies['1']).toBeUndefined();
    expect(saveExpectedErrors(state, '1', '[]').state.project.dataset.cases.find((c) => c.id === '1')?.expected_errors).toEqual([]);
  });

  it('the reply mapping and the error rules may be corrected', async () => {
    const state = await started();
    const rule = updateRule(state, 0, { name: 'A better name' });
    expect(rule.state.project.judge_set.error_rules[0]?.name).toBe('A better name');
    expect(setRuleWhere(state, 0, 'claims[].text').state.project.testRun).toBeDefined();
  });
});

describe('no way back', () => {
  it('there is no action that reopens the test cases or clears the test run', async () => {
    const start = await import('../../src/app/actions/start');
    expect(Object.keys(start).sort()).toEqual(['startTestRun']);
    expect(existsSync('src/app/actions/rerun.ts')).toBe(false);
  });

  it('starting twice changes nothing', async () => {
    const state = await started();
    const again = startTestRun(state);
    expect(again.state).toBe(state);
    expect(again.note).toMatch(/already started/i);
  });
});
