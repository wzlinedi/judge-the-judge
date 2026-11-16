// Reading the pasted opinion of the user's LLM (file-formats.md, section 7; FR-063, FR-084).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyDecisions } from '../../../../src/core/evaluation/decisions';
import { applyOpinion, opinionPlan } from '../../../../src/core/evaluation/opinions';
import { opinionItems } from '../../../../src/core/evaluation/opinion-items';
import { reviewEvaluation } from '../../../../src/core/evaluation/results';
import { readOpinion } from '../../../../src/core/io/opinions';
import { readTestProject } from '../../../../src/core/io/test-project-file';
import type { VerificationOpinion } from '../../../../src/core/model';
import { accuracyMetric } from '../../../helpers/fixtures';

const inner = { id: '3', expected: [{ index: 1, found: true, reason: 'r', fragment: 'f' }], additional: [{ index: 1, real: false, reason: 'r2', fragment: 'f2' }], new: [] };

const ok = (text: string, id = '3') => {
  const r = readOpinion(text, id);
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' | '));
  return r.value;
};
const problems = (text: string, id = '3') => {
  const r = readOpinion(text, id);
  if (r.ok) throw new Error('expected a refusal');
  return r.problems;
};

describe('readOpinion', () => {
  it('accepts the wrapped object, the bare object and a list with exactly one opinion', () => {
    for (const text of [JSON.stringify({ opinion: inner }), JSON.stringify(inner), JSON.stringify([inner]), JSON.stringify({ opinions: [inner] }), JSON.stringify([{ opinion: inner }])]) {
      expect(ok(text)).toEqual({ id: '3', expected: inner.expected, additional: inner.additional, new: [] });
    }
  });

  it('accepts an opinion inside a code fence and other text', () => {
    expect(ok('Here you are:\n```json\n' + JSON.stringify({ opinion: inner }) + '\n```\nGood luck').id).toBe('3');
  });

  it('accepts a number as the identifier', () => {
    expect(ok(JSON.stringify({ ...inner, id: 3 })).id).toBe('3');
  });

  it('refuses a list of several opinions, saying the opinion is asked for one case at a time', () => {
    const [p] = problems(JSON.stringify([inner, { ...inner, id: '4' }]));
    expect(p?.message).toMatch(/one case at a time/i);
  });

  it('refuses an opinion for another case, with the reason', () => {
    const [p] = problems(JSON.stringify({ opinion: { ...inner, id: '5' } }));
    expect(p?.message).toMatch(/case 5/);
    expect(p?.message).toMatch(/case 3/);
  });

  it('refuses an opinion without an identifier', () => {
    const { id: _id, ...rest } = inner;
    const [p] = problems(JSON.stringify(rest));
    expect(p?.path).toBe('opinion.id');
  });

  it('reports a JSON that cannot be read with its line and column', () => {
    const [p] = problems('{\n  "opinion": {\n    "id": "3",,\n  }\n}');
    expect(p?.line).toBe(3);
    expect(p?.column).toBeGreaterThan(0);
  });

  it('says so when there is no JSON in the text', () => {
    expect(problems('The judge was right.')[0]?.message).toMatch(/no JSON/i);
  });

  it('reads an additional entry with text and no valid index as a new finding', () => {
    const v = ok(JSON.stringify({ id: '3', expected: [], additional: [{ text: 'Something else', real: true, reason: 'because' }, { index: 0, text: 'Zero', real: false }, { index: 1, real: true }], new: [] }));
    expect(v.additional).toEqual([{ index: 1, real: true }]);
    expect(v.new).toEqual([
      { text: 'Something else', real: true, reason: 'because' },
      { text: 'Zero', real: false },
    ]);
  });

  it('keeps category and difficulty of a new finding', () => {
    const v = ok(JSON.stringify({ id: '3', expected: [], additional: [], new: [{ text: 'x', real: true, reason: 'r', fragment: 'f', category: 'factual-error', difficulty: 'subtle' }] }));
    expect(v.new).toEqual([{ text: 'x', real: true, reason: 'r', fragment: 'f', category: 'factual-error', difficulty: 'subtle' }]);
  });

  it('requires text and real in a new finding, naming the path', () => {
    const ps = problems(JSON.stringify({ id: '3', expected: [], additional: [], new: [{ real: true }, { text: 'x' }] }));
    expect(ps.map((p) => p.path)).toEqual(['new[1].text', 'new[2].real']);
  });

  it('treats missing lists as empty and ignores an unknown difficulty with a note', () => {
    const r = readOpinion(JSON.stringify({ id: '3', new: [{ text: 'x', real: true, difficulty: 'hard' }] }), '3');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.expected).toEqual([]);
      expect(r.value.new[0]?.difficulty).toBeUndefined();
      expect(r.notes.join(' ')).toMatch(/difficulty/);
    }
  });

  it('keeps an entry without found or real, which answers nothing', () => {
    const v = ok(JSON.stringify({ id: '3', expected: [{ index: 1, reason: 'unsure' }], additional: [] }));
    expect(v.expected).toEqual([{ index: 1, reason: 'unsure' }]);
  });
});

