// What is stored for a reply is checked against the limits the loader uses, so a saved test project can always be opened again
// (Constitution IX, FR-020, Clarifications 2026-11-16 S4, T412). A reply that is valid JSON is stored formatted (T292); the formatting
// must not push it over the limit, and the prompt stored with it must fit too.
import { describe, expect, it } from 'vitest';
import { attachReplies, saveReply } from '../../../src/app/actions/replies';
import { createState } from '../../../src/app/store';
import { readTestProject, writeTestProject } from '../../../src/core/io/test-project-file';
import { MAX_PROMPT_LENGTH, MAX_REPLY_LENGTH } from '../../../src/core/schemas/limits';
import type { TestProject } from '../../../src/core/model';
import { sampleProject, withRun } from '../../helpers/fixtures';

const fresh = (): TestProject => withRun(sampleProject(), { replies: {}, decisions: {}, reply_judge_version: undefined });

/** A compact JSON reply of about `length` characters whose formatted text is much longer. */
function compactReply(length: number): string {
  const claims: Array<{ text: string; verdict: string }> = [];
  let text = '{"claims":[]}';
  while (text.length < length) {
    claims.push({ text: 'a', verdict: 'supported' });
    text = JSON.stringify({ claims });
  }
  return text;
}

function reloads(project: TestProject): boolean {
  const text = writeTestProject(project, null, { now: '2026-11-17T00:00:00.000Z', toolVersion: 'test', judgeVersion: 'j', testCasesVersion: 'c' });
  return readTestProject(text).ok;
}

describe('a reply that fits as pasted but not when formatted (T412)', () => {
  it.each([132_003, 199_000])('compact reply of about %i characters: saved, within the limit, and the file reloads', async (length) => {
    const pasted = compactReply(length);
    expect(pasted.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
    const outcome = await saveReply({ ...createState(), project: fresh() }, '1', pasted);
    expect(outcome.status).toBe('saved');
    const stored = outcome.state.project.testRun!.replies['1']!.reply;
    expect(stored.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
    expect(JSON.parse(stored)).toEqual(JSON.parse(pasted));
    expect(reloads(outcome.state.project)).toBe(true);
  });

  it('attachReplies itself refuses a reply over the limit (import and clipboard paths) and names the limit', () => {
    const e = fresh();
    const result = attachReplies(e, { items: [{ case_id: '1', reply: 'x'.repeat(MAX_REPLY_LENGTH + 1) }], problems: [] }, { judgeVersion: 'v1' });
    expect(result.saved).toEqual([]);
    expect(result.project).toBe(e);
    expect(result.problems.map((p) => p.message).join(' ')).toContain('200,000 characters');
  });
});

describe('a reply whose composed prompt is over the limit (T412)', () => {
  const huge = (): TestProject => {
    const e = fresh();
    return { ...e, judge_set: { ...e.judge_set, prompt: 'p'.repeat(MAX_PROMPT_LENGTH + 10) } };
  };

  it('is refused with a message that names the prompt limit, and nothing changes', async () => {
    const state = { ...createState(), project: huge() };
    const outcome = await saveReply(state, '1', '{"claims":[]}');
    expect(outcome.status).toBe('refused');
    expect(outcome.state).toBe(state);
    expect(outcome.message).toContain('prompt');
    expect(outcome.message).toContain('1,000,000 characters');
  });
});
