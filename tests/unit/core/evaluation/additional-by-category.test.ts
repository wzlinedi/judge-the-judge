// Additional findings per category and per difficulty (FR-062, FR-070).
import { describe, expect, it } from 'vitest';
import { computeResults } from '../../../../src/core/evaluation/results';
import { readTestProject, writeTestProject } from '../../../../src/core/io/test-project-file';
import { accuracyMetric, sampleProject } from '../../../helpers/fixtures';

describe('additional findings per category and per difficulty', () => {
  it('counts real errors and false positives, with "(no category)" and "(not set)"', () => {
    const c = computeResults(sampleProject(), accuracyMetric).counters;
    expect(c.additional_per_category).toEqual({ 'factual-error': { real: 1, fp: 0 }, '(no category)': { real: 0, fp: 1 } });
    expect(c.additional_per_difficulty).toEqual({ obvious: { real: 1, fp: 0 }, '(not set)': { real: 0, fp: 1 } });
  });

  it('leaves an ignored finding out', () => {
    const e = sampleProject();
    e.testRun!.decisions['2']!.added_findings[0]!.state = 'ignored';
    const c = computeResults(e, accuracyMetric).counters;
    expect(c.additional_per_category).toEqual({ '(no category)': { real: 0, fp: 1 } });
    expect(c.ignored_additional).toBe(1);
  });

  it('is written to the test_run section and recomputed identically on load', async () => {
    const e = sampleProject();
    const results = computeResults(e, accuracyMetric);
    const text = writeTestProject(e, results, { now: '2026-01-01T00:00:00Z', toolVersion: 't', judgeVersion: 'j', testCasesVersion: 'c' });
    const file = JSON.parse(text);
    expect(file.test_run.results.counters.additional_per_category).toEqual(results.counters.additional_per_category);
    expect(file.test_run.results.counters.additional_per_difficulty).toEqual(results.counters.additional_per_difficulty);
    const read = readTestProject(text);
    if (!read.ok) throw new Error('not readable');
    expect(computeResults(read.value.project, accuracyMetric).counters).toEqual(results.counters);
  });
});
