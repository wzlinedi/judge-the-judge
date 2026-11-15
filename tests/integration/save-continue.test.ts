// US6: saving the two files and continuing later, with the port fakes (FR-020, FR-051, FR-073, FR-076, SC-029).
import { describe, expect, it } from 'vitest';
import {
  loadEvaluation, loadTestProject, saveEvaluation, saveEvaluationAs, saveTestProject, saveTestProjectAs,
  type FileEnv,
} from '../../src/app/actions/files';
import { createFakePorts, type FakePorts } from '../../src/app/ports/fakes';
import { createState, edit, startNewEvaluation, type AppState } from '../../src/app/store';
import { loadExample } from '../../src/app/actions/evaluation';
import { readFileSync } from 'node:fs';
import { testCasesVersion } from '../../src/core/cases/version';
import type { Evaluation } from '../../src/core/model';
import { sampleEvaluation } from '../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const stateWith = (evaluation: Evaluation, extra: Partial<AppState> = {}): AppState => ({ ...createState(), evaluation, unsaved: true, ...extra });

const normalized = async (e: Evaluation): Promise<Evaluation> => ({ ...e, dataset: { ...e.dataset, version: await testCasesVersion(e.dataset.cases) } });

function open(ports: FakePorts, text: string, name = 'chosen.json') {
  ports.opener.next = { name, text };
}

describe('Save evaluation', () => {
  it('asks for a file the first time and overwrites it the second time', async () => {
    const ports = createFakePorts();
    const first = await saveEvaluation(stateWith(sampleEvaluation()), ports, env);
    expect(first.outcome).toBe('saved');
    expect(ports.evaluationTarget.asked).toBe(1);
    expect(first.state).toMatchObject({ unsaved: false, evaluationFile: 'evaluation.json', hasFile: true });
    const second = await saveEvaluation(edit(first.state, (e) => ({ ...e, model_note: 'again' })), ports, env);
    expect(second.outcome).toBe('saved');
    expect(ports.evaluationTarget.asked).toBe(1);
    expect(ports.evaluationTarget.lastText).toContain('again');
  });

  it('"Save evaluation as" always asks', async () => {
    const ports = createFakePorts();
    const first = await saveEvaluation(stateWith(sampleEvaluation()), ports, env);
    await saveEvaluationAs(first.state, ports, env);
    expect(ports.evaluationTarget.asked).toBe(2);
  });

  it('keeps the work and says so when the remembered file can no longer be written', async () => {
    const ports = createFakePorts();
    const first = await saveEvaluation(stateWith(sampleEvaluation()), ports, env);
    ports.evaluationTarget.nextResult = { status: 'no_longer_writable' };
    const edited = edit(first.state, (e) => ({ ...e, model_note: 'precious' }));
    const result = await saveEvaluation(edited, ports, env);
    expect(result.outcome).toBe('no_longer_writable');
    expect(result.message).toMatch(/Choose a file/);
    expect(result.state.unsaved).toBe(true);
    expect(result.state.evaluation.model_note).toBe('precious');
    expect(result.state.evaluationFile).toBeNull();
  });

  it('a cancelled picker changes nothing', async () => {
    const ports = createFakePorts();
    ports.evaluationTarget.nextResult = { status: 'cancelled' };
    const state = stateWith(sampleEvaluation());
    const result = await saveEvaluation(state, ports, env);
    expect(result.outcome).toBe('cancelled');
    expect(result.state).toBe(state);
  });
});

