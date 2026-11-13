import { describe, expect, it } from 'vitest';
import {
  applyLoadedEvaluation,
  applyLoadedTestProject,
  createState,
  edit,
  loadCheckSettings,
  recordReplySaved,
  saveEvaluation,
  saveEvaluationAs,
  saveTestProject,
  setThresholds,
  startNewEvaluation,
} from '../../../src/app/store';
import { guardFor, replaceNeedsQuestion, shouldWarnBeforeUnload } from '../../../src/app/guard';
import { createFakePorts } from '../../../src/app/ports/fakes';
import type { CaseDecisions } from '../../../src/core/model';

const emptyDecisions = (): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '' });

describe('store actions', () => {
  it('return the next state without changing the old one', () => {
    const before = createState();
    const frozen = JSON.stringify(before);
    const after = edit(before, (e) => ({ ...e, model_note: 'x' }));
    expect(JSON.stringify(before)).toBe(frozen);
    expect(after).not.toBe(before);
    expect(after.evaluation.model_note).toBe('x');
  });

  it('start with nothing to save', () => {
    expect(createState().unsaved).toBe(false);
  });

  it('any change sets the one unsaved flag', () => {
    expect(edit(createState(), (e) => ({ ...e, model_note: 'x' })).unsaved).toBe(true);
  });

  it('a threshold change and loaded check settings set it too', () => {
    const rules = [{ measure: 'detection_rate', comparison: 'at_least' as const, value: 0.9 }];
    expect(setThresholds(createState(), { rules }).unsaved).toBe(true);
    expect(loadCheckSettings(createState(), { rules }).unsaved).toBe(true);
    expect(setThresholds(createState(), { rules }).evaluation.checks.rules[0]?.value).toBe(0.9);
  });

  it('count the replies saved since the last "Save evaluation"', () => {
    let state = createState();
    state = recordReplySaved(state);
    state = recordReplySaved(state);
    expect(state.repliesSinceSave).toBe(2);
    expect(state.unsaved).toBe(true);
  });
});

describe('saving', () => {
  it('"Save evaluation" clears the flag and resets the count of replies since save', async () => {
    const ports = createFakePorts();
    let state = recordReplySaved(edit(createState(), (e) => ({ ...e, model_note: 'x' })));
    const result = await saveEvaluation(state, ports, () => '{"evaluation":true}');
    expect(result.outcome).toBe('saved');
    state = result.state;
    expect(state.unsaved).toBe(false);
    expect(state.repliesSinceSave).toBe(0);
    expect(state.evaluationFile).toBe('evaluation.json');
    expect(ports.evaluationTarget.lastText).toBe('{"evaluation":true}');
  });

  it('a cancelled save keeps the flag and the count', async () => {
    const ports = createFakePorts();
    ports.evaluationTarget.nextResult = { status: 'cancelled' };
    const state = recordReplySaved(createState());
    const result = await saveEvaluation(state, ports, () => '{}');
    expect(result.outcome).toBe('cancelled');
    expect(result.state.unsaved).toBe(true);
    expect(result.state.repliesSinceSave).toBe(1);
  });

  it('a file that is no longer writable keeps the flag and says so', async () => {
    const ports = createFakePorts();
    ports.evaluationTarget.nextResult = { status: 'no_longer_writable' };
    const result = await saveEvaluation(edit(createState(), (e) => e), ports, () => '{}');
    expect(result.outcome).toBe('no_longer_writable');
    expect(result.state.unsaved).toBe(true);
    expect(result.message).toMatch(/choose a file/i);
    expect(result.state.evaluationFile).toBeNull();
  });

  it('"Save evaluation as" always asks for a file', async () => {
    const ports = createFakePorts();
    const state = edit(createState(), (e) => e);
    const result = await saveEvaluationAs(state, ports, () => '{}');
    expect(result.outcome).toBe('saved');
    expect(ports.evaluationTarget.asked).toBe(1);
  });

  it('"Save test project" clears the flag only while no reply exists', async () => {
    const ports = createFakePorts();
    const state = edit(createState(), (e) => ({ ...e, model_note: 'x' }));
    const result = await saveTestProject(state, ports, () => '{}');
    expect(result.outcome).toBe('saved');
    expect(result.state.unsaved).toBe(false);
    expect(result.state.testProjectFile).toBe('test-project.json');
    expect(result.message).toBeUndefined();
  });

  it('"Save test project" with replies leaves the flag set and says replies are kept only by "Save evaluation"', async () => {
    const ports = createFakePorts();
    const state = edit(createState(), (e) => ({ ...e, replies: { '1': { prompt: 'p', reply: 'r' } } }));
    const result = await saveTestProject(state, ports, () => '{}');
    expect(result.outcome).toBe('saved');
    expect(result.state.unsaved).toBe(true);
    expect(result.message).toContain('Save evaluation');
    expect(result.state.testProjectFile).toBe('test-project.json');
  });
});

