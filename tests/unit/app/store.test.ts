import { describe, expect, it } from 'vitest';
import {
  applyLoadedTestProject,
  createState,
  edit,
  recordReplySaved,
  saveTestProject,
  saveTestProjectAs,
  setThresholds,
  startNewTestProject,
} from '../../../src/app/store';
import { guardFor, replaceNeedsQuestion, shouldWarnBeforeUnload } from '../../../src/app/guard';
import { createFakePorts } from '../../../src/app/ports/fakes';
import type { CaseDecisions } from '../../../src/core/model';
import { withRun } from '../../helpers/fixtures';

const emptyDecisions = (): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '' });

describe('store actions', () => {
  it('return the next state without changing the old one', () => {
    const before = createState();
    const frozen = JSON.stringify(before);
    const after = edit(before, (e) => withRun(e, { model_note: 'x' }));
    expect(JSON.stringify(before)).toBe(frozen);
    expect(after).not.toBe(before);
    expect(after.project.testRun?.model_note).toBe('x');
  });

  it('start with nothing to save', () => {
    expect(createState().unsaved).toBe(false);
  });

  it('any change sets the one unsaved flag', () => {
    expect(edit(createState(), (e) => withRun(e, { model_note: 'x' })).unsaved).toBe(true);
  });

  it('a threshold change sets it too', () => {
    const rules = [{ measure: 'detection_rate', comparison: 'at_least' as const, value: 0.9 }];
    expect(setThresholds(createState(), { rules }).unsaved).toBe(true);
    expect(setThresholds(createState(), { rules }).project.checks.rules[0]?.value).toBe(0.9);
  });

  it('count the replies saved since the last "Save test project"', () => {
    let state = createState();
    state = recordReplySaved(state);
    state = recordReplySaved(state);
    expect(state.repliesSinceSave).toBe(2);
    expect(state.unsaved).toBe(true);
  });
});

describe('saving', () => {
  it('"Save test project" clears the flag and resets the count of replies since save', async () => {
    const ports = createFakePorts();
    let state = recordReplySaved(edit(createState(), (e) => withRun(e, { model_note: 'x' })));
    const result = await saveTestProject(state, ports, () => '{"test":true}');
    expect(result.outcome).toBe('saved');
    state = result.state;
    expect(state.unsaved).toBe(false);
    expect(state.repliesSinceSave).toBe(0);
    expect(state.testProjectFile).toBe('test-project.json');
    expect(ports.testProjectTarget.lastText).toBe('{"test":true}');
  });

  it('clears the flag also when replies exist, and has no second message', async () => {
    const ports = createFakePorts();
    const state = edit(createState(), (e) => withRun(e, { replies: { '1': { prompt: 'p', reply: 'r' } } }));
    const result = await saveTestProject(state, ports, () => '{}');
    expect(result.state.unsaved).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it('a cancelled save keeps the flag and the count', async () => {
    const ports = createFakePorts();
    ports.testProjectTarget.nextResult = { status: 'cancelled' };
    const state = recordReplySaved(createState());
    const result = await saveTestProject(state, ports, () => '{}');
    expect(result.outcome).toBe('cancelled');
    expect(result.state.unsaved).toBe(true);
    expect(result.state.repliesSinceSave).toBe(1);
  });

  it('a file that is no longer writable keeps the flag and says so', async () => {
    const ports = createFakePorts();
    ports.testProjectTarget.nextResult = { status: 'no_longer_writable' };
    const result = await saveTestProject(edit(createState(), (e) => e), ports, () => '{}');
    expect(result.outcome).toBe('no_longer_writable');
    expect(result.state.unsaved).toBe(true);
    expect(result.message).toMatch(/choose a file/i);
    expect(result.state.testProjectFile).toBeNull();
  });

  it('"Save test project as…" always asks for a file', async () => {
    const ports = createFakePorts();
    const result = await saveTestProjectAs(edit(createState(), (e) => e), ports, () => '{}');
    expect(result.outcome).toBe('saved');
    expect(ports.testProjectTarget.asked).toBe(1);
  });
});

describe('the remembered file', () => {
  it('loading with the test run makes the loaded file the remembered one and keeps no unsaved work', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'loaded.json';
    const next = applyLoadedTestProject({ ...createState(), unsaved: true }, withRun(createState().project, { model_note: 'x' }), ports, 'with');
    expect(next).toMatchObject({ unsaved: false, repliesSinceSave: 0, testProjectFile: 'loaded.json', hasFile: true });
    expect(next.project.testRun?.model_note).toBe('x');
  });

  it('loading the test project only drops the test run and the remembered file', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'old.json';
    const state = { ...createState(), testProjectFile: 'old.json' };
    const next = applyLoadedTestProject(state, withRun(createState().project, { model_note: 'x' }), ports, 'only');
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(next.testProjectFile).toBeNull();
    expect(next.unsaved).toBe(false);
    expect(next.project.testRun).toBeUndefined();
  });

  it('"New test project" forgets the file and starts empty', () => {
    const ports = createFakePorts();
    ports.testProjectTarget.fileName = 'a.json';
    const next = startNewTestProject(edit(createState(), (e) => withRun(e, { model_note: 'x' })), ports);
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(next.project.testRun).toBeUndefined();
    expect(next.unsaved).toBe(false);
  });
});

describe('the unsaved-work guard', () => {
  const unsaved = edit(createState(), (e) => withRun(e, { model_note: 'x' }));

  it('does not ask when nothing is unsaved', () => {
    expect(guardFor(createState(), 'load-test-project')).toBeNull();
  });

  it.each(['load-test-project', 'load-example', 'start-new-evaluation'] as const)(
    'asks before %s with the three choices',
    (action) => {
      const guard = guardFor(unsaved, action);
      expect(guard).not.toBeNull();
      expect(guard?.choices).toEqual(['Save test project first', 'Discard', 'Cancel']);
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
    edit(createState(), (e) =>
      withRun(e, {
        replies: { '1': { prompt: 'p', reply: 'r' } },
        decisions: decisions ? { '1': decisions } : ({} as Record<string, CaseDecisions>),
      }),
    );

  it('replaces without asking when only automatic results exist', () => {
    expect(replaceNeedsQuestion(withReply(undefined).project, '1')).toEqual({ ask: false, count: 0 });
    expect(replaceNeedsQuestion(withReply(emptyDecisions()).project, '1')).toEqual({ ask: false, count: 0 });
  });

  it('asks with the number of decisions set by hand or from an opinion', () => {
    const decisions: CaseDecisions = {
      ...emptyDecisions(),
      expected: { e1: { state: 'found', source: 'manual' } },
      additional: { 'claims[]#1': { state: 'false_positive', source: 'llm-approved' } },
      added_findings: [{ text: 't', state: 'real_error', source: 'manual' }],
    };
    expect(replaceNeedsQuestion(withReply(decisions).project, '1')).toEqual({ ask: true, count: 3 });
  });
});
