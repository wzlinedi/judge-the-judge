// Storing replies (FR-053, FR-056, FR-057, FR-059; contracts/core-api.md, attachReplies).
import { describe, expect, it } from 'vitest';
import { attachReplies, modelDetailsEdit, pasteReplyFromClipboard, reminderDue, removeReply, replaceNeedsQuestion, saveReply } from '../../../src/app/actions/replies';
import { createFakeClipboard } from '../../../src/app/ports/fakes';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { composePrompt } from '../../../src/core/judge/compose';
import { judgeVersion } from '../../../src/core/judge/version';
import type { Evaluation } from '../../../src/core/model';
import { sampleEvaluation } from '../../helpers/fixtures';

const withoutReplies = (): Evaluation => ({ ...sampleEvaluation(), replies: {}, decisions: {}, reply_judge_version: undefined });
const stateOf = (evaluation: Evaluation, extra: Partial<AppState> = {}): AppState => ({ ...createState(), step: 'run', evaluation, ...extra });
const reply = '{"claims":[{"text":"Anna is a baker.","verdict":"supported","reason":"x"}]}';
/** A reply that is valid JSON is stored formatted (T292). */
const pretty = (text: string) => JSON.stringify(JSON.parse(text), null, 2);

describe('attachReplies', () => {
  it('stores the reply with the prompt composed for its case', () => {
    const e = withoutReplies();
    const result = attachReplies(e, { items: [{ case_id: '1', reply }], problems: [] }, { judgeVersion: 'v1' });
    expect(result.problems).toEqual([]);
    expect(result.saved).toEqual(['1']);
    expect(result.evaluation.replies['1']).toEqual({ prompt: composePrompt(e.judge_set.prompt, e.dataset.cases[0]!).text, reply: pretty(reply) });
  });

  it('records the judge version on the first reply and keeps it afterwards', () => {
    const e = withoutReplies();
    const first = attachReplies(e, { items: [{ case_id: '1', reply }], problems: [] }, { judgeVersion: 'v1' }).evaluation;
    expect(first.reply_judge_version).toBe('v1');
    const second = attachReplies(first, { items: [{ case_id: '2', reply }], problems: [] }, { judgeVersion: 'v2' }).evaluation;
    expect(second.reply_judge_version).toBe('v1');
  });

  it('refuses before the test cases are finalized and changes nothing', () => {
    const e = { ...withoutReplies(), dataset: { ...withoutReplies().dataset, finalized: false } };
    const result = attachReplies(e, { items: [{ case_id: '1', reply }], problems: [] }, { judgeVersion: 'v1' });
    expect(result.evaluation).toBe(e);
    expect(result.saved).toEqual([]);
    expect(result.problems[0]?.message).toMatch(/finalize/i);
  });

  it('reports a case that does not exist and stores nothing for it', () => {
    const e = withoutReplies();
    const result = attachReplies(e, { items: [{ case_id: '99', reply }], problems: [] }, { judgeVersion: 'v1' });
    expect(result.saved).toEqual([]);
    expect(result.problems[0]?.message).toMatch(/99/);
  });

  it('passes on the problems of the batch', () => {
    const result = attachReplies(withoutReplies(), { items: [], problems: [{ message: 'The reply is empty.' }] }, { judgeVersion: 'v1' });
    expect(result.problems).toEqual([{ message: 'The reply is empty.' }]);
  });

  it('resets a case whose reply is replaced: decisions and added findings are removed', () => {
    const e = sampleEvaluation();
    expect(e.decisions['2']?.added_findings.length).toBeGreaterThan(0);
    const result = attachReplies(e, { items: [{ case_id: '2', reply: 'something else' }], problems: [] }, { judgeVersion: 'v9', confirmReplace: true });
    expect(result.saved).toEqual(['2']);
    expect(result.evaluation.decisions['2']).toBeUndefined();
    expect(result.evaluation.replies['2']?.reply).toBe('something else');
    expect(result.evaluation.decisions['1']).toBe(e.decisions['1']);
  });

  it('does not touch the evaluation it was given', () => {
    const e = sampleEvaluation();
    const frozen = JSON.stringify(e);
    attachReplies(e, { items: [{ case_id: '2', reply: 'new' }], problems: [] }, { judgeVersion: 'v', confirmReplace: true });
    expect(JSON.stringify(e)).toBe(frozen);
  });

  it('does not replace a reply that has decisions by hand unless the replacement was confirmed', () => {
    const e = sampleEvaluation();
    const result = attachReplies(e, { items: [{ case_id: '2', reply: 'new' }], problems: [] }, { judgeVersion: 'v' });
    expect(result.evaluation).toBe(e);
    expect(result.saved).toEqual([]);
    expect(result.needsConfirmation).toEqual([{ caseId: '2', count: 2 }]);
  });

  it('changes nothing when the same reply comes again', () => {
    const e = sampleEvaluation();
    const result = attachReplies(e, { items: [{ case_id: '2', reply: e.replies['2']!.reply }], problems: [] }, { judgeVersion: 'v' });
    expect(result.evaluation).toBe(e);
    expect(result.saved).toEqual([]);
    expect(result.unchanged).toEqual(['2']);
  });
});

