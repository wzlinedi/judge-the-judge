// The shared suite over every metric definition (metric-and-checks.md, section 4; Principle VI, SC-005).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMetric } from '../../src/core/io/metric-file';
import { composePrompt } from '../../src/core/judge/compose';
import { recognizeFields } from '../../src/core/judge/fields';
import { findFindings } from '../../src/core/judge/findings';
import { countingMode } from '../../src/core/judge/counting-mode';
import { validateRules } from '../../src/core/judge/rules';
import { findVariables } from '../../src/core/judge/variables';
import { emptyCounters } from '../../src/core/evaluation/counters';
import { COUNTER_NAMES, evaluateMeasure } from '../../src/core/metrics/operations';
import { createRegistry, findMetric, register } from '../../src/core/metrics/registry';
import type { MeasureValue, MetricDefinition } from '../../src/core/metrics/types';

const FILES = [
  'src/core/metrics/builtin/accuracy.json',
  'src/core/metrics/builtin/completeness.json',
  'examples/metrics/bias-example.json',
  'examples/metrics/bias-verdict-example.json',
];
const text = (file: string) => readFileSync(file, 'utf8');
const load = (file: string): MetricDefinition => {
  const r = readMetric(text(file));
  if (!r.ok) throw new Error(`${file}: ${r.problems.map((p) => `${p.path ?? ''} ${p.message}`).join('; ')}`);
  return r.value;
};

