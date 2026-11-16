// The merge of a saved reply into a state that changed meanwhile (R2) writes under the case id as an own key (S1, Constitution IX).
import { describe, expect, it } from 'vitest';
import { saveReply } from '../../../src/app/actions/replies';
import { createState } from '../../../src/app/store';
import { repliesOf, ownValue } from '../../../src/core/cases/test-run';
import { sampleProject, withRun } from '../../helpers/fixtures';

describe('saveReply().apply with a case id that is a built-in JavaScript name', () => {
  it.each(['__proto__', 'constructor', 'toString'])('%s: the reply is an own key of the merged state and the prototype is unchanged', async (id) => {
    const base = sampleProject();
    const cases = base.dataset.cases.map((c, i) => (i === 0 ? { ...c, id } : c));
    const project = withRun({ ...base, dataset: { ...base.dataset, cases } }, { replies: {}, decisions: {}, reply_judge_version: undefined });
    const state = { ...createState(), project };
    const outcome = await saveReply(state, id, '{"claims": []}');
    expect(outcome.status).toBe('saved');
    // the state moved meanwhile: a different object with the same project
    const merged = outcome.apply!({ ...state });
    const replies = merged.project.testRun!.replies;
    expect(Object.getPrototypeOf(replies)).toBe(Object.prototype);
    expect(Object.hasOwn(replies, id)).toBe(true);
    expect(ownValue(repliesOf(merged.project), id)?.reply).toContain('claims');
  });
});
