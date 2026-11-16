// A key that comes from data may be `__proto__` (S1, Constitution IX, T406). The JSON reader keeps it as an own key, and every
// record of a file schema must keep it too: Zod drops it from a record without a word, so a reply stored under the case id
// `__proto__` was lost and the case showed "Not run".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTestProject, writeTestProject } from '../../../../src/core/io/test-project-file';
import { readMetric } from '../../../../src/core/io/metric-file';
import { ownValue, repliesOf, decisionsOf } from '../../../../src/core/cases/test-run';
import { reviewEvaluation } from '../../../../src/core/evaluation/results';
import { caseDecisionsSchema, metricRefSchema } from '../../../../src/core/schemas/test-project';
import { testCaseSchema } from '../../../../src/core/schemas/test-case';
import { accuracyMetric } from '../../../helpers/fixtures';
import { z } from 'zod';
import { safeParseOwnKeys } from '../../../../src/core/schemas/own-record';
import { readTestCasesJson } from '../../../../src/core/io/test-cases-json';

const demoText = readFileSync('examples/demo/test-project.json', 'utf8');

/** JSON text of an object with an own key `__proto__` (an object literal or `JSON.stringify` of a spread cannot make one). */
function withProtoKey(json: string, value: unknown): string {
  return json.replace(/^\{/, `{"__proto__":${JSON.stringify(value)}${json === '{}' ? '' : ','}`);
}

/** The demo file with one case renamed to `__proto__`, its reply and its decisions moved under that key. */
function demoWithProtoCase(replyOverride?: unknown): string {
  const demo = JSON.parse(demoText);
  const index = demo.dataset.cases.findIndex((c: { id: string }) => Object.hasOwn(demo.test_run.replies, c.id));
  const old = demo.dataset.cases[index].id as string;
  const reply = replyOverride ?? demo.test_run.replies[old];
  // the demo holds no decisions; this case gets one of its own
  const decision = { expected: {}, additional: {}, added_findings: [], approved: false, note: 'kept' };
  delete demo.test_run.replies[old];
  demo.dataset.cases[index].id = 'PROTO-ID';
  const replies = withProtoKey(JSON.stringify(demo.test_run.replies), reply);
  const decisions = withProtoKey(JSON.stringify(demo.test_run.decisions), decision);
  demo.test_run.replies = 'REPLIES';
  demo.test_run.decisions = 'DECISIONS';
  return JSON.stringify(demo).replace('"REPLIES"', replies).replace('"DECISIONS"', decisions).replace('"PROTO-ID"', '"__proto__"');
}

describe('a test project whose case id is __proto__ (T406)', () => {
  it('keeps the reply and the decisions of that case as own keys, so the case is not "Not run"', () => {
    const read = readTestProject(demoWithProtoCase());
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    const project = read.value.project;
    const replies = project.testRun!.replies;
    expect(Object.hasOwn(replies, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(replies)).toBe(Object.prototype);
    expect(ownValue(repliesOf(project), '__proto__')?.reply.length).toBeGreaterThan(0);
    expect(ownValue(decisionsOf(project), '__proto__')).toBeDefined();
    const reviewed = reviewEvaluation(project, accuracyMetric).find((r) => r.testCase.id === '__proto__');
    expect(reviewed?.status).not.toBe('not_run');
  });

  it('writes the reply under __proto__ again, so the file loads the same a second time', () => {
    const read = readTestProject(demoWithProtoCase());
    if (!read.ok) throw new Error('not read');
    const text = writeTestProject(read.value.project, null, { now: '2026-01-01T00:00:00.000Z', toolVersion: 'test', judgeVersion: 'j', testCasesVersion: 'c' });
    const again = readTestProject(text);
    if (!again.ok) throw new Error(again.problems.map((p) => p.message).join('; '));
    expect(ownValue(repliesOf(again.value.project), '__proto__')).toBeDefined();
    expect(ownValue(repliesOf(again.value.project), '__proto__')).toEqual(ownValue(repliesOf(read.value.project), '__proto__'));
  });

  it('a wrong value under __proto__ is refused, and the message names __proto__', () => {
    const read = readTestProject(demoWithProtoCase({ prompt: 'p', reply: '' }));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    const message = read.problems.map((p) => `${p.path ?? ''} ${p.message}`).join('\n');
    expect(message).toContain('__proto__');
    expect(message).not.toContain('\u0000');
  });
});

describe('every record of a file schema keeps a key __proto__ as its own when checked with safeParseOwnKeys (T406)', () => {
  const decision = { state: 'found', source: 'manual' };
  function own<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
    const parsed = safeParseOwnKeys(schema, input);
    if (!parsed.success) throw new Error(parsed.error.message);
    return parsed.data;
  }
  const cases: Array<[string, () => Record<string, unknown>]> = [
    ['decisions.expected', () => own(caseDecisionsSchema, JSON.parse(`{"expected":${withProtoKey('{}', decision)}}`)).expected],
    ['decisions.additional', () => own(caseDecisionsSchema, JSON.parse(`{"additional":${withProtoKey('{}', { state: 'ignored', source: 'manual' })}}`)).additional],
    ['metric.parameters', () => own(metricRefSchema, JSON.parse(`{"id":"accuracy","parameters":${withProtoKey('{}', 0.5)}}`)).parameters],
    ['test case fields', () => own(testCaseSchema, JSON.parse(`{"id":"1","name":"n","fields":${withProtoKey('{"summary":"s"}', 'text')},"expected_errors":[]}`)).fields],
  ];
  it.each(cases)('%s', (_name, read) => {
    const record = read();
    expect(Object.hasOwn(record, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
  });

  it('a test cases file keeps a field named __proto__ of a case', () => {
    const text = readFileSync('examples/files/test-cases-example.json', 'utf8').replace('"fields": {', '"fields": {"__proto__": "extra", ').replace('"fields":{', '"fields":{"__proto__":"extra",');
    expect(text).toContain('"__proto__"');
    const read = readTestCasesJson(text);
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(Object.hasOwn(read.value.drafts[0]!.draft.fields, '__proto__')).toBe(true);
  });

  it('the parse leaves a tree with no key __proto__ as it is', () => {
    const input = { a: [{ b: 1 }], c: 'x' };
    const parsed = safeParseOwnKeys(z.object({ a: z.array(z.object({ b: z.number() })), c: z.string() }), input);
    expect(parsed.success && parsed.data).toEqual(input);
  });

  it('a metric file keeps a parameter and a field of a clean case named __proto__', () => {
    const file = JSON.parse(readFileSync('examples/metrics/bias-example.json', 'utf8'));
    const text = JSON.stringify(file)
      .replace('"parameters":{', '"parameters":{"__proto__":{"default":0.5,"description":""},')
      .replace('"fields":{', '"fields":{"__proto__":"extra",');
    const read = readMetric(text);
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(Object.hasOwn(read.value.parameters, '__proto__')).toBe(true);
    expect(Object.hasOwn(read.value.judge_set.clean_base_cases?.[0]?.fields ?? {}, '__proto__')).toBe(true);
  });
});
