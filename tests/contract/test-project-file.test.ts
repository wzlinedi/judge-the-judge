// contracts/file-formats.md, sections 1 and 5: the test project file with its optional test run (FR-020, FR-073, SC-013, T289).
import { describe, expect, it } from 'vitest';
import { withoutTestRun } from '../../src/core/cases/test-run';
import { testCasesVersion } from '../../src/core/cases/version';
import { computeResults } from '../../src/core/evaluation/results';
import { readTestProject, writeTestProject, type TestProjectMeta } from '../../src/core/io/test-project-file';
import { judgeVersion } from '../../src/core/judge/version';
import type { TestProject } from '../../src/core/model';
import { accuracyMetric, embeddedDefinition, sampleProject } from '../helpers/fixtures';

const NOW = '2026-11-13T10:15:00Z';

async function metaFor(project: TestProject): Promise<TestProjectMeta> {
  return { now: NOW, toolVersion: '1.0.0', judgeVersion: await judgeVersion(project.judge_set), testCasesVersion: await testCasesVersion(project.dataset.cases) };
}

async function written(project: TestProject = sampleProject()) {
  const meta = await metaFor(project);
  const results = project.testRun ? computeResults(project, accuracyMetric) : null;
  return { project, meta, results, text: writeTestProject(project, results, meta) };
}

const sample = await written();
const notStarted = await written(withoutTestRun(sampleProject()));
// The tests edit a parsed file freely, so its shape is deliberately loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsed = (text: string = sample.text) => JSON.parse(text) as Record<string, any>;
const read = (value: unknown, isMetricLoaded?: (id: string) => boolean) => readTestProject(typeof value === 'string' ? value : JSON.stringify(value), isMetricLoaded);
const ok = (value: unknown) => {
  const result = read(value);
  if (!result.ok) throw new Error(result.problems.map((p) => p.message).join('; '));
  return result;
};

describe('writeTestProject: the test project part', () => {
  it('writes format, schema version 2, judge set, test cases, metric and checks, and no "finalized" key', () => {
    const file = parsed();
    expect(file['format']).toBe('judge-the-judge-test-project');
    expect(file['schema_version']).toBe(2);
    expect(file['tool_version']).toBe('1.0.0');
    expect(file['judge_set'].prompt).toBe(sample.project.judge_set.prompt);
    expect(file['judge_set'].judged_text).toBe('summary');
    expect(file['judge_set'].error_catalog.length).toBeGreaterThan(0);
    expect(file['dataset']).toMatchObject({ name: 'Book summaries', version: sample.meta.testCasesVersion });
    expect(file['dataset']).not.toHaveProperty('finalized');
    expect(file['dataset'].cases).toHaveLength(2);
    expect(file['dataset'].cases[1]).toMatchObject({ id: '2', base: '1', changed_after_first_reply: 'added' });
    expect(file['metric']).toEqual({ id: 'accuracy', parameters: { match_clear_share: 0.5, match_partial_share: 0.3, match_min_word_length: 4 } });
    expect(file['checks'].rules).toHaveLength(4);
  });

  it('writes no test run for a test project that has not started, and no top-level replies, decisions or results', () => {
    const file = parsed(notStarted.text);
    expect(file).not.toHaveProperty('test_run');
    for (const key of ['replies', 'decisions', 'results', 'model_note', 'minimum_sample', 'reply_judge_version', 'saved']) expect(file).not.toHaveProperty(key);
    expect(notStarted.text).not.toContain('checked by hand');
    expect(notStarted.text).not.toContain('temperature 0');
  });
});

