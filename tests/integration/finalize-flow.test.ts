// User Story 11: imported and added cases join one test project, are finalized, and what stays fixed or open afterwards
// (FR-039, FR-049, FR-053, FR-076, FR-089).
import { describe, expect, it } from 'vitest';
import { correctExpectedErrors, removeCase, renameCase, saveCaseFromJson } from '../../src/app/actions/cases';
import { editTestCases, finalize } from '../../src/app/actions/finalize';
import { setJudgedText, setRuleWhere, setPrompt, updateRule } from '../../src/app/actions/judge';
import { saveReply } from '../../src/app/actions/replies';
import { applyImport, prepareImport } from '../../src/app/actions/test-cases-file';
import { createFakePorts } from '../../src/app/ports/fakes';
import { createState, type AppState } from '../../src/app/store';
import { sampleEvaluation } from '../helpers/fixtures';

const source = 'Anna is a baker. She bought a second oven in 1998.';
const json = (name: string, summary: string, errors: unknown[] = []) => JSON.stringify({ name, fields: { source_text: source, summary }, expected_errors: errors });
const doctor = { category: 'factual-error', fragment: 'Anna is a doctor', description: 'Profession changed', difficulty: 'subtle' };
const rows = 'name,field:source_text,field:summary\n' + Array.from({ length: 10 }, (_, i) => `Imported ${i + 1},${source},Summary number ${i + 1}`).join('\n') + '\n';

/** An open test project (nothing finalized, no cases) with the judge of the sample. */
const open = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { name: 'Book summaries', finalized: false, cases: [] }, replies: {}, decisions: {} } };
};

const imported = async (state: AppState, text = rows): Promise<AppState> => {
  const ports = createFakePorts();
  ports.opener.next = { name: 'cases.csv', text };
  const prepared = await prepareImport(state, ports);
  if (prepared.outcome !== 'ready') throw new Error('not ready');
  return applyImport(state, prepared.plan).state;
};

const twelve = async (): Promise<AppState> => {
  let state = await imported(open());
  state = saveCaseFromJson(state, json('Added clean', 'Anna works as a baker.'), { mode: 'paste' }).state;
  state = saveCaseFromJson(state, json('Added with error', 'Anna is a doctor. She bought a second oven in 1998.', [doctor]), { mode: 'paste' }).state;
  return state;
};

const finalized = async (): Promise<AppState> => {
  const done = finalize(await twelve());
  if (done.state.evaluation.dataset.finalized !== true) throw new Error('not finalized');
  return done.state;
};

