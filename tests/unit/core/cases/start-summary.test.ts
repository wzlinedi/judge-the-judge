// What the user sees before the start the test cases, and whether starting is allowed (FR-052, SC-014, SC-025).
import { describe, expect, it } from 'vitest';
import { startSummary } from '../../../../src/core/cases/start-summary';
import type { TestProject, TestCase } from '../../../../src/core/model';
import { sampleProject } from '../../../helpers/fixtures';
import { withoutTestRun } from '../../../../src/core/cases/test-run';

const make = (cases: TestCase[], over: Partial<TestProject> = {}): TestProject => ({ ...withoutTestRun(sampleProject()), dataset: { name: 'p', cases }, ...over });
const clean = (id: string): TestCase => ({ id, name: `c${id}`, fields: { source_text: `source ${id}`, summary: `summary ${id}` }, expected_errors: [] });
const withErrors = (id: string, difficulty: 'obvious' | 'subtle' = 'obvious'): TestCase => ({
  id,
  name: `e${id}`,
  fields: { source_text: `source ${id}`, summary: `summary ${id}` },
  expected_errors: [{ id: 'e1', description: 'd', category: 'factual-error', fragment: 'summary', difficulty }],
});
/** Big enough: 30 injected errors, 10 clean cases, one of the errors subtle. */
const bigEnough = (): TestCase[] => [
  ...Array.from({ length: 30 }, (_, i) => withErrors(`e${i + 1}`, i === 0 ? 'subtle' : 'obvious')),
  ...Array.from({ length: 10 }, (_, i) => clean(`c${i + 1}`)),
];

describe('whether starting is allowed', () => {
  it('is refused for empty test cases, and says what to do', () => {
    const summary = startSummary(make([]));
    expect(summary.allowed).toBe(false);
    expect(summary.refusal).toMatch(/no test cases/i);
    expect(summary.refusal).toMatch(/add|import/i);
  });

  it('is refused for an empty judge prompt, also when it is only blanks', () => {
    for (const prompt of ['', '  \n ']) {
      const e = make([clean('1'), withErrors('2')]);
      const summary = startSummary({ ...e, judge_set: { ...e.judge_set, prompt } });
      expect(summary.allowed).toBe(false);
      expect(summary.refusal).toMatch(/judge prompt is empty/i);
    }
  });

  it('is allowed with any warning: the user decides', () => {
    const summary = startSummary(make([withErrors('1')]));
    expect(summary.allowed).toBe(true);
    expect(summary.refusal).toBeUndefined();
    expect(summary.warnings.length).toBeGreaterThan(0);
  });

  it('is allowed again when the test run has already started and nothing is wrong (starting twice changes nothing)', () => {
    expect(startSummary(sampleProject()).allowed).toBe(true);
  });
});

describe('counts and balance', () => {
  it('gives the counts of cases, clean cases, cases with injected errors and injected errors', () => {
    const { feedback } = startSummary(make([clean('1'), withErrors('2'), withErrors('3')]));
    expect(feedback).toMatchObject({ total: 3, clean: 1, withErrors: 2, errorsTotal: 2 });
    expect(feedback.byErrorCount).toEqual([{ errors: 1, cases: 2 }]);
  });

  it('shows the test size against the fixed minimums', () => {
    const { feedback } = startSummary(make([clean('1'), withErrors('2')]));
    expect(feedback.size.errors).toMatchObject({ have: 1, need: 30, missing: 29, met: false });
    expect(feedback.size.clean).toMatchObject({ have: 1, need: 10, missing: 9, met: false });
  });
});

describe('warnings', () => {
  const text = (e: TestProject) => startSummary(e).warnings.join('\n');

  it('names a missing kind: no clean cases, no cases with injected errors', () => {
    expect(text(make([withErrors('1', 'subtle')]))).toMatch(/no clean cases/i);
    expect(text(make([clean('1')]))).toMatch(/no cases with injected errors/i);
  });

  it('warns when no expected error is marked subtle', () => {
    expect(text(make([clean('1'), withErrors('2', 'obvious')]))).toMatch(/no expected error is marked subtle/i);
    expect(text(make([clean('1'), withErrors('2', 'subtle')]))).not.toMatch(/subtle/i);
  });

  it('warns when the test size is below the minimum, and says the result is Inconclusive until then', () => {
    expect(text(make([clean('1'), withErrors('2', 'subtle')]))).toMatch(/Inconclusive/);
    expect(text(make(bigEnough()))).not.toMatch(/Inconclusive/);
  });

  it('has no warning at all for a big enough, balanced test project with a readable judge', () => {
    expect(startSummary(make(bigEnough())).warnings).toEqual([]);
  });

  it('warns when replies cannot be read automatically: no sample reply, an unreadable one', () => {
    const e = make(bigEnough());
    const { sample_reply: _sample, ...withoutSample } = e.judge_set;
    expect(text({ ...e, judge_set: withoutSample })).toMatch(/no sample reply/i);
    expect(text({ ...e, judge_set: { ...e.judge_set, sample_reply: 'I think it is fine.' } })).toMatch(/sample reply cannot be read/i);
  });

  it('warns about a broken rule and says every case will then need verification (SC-014)', () => {
    const e = make(bigEnough());
    const rule = e.judge_set.error_rules[0]!;
    const broken = { ...rule, name: 'Broken one', conditions: [{ ...rule.conditions[0]!, field: 'claims[].no_such_field' }] };
    const warning = startSummary({ ...e, judge_set: { ...e.judge_set, error_rules: [broken, ...e.judge_set.error_rules.slice(1)] } }).warnings.find((w) => /Broken one/.test(w));
    expect(warning).toMatch(/is broken/);
    expect(warning).toMatch(/verification/);
  });

  it('warns when there is no error rule', () => {
    const e = make(bigEnough());
    expect(text({ ...e, judge_set: { ...e.judge_set, error_rules: [] } })).toMatch(/no error rule/i);
  });

  it('names the cases that lack a field for a variable of the prompt (FR-047)', () => {
    const cases = bigEnough();
    cases[0] = { ...cases[0]!, fields: { source_text: 'only the source' } };
    cases[1] = { ...cases[1]!, fields: { source_text: 'only the source, too' } };
    const warning = startSummary(make(cases)).warnings.find((w) => /no field/.test(w));
    expect(warning).toBe('Cases e1 and e2 have no field for the variable "summary"; it will be empty in the prompt.');
  });

  it('names a single case in the singular', () => {
    const cases = bigEnough();
    cases[3] = { ...cases[3]!, fields: { summary: 'only the summary' } };
    expect(startSummary(make(cases)).warnings).toContain('Case e4 has no field for the variable "source_text"; it will be empty in the prompt.');
  });

  it('repeats the duplicate warning of the card, so nothing is lost between the card and the dialog', () => {
    const cases = bigEnough();
    cases[11] = { ...cases[11]!, fields: { ...cases[10]!.fields } };
    expect(text(make(cases))).toMatch(/identical fields/i);
  });

  it('puts every warning once, in a fixed order', () => {
    const e = make([withErrors('1', 'obvious')]);
    const warnings = startSummary(e).warnings;
    expect(new Set(warnings).size).toBe(warnings.length);
    expect(startSummary(e).warnings).toEqual(warnings);
  });
});