describe('the test_run section (section 5)', () => {
  it('holds everything needed to continue, reproduce and audit', () => {
    const run = parsed()['test_run'];
    expect(run.saved).toBe(NOW);
    expect(run.judge_version).toBe(sample.meta.judgeVersion);
    expect(run.reply_judge_version).toBe('aaaaaaaaaaaa');
    expect(run.rules_corrected_after_replies).toBe(true);
    expect(run.model_note).toBe('model X\ntemperature 0');
    expect(Object.keys(run.replies)).toEqual(['1', '2']);
    expect(run.decisions['2'].added_findings[0]).toMatchObject({ category: 'factual-error', difficulty: 'obvious' });
    expect(run.decisions['2'].added_findings[1]).toMatchObject({ from_opinion: true });
    expect(run.minimum_sample).toEqual({ expected_errors: 30, clean_cases: 10 });
    expect(run.results).toMatchObject({ evaluated_per: 'expected_error', counted_per_before_correction: null });
    expect(run.results.counters.additional_per_category).toBeDefined();
    expect(run.results.counters.additional_per_difficulty).toBeDefined();
    expect(parsed()).not.toHaveProperty('proposals');
  });

  it('(a) round-trips with identical content: read, then write again gives the same text', () => {
    const result = ok(sample.text);
    expect(result.notes).toEqual([]);
    const loaded = result.value.project;
    expect(loaded.testRun?.replies['2']?.reply).toContain('```json');
    expect(loaded.testRun?.reply_judge_version).toBe('aaaaaaaaaaaa');
    expect(loaded.testRun?.model_note).toBe('model X\ntemperature 0');
    const again = writeTestProject(loaded, computeResults(loaded, accuracyMetric), { ...sample.meta, now: result.value.stored?.saved ?? '' });
    expect(again).toBe(sample.text);
  });

  it('(b) writes an empty test run for a started test run with no replies, and reads it back as started', async () => {
    const empty: TestProject = { ...sampleProject(), testRun: { model_note: '', replies: {}, decisions: {} } };
    const { text } = await written(empty);
    const run = parsed(text)['test_run'];
    expect(run).toMatchObject({ saved: NOW, model_note: '', replies: {}, decisions: {}, results: {} });
    const result = ok(text);
    expect(result.value.hasTestRun).toBe(true);
    expect(result.value.project.testRun).toEqual({ model_note: '', replies: {}, decisions: {} });
  });

  it('(c) reads a file without a test run as not started', () => {
    const result = ok(notStarted.text);
    expect(result.value.project.testRun).toBeUndefined();
    expect(result.value.stored).toBeUndefined();
  });

  it('(d) says whether the file holds a test run', () => {
    expect(ok(sample.text).value.hasTestRun).toBe(true);
    expect(ok(notStarted.text).value.hasTestRun).toBe(false);
  });

  it('keeps the way of counting of the first reply, so a switch after a correction can be named (FR-075)', async () => {
    const project = sampleProject();
    const counted: TestProject = { ...project, testRun: { ...project.testRun!, reply_counted_per: 'case' } };
    const { text } = await written(counted);
    expect(parsed(text)['test_run'].reply_counted_per).toBe('case');
    expect(ok(text).value.project.testRun?.reply_counted_per).toBe('case');
    expect(parsed()['test_run']).not.toHaveProperty('reply_counted_per');
  });

  it('restores the stored matching parameters, so recomputing gives the same numbers', () => {
    const loaded = ok(sample.text).value.project;
    expect(loaded.metric.parameters['match_clear_share']).toBe(0.5);
    expect(computeResults(loaded, accuracyMetric).counters).toEqual(sample.results?.counters);
  });

  it('leaves results empty until something is decided', async () => {
    const project = sampleProject();
    const { text } = await written({ ...project, testRun: { ...project.testRun!, replies: {}, decisions: {} } });
    expect(parsed(text)['test_run'].results).toEqual({});
  });

  it('(f) refuses an invalid test run with the field path and changes nothing', () => {
    const file = parsed();
    file['test_run'].replies['2'].reply = '';
    const result = read(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.path)).toContain('test_run.replies.2.reply');
    const wrongType = parsed();
    wrongType['test_run'].decisions['2'].expected = { e1: { state: 'lost', source: 'manual' } };
    const second = read(wrongType);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.problems[0]?.path).toMatch(/^test_run\.decisions\.2\.expected\.e1/);
  });

  it('ignores an old "proposals" key and says so', () => {
    const file = parsed();
    file['proposals'] = { '2': {} };
    const result = ok(file);
    expect(result.notes.join(' ')).toMatch(/proposals/);
  });

  it('loads a file saved when a real-error mark kept a link to an expected error (T253, undone by T259) and drops the link', () => {
    const file = parsed();
    file['test_run'].decisions['2'].added_findings[0].promoted_to = 'e9';
    file['test_run'].decisions['2'].additional = { 'x#1': { state: 'real_error', source: 'manual', promoted_to: 'e8' } };
    const decisions = ok(file).value.project.testRun?.decisions['2'];
    expect(decisions?.added_findings[0]).not.toHaveProperty('promoted_to');
    expect(decisions?.additional['x#1']).toEqual({ state: 'real_error', source: 'manual' });
  });
});

