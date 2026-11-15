// The actions of the Results step: the thresholds and "Export HTML report" (FR-069, FR-072).
import { describe, expect, it } from 'vitest';
import { changeThreshold } from '../../../src/app/actions/checks';
import { exportReport } from '../../../src/app/actions/export';
import { createState, type AppState } from '../../../src/app/store';
import { accuracyMetric, sampleProject, withRun } from '../../helpers/fixtures';

const state = (): AppState => ({ ...createState(), step: 'results', project: sampleProject() });
const rule = (s: AppState, measure: string) => s.project.checks.rules.find((r) => r.measure === measure)!;

describe('changeThreshold', () => {
  it('changes the value of one rule and marks the work unsaved', () => {
    const before = state();
    const after = changeThreshold(before, 'detection_rate', 0.65);
    expect(rule(after, 'detection_rate').value).toBe(0.65);
    expect(rule(after, 'false_positive_rate')).toEqual(rule(before, 'false_positive_rate'));
    expect(after.unsaved).toBe(true);
    expect(rule(before, 'detection_rate').value).toBe(0.8);
  });

  it('refuses a value outside 0 to 1 and an unknown measure, changing nothing', () => {
    const before = state();
    expect(changeThreshold(before, 'detection_rate', 1.2)).toBe(before);
    expect(changeThreshold(before, 'detection_rate', Number.NaN)).toBe(before);
    expect(changeThreshold(before, 'nope', 0.5)).toBe(before);
  });
});

describe('exportReport', () => {
  const env = { now: () => '2026-11-14T10:00:00Z', toolVersion: '9.9.9' };

  it('builds the report of the current work with a file name from the test project name', async () => {
    const report = await exportReport(state(), env, accuracyMetric);
    expect(report.fileName).toBe('Book summaries - report.html');
    expect(report.html).toContain('9.9.9');
    expect(report.html).toContain('2026-11-14');
    expect(report.html).toMatch(/Judge version<\/dt><dd>[0-9a-f]{12}/);
  });

  it('does not call a report provisional: the name is the same, and the message says how many cases are not decided yet (T267)', async () => {
    const e = withRun(sampleProject(), { replies: {}, decisions: {} });
    const report = await exportReport({ ...state(), project: e }, env, accuracyMetric);
    expect(report.fileName).toBe('Book summaries - report.html');
    expect(report.message).toMatch(/2 cases are not decided yet/);
    expect(report.message).not.toMatch(/provisional/i);
    expect(report.html).not.toMatch(/provisional/i);
  });

  it('does not change the work and leaves it unsaved or saved as it was', async () => {
    const before = { ...state(), unsaved: false };
    await exportReport(before, env, accuracyMetric);
    expect(before.unsaved).toBe(false);
  });
});
