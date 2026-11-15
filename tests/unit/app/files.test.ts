// The one file of a test project: saving it, and loading it with the question about its test run (T302; FR-019, FR-020, FR-051, FR-076).
import { describe, expect, it } from 'vitest';
import { finishLoad, loadTestProject, saveTestProject, saveTestProjectAs, type FileEnv } from '../../../src/app/actions/files';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { isStarted } from '../../../src/core/cases/test-run';
import { notStartedProject, sampleProject, withRun } from '../../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const unsavedState = (project = sampleProject()): AppState => ({ ...createState(), project: project, unsaved: true });

async function fileOf(project = sampleProject()): Promise<string> {
  const ports = createFakePorts();
  await saveTestProject(unsavedState(project), ports, env);
  return ports.testProjectTarget.lastText!;
}
const open = (ports: FakePorts, text: string, name = 'chosen.json') => {
  ports.opener.next = { name, text };
};

describe('one save target', () => {
  it('has no second target for a test run', () => {
    expect(Object.keys(createFakePorts()).sort()).toEqual(['clipboard', 'exportTarget', 'opener', 'testProjectTarget']);
  });

  it('saves the whole test project, with its test run when it has started', async () => {
    expect(JSON.parse(await fileOf(sampleProject()))).toHaveProperty('test_run');
    expect(JSON.parse(await fileOf(notStartedProject()))).not.toHaveProperty('test_run');
  });

  it('clears the one unsaved indicator also when replies exist, with no second message', async () => {
    const ports = createFakePorts();
    const result = await saveTestProject({ ...unsavedState(), repliesSinceSave: 7 }, ports, env);
    expect(result.outcome).toBe('saved');
    expect(result.message).toBeUndefined();
    expect(result.state).toMatchObject({ unsaved: false, repliesSinceSave: 0, hasFile: true, testProjectFile: 'test-project.json' });
  });

  it('"Save test project" asks the first time and overwrites after; "Save test project as…" always asks', async () => {
    const ports = createFakePorts();
    const first = await saveTestProject(unsavedState(), ports, env);
    await saveTestProject(first.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(1);
    await saveTestProjectAs(first.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(2);
  });
});

describe('a file with a test run asks first (a, f)', () => {
  it('applies nothing until the choice, and says what it holds', async () => {
    const ports = createFakePorts();
    open(ports, await fileOf());
    const before = createState();
    const result = await loadTestProject(before, ports, env);
    expect(result.outcome).toBe('needs_choice');
    expect(result.state).toBe(before);
    expect(result.pending).toBeDefined();
    expect(ports.testProjectTarget.fileName).toBeNull();
  });

  it('"Load with the test run" restores everything and remembers the file (b)', async () => {
    const ports = createFakePorts();
    open(ports, await fileOf(), 'run-3.json');
    const asked = await loadTestProject(createState(), ports, env);
    const result = await finishLoad(asked.state, ports, asked.pending!, 'with');
    expect(result.outcome).toBe('loaded');
    expect(isStarted(result.state.project)).toBe(true);
    expect(result.state).toMatchObject({ unsaved: false, testProjectFile: 'run-3.json', hasFile: true });
    expect(ports.testProjectTarget.fileName).toBe('run-3.json');
    const before = ports.testProjectTarget.asked;
    await saveTestProject(result.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(before); // overwrites the loaded file
  });

  it('"Load with the test run" reports recomputed results that differ (b)', async () => {
    const ports = createFakePorts();
    const file = JSON.parse(await fileOf());
    file.test_run.results.measures.detection_rate.value = 0.123;
    open(ports, JSON.stringify(file));
    const asked = await loadTestProject(createState(), ports, env);
    const result = await finishLoad(asked.state, ports, asked.pending!, 'with');
    expect(result.message).toMatch(/differ/);
  });

  it('opens the first step with unfinished work (k)', async () => {
    const ports = createFakePorts();
    const one = sampleProject();
    open(ports, await fileOf(withRun(one, { replies: { '1': one.testRun!.replies['1']! }, decisions: {} })));
    const asked = await loadTestProject(createState(), ports, env);
    const result = await finishLoad(asked.state, ports, asked.pending!, 'with');
    expect(result.state.step).toBe('run');
    expect(result.state.openCase).toBeNull();
  });
});

describe('a file with no test run loads at once (e)', () => {
  it('does not ask, remembers the file and opens Test cases', async () => {
    const ports = createFakePorts();
    open(ports, await fileOf(notStartedProject()), 'cases.json');
    const result = await loadTestProject(createState(), ports, env);
    expect(result.outcome).toBe('loaded');
    expect(result.state).toMatchObject({ step: 'cases', unsaved: false, testProjectFile: 'cases.json' });
    expect(isStarted(result.state.project)).toBe(false);
  });
});

describe('a dropped file (d)', () => {
  it('asks the same question and is never remembered, so the first save asks for a file', async () => {
    const ports = createFakePorts();
    const asked = await loadTestProject(createState(), ports, env, { name: 'dropped.json', text: await fileOf() });
    expect(asked.outcome).toBe('needs_choice');
    expect(ports.opener.lastKind).toBeUndefined(); // the picker was not used
    const result = await finishLoad(asked.state, ports, asked.pending!, 'with');
    expect(result.state.testProjectFile).toBeNull();
    expect(ports.testProjectTarget.fileName).toBeNull();
    await saveTestProject(result.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(1);
  });

  it('a dropped file with no test run loads at once and is not remembered either', async () => {
    const ports = createFakePorts();
    const result = await loadTestProject(createState(), ports, env, { name: 'dropped.json', text: await fileOf(notStartedProject()) });
    expect(result.outcome).toBe('loaded');
    expect(result.state.testProjectFile).toBeNull();
  });
});

describe('an invalid file changes nothing and is explained before any question (g)', () => {
  it('does not read as a test project', async () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'mine.json';
    const state = unsavedState();
    open(ports, '{ "format": ');
    const result = await loadTestProject(state, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.pending).toBeUndefined();
    expect(result.state).toBe(state);
    expect(result.message).toMatch(/not readable JSON/);
    expect(ports.testProjectTarget.fileName).toBe('mine.json');
  });

  it('is incomplete', async () => {
    const ports = createFakePorts();
    const file = JSON.parse(await fileOf());
    delete file.dataset;
    open(ports, JSON.stringify(file));
    const state = createState();
    const result = await loadTestProject(state, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.state).toBe(state);
    expect(result.problems?.length).toBeGreaterThan(0);
  });

  it('a file whose metric is not loaded and has no definition is refused with a plain message (T274)', async () => {
    const ports = createFakePorts();
    const file = JSON.parse(await fileOf());
    file.metric = { id: 'bias', parameters: {} };
    open(ports, JSON.stringify(file));
    const state = createState();
    const result = await loadTestProject(state, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.message).toMatch(/"bias".*not loaded/);
    expect(result.message).toMatch(/no definition/);
    expect(result.state).toBe(state);
  });
});

describe('a cancelled picker changes nothing', () => {
  it('returns the same state', async () => {
    const state = createState();
    const result = await loadTestProject(state, createFakePorts(), env);
    expect(result.outcome).toBe('cancelled');
    expect(result.state).toBe(state);
  });
});
