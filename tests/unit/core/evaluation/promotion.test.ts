// T253: an additional error marked "Real error (missed in scenario)" becomes an expected error of its test case, at once,
// and goes back when its mark changes or the finding is removed.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { removeFinding } from '../../../../src/app/actions/decide';
import { dropPromotion, syncPromotions } from '../../../../src/core/evaluation/promotion';
import { reviewEvaluation } from '../../../../src/core/evaluation/results';
import { computeResults } from '../../../../src/core/evaluation/results';
import { readEvaluation } from '../../../../src/core/io/evaluation-file';
import type { CaseDecisions, Evaluation } from '../../../../src/core/model';
import { accuracyMetric } from '../../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.evaluation;

const empty = (): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '' });
const withDecisions = (e: Evaluation, id: string, d: Partial<CaseDecisions>): Evaluation => ({ ...e, decisions: { ...e.decisions, [id]: { ...(e.decisions[id] ?? empty()), ...d } } });
const sync = (e: Evaluation, id: string) => syncPromotions(e, reviewEvaluation(e, accuracyMetric).find((r) => r.testCase.id === id)!);
const caseOf = (e: Evaluation, id: string) => e.dataset.cases.find((c) => c.id === id)!;
const reviewOf = (e: Evaluation, id: string) => reviewEvaluation(e, accuracyMetric).find((r) => r.testCase.id === id)!;
const real = (e: Evaluation) => withDecisions(e, '19', { additional: { 'claims[]#3': { state: 'real_error', source: 'manual' } } });

describe('promoting a real error', () => {
  it('adds an expected error with the next free identifier, the text of the finding as its fragment, and says so', () => {
    const before = caseOf(demo, '19').expected_errors;
    const r = sync(real(demo), '19');
    const after = caseOf(r.evaluation, '19').expected_errors;
    expect(after).toHaveLength(before.length + 1);
    const added = after.at(-1)!;
    expect(added.id).toBe(`e${before.length + 1}`);
    expect(added.fragment).toBe(reviewOf(demo, '19').effective!.additional.find((a) => a.key === 'claims[]#3')!.text);
    expect(added.description.length).toBeGreaterThan(0);
    expect(r.evaluation.decisions['19']!.additional['claims[]#3']!.promoted_to).toBe(added.id);
    expect(r.notes).toEqual([`Added to the expected errors of case 19 as E${after.length}.`]);
  });

  it('drops the test cases version and marks the case as corrected after the first reply', () => {
    const start = { ...real(demo), dataset: { ...demo.dataset, version: 'stale' } };
    const r = sync(start, '19').evaluation;
    expect(r.dataset.version).toBeUndefined();
    expect(caseOf(r, '19').changed_after_first_reply).toBe('corrected');
    expect(caseOf(r, '18')).toBe(caseOf(demo, '18'));
  });

  it('is idempotent: a second sync changes nothing', () => {
    const once = sync(real(demo), '19');
    const twice = sync(once.evaluation, '19');
    expect(twice.evaluation).toBe(once.evaluation);
    expect(twice.notes).toEqual([]);
  });

  it('keeps the finding in Additional errors with its mark, and shows the new error as found: the case still passes', () => {
    const r = sync(real(demo), '19').evaluation;
    const reviewed = reviewOf(r, '19');
    const item = reviewed.effective!.additional.find((a) => a.key === 'claims[]#3')!;
    expect(item).toMatchObject({ state: 'real_error', promotedTo: caseOf(r, '19').expected_errors.at(-1)!.id });
    const promoted = reviewed.effective!.expected.at(-1)!;
    expect(promoted).toMatchObject({ id: item.promotedTo, state: 'found', source: 'manual', attached: 1, promoted: true });
    expect(reviewed.effective!.expected.map((e) => e.id)).toEqual(caseOf(r, '19').expected_errors.map((e) => e.id));
    expect(reviewed.status).toBe('pass');
  });

  it('counts it once, as an expected error that was found, and not as an additional real error', () => {
    const decided = { ...demo, decisions: { ...demo.decisions, ...Object.fromEntries(['3', '10', '14', '17'].map((id) => [id, { ...empty(), approved: true }])) } };
    const plain = computeResults(real(decided), accuracyMetric).counters;
    const promoted = computeResults(sync(real(decided), '19').evaluation, accuracyMetric).counters;
    expect(promoted.expected_total).toBe(plain.expected_total + 1);
    expect(promoted.expected_found).toBe(plain.expected_found + 1);
    expect(promoted.real_errors).toBe(plain.real_errors - 1);
    expect(promoted.additional_total).toBe(plain.additional_total - 1);
    expect(promoted.findings_total).toBe(plain.findings_total);
  });
});