describe('cases from a file and cases made in the tool', () => {
  it('10 imported and 2 added cases are one test project of 12 cases with their own identifiers', async () => {
    const state = await twelve();
    expect(state.evaluation.dataset.cases).toHaveLength(12);
    expect(state.evaluation.dataset.cases.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(state.evaluation.dataset.finalized).toBe(false);
  });
});

describe('finalize', () => {
  it('fixes the test cases, marks the work unsaved and keeps everything it was', async () => {
    const before = await twelve();
    const done = finalize(before);
    expect(done.state.evaluation.dataset.finalized).toBe(true);
    expect(done.state.evaluation.dataset.cases).toEqual(before.evaluation.dataset.cases);
    expect(done.state.unsaved).toBe(true);
  });

  it('is refused for empty test cases and for an empty prompt, and changes nothing', async () => {
    const empty = open();
    const none = finalize(empty);
    expect(none.state).toBe(empty);
    expect(none.note).toMatch(/no test cases/i);
    const state = await twelve();
    const blank = finalize({ ...state, evaluation: { ...state.evaluation, judge_set: { ...state.evaluation.judge_set, prompt: '' } } });
    expect(blank.state.evaluation.dataset.finalized).toBe(false);
    expect(blank.note).toMatch(/judge prompt is empty/i);
  });

  it('does not stop at a warning: a project of one kind finalizes', () => {
    const state = open();
    const one = saveCaseFromJson(state, json('Only', 'Anna works as a baker.'), { mode: 'paste' }).state;
    expect(finalize(one).state.evaluation.dataset.finalized).toBe(true);
  });
});

describe('what is fixed after finalizing', () => {
  it('the judge prompt and the judged text cannot be changed', async () => {
    const state = await finalized();
    const prompt = setPrompt(state, 'Another prompt {{summary}}');
    expect(prompt.state).toBe(state);
    expect(prompt.note).toMatch(/fixed/);
    const judged = setJudgedText(state, 'source_text');
    expect(judged.state).toBe(state);
  });

  it('the fields and identifiers of a case are fixed: correcting expected errors through JSON cannot change a field', async () => {
    const state = await finalized();
    const original = state.evaluation.dataset.cases.find((c) => c.id === '12')!;
    const changed = JSON.stringify({ fields: { ...original.fields, summary: 'Anna is a lawyer.' }, expected_errors: original.expected_errors });
    const refused = correctExpectedErrors(state, '12', changed);
    expect(refused.state).toBe(state);
    expect(refused.problems?.length).toBeGreaterThan(0);
  });

  it('replies are accepted only after finalizing', async () => {
    const reply = sampleEvaluation().replies['1']!.reply;
    const before = await saveReply(await twelve(), '1', reply);
    expect(before.status).toBe('refused');
    expect(before.message).toMatch(/Finalize the test cases/);
    const after = await saveReply(await finalized(), '1', reply);
    expect(after.status).toBe('saved');
  });
});

describe('what may still change after finalizing', () => {
  it('cases may still be added and imported; they start without a reply and the others stay as they are', async () => {
    let state = await finalized();
    state = saveCaseFromJson(state, json('Thirteenth', 'Anna works as a baker, as before.'), { mode: 'paste' }).state;
    expect(state.evaluation.dataset.cases).toHaveLength(13);
    expect(state.evaluation.dataset.finalized).toBe(true);

    state = await imported(state, 'name,field:source_text,field:summary\nLater import,Source,Another text\n');
    expect(state.evaluation.dataset.cases).toHaveLength(14);
    expect(state.evaluation.dataset.finalized).toBe(true);
  });

  it('a case without a reply may be renamed, removed and have its expected errors corrected; a case with a reply may be renamed and removed (with its reply), but its expected errors may not be corrected', async () => {
    let state = await finalized();
    const reply = sampleEvaluation().replies['1']!.reply;
    state = (await saveReply(state, '1', reply)).state;

    expect(renameCase(state, '2', 'Renamed').state.evaluation.dataset.cases.find((c) => c.id === '2')?.name).toBe('Renamed');
    expect(removeCase(state, '3').state.evaluation.dataset.cases).toHaveLength(11);
    const original = state.evaluation.dataset.cases.find((c) => c.id === '12')!;
    const corrected = correctExpectedErrors(state, '12', JSON.stringify({ fields: original.fields, expected_errors: [{ ...doctor, difficulty: 'obvious' }] }));
    expect(corrected.state.evaluation.dataset.cases.find((c) => c.id === '12')?.expected_errors[0]?.difficulty).toBe('obvious');

    expect(renameCase(state, '1', 'No').state.evaluation.dataset.cases.find((c) => c.id === '1')?.name).toBe('No');
    const removed = removeCase(state, '1').state.evaluation;
    expect(removed.dataset.cases.some((c) => c.id === '1')).toBe(false);
    expect(removed.replies['1']).toBeUndefined();
    expect(correctExpectedErrors(state, '1', json('x', 'y')).state).toBe(state);
  });

  it('the reply mapping and the error rules may be corrected', async () => {
    const state = await finalized();
    const rule = updateRule(state, 0, { name: 'A better name' });
    expect(rule.state.evaluation.judge_set.error_rules[0]?.name).toBe('A better name');
    expect(setRuleWhere(state, 0, 'claims[].text').state.evaluation.dataset.finalized).toBe(true);
  });
});

describe('Edit test cases', () => {
  it('while no reply exists it opens the test cases and the prompt again, loses nothing and keeps both remembered files', async () => {
    const state: AppState = { ...(await finalized()), testProjectFile: 'cases.json', evaluationFile: 'run.json', hasFile: true, step: 'run' };
    const edited = editTestCases(state);
    expect(edited.state.evaluation.dataset.finalized).toBe(false);
    expect(edited.state.evaluation.dataset.cases).toEqual(state.evaluation.dataset.cases);
    expect(edited.state.evaluation.judge_set).toEqual(state.evaluation.judge_set);
    expect(edited.state.testProjectFile).toBe('cases.json');
    expect(edited.state.evaluationFile).toBe('run.json');
    expect(edited.state.step).toBe('cases');
    expect(edited.note).toMatch(/open again/i);
    expect(setPrompt(edited.state, 'Compare {{source_text}} with {{summary}}').state.evaluation.judge_set.prompt).toBe('Compare {{source_text}} with {{summary}}');
  });

  it('is not allowed before finalizing', async () => {
    const state = await twelve();
    const edited = editTestCases(state);
    expect(edited.state).toBe(state);
    expect(edited.note).toBeDefined();
  });

  it('is not allowed after the first reply, and says what to do instead', async () => {
    const state = (await saveReply(await finalized(), '1', sampleEvaluation().replies['1']!.reply)).state;
    const edited = editTestCases(state);
    expect(edited.state).toBe(state);
    expect(edited.note).toMatch(/first reply/i);
    expect(edited.note).toMatch(/Edit the judge and run again|Start new evaluation/);
  });

  it('the test cases are finalized again before replies can be entered', async () => {
    const opened = editTestCases(await finalized()).state;
    expect((await saveReply(opened, '1', sampleEvaluation().replies['1']!.reply)).status).toBe('refused');
    const again = finalize(opened).state;
    expect((await saveReply(again, '1', sampleEvaluation().replies['1']!.reply)).status).toBe('saved');
  });
});