describe('replaceNeedsQuestion', () => {
  it('is false for a case with no decisions, and for one that has only automatic decisions', () => {
    expect(replaceNeedsQuestion(sampleEvaluation(), '1')).toEqual({ ask: false, count: 0 });
    expect(replaceNeedsQuestion(withoutReplies(), '1')).toEqual({ ask: false, count: 0 });
  });

  it('is true when the case has marks by hand or approved from an opinion, and says how many', () => {
    expect(replaceNeedsQuestion(sampleEvaluation(), '2')).toEqual({ ask: true, count: 2 });
    const e = sampleEvaluation();
    e.decisions['1'] = {
      expected: {},
      additional: { 'claims[]#1': { state: 'false_positive', source: 'manual' }, 'claims[]#2': { state: 'real_error', source: 'llm-approved' } },
      added_findings: [],
      approved: false,
      note: '',
    };
    expect(replaceNeedsQuestion(e, '1')).toEqual({ ask: true, count: 2 });
  });

  it('counts one decision when there is one', () => {
    const e = sampleEvaluation();
    e.decisions['1'] = { expected: {}, additional: { 'claims[]#1': { state: 'ignored', source: 'manual' } }, added_findings: [], approved: false, note: '' };
    expect(replaceNeedsQuestion(e, '1')).toEqual({ ask: true, count: 1 });
  });
});

describe('the reminder', () => {
  it('is due from 25 replies not saved to a file, and not before', () => {
    expect(reminderDue(0)).toBe(false);
    expect(reminderDue(24)).toBe(false);
    expect(reminderDue(25)).toBe(true);
    expect(reminderDue(26)).toBe(true);
    expect(reminderDue(50)).toBe(true);
  });
});

describe('saveReply', () => {
  it('stores the reply, records the judge version, counts it and marks the work unsaved', async () => {
    const state = stateOf(withoutReplies());
    const outcome = await saveReply(state, '1', reply);
    expect(outcome.status).toBe('saved');
    expect(outcome.state.evaluation.replies['1']?.reply).toBe(pretty(reply));
    expect(outcome.state.evaluation.reply_judge_version).toBe(await judgeVersion(state.evaluation.judge_set));
    expect(outcome.state.repliesSinceSave).toBe(1);
    expect(outcome.state.unsaved).toBe(true);
  });

  it('counts every saved reply, a replacement included, and each one toward the reminder', async () => {
    let state = stateOf(withoutReplies());
    state = (await saveReply(state, '1', reply)).state;
    state = (await saveReply(state, '2', reply)).state;
    state = (await saveReply(state, '2', 'changed')).state;
    expect(state.repliesSinceSave).toBe(3);
  });

  it('says "unchanged" and changes nothing for the same reply again', async () => {
    const state = stateOf(sampleEvaluation(), { repliesSinceSave: 4 });
    const outcome = await saveReply(state, '1', state.evaluation.replies['1']!.reply);
    expect(outcome.status).toBe('unchanged');
    expect(outcome.state).toBe(state);
  });

  it('explains an empty reply and changes nothing', async () => {
    const state = stateOf(withoutReplies());
    const outcome = await saveReply(state, '1', '  \n');
    expect(outcome.status).toBe('empty');
    expect(outcome.message).toMatch(/empty/i);
    expect(outcome.state).toBe(state);
  });

  it('asks first when the case has decisions by hand, naming how many, and replaces after confirmation', async () => {
    const state = stateOf(sampleEvaluation());
    const asked = await saveReply(state, '2', 'new text');
    expect(asked.status).toBe('needs_confirmation');
    expect(asked.replaces).toBe(2);
    expect(asked.state).toBe(state);
    const done = await saveReply(state, '2', 'new text', { confirmed: true });
    expect(done.status).toBe('saved');
    expect(done.state.evaluation.decisions['2']).toBeUndefined();
  });

  it('is refused before the test cases are finalized', async () => {
    const e = withoutReplies();
    const state = stateOf({ ...e, dataset: { ...e.dataset, finalized: false } });
    const outcome = await saveReply(state, '1', reply);
    expect(outcome.status).toBe('refused');
    expect(outcome.state).toBe(state);
  });

  it('keeps a reply that is not JSON', async () => {
    const outcome = await saveReply(stateOf(withoutReplies()), '1', 'It seems fine to me.');
    expect(outcome.status).toBe('saved');
    expect(outcome.state.evaluation.replies['1']?.reply).toBe('It seems fine to me.');
  });
});

