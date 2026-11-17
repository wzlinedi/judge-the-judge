// T460 (Clarifications 2026-11-17, finding 3, answer B; FR-084, S4): a file whose stored reply is longer than 200,000 characters is rejected.
// Nothing changes, and the message names the place of the reply and the limit.
import { describe, expect, it } from 'vitest';
import { loadTestProject, saveTestProject, type FileEnv } from '../../../src/app/actions/files';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { sampleProject } from '../../helpers/fixtures';

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };

/** The sample with case 2 renamed to 7, so the reply is stored at test_run.replies.7. */
function projectWithCase7(): TestProject {
  const p = sampleProject();
  const c = p.dataset.cases.find((x) => x.id === '2')!;
  c.id = '7';
  const replies = p.testRun!.replies;
  replies['7'] = replies['2']!;
  delete replies['2'];
  return p;
}

async function fileWithReply7(length: number): Promise<string> {
  const ports = createFakePorts();
  await saveTestProject({ ...createState(), project: projectWithCase7(), unsaved: true }, ports, env);
  const file = JSON.parse(ports.testProjectTarget.lastText as string);
  file.test_run.replies['7'].reply = 'x'.repeat(length);
  return JSON.stringify(file);
}

describe('a stored reply over 200,000 characters (T460)', () => {
  it('rejects the file, changes nothing, and names test_run.replies.7.reply and the limit 200,000', async () => {
    const ports = createFakePorts();
    ports.opener.next = { name: 'long.json', text: await fileWithReply7(200_001) };
    const before: AppState = createState();
    const result = await loadTestProject(before, ports, env);
    expect(result.outcome).toBe('invalid');
    expect(result.state).toBe(before);
    expect(result.pending).toBeUndefined();
    const text = `${result.message ?? ''}\n${(result.problems ?? []).map((p) => `${p.path ?? ''} ${p.message}`).join('\n')}`;
    expect(text).toContain('test_run.replies.7.reply');
    expect(text).toContain('200,000');
  });

  it('(control) the same file with a reply of exactly 200,000 characters is read', async () => {
    const ports = createFakePorts();
    ports.opener.next = { name: 'fits.json', text: await fileWithReply7(200_000) };
    const result = await loadTestProject(createState(), ports, env);
    expect(result.outcome).not.toBe('invalid');
  });
});