describe('readTestProject', () => {
  it('restores the metric with its parameters and the check rules', () => {
    const loaded = ok(sample.text).value.project;
    expect(loaded.metric).toEqual(sample.project.metric);
    expect(loaded.checks).toEqual(sample.project.checks);
  });

  it('(e) loads a version 1 file with a note: its finalized flag is dropped and the test run is not started', () => {
    const file = parsed(notStarted.text);
    file['schema_version'] = 1;
    file['dataset'].finalized = true;
    const result = ok(file);
    expect(result.value.project.testRun).toBeUndefined();
    expect(result.value.hasTestRun).toBe(false);
    expect(result.notes.join(' ')).toMatch(/version 1/i);
    expect(result.value.project.dataset).not.toHaveProperty('finalized');
    expect(JSON.parse(writeTestProject(result.value.project, null, notStarted.meta))['schema_version']).toBe(2);
  });

  it('does not upgrade a version 2 file with a note', () => {
    expect(ok(notStarted.text).notes).toEqual([]);
  });

  it('(g) refuses an evaluation file as an unknown format and names the format it reads', () => {
    const result = read({ format: 'judge-the-judge-evaluation', schema_version: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]?.path).toBe('format');
    expect(result.problems[0]?.message).toContain('judge-the-judge-evaluation');
    expect(result.problems[0]?.message).toContain('judge-the-judge-test-project');
    expect(result.problems[0]?.message).not.toMatch(/Load evaluation/);
  });

  it('keeps the source_fragment of an expected error through a save and a load; a file without one is unchanged (T250)', async () => {
    const project = withoutTestRun(sampleProject());
    const cases = project.dataset.cases.map((c, i) => (i === 1 ? { ...c, expected_errors: c.expected_errors.map((x, n) => (n === 0 ? { ...x, source_fragment: 'Anna is a baker' } : x)) } : c));
    const withFragment = { ...project, dataset: { ...project.dataset, cases } };
    const file = JSON.parse(writeTestProject(withFragment, null, notStarted.meta));
    expect(file.dataset.cases[1].expected_errors[0].source_fragment).toBe('Anna is a baker');
    expect(file.dataset.cases[1].expected_errors[1]).not.toHaveProperty('source_fragment');
    expect(ok(file).value.project.dataset.cases[1]?.expected_errors[0]?.source_fragment).toBe('Anna is a baker');
    expect(notStarted.text).not.toContain('source_fragment');
    expect(await testCasesVersion(cases)).not.toBe(await testCasesVersion(project.dataset.cases));
    expect(await testCasesVersion(ok(notStarted.text).value.project.dataset.cases)).toBe(await testCasesVersion(project.dataset.cases));
  });

  it('gives the cases their identifiers and every expected error one', () => {
    const file = parsed();
    delete file['dataset'].cases[1].expected_errors[0].id;
    const cases = ok(file).value.project.dataset.cases;
    expect(cases.map((c) => c.id)).toEqual(['1', '2']);
    expect(cases[1]?.expected_errors.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('never writes a minimum_sample in the checks, and tells the user it is fixed when a file has one', () => {
    const file = parsed();
    file['checks'].minimum_sample = { expected_errors: 5, clean_cases: 1 };
    const result = ok(file);
    expect(result.notes.join(' ')).toMatch(/minimum test size.*fixed/i);
    expect(writeTestProject(result.value.project, null, sample.meta)).not.toMatch(/"checks"[^}]*minimum_sample/);
  });

  it('falls back to the last variable when judged_text is absent or unknown, and says so', () => {
    for (const judged of [undefined, 'nonexistent']) {
      const file = parsed();
      if (judged === undefined) delete file['judge_set'].judged_text;
      else file['judge_set'].judged_text = judged;
      const result = ok(file);
      expect(result.value.project.judge_set.judged_text).toBe('summary');
      expect(result.notes.join(' ')).toContain('summary');
    }
  });

  it('loads a rule on a field the sample reply does not contain as broken and reports it', () => {
    const file = parsed();
    file['judge_set'].error_rules.push({ name: 'Ghost rule', match: 'all', conditions: [{ field: 'ghost.field', comparison: 'equals', value: 'x' }] });
    const result = ok(file);
    expect(result.value.project.judge_set.error_rules.map((r) => r.name)).toContain('Ghost rule');
    expect(result.notes.join(' ')).toContain('ghost.field');
  });

  it('keeps the stored parameters of a metric that is not loaded and tells the user', () => {
    const file = parsed();
    file['metric'] = { id: 'bias', parameters: { match_clear_share: 0.7 } };
    const result = read(file, (id) => id === 'accuracy');
    if (!result.ok) throw new Error('unreadable');
    expect(result.value.project.metric).toEqual({ id: 'bias', parameters: { match_clear_share: 0.7 } });
    expect(result.notes.join(' ')).toContain('bias');
  });

  it('reports a field on an expected error once and ignores it', () => {
    const file = parsed();
    file['dataset'].cases[1].expected_errors[0].field = 'summary';
    file['dataset'].cases[1].expected_errors[1].field = 'summary';
    expect(ok(file).notes.filter((n) => /field/.test(n))).toHaveLength(1);
  });

  it('rejects invalid files with a plain message and a place', () => {
    const notJson = read('{\n"format": \n}');
    expect(notJson.ok).toBe(false);
    if (!notJson.ok) expect(notJson.problems[0]).toMatchObject({ line: 3, column: 1 });
    expect(read({ format: 'something-else', schema_version: 1 }).ok).toBe(false);
    expect(read({ ...parsed(), schema_version: 99 }).ok).toBe(false);
    const noPrompt = parsed();
    delete noPrompt['judge_set'].prompt;
    noPrompt['dataset'].cases[0].fields = { source_text: 5 };
    const result = read(noPrompt);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.problems.map((p) => p.path);
      expect(paths).toContain('judge_set.prompt');
      expect(paths).toContain('dataset.cases[0].fields.source_text');
    }
  });

  it('refuses more than 500 cases and fields above 100,000 characters', () => {
    const many = parsed();
    many['dataset'].cases = Array.from({ length: 501 }, (_, i) => ({ id: String(i), name: `c${i}`, fields: { summary: 's' }, expected_errors: [] }));
    expect(read(many).ok).toBe(false);
    const long = parsed();
    long['dataset'].cases[0].fields.summary = 'x'.repeat(100001);
    expect(read(long).ok).toBe(false);
  });

  it('reports unknown extra keys once as a note', () => {
    const result = ok({ ...parsed(), extra_key: 1, other_key: 2 });
    expect(result.notes.filter((n) => /extra_key/.test(n))).toHaveLength(1);
  });
});

describe('withoutTestRun (h)', () => {
  it('returns the project with no test run and no changed_after_first_reply mark on any case', () => {
    const project = sampleProject();
    expect(project.dataset.cases[1]?.changed_after_first_reply).toBe('added');
    const dropped = withoutTestRun(project);
    expect(dropped.testRun).toBeUndefined();
    expect(dropped).not.toHaveProperty('testRun');
    for (const testCase of dropped.dataset.cases) expect(testCase).not.toHaveProperty('changed_after_first_reply');
  });

  it('keeps the judge set, the error catalog, the test cases, the metric with its definition and the thresholds', () => {
    const project = sampleProject();
    project.metric = { id: 'bias-verdict', parameters: {}, definition: embeddedDefinition() };
    const dropped = withoutTestRun(project);
    expect(dropped.judge_set).toEqual(project.judge_set);
    expect(dropped.judge_set.error_catalog.length).toBeGreaterThan(0);
    expect(dropped.dataset.cases.map((c) => [c.id, c.name, c.base, c.fields, c.expected_errors])).toEqual(project.dataset.cases.map((c) => [c.id, c.name, c.base, c.fields, c.expected_errors]));
    expect(dropped.dataset.name).toBe(project.dataset.name);
    expect(dropped.metric).toEqual(project.metric);
    expect(dropped.checks).toEqual(project.checks);
  });

  it('does not change the project it is given', () => {
    const project = sampleProject();
    const before = structuredClone(project);
    withoutTestRun(project);
    expect(project).toEqual(before);
  });

  it('gives a file with no test run, so the next save writes none', () => {
    const file = JSON.parse(writeTestProject(withoutTestRun(sampleProject()), null, sample.meta));
    expect(file).not.toHaveProperty('test_run');
    expect(file.dataset.cases[1]).not.toHaveProperty('changed_after_first_reply');
  });
});

describe('a metric definition inside the file (T243, i)', () => {
  const definition = embeddedDefinition();
  const withDefinition = (text: string = notStarted.text) => {
    const file = parsed(text);
    file['metric'] = { id: 'bias-verdict', parameters: {}, definition };
    return file;
  };

  it('is read, kept, and written again unchanged', () => {
    const result = ok(withDefinition());
    expect(result.value.project.metric.definition?.measures.map((m) => m.id)).toContain('case_detection_rate');
    const again = writeTestProject(result.value.project, null, notStarted.meta);
    expect(JSON.parse(again)['metric'].definition).toEqual(definition);
  });

  it('is kept next to a test run', () => {
    const result = ok(withDefinition(sample.text));
    expect(result.value.hasTestRun).toBe(true);
    expect(result.value.project.metric.definition?.name).toBe(definition.name);
  });

  it('says nothing about a metric that is not loaded when the file carries its definition', () => {
    const result = read(withDefinition(), () => false);
    if (!result.ok) throw new Error('not read');
    expect(result.notes.join(' ')).not.toMatch(/not (registered|loaded)/);
  });

  it('refuses a measure with an unknown operation and names where it is', () => {
    const file = withDefinition();
    file['metric'].definition.measures[0].operation = 'median';
    const result = read(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatchObject({ path: 'metric.definition.measures[0].operation' });
  });

  it('refuses a definition without the measures the overall result rests on', () => {
    const file = withDefinition();
    file['metric'].definition.measures = file['metric'].definition.measures.filter((m: { id: string }) => m.id !== 'detection_rate');
    expect(read(file).ok).toBe(false);
  });
});

// R7 (code review 2026-11-16; FR-076, SC-004): two cases with one id, or two expected errors with one id in a case, are refused.
describe('readTestProject: repeated ids', () => {
  const withCases = (cases: unknown[]) => {
    const file = parsed();
    file['dataset'].cases = cases;
    return file;
  };
  const messages = (value: unknown) => {
    const result = read(value);
    return result.ok ? [] : result.problems.map((p) => `${p.path ?? ''} ${p.message}`);
  };

  it('rejects two cases with the id 7 and names the id and the path', () => {
    const [first] = parsed()['dataset'].cases as Array<Record<string, unknown>>;
    const text = messages(withCases([{ ...first, id: '7' }, { ...first, id: '7' }])).join('\n');
    expect(text).toContain('7');
    expect(text).toContain('dataset.cases[');
    expect(text).toContain('.id');
  });

  it('rejects a case with two expected errors with the id e1 and names the id and the path', () => {
    const [first] = parsed()['dataset'].cases as Array<Record<string, unknown>>;
    const error = { description: 'd', id: 'e1' };
    const text = messages(withCases([{ ...first, expected_errors: [error, { ...error }] }])).join('\n');
    expect(text).toContain('e1');
    expect(text).toContain('expected_errors[');
    expect(text).toContain('.id');
  });

  it('still loads a valid file', () => {
    expect(read(parsed()).ok).toBe(true);
  });
});

