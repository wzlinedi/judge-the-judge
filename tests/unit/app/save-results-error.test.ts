// T452 (code review finding 1; FR-084, Clarifications 2026-11-16 S3): the save of the error panel must still write the work when the
// results cannot be worked out. The file keeps the whole project and its test run, leaves the results out, and says so.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveTestProject, saveTestProjectAs, type FileEnv } from '../../../src/app/actions/files';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';

const flag = vi.hoisted(() => ({ throws: false }));
vi.mock('../../../src/core/evaluation/results', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/core/evaluation/results')>();
  return {
    ...original,
    computeResults: (...args: Parameters<typeof original.computeResults>) => {
      if (flag.throws) throw new Error('The cases could not be read');
      return original.computeResults(...args);
    },
  };
});

afterEach(() => {
  flag.throws = false;
});

const env: FileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const unsaved = (): AppState => ({ ...createState(), project: sampleProject(), unsaved: true });

describe.each([
  ['Save test project', saveTestProject],
  ['Save test project as…', saveTestProjectAs],
])('%s when the results cannot be worked out (T452)', (_label, save) => {
  it('writes the whole project with its test run and no results, and says the results are worked out again on load', async () => {
    const state = unsaved();
    expect(state.project.testRun).toBeDefined();
    flag.throws = true;
    const ports = createFakePorts();
    const result = await save(state, ports, env);
    expect(result.outcome).toBe('saved');
    const written = JSON.parse(ports.testProjectTarget.lastText as string);
    expect(written.dataset.cases).toHaveLength(state.project.dataset.cases.length);
    expect(written.test_run.replies).toEqual(JSON.parse(JSON.stringify(state.project.testRun!.replies)));
    expect(written.test_run.decisions).toEqual(JSON.parse(JSON.stringify(state.project.testRun!.decisions)));
    expect(written.test_run.results).toEqual({});
    expect(result.message).toBe(
      'The test project was saved without its results, because they could not be worked out (The cases could not be read). They are worked out again when the file is loaded.',
    );
  });

  it('says nothing more when the results are worked out', async () => {
    const ports = createFakePorts();
    const result = await save(unsaved(), ports, env);
    expect(result.outcome).toBe('saved');
    expect(result.message).toBeUndefined();
  });
});