describe('pasteReplyFromClipboard', () => {
  it('reads the clipboard and saves the reply in one action', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard(reply);
    const outcome = await pasteReplyFromClipboard(stateOf(withoutReplies()), '1', ports);
    expect(outcome.status).toBe('saved');
    expect(outcome.state.evaluation.replies['1']?.reply).toBe(pretty(reply));
  });

  it('explains an empty clipboard and changes nothing', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('  ');
    const state = stateOf(withoutReplies());
    const outcome = await pasteReplyFromClipboard(state, '1', ports);
    expect(outcome.status).toBe('empty');
    expect(outcome.message).toMatch(/clipboard is empty/i);
    expect(outcome.state).toBe(state);
  });

  it('points to the box when the clipboard is refused or not available', async () => {
    for (const set of [(c: ReturnType<typeof createFakeClipboard>) => (c.refuse = true), (c: ReturnType<typeof createFakeClipboard>) => (c.available = false)]) {
      const ports = createFakePorts();
      const clipboard = createFakeClipboard(reply);
      set(clipboard);
      ports.clipboard = clipboard;
      const state = stateOf(withoutReplies());
      const outcome = await pasteReplyFromClipboard(state, '1', ports);
      expect(outcome.status).toBe('clipboard_blocked');
      expect(outcome.message).toMatch(/box/i);
      expect(outcome.state).toBe(state);
    }
  });

  it('asks before replacing a reply that has decisions, giving the text back for the confirmation', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('another reply');
    const outcome = await pasteReplyFromClipboard(stateOf(sampleEvaluation()), '2', ports);
    expect(outcome.status).toBe('needs_confirmation');
    expect(outcome.replaces).toBe(2);
    expect(outcome.text).toBe('another reply');
  });
});

describe('modelDetailsEdit', () => {
  it('stores the text as written, with its lines, and sets the unsaved flag', () => {
    const state = stateOf(withoutReplies());
    const next = modelDetailsEdit(state, 'model X\ntemperature 0\n');
    expect(next.evaluation.model_note).toBe('model X\ntemperature 0\n');
    expect(next.unsaved).toBe(true);
    expect(state.evaluation.model_note).toBe('model X\ntemperature 0');
  });
});

describe('removeReply (T291)', () => {
  it('removes the reply, the decisions and the added findings of the case; the other cases keep theirs', () => {
    const e = sampleEvaluation();
    const removed = removeReply(e, '2');
    expect(removed.replies['2']).toBeUndefined();
    expect(removed.decisions['2']).toBeUndefined();
    expect(Object.keys(removed.replies)).toEqual(Object.keys(e.replies).filter((id) => id !== '2'));
    expect(removed.dataset).toBe(e.dataset);
  });

  it('puts the run back to the start when the last reply goes', () => {
    const e = sampleEvaluation();
    const only: Evaluation = { ...e, replies: { '2': e.replies['2']! }, decisions: { '2': e.decisions['2']! }, reply_judge_version: 'v1', rules_corrected_after_replies: true };
    const removed = removeReply(only, '2');
    expect(removed.replies).toEqual({});
    expect(removed.reply_judge_version).toBeUndefined();
    expect(removed.rules_corrected_after_replies).toBeUndefined();
  });

  it('changes nothing for a case without a reply', () => {
    const e = withoutReplies();
    expect(removeReply(e, '2')).toBe(e);
  });
});

describe('a reply that is valid JSON is stored formatted (T292)', () => {
  it('stores the same data with new lines and an indent of 2 spaces, from the box and from the clipboard alike', async () => {
    const state = stateOf({ ...withoutReplies(), dataset: { ...withoutReplies().dataset, finalized: true } });
    const saved = await saveReply(state, '1', '{"claims":[{"text":"x"}]}');
    expect(saved.status).toBe('saved');
    expect(saved.state.evaluation.replies['1']?.reply).toBe('{\n  "claims": [\n    {\n      "text": "x"\n    }\n  ]\n}');
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('{"claims":[]}');
    const pasted = await pasteReplyFromClipboard(state, '1', ports);
    expect(pasted.state.evaluation.replies['1']?.reply).toBe('{\n  "claims": []\n}');
  });

  it('keeps a text that is not valid JSON, or has JSON in a fence, as it is', async () => {
    const state = stateOf({ ...withoutReplies(), dataset: { ...withoutReplies().dataset, finalized: true } });
    const fenced = '```json\n{"claims":[]}\n```';
    const saved = await saveReply(state, '1', fenced);
    expect(saved.state.evaluation.replies['1']?.reply).toBe(fenced);
  });

  it('counts the same data in other spaces as the reply already saved: nothing changes', async () => {
    const state = stateOf({ ...withoutReplies(), dataset: { ...withoutReplies().dataset, finalized: true } });
    const first = await saveReply(state, '1', '{"claims":[]}');
    const again = await saveReply(first.state, '1', '{ "claims": [] }');
    expect(again.status).toBe('unchanged');
  });
});
