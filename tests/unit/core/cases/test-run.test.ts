// The test run part of a test project (data-model.md, TestRun; T289): started or not, and what changes with it.
import { describe, expect, it } from 'vitest';
import { decisionsOf, emptyTestRun, isStarted, repliesOf, replyCount, updateTestRun, withoutReply, withoutTestRun } from '../../../../src/core/cases/test-run';
import { notStartedProject, sampleProject } from '../../../helpers/fixtures';

describe('started', () => {
  it('is true exactly when the test run is there, also with no reply', () => {
    expect(isStarted(sampleProject())).toBe(true);
    expect(isStarted({ testRun: emptyTestRun() })).toBe(true);
    expect(isStarted(notStartedProject())).toBe(false);
  });

  it('starts empty: no reply, no decision and no model details', () => {
    expect(emptyTestRun()).toEqual({ replies: {}, decisions: {}, model_note: '' });
    expect(emptyTestRun()).not.toBe(emptyTestRun());
  });
});

describe('reading a test project that has not started', () => {
  it('has no replies and no decisions, and counts none', () => {
    const project = notStartedProject();
    expect(repliesOf(project)).toEqual({});
    expect(decisionsOf(project)).toEqual({});
    expect(replyCount(project)).toBe(0);
  });

  it('counts the replies of a started one', () => {
    expect(replyCount(sampleProject())).toBe(2);
    expect(Object.keys(repliesOf(sampleProject()))).toEqual(['1', '2']);
    expect(Object.keys(decisionsOf(sampleProject()))).toEqual(['2']);
  });
});

describe('updateTestRun', () => {
  it('changes the test run of a started project and nothing else', () => {
    const project = sampleProject();
    const next = updateTestRun(project, (run) => ({ ...run, model_note: 'other model' }));
    expect(next.testRun?.model_note).toBe('other model');
    expect(next.dataset).toBe(project.dataset);
    expect(project.testRun?.model_note).toBe('model X\ntemperature 0');
  });

  it('returns a project that has not started as it is: there is no test run to change', () => {
    const project = notStartedProject();
    expect(updateTestRun(project, (run) => ({ ...run, model_note: 'x' }))).toBe(project);
  });
});

describe('withoutReply', () => {
  it('removes the reply and the decisions of the case and keeps the rest', () => {
    const run = sampleProject().testRun!;
    const next = withoutReply(run, '1');
    expect(Object.keys(next.replies)).toEqual(['2']);
    expect(next.reply_judge_version).toBe('aaaaaaaaaaaa');
    expect(withoutReply(run, '2').decisions).toEqual({});
  });

  it('starts the run again from nothing when the last reply goes: the judge version and the way of counting go too (FR-075)', () => {
    const run = { ...sampleProject().testRun!, replies: { '2': sampleProject().testRun!.replies['2']! }, reply_counted_per: 'case' as const, rules_corrected_after_replies: true };
    const next = withoutReply(run, '2');
    expect(next.replies).toEqual({});
    expect(next).not.toHaveProperty('reply_judge_version');
    expect(next).not.toHaveProperty('reply_counted_per');
    expect(next).not.toHaveProperty('rules_corrected_after_replies');
    expect(next.model_note).toBe('model X\ntemperature 0');
  });
});

describe('withoutTestRun', () => {
  it('drops the test run and the "added after first reply" marks, and gives back a project that has not started', () => {
    const dropped = withoutTestRun(sampleProject());
    expect(isStarted(dropped)).toBe(false);
    expect(dropped.dataset.cases.every((c) => c.changed_after_first_reply === undefined)).toBe(true);
  });
});
