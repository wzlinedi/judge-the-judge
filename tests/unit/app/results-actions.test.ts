// The actions of the Results step: the thresholds, "Load check settings" and "Export HTML report" (FR-069, FR-072).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changeThreshold, loadChecksFromFile } from '../../../src/app/actions/checks';
import { exportReport } from '../../../src/app/actions/export';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { accuracyMetric, sampleEvaluation } from '../../helpers/fixtures';

const state = (): AppState => ({ ...createState(), step: 'results', evaluation: sampleEvaluation() });
const rule = (s: AppState, measure: string) => s.evaluation.checks.rules.find((r) => r.measure === measure)!;

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

describe('loadChecksFromFile', () => {
  it('replaces the rules from the file and says that the minimum test size is fixed', async () => {
    const ports = createFakePorts();
    ports.opener.next = { name: 'checks-example.json', text: readFileSync('examples/metrics/checks-example.json', 'utf8') };
    const result = await loadChecksFromFile(state(), ports, accuracyMetric);
    expect(result.outcome).toBe('loaded');
    expect(rule(result.state, 'detection_rate').value).toBe(0.7);
    expect(rule(result.state, 'false_positive_rate').value).toBe(0.15);
    expect(result.state.unsaved).toBe(true);
    expect(result.message).toMatch(/minimum test size is fixed/);
  });

  it('describes an invalid file and keeps the rules in use', async () => {
    const ports = createFakePorts();
    const before = state();
    ports.opener.next = { name: 'bad.json', text: JSON.stringify({ format: 'judge-the-judge-checks', schema_version: 1, rules: [{ measure: 'f1', comparison: 'at_least', value: 0.5 }] }) };
    const result = await loadChecksFromFile(before, ports, accuracyMetric);
    expect(result.outcome).toBe('invalid');
    expect(result.problems?.[0]?.path).toBe('rules[0].measure');
    expect(result.state).toBe(before);
  });

  it('does nothing when the user cancels the file picker', async () => {
    const ports = createFakePorts();
    ports.opener.next = null;
    const before = state();
    const result = await loadChecksFromFile(before, ports, accuracyMetric);
    expect(result.outcome).toBe('cancelled');
    expect(result.state).toBe(before);
  });

  it('does not make the checks file the current file of the evaluation', async () => {
    const ports = createFakePorts();
    ports.opener.next = { name: 'checks-example.json', text: readFileSync('examples/metrics/checks-example.json', 'utf8') };
    const result = await loadChecksFromFile(state(), ports, accuracyMetric);
    expect(result.state.evaluationFile).toBeNull();
    expect(result.state.testProjectFile).toBeNull();
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

  it('marks a provisional report in its name and in its message', async () => {
    const e = sampleEvaluation();
    e.replies = {};
    const report = await exportReport({ ...state(), evaluation: e }, env, accuracyMetric);
    expect(report.provisional).toBe(true);
    expect(report.fileName).toBe('Book summaries - report (provisional).html');
    expect(report.message).toMatch(/provisional/i);
  });

  it('does not change the work and leaves it unsaved or saved as it was', async () => {
    const before = { ...state(), unsaved: false };
    await exportReport(before, env, accuracyMetric);
    expect(before.unsaved).toBe(false);
  });
});
