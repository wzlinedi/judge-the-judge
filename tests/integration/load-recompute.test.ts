// Loading an evaluation recomputes it and reports a difference from the stored numbers (FR-075, SC-003; User Story 13).
import { describe, expect, it } from 'vitest';
import { exportReport } from '../../src/app/actions/export';
import { loadEvaluation, saveEvaluation } from '../../src/app/actions/files';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, edit, recomputeDifferences } from '../../src/app/store';
import { sampleEvaluation, accuracyMetric } from '../helpers/fixtures';

const env = { now: () => '2026-11-14T10:00:00Z', toolVersion: '1.0.0' };
const done = () => ({ ...createState(), step: 'results' as const, evaluation: sampleEvaluation(), unsaved: true });

async function fileText(change: (file: Record<string, any>) => void = () => undefined) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const ports = createFakePorts();
  await saveEvaluation(done(), ports, env);
  const file = JSON.parse(ports.evaluationTarget.lastText!);
  change(file);
  return JSON.stringify(file);
}
async function load(text: string) {
  const ports = createFakePorts();
  ports.opener.next = { name: 'run.json', text };
  return loadEvaluation(createState(), ports);
}

describe('Load evaluation recomputes the numbers', () => {
  it('says nothing, and holds no difference, for a file whose numbers follow from its data', async () => {
    const result = await load(await fileText());
    expect(result.outcome).toBe('loaded');
    expect(result.message ?? '').not.toMatch(/differ/);
    expect(recomputeDifferences(result.state)).toEqual([]);
  });

  it('says so in the message and holds both numbers when a stored number differs', async () => {
    const result = await load(await fileText((f) => { f.results.measures.detection_rate.value = 0.123; }));
    expect(result.outcome).toBe('loaded');
    expect(result.message).toMatch(/recomputed from this file differ/);
    expect(result.message).toContain('results.measures.detection_rate.value was 0.123 in the file');
    const found = recomputeDifferences(result.state);
    expect(found.find((d) => d.what === 'results.measures.detection_rate.value')?.stored).toBe('0.123');
  });

  it('shows the recomputed numbers: the state holds the file’s data, not its stored results', async () => {
    const result = await load(await fileText((f) => { f.results.counters.cases_decided = 99; }));
    expect(result.state.evaluation.replies).toEqual(sampleEvaluation().replies);
  });

  it('the difference belongs to the loaded work: any change drops it', async () => {
    const result = await load(await fileText((f) => { f.results.measures.detection_rate.value = 0.123; }));
    expect(recomputeDifferences(result.state)).not.toEqual([]);
    expect(recomputeDifferences(edit(result.state, (e) => ({ ...e, model_note: 'changed' })))).toEqual([]);
  });

  it('is carried into the report of the loaded work, and not into a report after a change', async () => {
    const result = await load(await fileText((f) => { f.results.measures.detection_rate.value = 0.123; }));
    const html = (await exportReport(result.state, env, accuracyMetric)).html;
    expect(html).toContain('The numbers recomputed from this file differ');
    expect(html).toContain('stored 0.123');
    const changed = edit(result.state, (e) => ({ ...e, model_note: 'changed' }));
    expect((await exportReport(changed, env, accuracyMetric)).html).not.toContain('recomputed from this file');
  });
});
