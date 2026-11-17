// T459 (Clarifications 2026-11-17, finding 8, answer A; FR-075): a file saved before the rules turned off by the sample reply were part of the
// judge version stored the version without them. Loading it must not say "The rules were corrected after the replies were received" nor
// list a different judge version; a project whose prompt or rules really changed still does.
import { describe, expect, it } from 'vitest';
import { finishLoad, loadTestProject, saveTestProject, type FileEnv } from '../../../src/app/actions/files';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { rulesCorrectedAfterReplies } from '../../../src/core/evaluation/recompute';
import { judgeVersion, judgeVersionWithoutUnusable } from '../../../src/core/judge/version';
import type { TestProject } from '../../../src/core/model';
import { sampleProject } from '../../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
/** The sample with a sample reply that lacks `verdict`, so its rules are turned off and count in the judge version (R3). */
const project = (): TestProject => {
  const p = sampleProject();
  p.judge_set.sample_reply = '{"claims": [{"text": "a"}]}';
  return p;
};

async function loadWith(storedVersion: (current: string, earlier: string) => string) {
  const p = project();
  const current = await judgeVersion(p.judge_set);
  const earlier = await judgeVersionWithoutUnusable(p.judge_set);
  const stored = storedVersion(current, earlier);
  const ports = createFakePorts();
  const state: AppState = { ...createState(), project: p, unsaved: true };
  await saveTestProject(state, ports, env);
  const file = JSON.parse(ports.testProjectTarget.lastText as string);
  file.test_run.reply_judge_version = stored;
  file.test_run.judge_version = stored;
  ports.opener.next = { name: 'older.json', text: JSON.stringify(file) };
  const asked = await loadTestProject(createState(), ports, env);
  const loaded = await finishLoad(createState(), ports, asked.pending!, 'with');
  return { current, earlier, loaded };
}

describe('the judge version of a file saved before R3 (T459)', () => {
  it('(setup) the sample reply turns a rule off, so the two versions differ', async () => {
    const { current, earlier } = await loadWith((c) => c);
    expect(earlier).not.toBe(current);
  });

  it('a stored version worked out the earlier way agrees: no correction note and no judge version difference', async () => {
    const { current, loaded } = await loadWith((_c, earlier) => earlier);
    expect(loaded.outcome).toBe('loaded');
    expect(rulesCorrectedAfterReplies(loaded.state.project.testRun!.reply_judge_version, current)).toBe(false);
    expect(loaded.message ?? '').not.toContain('judge version');
  });

  it('a version of another prompt or other rules still shows both', async () => {
    const { current, loaded } = await loadWith(() => 'aaaaaaaaaaaa');
    expect(rulesCorrectedAfterReplies(loaded.state.project.testRun!.reply_judge_version, current)).toBe(true);
    expect(loaded.message).toContain('judge version was aaaaaaaaaaaa in the file');
  });
});
