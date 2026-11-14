// User Story 12: test another version of the judge on the same test cases, and the same test with another LLM
// (FR-020, FR-034, FR-051, FR-074, FR-076; quickstart V10).
import { describe, expect, it } from 'vitest';
import { editJudgeAndRunAgain } from '../../src/app/actions/rerun';
import type { Ports } from '../../src/app/ports/types';
import { loadTestProject, saveEvaluation, saveTestProject } from '../../src/app/actions/files';
import { modelDetailsEdit, saveReply } from '../../src/app/actions/replies';
import { setPrompt, setJudgedText } from '../../src/app/actions/judge';
import { guardFor } from '../../src/app/guard';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, promptLocked, type AppState } from '../../src/app/store';
import { testCasesVersion } from '../../src/core/cases/version';
import { judgeVersion } from '../../src/core/judge/version';
import { sampleEvaluation } from '../helpers/fixtures';

const env = { now: () => '2026-11-14T10:00:00Z', toolVersion: '1.0.0' };
const done = (over: Partial<AppState> = {}): AppState => ({ ...createState(), step: 'results', evaluation: sampleEvaluation(), unsaved: false, hasFile: true, ...over });
const rerun = (state: AppState, ports: Ports = createFakePorts()) => editJudgeAndRunAgain(state, ports);
const reply = sampleEvaluation().replies['1']!.reply;

describe('Run again with a new judge… keeps the test and clears the run', () => {
  it('keeps the finalized cases exactly, clears replies, decisions and the judge version of the replies, and opens the Judge step', async () => {
    const before = done();
    const result = rerun(before);
    const e = result.state.evaluation;
    expect(result.state.step).toBe('judge');
    expect(e.dataset.finalized).toBe(true);
    expect(await testCasesVersion(e.dataset.cases)).toBe(await testCasesVersion(before.evaluation.dataset.cases));
    expect(e.dataset.cases.map((c) => c.id)).toEqual(['1', '2']);
    expect(e.replies).toEqual({});
    expect(e.decisions).toEqual({});
    expect(e.reply_judge_version).toBeUndefined();
    expect(e.reply_counted_per).toBeUndefined();
    expect(e.rules_corrected_after_replies).toBeUndefined();
    expect(e.judge_set).toEqual(before.evaluation.judge_set);
    expect(e.metric).toEqual(before.evaluation.metric);
    expect(e.checks).toEqual(before.evaluation.checks);
    expect(result.state.openCase).toBeNull();
    expect(result.note).toMatch(/replies and decisions were cleared/i);
  });

  it('forgets that cases were added or corrected after the first reply, because there is no reply any more', () => {
    const e = rerun(done()).state.evaluation;
    expect(e.dataset.cases.some((c) => c.changed_after_first_reply !== undefined)).toBe(false);
  });

  it('is refused while the test cases are not finalized: there is no run to repeat', () => {
    const open = done({ evaluation: { ...sampleEvaluation(), dataset: { ...sampleEvaluation().dataset, finalized: false }, replies: {}, decisions: {} } });
    const result = rerun(open);
    expect(result.state).toBe(open);
    expect(result.note).toMatch(/finalize/i);
  });
});

describe('the prompt may change until the first new reply', () => {
  it('is editable after Run again with a new judge…, and fixed again by the first new reply', async () => {
    const start = rerun(done()).state;
    expect(promptLocked(start)).toBe(false);
    const edited = setPrompt(start, `${start.evaluation.judge_set.prompt}\nBe strict about numbers.`);
    expect(edited.state.evaluation.judge_set.prompt).toMatch(/Be strict about numbers/);
    expect(edited.note).toBeUndefined();

    const first = await saveReply(edited.state, '1', reply);
    expect(first.status).toBe('saved');
    expect(promptLocked(first.state)).toBe(true);
    const refused = setPrompt(first.state, 'Another prompt {{summary}}');
    expect(refused.state).toBe(first.state);
    expect(refused.note).toMatch(/fixed/);
    expect(setJudgedText(first.state, 'source_text').state).toBe(first.state);
  });

  it('the cases stay fixed even while the prompt is open: the test cases version is the same', async () => {
    const start = rerun(done()).state;
    const edited = setPrompt(start, `${start.evaluation.judge_set.prompt}\nBe strict.`).state;
    expect(await testCasesVersion(edited.evaluation.dataset.cases)).toBe(await testCasesVersion(done().evaluation.dataset.cases));
  });

  it('an edited prompt is a new judge version, and the new replies record it', async () => {
    const before = done();
    const start = rerun(before).state;
    const edited = setPrompt(start, `${start.evaluation.judge_set.prompt}\nBe strict about numbers.`).state;
    const oldVersion = await judgeVersion(before.evaluation.judge_set);
    const newVersion = await judgeVersion(edited.evaluation.judge_set);
    expect(newVersion).not.toBe(oldVersion);
    const first = await saveReply(edited, '1', reply);
    expect(first.state.evaluation.reply_judge_version).toBe(newVersion);
  });

  it('a prompt that is not edited keeps the judge version', async () => {
    const before = done();
    const start = rerun(before).state;
    expect(await judgeVersion(start.evaluation.judge_set)).toBe(await judgeVersion(before.evaluation.judge_set));
  });

  it('Reopen test cases after the reopening works as before and the flag does no harm', () => {
    const start = rerun(done()).state;
    expect(promptLocked({ ...start, evaluation: { ...start.evaluation, dataset: { ...start.evaluation.dataset, finalized: false } } })).toBe(false);
  });
});