// R8 (code review 2026-11-16; FR-063, contracts/file-formats.md section 7): the code of the list, and the findings that wait for an error.
describe('readOpinion: the code of the list (R8)', () => {
  it('keeps the code in `list`, and reads an opinion without it as before', () => {
    expect(ok(JSON.stringify({ opinion: { ...inner, list: '3f9a2c' } })).list).toBe('3f9a2c');
    expect('list' in ok(JSON.stringify({ opinion: inner }))).toBe(false);
  });
});

describe('opinionPlan: the same list as the prompt (R8)', () => {
  const loadedDemo = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
  if (!loadedDemo.ok) throw new Error('demo not readable');
  const base = structuredClone(loadedDemo.value.project);
  base.dataset.cases.find((c) => c.id === '17')!.expected_errors.push({ id: 'x9', description: 'Gandalf is grey', fragment: 'Gandalf grey' } as never);
  const reviewedNow = (project = base) => reviewEvaluation(project, accuracyMetric).find((x) => x.testCase.id === '17')!;
  const code = (project = base) => opinionItems(reviewedNow(project)).code;
  const planFor = (opinion: VerificationOpinion, project = base) => {
    const r = reviewedNow(project);
    return opinionPlan(r.testCase, r.effective!, opinion, opinionItems(r).waiting);
  };
  const empty = (extra: Partial<VerificationOpinion> = {}): VerificationOpinion => ({ id: '17', expected: [], additional: [], new: [], ...extra });

  it('numbers the waiting finding after the additional findings and counts it among the items', () => {
    const r = reviewedNow();
    const plan = planFor(empty({ additional: [{ index: 1, real: false, reason: 'no' }] }));
    expect(plan.itemCount).toBe(r.effective!.expected.length + r.effective!.additional.length + 1);
    expect(plan.marks).toHaveLength(1);
    expect(plan.marks[0]).toMatchObject({ label: 'A1', kind: 'additional', target: 'claims[]#2', to: 'false_positive' });
  });

  it('refuses an opinion with another code, and applies nothing', () => {
    const plan = planFor(empty({ list: 'ffffff', additional: [{ index: 1, real: false }] }));
    expect(plan.canApply).toBe(false);
    expect(plan.message).toBe('The case changed after this prompt was copied. Copy the prompt again.');
    expect(plan.marks).toEqual([]);
  });

  it('accepts the code of its own list, and an opinion without a code as before', () => {
    expect(planFor(empty({ list: code(), additional: [{ index: 1, real: false }] })).canApply).toBe(true);
    expect(planFor(empty({ additional: [{ index: 1, real: false }] })).canApply).toBe(true);
  });

  it('keeps an answer for a finding that waits, and it takes effect when the error is decided missed', () => {
    const r = reviewedNow();
    const plan = planFor(empty({ expected: [{ index: 4, found: false }], additional: [{ index: 1, real: false }] }));
    const decisions = applyOpinion(undefined, plan);
    expect(decisions.additional['claims[]#2']).toEqual({ state: 'false_positive', source: 'llm-approved' });
    const after = applyDecisions(r.review!, decisions);
    expect(after.additional.find((a) => a.key === 'claims[]#2')).toMatchObject({ state: 'false_positive', moved: true });
  });

  it('counts "classifies none" over the same items', () => {
    const r = reviewedNow();
    const plan = planFor(empty());
    expect(plan.message).toBe(`The opinion classifies none of the ${r.effective!.expected.length + r.effective!.additional.length + 1} items of this case. Nothing will change.`);
  });
});
