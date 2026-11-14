// The Judge step's actions (FR-009 to FR-014, FR-019, FR-021, FR-053, FR-088).
import { describe, expect, it } from 'vitest';
import {
  addCondition, addRule, removeCondition, removeRule, setFindingText, setJudgedText, setPrompt, setSampleReply,
  startFromMetric, updateCondition, updateRule,
} from '../../../src/app/actions/judge';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { metricFor } from '../../../src/app/metrics';
import { sampleEvaluation } from '../../helpers/fixtures';

const SAMPLE = JSON.stringify({ claims: [{ text: 'A', verdict: 'contradicted' }, { text: 'B', verdict: 'supported' }] });
const fresh = (): AppState => createState();
const withPrompt = (prompt: string, state = fresh()) => setPrompt(state, prompt).state;

describe('prompt and judged text', () => {
  it('proposes the last variable as the judged text and marks the state unsaved', () => {
    const { state } = setPrompt(fresh(), '{{prompt_input}} {{prompt_output}} {{context}}');
    expect(state.evaluation.judge_set.judged_text).toBe('context');
    expect(state.unsaved).toBe(true);
  });

  it('keeps the user\'s choice while the variable stays in the prompt', () => {
    let state = withPrompt('{{a}} {{b}} {{c}}');
    state = setJudgedText(state, 'b').state;
    state = withPrompt('{{a}} {{b}} {{c}} {{d}}', state);
    expect(state.evaluation.judge_set.judged_text).toBe('b');
  });

  it('proposes the last variable again and says so when the marked one disappears', () => {
    let state = withPrompt('{{a}} {{b}}');
    state = setJudgedText(state, 'a').state;
    const result = setPrompt(state, '{{b}} {{c}}');
    expect(result.state.evaluation.judge_set.judged_text).toBe('c');
    expect(result.note).toMatch(/"a".*"c"/);
  });

  it('has no judged text without variables', () => {
    const { state } = setPrompt(withPrompt('{{a}}'), 'No variables here');
    expect(state.evaluation.judge_set.judged_text).toBeUndefined();
  });

  it('refuses a judged text that is not a variable of the prompt', () => {
    const state = withPrompt('{{a}} {{b}}');
    const result = setJudgedText(state, 'zzz');
    expect(result.state).toBe(state);
    expect(result.note).toMatch(/not a variable/);
  });

  it('keeps the prompt and judged text fixed once the test cases are finalized', () => {
    const state: AppState = { ...fresh(), evaluation: sampleEvaluation() };
    for (const result of [setPrompt(state, 'changed {{x}}'), setJudgedText(state, 'source_text')]) {
      expect(result.state).toBe(state);
      expect(result.note).toMatch(/fixed/);
    }
  });
});

describe('sample reply and finding text', () => {
  it('stores the sample as typed and proposes the finding text of each list', () => {
    const { state } = setSampleReply(fresh(), 'Here it is:\n```json\n' + SAMPLE + '\n```');
    expect(state.evaluation.judge_set.sample_reply).toContain('Here it is');
    expect(state.evaluation.judge_set.reply_mapping.finding_text).toEqual({ 'claims[]': 'claims[].text' });
  });

  it('keeps the text and the mapping when the sample cannot be read', () => {
    const first = setSampleReply(fresh(), SAMPLE).state;
    const { state } = setSampleReply(first, '{ "claims": [');
    expect(state.evaluation.judge_set.sample_reply).toBe('{ "claims": [');
    expect(state.evaluation.judge_set.reply_mapping.finding_text).toEqual({ 'claims[]': 'claims[].text' });
  });

  it('keeps a mapping the user chose and drops one whose list left the sample', () => {
    let state = setSampleReply(fresh(), JSON.stringify({ a: [{ x: 'one', y: 'two' }], b: [{ z: 'three' }] })).state;
    state = setFindingText(state, 'a[]', 'a[].y').state;
    state = setSampleReply(state, JSON.stringify({ a: [{ x: 'one', y: 'two' }] })).state;
    expect(state.evaluation.judge_set.reply_mapping.finding_text).toEqual({ 'a[]': 'a[].y' });
  });

  it('refuses a finding text that is not a text field of that list', () => {
    const state = setSampleReply(fresh(), SAMPLE).state;
    const result = setFindingText(state, 'claims[]', 'nope');
    expect(result.state).toBe(state);
    expect(result.note).toBeDefined();
  });

  it('an empty sample is removed', () => {
    const { state } = setSampleReply(setSampleReply(fresh(), SAMPLE).state, '   ');
    expect(state.evaluation.judge_set.sample_reply).toBeUndefined();
  });
});

