import { describe, expect, it } from 'vitest';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import { caseStatus } from '../../../../src/core/evaluation/status';
import type { CaseReview } from '../../../../src/core/evaluation/review';
import type { CaseDecisions } from '../../../../src/core/model';

const f = (key: string, text = key) => ({ key, text, rules: ['r'] });
const review = (over: Partial<CaseReview> = {}): CaseReview => ({
  readable: true,
  needsApproval: false,
  expected: [],
  additional: [],
  partialOnly: [],
  unknown: [],
  ...over,
});
const decisions = (over: Partial<CaseDecisions> = {}): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '', ...over });

describe('applyDecisions', () => {
  it('uses the automatic states when nothing is stored', () => {
    const e = applyDecisions(review({ expected: [{ id: 'e1', state: 'found', clear: ['a'], partial: [] }, { id: 'e2', state: 'undecided', clear: [], partial: [], reason: 'why' }], additional: [f('x')] }), undefined);
    expect(e.expected).toMatchObject([{ id: 'e1', state: 'found', source: 'automatic', attached: 1 }, { id: 'e2', state: 'undecided', source: 'automatic', reason: 'why' }]);
    expect(e.additional).toMatchObject([{ key: 'x', state: 'undecided', source: 'automatic' }]);
  });

  it('lets a stored decision override, with its source', () => {
    const e = applyDecisions(
      review({ expected: [{ id: 'e1', state: 'found', clear: ['a'], partial: [] }], additional: [f('x')] }),
      decisions({ expected: { e1: { state: 'missed', source: 'manual' } }, additional: { x: { state: 'false_positive', source: 'llm-approved' } } }),
    );
    expect(e.expected[0]).toMatchObject({ state: 'missed', source: 'manual' });
    expect(e.additional[0]).toMatchObject({ state: 'false_positive', source: 'llm-approved' });
  });

  it('counts at least one finding as attached to a found error, also when found by hand', () => {
    const e = applyDecisions(review({ expected: [{ id: 'e1', state: 'undecided', clear: [], partial: [] }] }), decisions({ expected: { e1: { state: 'found', source: 'manual' } } }));
    expect(e.expected[0]?.attached).toBe(1);
  });

  it('moves findings that only partly resembled an error to the additional findings when it is decided missed', () => {
    const base = review({ expected: [{ id: 'e1', state: 'undecided', clear: [], partial: ['p'] }], partialOnly: [f('p')] });
    expect(applyDecisions(base, undefined).additional).toEqual([]);
    const moved = applyDecisions(base, decisions({ expected: { e1: { state: 'missed', source: 'manual' } } }));
    expect(moved.additional).toMatchObject([{ key: 'p', state: 'undecided', moved: true }]);
    const found = applyDecisions(base, decisions({ expected: { e1: { state: 'found', source: 'manual' } } }));
    expect(found.additional).toEqual([]);
    expect(found.expected[0]?.attached).toBe(1);
  });

  it('keeps a partial finding waiting while any error it resembles is undecided', () => {
    const base = review({
      expected: [{ id: 'e1', state: 'undecided', clear: [], partial: ['p'] }, { id: 'e2', state: 'undecided', clear: [], partial: ['p'] }],
      partialOnly: [f('p')],
    });
    expect(applyDecisions(base, decisions({ expected: { e1: { state: 'missed', source: 'manual' } } })).additional).toEqual([]);
  });

  it('returns decisions whose target no longer exists separately', () => {
    const e = applyDecisions(review({ expected: [{ id: 'e1', state: 'found', clear: ['a'], partial: [] }] }), decisions({ expected: { gone: { state: 'found', source: 'manual' } }, additional: { nope: { state: 'ignored', source: 'manual' } } }));
    expect(e.orphans).toEqual({ expected: ['gone'], additional: ['nope'] });
  });

  it('lists findings added by hand as additional findings with their category and difficulty', () => {
    const e = applyDecisions(review(), decisions({ added_findings: [{ text: 'new', category: 'factual-error', difficulty: 'subtle', state: 'real_error', source: 'manual', from_opinion: true }] }));
    expect(e.additional).toMatchObject([{ key: 'added#1', text: 'new', state: 'real_error', source: 'manual', category: 'factual-error', difficulty: 'subtle', added: 0, fromOpinion: true }]);
  });

  it('carries approval and the need for it', () => {
    expect(applyDecisions(review({ readable: false, needsApproval: true }), decisions({ approved: true }))).toMatchObject({ needsApproval: true, approved: true });
  });
});

describe('caseStatus', () => {
  const eff = (r: Partial<CaseReview>, d?: Partial<CaseDecisions>) => applyDecisions(review(r), d ? decisions(d) : undefined);

  it('is Not run without a reply', () => {
    expect(caseStatus(null)).toBe('not_run');
  });

  it('is Awaiting verification while anything is undecided', () => {
    expect(caseStatus(eff({ expected: [{ id: 'e1', state: 'undecided', clear: [], partial: [] }] }))).toBe('awaiting');
    expect(caseStatus(eff({ additional: [f('x')] }))).toBe('awaiting');
  });

  it('is Awaiting verification for an unreadable reply until the user approves it', () => {
    const base = { readable: false, needsApproval: true, expected: [{ id: 'e1', state: 'undecided' as const, clear: [], partial: [] }] };
    expect(caseStatus(eff(base, { expected: { e1: { state: 'missed', source: 'manual' } } }))).toBe('awaiting');
    expect(caseStatus(eff(base, { expected: { e1: { state: 'missed', source: 'manual' } }, approved: true }))).toBe('fail');
  });

  it('is Pass when every expected error that is not ignored is found and no finding is a false positive', () => {
    expect(caseStatus(eff({ expected: [{ id: 'e1', state: 'found', clear: ['a'], partial: [] }] }))).toBe('pass');
    expect(caseStatus(eff({}))).toBe('pass');
  });

  it('is Fail with a missed error or a false positive', () => {
    expect(caseStatus(eff({ expected: [{ id: 'e1', state: 'missed', clear: [], partial: [] }] }))).toBe('fail');
    expect(caseStatus(eff({ additional: [f('x')] }, { additional: { x: { state: 'false_positive', source: 'manual' } } }))).toBe('fail');
  });

  it('is not failed by a confirmed real error', () => {
    expect(caseStatus(eff({ additional: [f('x')] }, { additional: { x: { state: 'real_error', source: 'manual' } } }))).toBe('pass');
  });

  it('passes a case whose expected errors are all ignored', () => {
    expect(caseStatus(eff({ expected: [{ id: 'e1', state: 'missed', clear: [], partial: [] }] }, { expected: { e1: { state: 'ignored', source: 'manual' } } }))).toBe('pass');
  });
});
