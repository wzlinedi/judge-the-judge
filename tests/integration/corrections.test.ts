// Correcting the judge after replies (quickstart V8; FR-053, FR-075).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { correctRules } from '../../src/app/actions/decide';
import { removeRule, updateRule } from '../../src/app/actions/judge';
import { createState, type AppState } from '../../src/app/store';
import { reviewEvaluation } from '../../src/core/evaluation/results';
import { readTestProject } from '../../src/core/io/test-project-file';
import { judgeVersion } from '../../src/core/judge/version';
import type { CaseDecisions } from '../../src/core/model';
import { accuracyMetric, withRun } from '../helpers/fixtures';

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const expectedResults = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8')) as { decisions_after: Record<string, CaseDecisions> };

/** The demo with every awaiting case decided, as after the walk through of quickstart V7. */
const decided = (): AppState => ({
  ...createState(),
  step: 'judge',
  project: withRun(structuredClone(loaded.value.project), { decisions: structuredClone(expectedResults.decisions_after) }),
});

describe('correcting a rule after replies', () => {
  it('recomputes the automatic decisions, keeps those made by hand and changes the judge version, but not reply_judge_version', async () => {
    const before = decided();
    const versionBefore = await judgeVersion(before.project.judge_set);
    expect(before.project.testRun!.reply_judge_version).toBe(versionBefore);

    const edit = correctRules(before, removeRule(before, 0), accuracyMetric);
    expect(edit.state.project.testRun!.decisions).toEqual(before.project.testRun!.decisions);
    expect(edit.state.project.testRun!.reply_judge_version).toBe(versionBefore);
    expect(await judgeVersion(edit.state.project.judge_set)).not.toBe(versionBefore);

    const statuses = (s: AppState) => reviewEvaluation(s.project, accuracyMetric).map((r) => r.status);
    expect(statuses(edit.state)).not.toEqual(statuses(before));
  });

  it('lists the decisions that no longer match any item in one note', () => {
    const before = decided();
    const edit = correctRules(before, removeRule(before, 0), accuracyMetric);
    expect(edit.note).toMatch(/3 decisions/);
    for (const where of ['case 3', 'case 17', 'case 19']) expect(edit.note).toContain(where);
    expect(edit.note?.match(/\n/g) ?? []).toEqual([]);
  });

  it('says nothing about decisions when every one still matches an item', () => {
    const before = decided();
    const edit = correctRules(before, updateRule(before, 0, { name: 'Another name' }), accuracyMetric);
    expect(edit.note ?? '').not.toMatch(/decisions/);
    expect(edit.state.project.judge_set.error_rules[0]?.name).toBe('Another name');
  });

  it('keeps the note of the edit itself and does nothing before replies exist', () => {
    const empty = { ...decided(), project: withRun(decided().project, { replies: {}, decisions: {} }) };
    const edit = correctRules(empty, { state: empty, note: 'Paste a sample reply first.' }, accuracyMetric);
    expect(edit.note).toBe('Paste a sample reply first.');
  });
});
