// "Load the test project only" (T302 c; FR-076, User Story 12): the same test cases for another judge, with no test run and no remembered file.
import { describe, expect, it } from 'vitest';
import { finishLoad, loadTestProject, saveTestProject, type FileEnv } from '../../src/app/actions/files';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState } from '../../src/app/store';
import { isStarted } from '../../src/core/cases/test-run';
import { sampleProject } from '../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };

async function loadedOnly() {
  const saver = createFakePorts();
  await saveTestProject({ ...createState(), project: sampleProject(), unsaved: true }, saver, env);
  const text = saver.testProjectTarget.lastText!;
  const ports = createFakePorts();
  ports.opener.next = { name: 'run-1.json', text };
  const asked = await loadTestProject({ ...createState(), testProjectFile: 'old.json' }, ports, env);
  ports.testProjectTarget.fileName = 'old.json';
  const result = await finishLoad(asked.state, ports, asked.pending!, 'only');
  return { ports, result, text };
}

describe('Load the test project only', () => {
  it('drops the test run and the "added after first reply" marks: the test run has not started', async () => {
    const { result } = await loadedOnly();
    expect(result.outcome).toBe('loaded');
    expect(isStarted(result.state.project)).toBe(false);
    expect(result.state.project.dataset.cases.every((c) => c.changed_after_first_reply === undefined)).toBe(true);
    expect(result.state.step).toBe('cases');
    expect(result.state.unsaved).toBe(false);
  });

  it('keeps the judge, the cases, the metric and the thresholds', async () => {
    const { result } = await loadedOnly();
    const original = sampleProject();
    expect(result.state.project.judge_set).toEqual(original.judge_set);
    expect(result.state.project.metric).toEqual(original.metric);
    expect(result.state.project.checks).toEqual(original.checks);
    expect(result.state.project.dataset.cases.map((c) => c.id)).toEqual(original.dataset.cases.map((c) => c.id));
  });

  it('forgets the remembered file: the first save asks for a new file, and the loaded file is never written', async () => {
    const { ports, result } = await loadedOnly();
    expect(result.state.testProjectFile).toBeNull();
    expect(ports.testProjectTarget.fileName).toBeNull();
    const saved = await saveTestProject(result.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(1);
    expect(saved.state.testProjectFile).toBe('test-project.json');
    expect(JSON.parse(ports.testProjectTarget.lastText!)).not.toHaveProperty('test_run');
  });

  it('"Cancel" at the question applies nothing: the caller drops the pending load', async () => {
    const saver = createFakePorts();
    await saveTestProject({ ...createState(), project: sampleProject(), unsaved: true }, saver, env);
    const ports = createFakePorts();
    ports.opener.next = { name: 'run-1.json', text: saver.testProjectTarget.lastText! };
    const before = createState();
    const asked = await loadTestProject(before, ports, env);
    expect(asked.state).toBe(before);
    expect(ports.testProjectTarget.fileName).toBeNull();
  });
});
