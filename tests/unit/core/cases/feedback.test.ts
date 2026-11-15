// Live feedback on the test cases being built (FR-045, FR-046).
import { describe, expect, it } from 'vitest';
import { testProjectFeedback } from '../../../../src/core/cases/feedback';
import type { TestProject, TestCase } from '../../../../src/core/model';
import { sampleProject, verdictProject } from '../../../helpers/fixtures';
import { withoutTestRun } from '../../../../src/core/cases/test-run';

const make = (cases: TestCase[], over: Partial<TestProject> = {}): TestProject => ({ ...withoutTestRun(sampleProject()), dataset: { name: 'p', cases }, ...over });
const clean = (id: string, text = `clean text ${id}`): TestCase => ({ id, name: `c${id}`, fields: { source_text: text, summary: text }, expected_errors: [] });
const withErrors = (id: string, errors: number, difficulty: 'obvious' | 'subtle' = 'obvious'): TestCase => ({
  id,
  name: `e${id}`,
  fields: { source_text: `source ${id}`, summary: `summary ${id}` },
  expected_errors: Array.from({ length: errors }, (_, i) => ({ id: `e${i + 1}`, description: 'd', category: 'factual-error', fragment: `f${i}`, difficulty })),
});

describe('testProjectFeedback', () => {
  it('counts the cases, the clean ones, the ones with injected errors, the ones with a reply and the injected errors', () => {
    const f = testProjectFeedback(sampleProject());
    expect(f).toMatchObject({ total: 2, clean: 1, withErrors: 1, withReply: 2, errorsTotal: 2 });
  });

  it('groups the cases with errors by the number of errors', () => {
    const f = testProjectFeedback(make([withErrors('1', 2), withErrors('2', 3), withErrors('3', 2), clean('4')]));
    expect(f.byErrorCount).toEqual([{ errors: 2, cases: 2 }, { errors: 3, cases: 1 }]);
    expect(f.errorsTotal).toBe(7);
  });

  it('gives the totals against the minimums as met or "missing N"', () => {
    const small = testProjectFeedback(sampleProject());
    expect(small.size.errors).toEqual({ have: 2, need: 30, missing: 28, met: false });
    expect(small.size.clean).toEqual({ have: 1, need: 10, missing: 9, met: false });
    const cases = [...Array.from({ length: 10 }, (_, i) => withErrors(`e${i}`, 3, i === 0 ? 'subtle' : 'obvious')), ...Array.from({ length: 10 }, (_, i) => clean(`c${i}`))];
    const big = testProjectFeedback(make(cases));
    expect(big.size.errors).toMatchObject({ have: 30, missing: 0, met: true });
    expect(big.size.clean).toMatchObject({ have: 10, missing: 0, met: true });
  });

  it('says that a reliable answer needs the minimums, and that it is Inconclusive until then', () => {
    expect(testProjectFeedback(sampleProject()).size.sentence).toBe('A reliable answer needs at least 30 injected errors and 10 clean cases; until then the result is Inconclusive.');
    const cases = [...Array.from({ length: 10 }, (_, i) => withErrors(`e${i}`, 3, i === 0 ? 'subtle' : 'obvious')), ...Array.from({ length: 10 }, (_, i) => clean(`c${i}`))];
    expect(testProjectFeedback(make(cases)).size.sentence).toMatch(/enough for a reliable answer/);
  });

  it('counts cases with expected errors instead of injected errors for a judge evaluated per case', () => {
    const f = testProjectFeedback(verdictProject());
    expect(f.size.unit).toBe('cases with expected errors');
    expect(f.size.errors).toEqual({ have: 3, need: 30, missing: 27, met: false });
    expect(f.size.sentence).toBe('A reliable answer needs at least 30 cases with expected errors and 10 clean cases; until then the result is Inconclusive.');
    expect(testProjectFeedback(sampleProject()).size.unit).toBe('injected errors');
  });

  it('warns when one kind is missing, and says some measures cannot be computed without both', () => {
    const onlyErrors = testProjectFeedback(make([withErrors('1', 2, 'subtle')]));
    expect(onlyErrors.warnings.join(' ')).toMatch(/no clean cases/i);
    expect(onlyErrors.warnings.join(' ')).toMatch(/false-positive rate cannot be computed/i);
    const onlyClean = testProjectFeedback(make([clean('1'), clean('2')]));
    expect(onlyClean.warnings.join(' ')).toMatch(/no cases with injected errors/i);
    expect(onlyClean.warnings.join(' ')).toMatch(/detection rate cannot be computed/i);
  });

  it('has no kind warning when both kinds are there, and none for an empty project', () => {
    expect(testProjectFeedback(sampleProject()).warnings).toEqual([]);
    expect(testProjectFeedback(make([])).warnings).toEqual([]);
  });

  it('warns when no expected error is subtle, and only when there are expected errors', () => {
    expect(testProjectFeedback(make([withErrors('1', 2), clean('2')])).warnings.join(' ')).toMatch(/no expected error is marked subtle/i);
    expect(testProjectFeedback(make([clean('1'), clean('2')])).warnings.join(' ')).not.toMatch(/subtle/i);
  });

  it('flags two cases whose fields are all identical as duplicates, and names them', () => {
    const f = testProjectFeedback(make([clean('1', 'same'), clean('2', 'same'), clean('3', 'other'), withErrors('4', 1, 'subtle')]));
    expect(f.duplicates).toEqual([['1', '2']]);
    expect(f.warnings.join(' ')).toMatch(/cases 1 and 2 have identical fields/i);
  });

  it('groups three duplicates in one warning, and does not flag a case that differs in one field', () => {
    const f = testProjectFeedback(make([clean('1', 'same'), clean('2', 'same'), clean('3', 'same')]));
    expect(f.duplicates).toEqual([['1', '2', '3']]);
    const different = clean('5', 'same');
    different.fields['summary'] = 'changed';
    expect(testProjectFeedback(make([clean('1', 'same'), different])).duplicates).toEqual([]);
  });

  it('gives the remaining capacity up to 500 cases', () => {
    expect(testProjectFeedback(sampleProject()).capacity).toEqual({ limit: 500, used: 2, remaining: 498, full: false });
    const full = testProjectFeedback(make(Array.from({ length: 500 }, (_, i) => clean(String(i), `t${i}`))));
    expect(full.capacity).toEqual({ limit: 500, used: 500, remaining: 0, full: true });
  });
});