describe('the remembered files', () => {
  it('"Load test project" forgets the evaluation file and keeps no unsaved work', () => {
    const ports = createFakePorts();
    ports.evaluationTarget.fileName = 'evaluation.json';
    const state = { ...createState(), evaluationFile: 'evaluation.json' };
    const next = applyLoadedTestProject(state, createState().evaluation, ports);
    expect(ports.evaluationTarget.fileName).toBeNull();
    expect(next.evaluationFile).toBeNull();
    expect(next.unsaved).toBe(false);
    expect(next.evaluation.replies).toEqual({});
  });

  it('"Load evaluation" forgets the test project file', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'test-project.json';
    const next = applyLoadedEvaluation({ ...createState(), testProjectFile: 'test-project.json' }, createState().evaluation, ports);
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(next.testProjectFile).toBeNull();
    expect(next.unsaved).toBe(false);
  });

  it('"Start new evaluation" forgets both and starts empty', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'a.json';
    ports.evaluationTarget.fileName = 'b.json';
    const next = startNewEvaluation(edit(createState(), (e) => ({ ...e, model_note: 'x' })), ports);
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(ports.evaluationTarget.fileName).toBeNull();
    expect(next.evaluation.model_note).toBe('');
    expect(next.unsaved).toBe(false);
  });
});

describe('the unsaved-work guard', () => {
  const unsaved = edit(createState(), (e) => ({ ...e, model_note: 'x' }));

  it('does not ask when nothing is unsaved', () => {
    expect(guardFor(createState(), 'load-test-project')).toBeNull();
  });

  it.each(['load-test-project', 'load-evaluation', 'load-example', 'start-new-evaluation', 'edit-judge-and-run-again'] as const)(
    'asks before %s with the three choices',
    (action) => {
      const guard = guardFor(unsaved, action);
      expect(guard).not.toBeNull();
      expect(guard?.choices).toEqual(['Save evaluation first', 'Discard', 'Cancel']);
    },
  );

  it('does not ask before actions that keep the work', () => {
    expect(guardFor(unsaved, 'edit-test-cases')).toBeNull();
  });

  it('warns on leaving the page only while unsaved', () => {
    expect(shouldWarnBeforeUnload(unsaved)).toBe(true);
    expect(shouldWarnBeforeUnload(createState())).toBe(false);
  });
});

describe('replacing a reply', () => {
  const withReply = (decisions: CaseDecisions | undefined) =>
    edit(createState(), (e) => ({
      ...e,
      replies: { '1': { prompt: 'p', reply: 'r' } },
      decisions: decisions ? { '1': decisions } : ({} as Record<string, CaseDecisions>),
    }));

  it('replaces without asking when only automatic results exist', () => {
    expect(replaceNeedsQuestion(withReply(undefined).evaluation, '1')).toEqual({ ask: false, count: 0 });
    expect(replaceNeedsQuestion(withReply(emptyDecisions()).evaluation, '1')).toEqual({ ask: false, count: 0 });
  });

  it('asks with the number of decisions set by hand or from an opinion', () => {
    const decisions: CaseDecisions = {
      ...emptyDecisions(),
      expected: { e1: { state: 'found', source: 'manual' } },
      additional: { 'claims[]#1': { state: 'false_positive', source: 'llm-approved' } },
      added_findings: [{ text: 't', state: 'real_error', source: 'manual' }],
    };
    expect(replaceNeedsQuestion(withReply(decisions).evaluation, '1')).toEqual({ ask: true, count: 3 });
  });
});
