// US6: saving the one test project file and continuing later, with the port fakes (FR-020, FR-051, FR-073, FR-076, SC-029).
import { describe, expect, it } from 'vitest';
import { finishLoad, loadTestProject, saveTestProject, saveTestProjectAs, type FileEnv } from '../../src/app/actions/files';
import { createFakePorts, type FakePorts } from '../../src/app/ports/fakes';
import { createState, edit, startNewTestProject, type AppState } from '../../src/app/store';
import { loadExample } from '../../src/app/actions/demo';
import { readFileSync } from 'node:fs';
import { testCasesVersion } from '../../src/core/cases/version';
import type { TestProject } from '../../src/core/model';
import { withoutTestRun } from '../../src/core/cases/test-run';
import { sampleProject, withRun } from '../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const stateWith = (evaluation: TestProject, extra: Partial<AppState> = {}): AppState => ({ ...createState(), project: evaluation, unsaved: true, ...extra });

const normalized = async (e: TestProject): Promise<TestProject> => ({ ...e, dataset: { ...e.dataset, version: await testCasesVersion(e.dataset.cases) } });

function open(ports: FakePorts, text: string, name = 'chosen.json') {
  ports.opener.next = { name, text };
}

/** Loads the file the way the page does: the question, when there is one, is answered with the test run. */
async function loadWith(state: AppState, ports: FakePorts) {
  const first = await loadTestProject(state, ports, env);
  return first.outcome === 'needs_choice' ? finishLoad(first.state, ports, first.pending!, 'with') : first;
}

