// T243, T289: a test project file carries the definition of its metric, with or without its test run, and loading the file registers it.
import { afterEach, describe, expect, it } from 'vitest';
import { finishLoad, loadTestProject, saveTestProject, type FileEnv } from '../../src/app/actions/files';
import { metricFor, registerEmbeddedMetric, resetRegistry, sessionRegistry } from '../../src/app/metrics';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, type AppState } from '../../src/app/store';
import type { TestProject } from '../../src/core/model';
import { embeddedDefinition, sampleProject } from '../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const bias = (): TestProject => ({ ...sampleProject(), metric: { id: 'bias-verdict', parameters: {}, definition: embeddedDefinition() } });
const withEvaluation = (evaluation: TestProject): AppState => ({ ...createState(), project: evaluation, unsaved: true });

afterEach(() => resetRegistry());

/** Loads the file and answers the question about its test run, when there is one, with the test run. */
async function loadAll(state: AppState, ports: ReturnType<typeof createFakePorts>) {
  const first = await loadTestProject(state, ports, env);
  return first.outcome === 'needs_choice' ? finishLoad(first.state, ports, first.pending!, 'with') : first;
}

/** Saves a test project whose metric the session does not know yet, as another session would have: the metric is registered for the save only. */
async function saveBias(project: TestProject, ports: ReturnType<typeof createFakePorts>) {
  registerEmbeddedMetric(project.metric);
  await saveTestProject(withEvaluation(project), ports, env);
  resetRegistry();
}

describe('a metric definition inside a file', () => {
  it('Load test project registers it, and metricFor then finds it', async () => {
    expect(() => metricFor('bias-verdict')).toThrow(/not loaded/);
    const ports = createFakePorts();
    await saveBias(bias(), ports);
    ports.opener.next = { name: 'bias.json', text: ports.testProjectTarget.lastText! };
    const result = await loadAll(createState(), ports);
    expect(result.outcome).toBe('loaded');
    expect(result.notes.join(' ')).not.toMatch(/not registered/);
    expect(metricFor('bias-verdict').measures.map((m) => m.id)).toContain('case_detection_rate');
    expect(sessionRegistry().metrics.map((m) => m.id)).toEqual(['accuracy', 'bias-verdict']);
  });

  it('a file saved with its test run carries the definition too, because it is one file (T289)', async () => {
    const ports = createFakePorts();
    await saveBias(bias(), ports);
    ports.opener.next = { name: 'p.json', text: ports.testProjectTarget.lastText! };
    const first = await loadAll(createState(), ports);
    await saveTestProject(first.state, ports, env);
    const text = ports.testProjectTarget.lastText!;
    expect(JSON.parse(text).metric.definition).toEqual(embeddedDefinition());
    resetRegistry();
    ports.opener.next = { name: 'e.json', text };
    const result = await loadAll(createState(), ports);
    expect(result.outcome).toBe('loaded');
    expect(result.state.project.metric.definition?.name).toBe(embeddedDefinition().name);
    expect(metricFor('bias-verdict').name).toBe(embeddedDefinition().name);
  });

  it('a file whose metric is not loaded and has no definition is refused with a plain message and changes nothing (T274)', async () => {
    const ports = createFakePorts();
    await saveBias(bias(), ports);
    ports.opener.next = { name: 'p.json', text: ports.testProjectTarget.lastText! };
    const first = await loadAll(createState(), ports);
    await saveTestProject(first.state, ports, env);
    const file = JSON.parse(ports.testProjectTarget.lastText!);
    file.metric = { id: file.metric.id, parameters: file.metric.parameters };
    const text = JSON.stringify(file);
    resetRegistry();
    const before = createState();
    ports.opener.next = { name: 'e.json', text };
    const result = await loadTestProject(before, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.message).toMatch(/"bias-verdict"/);
    expect(result.message).toMatch(/no definition/);
    expect(result.state).toBe(before);
  });

  it('loading it again replaces the earlier definition without asking, and the default metric file is replaced like any other', async () => {
    const ports = createFakePorts();
    const twice = bias();
    await saveBias(twice, ports);
    const text = ports.testProjectTarget.lastText!;
    for (let i = 0; i < 2; i++) {
      ports.opener.next = { name: 'bias.json', text };
      expect((await loadAll(createState(), ports)).outcome).toBe('loaded');
    }
    expect(sessionRegistry().metrics.filter((m) => m.id === 'bias-verdict')).toHaveLength(1);

    const fake = { ...sampleProject(), metric: { id: 'accuracy', parameters: {}, definition: { ...embeddedDefinition(), name: 'Not Accuracy' } } };
    await saveBias(fake, ports);
    ports.opener.next = { name: 'fake.json', text: ports.testProjectTarget.lastText! };
    await loadAll(createState(), ports);
    expect(metricFor('accuracy').name).toBe('Not Accuracy');
  });
});
