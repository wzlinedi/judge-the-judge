// The test run part of a test project: whether it has started, what it holds, and the test project without it (data-model.md, TestRun).
import type { CaseDecisions, Reply, TestProject, TestRun } from '../model';

const NO_REPLIES: Readonly<Record<string, Reply>> = Object.freeze({});
const NO_DECISIONS: Readonly<Record<string, CaseDecisions>> = Object.freeze({});

/** True once "Start test run" was pressed: the test run is present, also before the first reply (FR-053). */
export function isStarted(project: Pick<TestProject, 'testRun'>): boolean {
  return project.testRun !== undefined;
}

/** What "Start test run" creates: a test run with no reply, no decision and no model details. */
export function emptyTestRun(): TestRun {
  return { replies: {}, decisions: {}, model_note: '' };
}

/**
 * A case id is any text of the user's file, `constructor` and `__proto__` included (S1). A record read by an id must therefore hold
 * only the keys of the file: this copy has no prototype, so `record['constructor']` is `undefined` unless the file has that key.
 * The copy is made once for each stored object.
 */
const COPIES = new WeakMap<object, Record<string, unknown>>();
function ownKeysOnly<T>(stored: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  let copy = COPIES.get(stored);
  if (copy === undefined) {
    copy = Object.assign(Object.create(null) as Record<string, unknown>, stored);
    COPIES.set(stored, copy);
  }
  return copy as Readonly<Record<string, T>>;
}

/** The value stored under `key` in a record of the file, or `undefined`; inherited names such as `constructor` are not values (S1). */
export function ownValue<T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined {
  return record !== undefined && Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Sets a key of a record of the file as an own value; `record['__proto__'] = …` would set the prototype instead (S1). */
export function setOwn<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, { value, enumerable: true, writable: true, configurable: true });
}

/** The replies by case identifier; none while the test run has not started. */
export function repliesOf(project: Pick<TestProject, 'testRun'>): Readonly<Record<string, Reply>> {
  return project.testRun ? ownKeysOnly(project.testRun.replies) : NO_REPLIES;
}

/** The decisions by case identifier; none while the test run has not started. */
export function decisionsOf(project: Pick<TestProject, 'testRun'>): Readonly<Record<string, CaseDecisions>> {
  return project.testRun ? ownKeysOnly(project.testRun.decisions) : NO_DECISIONS;
}

/** How many cases have a reply. */
export function replyCount(project: Pick<TestProject, 'testRun'>): number {
  return Object.keys(repliesOf(project)).length;
}

/**
 * The same test project with no test run, as "Load the test project only" needs it: the replies, decisions, model details and results
 * are gone, and so is `changed_after_first_reply` on every case, because the run it refers to is gone (FR-076, file-formats.md, section 1).
 * Does not change the project it is given.
 */
export function withoutTestRun(project: TestProject): TestProject {
  const { testRun: _run, ...rest } = project;
  return {
    ...rest,
    dataset: { ...project.dataset, cases: project.dataset.cases.map(({ changed_after_first_reply: _mark, ...testCase }) => testCase) },
  };
}

/** Applies a change to the test run; a test project that has not started has nothing to change and is returned as it is. */
export function updateTestRun(project: TestProject, change: (run: TestRun) => TestRun): TestProject {
  return project.testRun === undefined ? project : { ...project, testRun: change(project.testRun) };
}

/**
 * The test run without the reply and the decisions of one case (the case was removed, or its reply was emptied).
 * With no reply left the run starts again from nothing: the judge version and the way of counting go too (FR-075).
 */
export function withoutReply(run: TestRun, caseId: string): TestRun {
  const { [caseId]: _reply, ...replies } = run.replies;
  const { [caseId]: _decisions, ...decisions } = run.decisions;
  if (Object.keys(replies).length > 0) return { ...run, replies, decisions };
  const { reply_judge_version: _version, reply_counted_per: _counted, rules_corrected_after_replies: _rules, ...rest } = run;
  return { ...rest, replies, decisions };
}