describe.each(FILES)('%s', (file) => {
  const metric = load(file);
  const set = metric.judge_set;
  const variables = findVariables(set.prompt);

  it('is schema-valid with the two required measures and unique ids', () => {
    const ids = metric.measures.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['detection_rate', 'false_positive_rate']));
    expect(metric.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('uses only the operations ratio and complement and known counters', () => {
    for (const m of metric.measures) {
      expect(['ratio', 'complement']).toContain(m.operation);
      if (m.operation === 'ratio') {
        expect(COUNTER_NAMES).toContain(m.numerator);
        expect(COUNTER_NAMES).toContain(m.denominator);
      }
    }
    expect(COUNTER_NAMES).toEqual(expect.arrayContaining(['defective_cases_decided', 'defective_cases_flagged']));
  });

  it('has a judged text that is a variable of the prompt', () => {
    expect(variables).toContain(set.judged_text);
  });

  it('computes every measure on a fixed set of counters', () => {
    const counters = { ...emptyCounters(), expected_total: 10, expected_found: 8, findings_total: 10, false_positives: 1, defective_cases_decided: 5, defective_cases_flagged: 4, clean_cases_decided: 5, clean_cases_with_false_positive: 1 };
    const computed: Record<string, MeasureValue> = {};
    for (const m of metric.measures) {
      computed[m.id] = evaluateMeasure(m, counters, computed);
      expect(computed[m.id]?.value).not.toBeNull();
    }
    expect(computed['detection_rate']?.value).toBeCloseTo(0.8);
  });

  it('has clean base cases that are complete, have no expected errors and compose with the prompt', () => {
    expect(set.clean_base_cases.length).toBeGreaterThanOrEqual(3);
    for (const c of set.clean_base_cases) {
      expect(Object.keys(c.fields).sort()).toEqual([...variables].sort());
      expect(c.expected_errors).toEqual([]);
      expect(composePrompt(set.prompt, c).missing).toEqual([]);
    }
  });

  it('has rules that use only fields of the sample reply and give a finding on it', () => {
    const recognized = recognizeFields(set.sample_reply ?? '');
    if (!recognized.ok) throw new Error('sample unreadable');
    expect(validateRules(set.error_rules, recognized).every((v) => v.usable)).toBe(true);
    const found = findFindings(set.sample_reply ?? '', set.error_rules, set.reply_mapping.finding_text, recognized);
    expect(found.readable && found.findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('the examples', () => {
  it('bias-example has one variable and is evaluated per expected error', () => {
    const m = load('examples/metrics/bias-example.json');
    expect(findVariables(m.judge_set.prompt)).toEqual(['text']);
    expect(countingMode(m.judge_set.error_rules)).toBe('per_expected_error');
  });

  it('bias-verdict-example is evaluated per case and may list the case-level measures', () => {
    const m = load('examples/metrics/bias-verdict-example.json');
    expect(findVariables(m.judge_set.prompt)).toEqual(['text']);
    expect(countingMode(m.judge_set.error_rules)).toBe('per_case');
    expect(m.measures.map((x) => x.id)).toEqual(expect.arrayContaining(['case_detection_rate', 'clean_case_false_positive_rate']));
  });
});

describe('an invalid definition', () => {
  const good = JSON.parse(text('examples/metrics/bias-example.json'));
  const bad = (change: (m: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const copy = structuredClone(good);
    change(copy);
    return readMetric(JSON.stringify(copy));
  };
  const messages = (r: ReturnType<typeof readMetric>) => (r.ok ? '' : r.problems.map((p) => `${p.path ?? ''} ${p.message}`).join(' | '));

  it('is refused with a plain message, for each rule of the contract', () => {
    expect(messages(bad((m) => (m['measures'][0].operation = 'harmonic_mean')))).toMatch(/operation/);
    expect(messages(bad((m) => (m['measures'][0].numerator = 'secret_counter')))).toMatch(/secret_counter/);
    expect(messages(bad((m) => m['measures'].push({ ...m['measures'][0] })))).toMatch(/unique|twice|duplicate/i);
    expect(messages(bad((m) => (m['measures'] = m['measures'].slice(1))))).toMatch(/detection_rate/);
    expect(messages(bad((m) => m['measures'].push({ id: 'x', name: 'X', description: '', operation: 'complement', of: 'nope', better: 'higher' })))).toMatch(/nope/);
    expect(messages(bad((m) => (m['judge_set'].judged_text = 'nothing')))).toMatch(/judged_text/);
    expect(messages(bad((m) => (m['judge_set'].error_rules[0].conditions[0].field = 'ghost')))).toMatch(/ghost/);
    expect(messages(bad((m) => (m['judge_set'].clean_base_cases[0].fields = {})))).toMatch(/text/);
    expect(messages(bad((m) => (m['judge_set'].clean_base_cases[0].expected_errors = [{ description: 'x' }])))).toMatch(/expected_errors/);
    expect(messages(bad((m) => (m['id'] = 'Not Valid')))).toMatch(/id/);
    expect(messages(bad((m) => (m['format'] = 'other')))).toMatch(/format/);
  });

  it('leaves the registry unchanged and cannot replace a built-in', () => {
    const accuracy = load('src/core/metrics/builtin/accuracy.json');
    const registry = createRegistry([accuracy]);
    expect(readMetric('{ nope').ok).toBe(false);
    expect(registry.metrics).toHaveLength(1);
    expect(register(registry, { ...accuracy, name: 'Changed' }, { replace: true }).ok).toBe(false);
    expect(findMetric(registry, 'accuracy')?.name).toBe('Accuracy');
  });

  it('replaces a loaded definition only when asked', () => {
    const accuracy = load('src/core/metrics/builtin/accuracy.json');
    const bias = load('examples/metrics/bias-example.json');
    const once = register(createRegistry([accuracy]), bias);
    if (!once.ok) throw new Error('not registered');
    const again = register(once.registry, { ...bias, name: 'Bias v2' });
    expect(again).toMatchObject({ ok: false, canReplace: true });
    const replaced = register(once.registry, { ...bias, name: 'Bias v2' }, { replace: true });
    expect(replaced.ok && findMetric(replaced.registry, 'bias')?.name).toBe('Bias v2');
    expect(replaced.ok && replaced.registry.metrics).toHaveLength(2);
  });
});
