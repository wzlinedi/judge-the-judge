// T462 (d) (code review 2026-11-17, finding 10; FR-068, T414): a project made in the page (not loaded) already holds a threshold rule for
// every measure, so Details on the Results step shows the same thresholds as the result checks, in both counting modes. The fill in
// `evaluateChecks` stays as the safety net that the T414 tests cover (owner's choice, 2026-11-17).
import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { emptyTestProject } from '../../../src/app/store';
import { measuresInUse } from '../../../src/core/evaluation/measures';
import { computeResults } from '../../../src/core/evaluation/results';
import { evaluateChecks, withDefaultRules } from '../../../src/core/metrics/checks';
import type { TestProject } from '../../../src/core/model';
import { DetailsSection } from '../../../src/ui/steps/results/DetailsSection';
import { accuracyMetric, biasVerdictMetric, sampleProject, verdictProject } from '../../helpers/fixtures';

const inPage = () => emptyTestProject().checks;

describe('the thresholds of a project made in the page (T462 d)', () => {
  it('needs no default rule added', () => {
    expect(withDefaultRules(inPage()).added).toEqual([]);
  });

  it.each([
    ['per expected error', sampleProject(), accuracyMetric, 'per_expected_error'],
    ['per case', verdictProject(), biasVerdictMetric, 'per_case'],
  ] as const)('%s: Details shows the thresholds that are checked', (_label, project, metric, mode) => {
    const p: TestProject = { ...project, checks: inPage() };
    const results = computeResults(p, metric);
    const { container } = render(<DetailsSection results={results} rules={p.checks.rules} onThreshold={() => {}} />);
    const shown = [...container.querySelectorAll<HTMLInputElement>('input[id^="threshold-"]')].map((i) => [i.id.replace('threshold-', ''), Number(i.value) / 100]);
    const checked = evaluateChecks(results.measures, p.checks, measuresInUse(mode)).map((o) => [o.measure, o.threshold]);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.sort()).toEqual(checked.sort());
  });
});
