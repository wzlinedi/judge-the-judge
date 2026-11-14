// T243: a test project (not an evaluation file) carries the definition of its metric, and loading the file registers it.
import { afterEach, describe, expect, it } from 'vitest';
import { loadEvaluation, loadTestProject, saveEvaluation, saveTestProject, type FileEnv } from '../../src/app/actions/files';
import { metricFor, resetRegistry, sessionRegistry } from '../../src/app/metrics';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, type AppState } from '../../src/app/store';
import type { Evaluation } from '../../src/core/model';
import { embeddedDefinition, sampleEvaluation } from '../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const bias = (): Evaluation => ({ ...sampleEvaluation(), metric: { id: 'bias-verdict', parameters: {}, definition: embeddedDefinition() } });
const withEvaluation = (evaluation: Evaluation): AppState => ({ ...createState(), evaluation, unsaved: true });

afterEach(() => resetRegistry());

describe('a metric definition inside a file', () => {
  it('Load test project registers it, and metricFor then finds it', async () => {
    expect(metricFor('bias-verdict').id).toBe('accuracy');
    const ports = createFakePorts();
    await saveTestProject(withEvaluation(bias()), ports, env);
    ports.opener.next = { name: 'bias.json', text: ports.testProjectTarget.lastText! };
    const result = await loadTestProject(createState(), ports, env);
    expect(result.outcome).toBe('loaded');
    expect(result.notes.join(' ')).not.toMatch(/not registered/);
    expect(metricFor('bias-verdict').measures.map((m) => m.id)).toContain('case_detection_rate');
    expect(sessionRegistry().metrics.map((m) => m.id)).toEqual(['accuracy', 'bias-verdict']);
  });

  it('an evaluation file does not carry it: only the id and the parameters are written, and the metric of an earlier test project is used', async () => {
    const ports = createFakePorts();
    await saveTestProject(withEvaluation(bias()), ports, env);
    ports.opener.next = { name: 'p.json', text: ports.testProjectTarget.lastText! };
    const loaded = await loadTestProject(createState(), ports, env);
    await saveEvaluation(loaded.state, ports, env);
    const text = ports.evaluationTarget.lastText!;
    expect(JSON.parse(text).metric).toEqual({ id: 'bias-verdict', parameters: {} });
    ports.opener.next = { name: 'e.json', text };
    const result = await loadEvaluation(createState(), ports, env);
    expect(result.outcome).toBe('loaded');
    expect(result.state.evaluation.metric.definition).toBeUndefined();
    expect(metricFor('bias-verdict').name).toBe(embeddedDefinition().name);
  });

  it('loading it again replaces the earlier definition without asking, and a built-in metric is never replaced', async () => {
    const ports = createFakePorts();
    const twice = bias();
    await saveTestProject(withEvaluation(twice), ports, env);
    const text = ports.testProjectTarget.lastText!;
    for (let i = 0; i < 2; i++) {
      ports.opener.next = { name: 'bias.json', text };
      expect((await loadTestProject(createState(), ports, env)).outcome).toBe('loaded');
    }
    expect(sessionRegistry().metrics.filter((m) => m.id === 'bias-verdict')).toHaveLength(1);

    const fake = { ...sampleEvaluation(), metric: { id: 'accuracy', parameters: {}, definition: { ...embeddedDefinition(), name: 'Not Accuracy' } } };
    await saveTestProject(withEvaluation(fake), ports, env);
    ports.opener.next = { name: 'fake.json', text: ports.testProjectTarget.lastText! };
    await loadTestProject(createState(), ports, env);
    expect(metricFor('accuracy').name).toBe('Accuracy');
  });
});