describe('load evaluation and continue', () => {
  const stages: Array<[string, (e: Evaluation) => Evaluation, string]> = [
    ['before finalizing', (e) => ({ ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {}, reply_judge_version: undefined }), 'cases'],
    ['part-way through Run', (e) => ({ ...e, replies: { '1': e.replies['1']! }, decisions: {} }), 'run'],
    ['after deciding', (e) => e, 'results'],
  ];
  it.each(stages)('an evaluation saved %s loads back identical and opens the right step', async (_name, shape, step) => {
    const saver = createFakePorts();
    const original = shape(sampleEvaluation());
    await saveEvaluation(stateWith(original), saver, env);
    const ports = createFakePorts();
    open(ports, saver.evaluationTarget.lastText!);
    const loaded = await loadEvaluation(createState(), ports, env);
    expect(loaded.outcome).toBe('loaded');
    expect(loaded.state.evaluation).toEqual(await normalized(original));
    expect(loaded.state).toMatchObject({ step, unsaved: false, evaluationFile: 'chosen.json', testProjectFile: null, hasFile: true });
  });

  it('opens Run on loading, with no case open yet: Continue on Run opens it (FR-073)', async () => {
    const saver = createFakePorts();
    const e = sampleEvaluation();
    await saveEvaluation(stateWith({ ...e, replies: { '1': e.replies['1']! }, decisions: {} }), saver, env);
    const ports = createFakePorts();
    open(ports, saver.evaluationTarget.lastText!);
    const loaded = await loadEvaluation(createState(), ports, env);
    expect(loaded.state.step).toBe('run');
    expect(loaded.state.openCase).toBeNull();
  });

  it('makes the loaded file the current one: the next save overwrites it, and the test project file is forgotten', async () => {
    const saver = createFakePorts();
    await saveEvaluation(stateWith(sampleEvaluation()), saver, env);
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'old-project.json';
    open(ports, saver.evaluationTarget.lastText!, 'run-7.json');
    const loaded = await loadEvaluation({ ...createState(), testProjectFile: 'old-project.json' }, ports, env);
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(ports.evaluationTarget.fileName).toBe('run-7.json');
    const before = ports.evaluationTarget.asked;
    await saveEvaluation(loaded.state, ports, env);
    expect(ports.evaluationTarget.asked).toBe(before);
  });

  it('an invalid file leaves the current work and the remembered files unchanged and says what is wrong', async () => {
    const ports = createFakePorts();
    ports.evaluationTarget.fileName = 'mine.json';
    ports.testProjectTarget.fileName = 'proj.json';
    const state = stateWith(sampleEvaluation(), { evaluationFile: 'mine.json', testProjectFile: 'proj.json' });
    open(ports, '{ "format": ');
    const result = await loadEvaluation(state, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.state).toBe(state);
    expect(result.message).toMatch(/not readable JSON/);
    expect(ports.evaluationTarget.fileName).toBe('mine.json');
    expect(ports.testProjectTarget.fileName).toBe('proj.json');
  });

  it('a test project file given to "Load evaluation" is refused with a message naming "Load test project"', async () => {
    const saver = createFakePorts();
    await saveTestProject(stateWith(sampleEvaluation()), saver, env);
    const ports = createFakePorts();
    open(ports, saver.testProjectTarget.lastText!);
    const result = await loadEvaluation(createState(), ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.message).toContain('Load test project');
  });

  it('a cancelled picker changes nothing', async () => {
    const ports = createFakePorts();
    const state = createState();
    const result = await loadEvaluation(state, ports, env);
    expect(result.outcome).toBe('cancelled');
    expect(result.state).toBe(state);
  });
});

