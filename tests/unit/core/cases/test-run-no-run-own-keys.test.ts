// Before the test run starts there are no replies and no decisions: a case id that is a built-in JavaScript name finds nothing
// either (Constitution IX, S1, T410). Before the fix `repliesOf(project)['constructor']` was the `Object` function.
import { describe, expect, it } from 'vitest';
import { computeResults, reviewEvaluation } from '../../../../src/core/evaluation/results';
import { decisionsOf, repliesOf } from '../../../../src/core/cases/test-run';
import { testProjectFeedback } from '../../../../src/core/cases/feedback';
import { removalImpact, saveExpectedErrors } from '../../../../src/app/actions/cases';
import { createState } from '../../../../src/app/store';
import type { TestProject } from '../../../../src/core/model';
import { accuracyMetric, notStartedProject } from '../../../helpers/fixtures';

const NAMES = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];

/** The test project with no test run, its cases renamed to built-in names. */
function project(): TestProject {
  const base = notStartedProject();
  const [first] = base.dataset.cases;
  const cases = NAMES.map((id) => ({ ...first!, id, name: id }));
  return { ...base, dataset: { ...base.dataset, cases } };
}

describe('a case id that is a built-in JavaScript name, before the test run starts (T410)', () => {
  it('reviewEvaluation and computeResults do not throw and every such case is Not run', () => {
    const p = project();
    expect(reviewEvaluation(p, accuracyMetric).map((r) => r.status)).toEqual(NAMES.map(() => 'not_run'));
    expect(() => computeResults(p, accuracyMetric)).not.toThrow();
  });

  it.each(NAMES)('%s: repliesOf and decisionsOf hold no value for it', (id) => {
    const p = project();
    expect(repliesOf(p)[id]).toBeUndefined();
    expect(decisionsOf(p)[id]).toBeUndefined();
  });

  it('testProjectFeedback counts no case with a reply', () => {
    expect(testProjectFeedback(project()).withReply).toBe(0);
  });

  it.each(NAMES)('%s: removalImpact says no reply and no decision', (id) => {
    const state = { ...createState(), project: project() };
    expect(removalImpact(state, id)).toEqual({ hasReply: false, decisions: 0 });
  });

  it('saveExpectedErrors works for a case named constructor', () => {
    const state = { ...createState(), project: project() };
    const text = JSON.stringify([{ description: 'Profession changed.', category: 'factual-error', fragment: 'Anna is a baker', difficulty: 'obvious' }]);
    const edit = saveExpectedErrors(state, 'constructor', text);
    expect(edit.problems ?? []).toEqual([]);
    expect(edit.state.project.dataset.cases.find((c) => c.id === 'constructor')!.expected_errors).toHaveLength(1);
  });
});