describe('Save test project', () => {
  it('asks for a file the first time and overwrites it the second time', async () => {
    const ports = createFakePorts();
    const first = await saveTestProject(stateWith(sampleProject()), ports, env);
    expect(first.outcome).toBe('saved');
    expect(ports.testProjectTarget.asked).toBe(1);
    expect(first.state).toMatchObject({ unsaved: false, testProjectFile: 'test-project.json', hasFile: true });
    const second = await saveTestProject(edit(first.state, (e) => withRun(e, { model_note: 'again' })), ports, env);
    expect(second.outcome).toBe('saved');
    expect(ports.testProjectTarget.asked).toBe(1);
    expect(ports.testProjectTarget.lastText).toContain('again');
  });

  it('"Save test project as…" always asks', async () => {
    const ports = createFakePorts();
    const first = await saveTestProject(stateWith(sampleProject()), ports, env);
    await saveTestProjectAs(first.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(2);
  });

  it('keeps the work and says so when the remembered file can no longer be written', async () => {
    const ports = createFakePorts();
    const first = await saveTestProject(stateWith(sampleProject()), ports, env);
    ports.testProjectTarget.nextResult = { status: 'no_longer_writable' };
    const edited = edit(first.state, (e) => withRun(e, { model_note: 'precious' }));
    const result = await saveTestProject(edited, ports, env);
    expect(result.outcome).toBe('no_longer_writable');
    expect(result.message).toMatch(/Choose a file/);
    expect(result.state.unsaved).toBe(true);
    expect(result.state.project.testRun!.model_note).toBe('precious');
    expect(result.state.testProjectFile).toBeNull();
  });

  it('a cancelled picker changes nothing', async () => {
    const ports = createFakePorts();
    ports.testProjectTarget.nextResult = { status: 'cancelled' };
    const state = stateWith(sampleProject());
    const result = await saveTestProject(state, ports, env);
    expect(result.outcome).toBe('cancelled');
    expect(result.state).toBe(state);
  });
});

describe('load and continue', () => {
  const stages: Array<[string, (e: TestProject) => TestProject, string]> = [
    ['before the test run starts', (e) => withoutTestRun(e), 'cases'],
    ['part-way through the test run', (e) => withRun(e, { replies: { '1': e.testRun!.replies['1']! }, decisions: {} }), 'run'],
    ['after deciding', (e) => e, 'results'],
  ];
  it.each(stages)('a test project saved %s loads back identical and opens the right step', async (_name, shape, step) => {
    const saver = createFakePorts();
    const original = shape(sampleProject());
    await saveTestProject(stateWith(original), saver, env);
    const ports = createFakePorts();
    open(ports, saver.testProjectTarget.lastText!);
    const loaded = await loadWith(createState(), ports);
    expect(loaded.outcome).toBe('loaded');
    expect(loaded.state.project).toEqual(await normalized(original));
    expect(loaded.state).toMatchObject({ step, unsaved: false, testProjectFile: 'chosen.json', hasFile: true });
  });

  it('opens Run on loading, with no case open yet: Continue on Run opens it (FR-073)', async () => {
    const saver = createFakePorts();
    const e = sampleProject();
    await saveTestProject(stateWith(withRun(e, { replies: { '1': e.testRun!.replies['1']! }, decisions: {} })), saver, env);
    const ports = createFakePorts();
    open(ports, saver.testProjectTarget.lastText!);
    const loaded = await loadWith(createState(), ports);
    expect(loaded.state.step).toBe('run');
    expect(loaded.state.openCase).toBeNull();
  });

  it('opens Judge when the saved test project has no prompt', async () => {
    const saver = createFakePorts();
    const noPrompt = withoutTestRun(sampleProject());
    noPrompt.judge_set.prompt = '';
    await saveTestProject(stateWith(noPrompt), saver, env);
    const ports = createFakePorts();
    open(ports, saver.testProjectTarget.lastText!);
    expect((await loadWith(createState(), ports)).state.step).toBe('judge');
  });

  it('keeps the metric and the thresholds', async () => {
    const saver = createFakePorts();
    const original = withoutTestRun(sampleProject());
    original.checks = { rules: [{ measure: 'detection_rate', comparison: 'at_least', value: 0.55 }] };
    await saveTestProject(stateWith(original), saver, env);
    const ports = createFakePorts();
    open(ports, saver.testProjectTarget.lastText!);
    const loaded = await loadWith(createState(), ports);
    expect(loaded.state.project.metric).toEqual(original.metric);
    // the file's own threshold is kept; a measure with no rule gets the bundled default (T414, owner 2026-11-17)
    expect(loaded.state.project.checks.rules.find((r) => r.measure === 'detection_rate')).toEqual(original.checks.rules[0]);
    expect(loaded.state.project.checks.rules.map((r) => r.measure).sort()).toEqual(['case_detection_rate', 'clean_case_false_positive_rate', 'detection_rate', 'false_positive_rate']);
  });

  it('an invalid file leaves the current work and the remembered file unchanged and says what is wrong', async () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'proj.json';
    const state = stateWith(sampleProject(), { testProjectFile: 'proj.json' });
    open(ports, '{ "format": ');
    const result = await loadTestProject(state, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.state).toBe(state);
    expect(result.message).toMatch(/not readable JSON/);
    expect(ports.testProjectTarget.fileName).toBe('proj.json');
  });
});

describe('the reminder after replies (j)', () => {
  it('counts the replies since the last "Save test project"', async () => {
    const ports = createFakePorts();
    const state = stateWith(sampleProject(), { repliesSinceSave: 25 });
    const saved = await saveTestProject(state, ports, env);
    expect(saved.state.repliesSinceSave).toBe(0);
    const as = await saveTestProjectAs({ ...state, repliesSinceSave: 12 }, ports, env);
    expect(as.state.repliesSinceSave).toBe(0);
  });
});

describe('forgetting the remembered file (FR-076)', () => {
  it('"New test project" and "Load demo…" forget it', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'a.json';
    startNewTestProject(createState(), ports);
    expect(ports.testProjectTarget.fileName).toBeNull();

    ports.testProjectTarget.fileName = 'a.json';
    const demo = loadExample(createState(), readFileSync('examples/demo/test-project.json', 'utf8'), ports);
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(demo.testProjectFile).toBeNull();
    expect(demo.step).toBe('judge');
    expect(demo.project.testRun).toBeDefined(); // the demo loads with its test run, with no question
  });
});
