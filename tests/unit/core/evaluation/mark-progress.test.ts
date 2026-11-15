// T230: the meter "Marked N of M" in the case window of Run (FR-062, FR-064).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { markProgress } from '../../../../src/core/evaluation/mark-progress';
import { reviewEvaluation } from '../../../../src/core/evaluation/results';
import { readTestProject } from '../../../../src/core/io/test-project-file';
import { accuracyMetric } from '../../../helpers/fixtures';

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.project;
const caseOf = (id: string) => reviewEvaluation(demo, accuracyMetric).find((r) => r.testCase.id === id)!;

describe('markProgress', () => {
  it('counts every expected error and additional finding, and the ones that are not undecided', () => {
    const effective = caseOf('14').effective!;
    const total = effective.expected.length + effective.additional.length;
    const undecided = [...effective.expected, ...effective.additional].filter((i) => i.state === 'undecided').length;
    expect(markProgress(effective)).toEqual({ marked: total - undecided, total });
    expect(undecided).toBeGreaterThan(0);
  });

  it('counts Ignore as marked: the user decided it', () => {
    const effective = structuredClone(caseOf('14').effective!);
    for (const item of [...effective.expected, ...effective.additional]) item.state = 'ignored';
    const total = effective.expected.length + effective.additional.length;
    expect(markProgress(effective)).toEqual({ marked: total, total });
  });

  it('has nothing to mark for a case with no items', () => {
    const effective = structuredClone(caseOf('14').effective!);
    effective.expected = [];
    effective.additional = [];
    expect(markProgress(effective)).toEqual({ marked: 0, total: 0 });
  });
});