describe('the unsaved work is asked about first', () => {
  it('asks with Save evaluation first, Discard and Cancel while there are unsaved changes, and not otherwise', () => {
    const guard = guardFor(done({ unsaved: true }), 'edit-judge-and-run-again');
    expect(guard?.choices).toEqual(['Save evaluation first', 'Discard', 'Cancel']);
    expect(guardFor(done({ unsaved: false }), 'edit-judge-and-run-again')).toBeNull();
  });
});

describe('both remembered files are forgotten, so the new run never overwrites the earlier one', () => {
  it('the next Save test project and Save evaluation each ask for a file', async () => {
    const ports = createFakePorts();
    const first = await saveEvaluation(done({ unsaved: true }), ports, env);
    await saveTestProject(first.state, ports, env);
    expect(ports.evaluationTarget.asked).toBe(1);
    expect(ports.testProjectTarget.asked).toBe(1);
    expect(first.state.evaluationFile).toBe('evaluation.json');

    const again = rerun(first.state, ports);
    expect(ports.evaluationTarget.fileName).toBeNull();
    expect(ports.testProjectTarget.fileName).toBeNull();
    expect(again.state.evaluationFile).toBeNull();
    expect(again.state.testProjectFile).toBeNull();

    await saveTestProject(again.state, ports, env);
    await saveEvaluation(again.state, ports, env);
    expect(ports.testProjectTarget.asked).toBe(2);
    expect(ports.evaluationTarget.asked).toBe(2);
  });
});

describe('the same test with another LLM (quickstart V10, step 2)', () => {
  it('loading the first run’s test project and entering other replies gives the same judge version, test cases version, metric and thresholds', async () => {
    const firstRun = done();
    const saver = createFakePorts();
    await saveTestProject(firstRun, saver, env);
    const projectText = saver.testProjectTarget.lastText!;
    const judgeV = await judgeVersion(firstRun.evaluation.judge_set);
    const casesV = await testCasesVersion(firstRun.evaluation.dataset.cases);

    const ports = createFakePorts();
    ports.opener.next = { name: 'first-run-test-project.json', text: projectText };
    const loaded = await loadTestProject(createState(), ports);
    expect(loaded.outcome).toBe('loaded');
    let state = modelDetailsEdit(loaded.state, 'another LLM\ntemperature 0.7');
    state = (await saveReply(state, '1', reply)).state;
    state = (await saveReply(state, '2', sampleEvaluation().replies['2']!.reply)).state;

    const e = state.evaluation;
    expect(e.reply_judge_version).toBe(judgeV);
    expect(await judgeVersion(e.judge_set)).toBe(judgeV);
    expect(await testCasesVersion(e.dataset.cases)).toBe(casesV);
    expect(e.metric).toEqual(firstRun.evaluation.metric);
    expect(e.checks).toEqual(firstRun.evaluation.checks);
    expect(e.model_note).toBe('another LLM\ntemperature 0.7');
    expect(Object.keys(e.replies)).toEqual(['1', '2']);
    expect(e.decisions).toEqual({});
    // a new file for the new run: the evaluation file of the first run is not remembered
    expect(state.evaluationFile).toBeNull();
    expect(state.testProjectFile).toBe('first-run-test-project.json');
  });
});
