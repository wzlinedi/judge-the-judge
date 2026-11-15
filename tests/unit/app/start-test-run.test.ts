// "Start test run" at app level (FR-052, FR-053, T300): refusals, the lock, and Test run actions before the start.
import { describe, expect, it } from 'vitest';
import { setJudgedText, setPrompt } from '../../../src/app/actions/judge';
import { saveReply } from '../../../src/app/actions/replies';
import { startTestRun } from '../../../src/app/actions/start';
import { createState, promptLocked, type AppState } from '../../../src/app/store';
import { isStarted, withoutTestRun } from '../../../src/core/cases/test-run';
import { notStartedProject, sampleProject } from '../../helpers/fixtures';

const notStarted = (): AppState => ({ ...createState(), step: 'cases', project: notStartedProject() });

describe('startTestRun', () => {
  it('is refused with no test cases, with the reason, and changes nothing', () => {
    const state: AppState = { ...notStarted(), project: { ...notStartedProject(), dataset: { name: 'p', cases: [] } } };
    const result = startTestRun(state);
    expect(result.state).toBe(state);
    expect(result.note).toMatch(/no test cases/i);
  });

  it('is refused with an empty judge prompt, with the reason', () => {
    const state = notStarted();
    const blank: AppState = { ...state, project: { ...state.project, judge_set: { ...state.project.judge_set, prompt: '' } } };
    const result = startTestRun(blank);
    expect(result.state).toBe(blank);
    expect(result.note).toMatch(/judge prompt is empty/i);
  });

  it('creates an empty test run, marks the work unsaved and says the test run has started', () => {
    const result = startTestRun(notStarted());
    expect(isStarted(result.state.project)).toBe(true);
    expect(result.state.project.testRun).toEqual({ replies: {}, decisions: {}, model_note: '' });
    expect(result.state.unsaved).toBe(true);
    expect(result.note).toMatch(/test run has started/i);
  });
});

describe('what the start fixes', () => {
  it('locks the prompt and the judged text, with no way to open them again', () => {
    const state: AppState = { ...createState(), project: sampleProject() };
    expect(promptLocked(state)).toBe(true);
    for (const result of [setPrompt(state, 'x {{y}}'), setJudgedText(state, 'source_text')]) {
      expect(result.state).toBe(state);
      expect(result.note).toBe('The test run has started, so the prompt is fixed.');
    }
  });

  it('leaves the prompt open before the start', () => {
    expect(promptLocked({ ...createState(), project: withoutTestRun(sampleProject()) })).toBe(false);
  });
});

describe('Test run actions before the start', () => {
  it('saving a reply is refused with "Start the test run first" and changes nothing', async () => {
    const state = notStarted();
    const outcome = await saveReply(state, '1', '{"claims": []}');
    expect(outcome.status).toBe('refused');
    expect(outcome.message).toBe('Start the test run first.');
    expect(outcome.state).toBe(state);
  });
});