describe('rules', () => {
  const ready = () => setSampleReply(fresh(), SAMPLE).state;

  it('adds a rule with one condition on a recognized field, never proposing a rule by itself', () => {
    const fresh0 = ready();
    expect(fresh0.evaluation.judge_set.error_rules).toEqual([]);
    const { state } = addRule(fresh0);
    const rule = state.evaluation.judge_set.error_rules[0]!;
    expect(rule.name).toBe('Rule 1');
    expect(rule.conditions).toHaveLength(1);
    expect(['claims[].text', 'claims[].verdict']).toContain(rule.conditions[0]!.field);
  });

  it('refuses a rule while there is no readable sample', () => {
    const state = fresh();
    const result = addRule(state);
    expect(result.state).toBe(state);
    expect(result.note).toMatch(/sample reply/);
  });

  it('edits name, match and conditions; adds and removes conditions and rules', () => {
    let state = addRule(ready()).state;
    state = updateRule(state, 0, { name: 'Bad claim', match: 'all' }).state;
    state = updateCondition(state, 0, 0, { field: 'claims[].verdict', comparison: 'equals', value: 'contradicted' }).state;
    state = addCondition(state, 0).state;
    expect(state.evaluation.judge_set.error_rules[0]).toMatchObject({ name: 'Bad claim', match: 'all' });
    expect(state.evaluation.judge_set.error_rules[0]!.conditions).toHaveLength(2);
    state = removeCondition(state, 0, 1).state;
    expect(state.evaluation.judge_set.error_rules[0]!.conditions).toHaveLength(1);
    state = removeRule(state, 0).state;
    expect(state.evaluation.judge_set.error_rules).toEqual([]);
  });

  it('refuses a field that the sample reply does not contain', () => {
    const state = addRule(ready()).state;
    const result = updateCondition(state, 0, 0, { field: 'ghost.field' });
    expect(result.state).toBe(state);
    expect(result.note).toMatch(/ghost\.field/);
  });

  it('drops the value of an is-empty comparison', () => {
    let state = addRule(ready()).state;
    state = updateCondition(state, 0, 0, { field: 'claims[].text', comparison: 'is_empty' }).state;
    expect(state.evaluation.judge_set.error_rules[0]!.conditions[0]!.value).toBeUndefined();
  });

  it('a rule keeps its place and is marked broken, not removed, when the sample loses its field', () => {
    let state = addRule(ready()).state;
    state = updateCondition(state, 0, 0, { field: 'claims[].verdict', value: 'contradicted' }).state;
    state = setSampleReply(state, JSON.stringify({ other: 1 })).state;
    expect(state.evaluation.judge_set.error_rules).toHaveLength(1);
  });

  it('rules stay editable after finalizing (the reply mapping and the rules may still be corrected)', () => {
    const state: AppState = { ...fresh(), evaluation: sampleEvaluation() };
    const next = addRule(state).state;
    expect(next.evaluation.judge_set.error_rules.length).toBe(state.evaluation.judge_set.error_rules.length + 1);
  });
});

describe('starting from a ready example (FR-019)', () => {
  it.each(['accuracy', 'completeness'])('%s starts a new test project with its judge, catalog and clean cases', (id) => {
    const ports = createFakePorts();
    ports.evaluationTarget.fileName = 'old.json';
    ports.testProjectTarget.fileName = 'old-project.json';
    const metric = metricFor(id);
    const state = startFromMetric({ ...fresh(), unsaved: true, evaluationFile: 'old.json' }, metric, ports);
    const e = state.evaluation;
    expect(e.judge_set.prompt).toBe(metric.judge_set.prompt);
    expect(e.judge_set.error_catalog).toEqual(metric.judge_set.error_catalog);
    expect(e.dataset.cases.map((c) => c.name)).toEqual(metric.judge_set.clean_base_cases.map((c) => c.name));
    expect(e.dataset.cases.every((c) => c.expected_errors.length === 0)).toBe(true);
    expect(e.dataset.cases.map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(e.dataset.finalized).toBe(false);
    expect(e.metric.id).toBe(id);
    expect(e.metric.parameters).toEqual({ match_clear_share: 0.6, match_partial_share: 0.3, match_min_word_length: 4 });
    expect(e.replies).toEqual({});
    expect(state).toMatchObject({ step: 'judge', unsaved: false, evaluationFile: null, testProjectFile: null, hasFile: false });
    expect([ports.testProjectTarget.fileName, ports.evaluationTarget.fileName]).toEqual([null, null]);
  });

  it('does not share objects with the definition', () => {
    const metric = metricFor('accuracy');
    const state = startFromMetric(fresh(), metric, createFakePorts());
    state.evaluation.judge_set.error_rules[0]!.name = 'changed';
    expect(metric.judge_set.error_rules[0]!.name).not.toBe('changed');
  });
});
