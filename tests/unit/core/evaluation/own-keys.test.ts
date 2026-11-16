// S1 (security review 2026-11-16, Clarifications 2026-11-16): a case id may be any text, a built-in JavaScript name included.
// Replies and decisions are looked up among the keys of the file only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTestProject } from '../../../../src/core/io/test-project-file';
import { computeResults, reviewEvaluation } from '../../../../src/core/evaluation/results';
import { buildHtmlReport } from '../../../../src/core/io/html-report';
import { decisionsOf, ownValue, repliesOf, setOwn } from '../../../../src/core/cases/test-run';
import { attachReplies } from '../../../../src/app/actions/replies';
import { accuracyMetric } from '../../../helpers/fixtures';

const NAMES = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];
const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8'));

function projectWithIds(ids: string[]) {
  const file = structuredClone(demo);
  ids.forEach((id, i) => {
    const old = file.dataset.cases[i].id;
    file.dataset.cases[i].id = id;
    delete file.test_run.replies[old];
    delete file.test_run.decisions[old];
  });
  const read = readTestProject(JSON.stringify(file));
  if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
  return read.value.project;
}

describe('a case id that is a built-in JavaScript name', () => {
  it.each(NAMES)('%s: the file loads, the results are computed and the report is built; the case is "Not run"', (name) => {
    const project = projectWithIds([name]);
    const reviewed = reviewEvaluation(project, accuracyMetric);
    expect(reviewed[0]!.testCase.id).toBe(name);
    expect(reviewed[0]!.status).toBe('not_run');
    const results = computeResults(project, accuracyMetric);
    expect(results.counters.cases_not_run).toBeGreaterThanOrEqual(1);
    const html = buildHtmlReport(project, results, reviewed, { now: 'n', toolVersion: 't', judgeVersion: 'j', testCasesVersion: 'c' });
    expect(html).toContain(`Case ${name}`);
  });

  it('every name at once', () => {
    const project = projectWithIds(NAMES);
    const reviewed = reviewEvaluation(project, accuracyMetric);
    expect(reviewed.slice(0, 4).map((r) => r.status)).toEqual(['not_run', 'not_run', 'not_run', 'not_run']);
  });

  it('a reply stored under that id is found for that case, and for no other', () => {
    const file = structuredClone(demo);
    const old = file.dataset.cases[0].id;
    file.dataset.cases[0].id = 'constructor';
    file.test_run.replies.constructor = file.test_run.replies[old];
    delete file.test_run.replies[old];
    delete file.test_run.decisions[old];
    const read = readTestProject(JSON.stringify(file));
    if (!read.ok) throw new Error('not read');
    const project = read.value.project;
    expect(ownValue(repliesOf(project), 'constructor')?.reply).toBeTruthy();
    expect(ownValue(repliesOf(project), 'toString')).toBeUndefined();
    expect(repliesOf(project)['toString']).toBeUndefined();
    expect(decisionsOf(project)['hasOwnProperty']).toBeUndefined();
    expect(reviewEvaluation(project, accuracyMetric)[0]!.status).not.toBe('not_run');
  });
});

describe('writing under a case id that is a built-in JavaScript name (T388, T390)', () => {
  it.each(NAMES)('%s: a pasted reply is stored as that case\'s own reply, and the prototype is unchanged', (name) => {
    const project = projectWithIds([name]);
    const result = attachReplies(project, { items: [{ case_id: name, reply: '{"claims": []}' }], problems: [] }, { judgeVersion: 'j' });
    expect(result.saved).toEqual([name]);
    const replies = result.project.testRun!.replies;
    expect(Object.hasOwn(replies, name)).toBe(true);
    expect(Object.getPrototypeOf(replies)).toBe(Object.prototype);
    expect(ownValue(repliesOf(result.project), name)?.reply).toContain('claims');
  });

  it.each(NAMES)('%s: the results hold the case as their own key', (name) => {
    const project = projectWithIds([name]);
    const results = computeResults(project, accuracyMetric);
    expect(Object.hasOwn(results.cases, name)).toBe(true);
    expect(Object.getPrototypeOf(results.cases)).toBe(Object.prototype);
    expect(Object.keys(results.cases)).toHaveLength(project.dataset.cases.length);
  });
});

describe('an expected error id that is a built-in JavaScript name', () => {
  it('a mark set on it is kept as its own value and changes no prototype', () => {
    const marks: Record<string, { state: string }> = {};
    for (const id of NAMES) setOwn(marks, id, { state: 'found' });
    expect(Object.keys(marks).sort()).toEqual([...NAMES].sort());
    expect(Object.getPrototypeOf(marks)).toBe(Object.prototype);
    expect(ownValue(marks, '__proto__')?.state).toBe('found');
    expect(ownValue({}, 'constructor')).toBeUndefined();
  });
});