describe('test project', () => {
  it('saved after finalizing comes back finalized with metric and thresholds and no replies, starts a new evaluation and opens Run', async () => {
    const saver = createFakePorts();
    const original = sampleEvaluation();
    original.checks = { rules: [{ measure: 'detection_rate', comparison: 'at_least', value: 0.55 }] };
    const saved = await saveTestProject(stateWith(original), saver, env);
    expect(saved.outcome).toBe('saved');
    expect(saved.message).toMatch(/Replies are kept only by "Save evaluation"/);
    expect(saved.state.unsaved).toBe(true); // replies still unsaved
    const text = saver.testProjectTarget.lastText!;
    expect(text).not.toContain('"replies"');

    const ports = createFakePorts();
    ports.evaluationTarget.fileName = 'old-run.json';
    open(ports, text, 'books.json');
    const loaded = await loadTestProject(stateWith(original, { evaluationFile: 'old-run.json' }), ports, env);
    expect(loaded.outcome).toBe('loaded');
    const e = loaded.state.evaluation;
    expect(e.dataset.finalized).toBe(true);
    expect(e.metric).toEqual(original.metric);
    expect(e.checks).toEqual(original.checks);
    expect(e.replies).toEqual({});
    expect(e.decisions).toEqual({});
    expect(loaded.state).toMatchObject({ step: 'run', unsaved: false, testProjectFile: 'books.json', evaluationFile: null });
    expect(ports.evaluationTarget.fileName).toBeNull();
  });

  it('with no replies, saving it leaves nothing unsaved and no message', async () => {
    const ports = createFakePorts();
    const e = { ...sampleEvaluation(), replies: {}, decisions: {} };
    const result = await saveTestProject(stateWith(e), ports, env);
    expect(result.state.unsaved).toBe(false);
    expect(result.message).toBeUndefined();
    expect(result.state.testProjectFile).toBe('test-project.json');
  });

  it('opens Test cases when the saved test project was not finalized, and Judge when it has no prompt', async () => {
    const saver = createFakePorts();
    const open1 = sampleEvaluation();
    open1.dataset.finalized = false;
    await saveTestProject(stateWith(open1), saver, env);
    const ports = createFakePorts();
    open(ports, saver.testProjectTarget.lastText!);
    expect((await loadTestProject(createState(), ports, env)).state.step).toBe('cases');

    const noPrompt = sampleEvaluation();
    noPrompt.judge_set.prompt = '';
    await saveTestProject(stateWith(noPrompt), saver, env);
    open(ports, saver.testProjectTarget.lastText!);
    expect((await loadTestProject(createState(), ports, env)).state.step).toBe('judge');
  });

  it('"Save test project as" always asks; a remembered file is overwritten', async () => {
    const ports = createFakePorts();
    const a = await saveTestProject(stateWith(sampleEvaluation()), ports, env);
    await saveTestProject(a.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(1);
    await saveTestProjectAs(a.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(2);
  });

  it('an evaluation file given to "Load test project" is refused with a message naming "Load evaluation"', async () => {
    const saver = createFakePorts();
    await saveEvaluation(stateWith(sampleEvaluation()), saver, env);
    const ports = createFakePorts();
    open(ports, saver.evaluationTarget.lastText!);
    const state = stateWith(sampleEvaluation());
    const result = await loadTestProject(state, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.message).toContain('Load evaluation');
    expect(result.state).toBe(state);
  });

  it('refuses a file whose metric is not loaded and has no definition in the file, and changes nothing (T274)', async () => {
    const saver = createFakePorts();
    await saveTestProject(stateWith(sampleEvaluation()), saver, env);
    const file = JSON.parse(saver.testProjectTarget.lastText!);
    file.metric = { id: 'bias', parameters: {} };
    const ports = createFakePorts();
    open(ports, JSON.stringify(file));
    const before = createState();
    const result = await loadTestProject(before, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.message).toMatch(/"bias".*not loaded/);
    expect(result.state).toBe(before);
  });
});

describe('forgetting the remembered files (FR-076)', () => {
  it('"New evaluation" and "Load demo…" forget both', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'a.json';
    ports.evaluationTarget.fileName = 'b.json';
    startNewEvaluation(createState(), ports);
    expect([ports.testProjectTarget.fileName, ports.evaluationTarget.fileName]).toEqual([null, null]);

    ports.testProjectTarget.fileName = 'a.json';
    ports.evaluationTarget.fileName = 'b.json';
    loadExample(createState(), readFileSync('examples/demo/evaluation.json', 'utf8'), ports);
    expect([ports.testProjectTarget.fileName, ports.evaluationTarget.fileName]).toEqual([null, null]);
  });
});