describe('demoting', () => {
  const promoted = () => sync(real(demo), '19').evaluation;

  it('changing the mark removes the expected error again, with its stale decision, and says so', () => {
    const start = promoted();
    const id = caseOf(start, '19').expected_errors.at(-1)!.id;
    const changed = withDecisions(start, '19', { additional: { 'claims[]#3': { state: 'false_positive', source: 'manual', promoted_to: id }, }, expected: { [id]: { state: 'missed', source: 'manual' } } });
    const r = sync(changed, '19');
    expect(caseOf(r.evaluation, '19').expected_errors).toHaveLength(caseOf(demo, '19').expected_errors.length);
    expect(r.evaluation.decisions['19']!.additional['claims[]#3']).toEqual({ state: 'false_positive', source: 'manual' });
    expect(r.evaluation.decisions['19']!.expected[id]).toBeUndefined();
    expect(r.notes).toEqual([`Removed from the expected errors of case 19: ${id.replace('e', 'E')}.`]);
  });

  it('a later promotion that reuses the identifier does not inherit a stale mark', () => {
    const start = promoted();
    const id = caseOf(start, '19').expected_errors.at(-1)!.id;
    const down = sync(withDecisions(start, '19', { additional: { 'claims[]#3': { state: 'ignored', source: 'manual', promoted_to: id } } }), '19').evaluation;
    const up = sync(withDecisions(down, '19', { additional: { 'claims[]#3': { state: 'real_error', source: 'manual' } } }), '19').evaluation;
    expect(caseOf(up, '19').expected_errors.at(-1)!.id).toBe(id);
    expect(reviewOf(up, '19').effective!.expected.at(-1)).toMatchObject({ state: 'found', promoted: true });
  });

  it('removing a finding added by hand removes the expected error it made', () => {
    const added = withDecisions(demo, '19', { added_findings: [{ text: 'The marlin is a shark', state: 'real_error', source: 'manual' }] });
    const made = sync(added, '19').evaluation;
    expect(caseOf(made, '19').expected_errors.at(-1)).toMatchObject({ fragment: 'The marlin is a shark' });
    expect(made.decisions['19']!.added_findings[0]!.promoted_to).toBe(caseOf(made, '19').expected_errors.at(-1)!.id);
    const gone = removeFinding(made, '19', 0);
    expect(caseOf(gone, '19').expected_errors).toHaveLength(caseOf(demo, '19').expected_errors.length);
    expect(gone.decisions['19']!.added_findings).toEqual([]);
    expect(sync(gone, '19').evaluation).toBe(gone);
    expect(dropPromotion(made, '19', 5)).toBe(made);
  });

  it('two findings keep unique identifiers; the identifier of an error removed in the middle is not reused by a link', () => {
    const two = withDecisions(demo, '19', { added_findings: [{ text: 'one', state: 'real_error', source: 'manual' }, { text: 'two', state: 'real_error', source: 'llm-approved' }] });
    const r = sync(two, '19').evaluation;
    const ids = caseOf(r, '19').expected_errors.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(reviewOf(r, '19').effective!.expected.filter((e) => e.promoted).map((e) => e.source)).toEqual(['manual', 'llm-approved']);
  });

  it('when the replies are cleared the promoted error stays an ordinary expected error', () => {
    const r = { ...promoted(), decisions: {}, replies: {} };
    expect(caseOf(r, '19').expected_errors).toHaveLength(caseOf(demo, '19').expected_errors.length + 1);
    expect(reviewOf(r, '19').effective).toBeNull();
  });
});

describe('a judge evaluated per case', () => {
  it('a flag on a clean case, marked real, makes an expected error that is found at once', () => {
    const clean = demo.dataset.cases.find((c) => c.expected_errors.length === 0)!;
    const perCase = { ...demo, judge_set: { ...demo.judge_set, error_rules: [{ name: 'Flag', match: 'all' as const, conditions: [{ field: 'biased', comparison: 'equals' as const, value: 'true' }] }], sample_reply: '{"biased": true}', reply_mapping: { finding_text: {} } }, replies: { [clean.id]: { reply: '{"biased": true}', prompt: 'p', received_at: 'x' } }, decisions: {} };
    const marked = withDecisions(perCase, clean.id, { additional: { reply: { state: 'real_error', source: 'manual' } } });
    const r = sync(marked, clean.id).evaluation;
    const reviewed = reviewOf(r, clean.id);
    expect(caseOf(r, clean.id).expected_errors).toHaveLength(1);
    expect(reviewed.effective!.expected[0]).toMatchObject({ state: 'found', promoted: true });
    expect(reviewed.status).toBe('pass');
  });
});
