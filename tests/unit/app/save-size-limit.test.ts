// A test project too large for one file is not written: the save checks the size first, says the size and the 50 MB limit, and the
// work stays in the page (Clarifications 2026-11-17, T416). The read limit is the same, so every saved file opens again.
import { describe, expect, it } from 'vitest';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, saveTestProject, saveTestProjectAs } from '../../../src/app/store';
import { MAX_FILE_BYTES } from '../../../src/core/schemas/limits';
import { sampleProject } from '../../helpers/fixtures';

const state = () => ({ ...createState(), project: sampleProject(), unsaved: true });

describe.each([
  ['Save test project', saveTestProject],
  ['Save test project as…', saveTestProjectAs],
])('%s with a file over 50 MB (T416)', (_label, save) => {
  it('writes nothing, says the size and the limit, and keeps the work unsaved', async () => {
    const ports = createFakePorts();
    const before = state();
    const result = await save(before, ports, async () => 'x'.repeat(MAX_FILE_BYTES + 1));
    expect(ports.testProjectTarget.lastText).toBeNull();
    expect(result.outcome).toBe('too_large');
    expect(result.state).toBe(before);
    expect(result.message).toBe('The test project would be 51 MB; the tool saves files up to 50 MB. Nothing was saved. Remove test cases or shorten long texts, then save again.');
  });

  it('counts bytes, not characters: text with letters such as "ż" is measured as it is written', async () => {
    const ports = createFakePorts();
    const text = 'ż'.repeat(MAX_FILE_BYTES / 2 + 1); // fewer characters than the limit, more bytes
    const result = await save(state(), ports, async () => text);
    expect(result.outcome).toBe('too_large');
    expect(ports.testProjectTarget.lastText).toBeNull();
  });

  it('a file of exactly 50 MB is written', async () => {
    const ports = createFakePorts();
    const result = await save(state(), ports, async () => 'x'.repeat(MAX_FILE_BYTES));
    expect(result.outcome).toBe('saved');
    expect(ports.testProjectTarget.lastText?.length).toBe(MAX_FILE_BYTES);
  });
});
