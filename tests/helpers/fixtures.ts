import accuracy from '../../src/core/metrics/builtin/accuracy.json';
import checksDefault from '../../src/core/metrics/builtin/checks.default.json';
import type { JudgeSet, TestCase, TestProject, TestRun } from '../../src/core/model';
import { withoutTestRun } from '../../src/core/cases/test-run';
import type { Ports } from '../../src/app/ports/types';
import { DEFAULT_CHECKS, forgetFile, type AppState } from '../../src/app/store';
import type { MetricDefinition } from '../../src/core/metrics/types';

export const accuracyMetric = accuracy as unknown as MetricDefinition;

export function accuracyJudgeSet(): JudgeSet {
  const { clean_base_cases: _unused, ...rest } = accuracyMetric.judge_set;
  return structuredClone(rest);
}

const reply = (claims: Array<[string, string]>) => JSON.stringify({ claims: claims.map(([text, verdict]) => ({ text, verdict, reason: 'because' })) });

/** A small started test project: one clean case, one case with two injected errors, both with replies. */
export function sampleProject(): TestProject {
  return {
    judge_set: accuracyJudgeSet(),
    dataset: {
      name: 'Book summaries',
      cases: [
        { id: '1', name: 'Anna', fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a baker. She bought a second oven in 1998.' }, expected_errors: [] },
        {
          id: '2',
          name: 'Anna + 2 errors',
          base: '1',
          changed_after_first_reply: 'added',
          fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a doctor. She bought a second oven in 2005.' },
          expected_errors: [
            { id: 'e1', description: 'Profession changed.', category: 'factual-error', fragment: 'Anna is a doctor', difficulty: 'obvious' },
            { id: 'e2', description: 'Year changed.', category: 'wrong-number', fragment: 'second oven in 2005', difficulty: 'subtle' },
          ],
        },
      ],
    },
    metric: { id: 'accuracy', parameters: { match_clear_share: 0.5, match_partial_share: 0.3, match_min_word_length: 4 } },
    checks: structuredClone({ rules: checksDefault.rules }) as TestProject['checks'],
    testRun: {
      model_note: 'model X\ntemperature 0',
      replies: {
        '1': { prompt: 'p1', reply: reply([['Anna is a baker.', 'supported']]) },
        '2': { prompt: 'p2', reply: '```json\n' + reply([['Anna is a doctor.', 'contradicted'], ['She bought a second oven in 2005.', 'unsupported']]) + '\n```' },
      },
      decisions: {
        '2': {
          expected: {},
          additional: {},
          added_findings: [
            { text: 'The oven was never bought', category: 'factual-error', difficulty: 'obvious', state: 'real_error', source: 'manual' },
            { text: 'Something the LLM saw', from_opinion: true, state: 'false_positive', source: 'llm-approved' },
          ],
          approved: true,
          note: 'checked by hand',
        },
      },
      reply_judge_version: 'aaaaaaaaaaaa',
    },
  };
}

/** The same project with some parts of its test run replaced; a project that has not started gets an empty test run first. */
export function withRun(project: TestProject, over: Partial<TestRun>): TestProject {
  return { ...project, testRun: { replies: {}, decisions: {}, model_note: '', ...project.testRun, ...over } };
}

/** The same project with the test run not started: the test project as "Load the test project only" gives it. */
export function notStartedProject(): TestProject {
  return withoutTestRun(sampleProject());
}

import biasVerdict from '../../examples/metrics/bias-verdict-example.json';
export const biasVerdictMetric = biasVerdict as unknown as MetricDefinition;

const verdict = (biased: boolean) => JSON.stringify({ biased, kind: biased ? 'gender-bias' : '', reason: 'because' });
const textCase = (id: string, name: string, errors: TestProject['dataset']['cases'][number]['expected_errors'] = []) => ({ id, name, fields: { text: `Text of case ${id}.` }, expected_errors: errors });

/**
 * A judge that gives one verdict for the whole text, so it is evaluated per case: two cases with errors (one flagged, one not),
 * a case whose only error is ignored, and four clean cases (not flagged, flagged and awaiting, flagged and a false positive, not flagged).
 */
export function verdictProject(): TestProject {
  const { clean_base_cases: _unused, ...set } = biasVerdictMetric.judge_set;
  const judge_set: JudgeSet = structuredClone(set);
  const cases = [
    textCase('1', 'Sexist advert', [
      { id: 'e1', description: 'Gender bias.', category: 'gender-bias', fragment: 'Text of case 1', difficulty: 'obvious' },
      { id: 'e2', description: 'A stereotype, no fragment.', category: 'stereotype', difficulty: 'subtle' },
    ]),
    textCase('2', 'Age advert', [{ id: 'e1', description: 'Age bias.', category: 'age-bias', fragment: 'Text of case 2', difficulty: 'obvious' }]),
    textCase('3', 'Clean, not flagged'),
    textCase('4', 'Clean, flagged'),
    textCase('5', 'Clean, flagged, false positive'),
    textCase('6', 'Only an ignored error', [{ id: 'e1', description: 'Doubtful.', category: 'stereotype', fragment: 'Text of case 6', difficulty: 'obvious' }]),
    textCase('7', 'Clean, not flagged too'),
  ];
  const replies = Object.fromEntries(
    [['1', true], ['2', false], ['3', false], ['4', true], ['5', true], ['6', false], ['7', false]].map(([id, biased]) => [id as string, { prompt: `p${id}`, reply: verdict(biased as boolean) }]),
  );
  return {
    judge_set,
    dataset: { name: 'Bias texts', cases },
    metric: { id: biasVerdictMetric.id, parameters: {} },
    checks: structuredClone({ rules: checksDefault.rules }) as TestProject['checks'],
    testRun: {
      model_note: '',
      replies,
      decisions: {
        '5': { expected: {}, additional: { reply: { state: 'false_positive', source: 'manual' } }, added_findings: [], approved: false, note: '' },
        '6': { expected: { e1: { state: 'ignored', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' },
      },
      reply_judge_version: 'aaaaaaaaaaaa',
    },
  };
}

/** A fixture for tests: a new test project from a metric's judge, catalog and clean cases (the app no longer offers this, T243). */
export function startFromMetric(state: AppState, metric: MetricDefinition, ports: Ports): AppState {
  forgetFile(ports);
  const { clean_base_cases, ...judgeSet } = structuredClone(metric.judge_set);
  const cases: TestCase[] = clean_base_cases.map((c, i) => ({ id: String(i + 1), name: c.name, fields: c.fields, expected_errors: [] }));
  const evaluation: TestProject = {
    judge_set: judgeSet,
    dataset: { name: 'Untitled test cases', cases },
    metric: { id: metric.id, parameters: Object.fromEntries(Object.entries(metric.parameters).map(([k, v]) => [k, v.default])) },
    checks: structuredClone(DEFAULT_CHECKS),
  };
  return { ...state, project: evaluation, step: 'judge', unsaved: false, repliesSinceSave: 0, testProjectFile: null, hasFile: false, openCase: null };
}

/** The part of a metric definition a test project may carry (T243). */
export function embeddedDefinition(metric: MetricDefinition = biasVerdictMetric) {
  const { name, description, limitations, output_format, parameters, measures } = structuredClone(metric);
  return { name, description, limitations, output_format, parameters, measures };
}
