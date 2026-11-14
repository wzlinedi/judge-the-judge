// The catalog actions and the loading of a metric definition (FR-015, FR-024, Principle VI).
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { addCategoriesFromText, removeCategory, renameCategoryAction, setCategoryDetails } from '../../../src/app/actions/catalog';
import { loadMetricDefinition } from '../../../src/app/actions/judge';
import { listExamples } from '../../../src/core/metrics/registry';
import { metricFor, resetRegistry, sessionRegistry } from '../../../src/app/metrics';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const open = (finalized = false): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized, version: 'stale' }, replies: finalized ? e.replies : {}, decisions: {} } };
};

describe('catalog actions', () => {
  it('adds categories from a typed list and reports what was skipped', () => {
    const r = addCategoriesFromText(open(), 'Brand New - a description\nfactual-error\n');
    expect(r.state.evaluation.judge_set.error_catalog.find((c) => c.name === 'brand-new')?.description).toBe('a description');
    expect(r.note).toMatch(/brand-new/);
    expect(r.note).toMatch(/already.*factual-error/i);
    expect(r.state.unsaved).toBe(true);
  });

  it('says so when nothing was added', () => {
    const state = open();
    const r = addCategoriesFromText(state, '   ');
    expect(r.state).toBe(state);
    expect(r.note).toBeDefined();
  });

  it('edits the description and example of a category', () => {
    const r = setCategoryDetails(open(), 'wrong-number', { description: 'new d', example: 'new e' });
    expect(r.state.evaluation.judge_set.error_catalog.find((c) => c.name === 'wrong-number')).toMatchObject({ description: 'new d', example: 'new e' });
  });

  it('renames in the catalog and every expected error, drops the stale version, and refuses a taken name', () => {
    const r = renameCategoryAction(open(), 'factual-error', 'Wrong Fact');
    expect(r.state.evaluation.dataset.cases[1]?.expected_errors[0]?.category).toBe('wrong-fact');
    expect(r.state.evaluation.dataset.version).toBeUndefined();
    const taken = renameCategoryAction(open(), 'factual-error', 'wrong-number');
    expect(taken.note).toMatch(/already/);
    expect(taken.state.evaluation.judge_set.error_catalog.map((c) => c.name)).toContain('factual-error');
  });

  it('allows a rename after finalizing, when the cases have replies', () => {
    const r = renameCategoryAction(open(true), 'factual-error', 'renamed');
    expect(r.state.evaluation.dataset.cases[1]?.expected_errors[0]?.category).toBe('renamed');
  });

  it('removes an unused category at once and refuses a used one with the reason', () => {
    const ok = removeCategory(open(), 'misattribution');
    expect(ok.state.evaluation.judge_set.error_catalog.some((c) => c.name === 'misattribution')).toBe(false);
    const used = removeCategory(open(), 'factual-error');
    expect(used.note).toBe('Used by 1 test case. Remove that test case first, or rename the category.');
    expect(used.state.evaluation.judge_set.error_catalog.some((c) => c.name === 'factual-error')).toBe(true);
  });
});

describe('loadMetricDefinition', () => {
  afterEach(() => resetRegistry());
  const bias = readFileSync('examples/metrics/bias-example.json', 'utf8');
  const withFile = (text: string) => {
    const ports = createFakePorts();
    ports.opener.next = { name: 'bias.json', text };
    return ports;
  };

  it('registers the definition so that it is offered as an example and used by metricFor', async () => {
    const r = await loadMetricDefinition(withFile(bias));
    expect(r.outcome).toBe('loaded');
    expect(listExamples(sessionRegistry()).map((m) => m.id)).toEqual(['accuracy', 'completeness', 'bias']);
    expect(metricFor('bias').name).toBe('Bias');
  });

  it('refuses an invalid file with the problems and registers nothing', async () => {
    const r = await loadMetricDefinition(withFile('{ "format": '));
    expect(r.outcome).toBe('invalid');
    expect(listExamples(sessionRegistry())).toHaveLength(2);
  });

  it('is cancelled when no file is chosen', async () => {
    expect((await loadMetricDefinition(createFakePorts())).outcome).toBe('cancelled');
  });

  it('asks before replacing a definition loaded earlier, and never replaces a built-in', async () => {
    await loadMetricDefinition(withFile(bias));
    const again = await loadMetricDefinition(withFile(bias));
    expect(again.outcome).toBe('exists');
    const replaced = await loadMetricDefinition(withFile(bias), { replace: true });
    expect(replaced.outcome).toBe('loaded');
    const builtIn = JSON.parse(bias);
    builtIn.id = 'accuracy';
    const refused = await loadMetricDefinition(withFile(JSON.stringify(builtIn)), { replace: true });
    expect(refused.outcome).toBe('invalid');
  });
});
