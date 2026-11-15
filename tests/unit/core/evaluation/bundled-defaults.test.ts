// T273: the default thresholds and the fixed minimum sample are data, read from the bundled file, not code (Constitution VI).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/core/metrics/builtin/checks.default.json', () => ({
  default: {
    format: 'judge-the-judge-checks',
    schema_version: 1,
    rules: [{ measure: 'detection_rate', comparison: 'at_least', value: 0.55 }],
    minimum_sample: { expected_errors: 7, clean_cases: 3 },
  },
}));

describe('the bundled checks file', () => {
  it('gives the minimum sample', async () => {
    const { MINIMUM_SAMPLE } = await import('../../../../src/core/evaluation/results');
    expect(MINIMUM_SAMPLE).toEqual({ expected_errors: 7, clean_cases: 3 });
  });

  it('gives the default rules of a new test project', async () => {
    const { DEFAULT_CHECKS, emptyEvaluation } = await import('../../../../src/app/store');
    expect(DEFAULT_CHECKS.rules).toEqual([{ measure: 'detection_rate', comparison: 'at_least', value: 0.55 }]);
    expect(emptyEvaluation().checks).toEqual(DEFAULT_CHECKS);
  });
});
