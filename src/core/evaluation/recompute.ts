// Reproduce and audit (FR-075, SC-003): the results recomputed from a loaded evaluation file, and any
// difference from the stored ones. Pure: the versions are passed in, because hashing them is asynchronous.
import type { LoadedTestProject } from '../io/test-project-file';
import type { MetricDefinition } from '../metrics/types';
import { computeResults, type Results } from './results';

/** One thing that is not the same as the file says it was: its name, and both values as text. */
export interface Difference {
  what: string;
  stored: string;
  recomputed: string;
}

export interface Recomputed {
  results: Results;
  differences: Difference[];
}

/** True exactly when the replies were received under another judge version than the one in force now (FR-075). */
export function rulesCorrectedAfterReplies(replyJudgeVersion: string | undefined, currentJudgeVersion: string): boolean {
  return replyJudgeVersion !== undefined && replyJudgeVersion !== currentJudgeVersion;
}

/** The results as the `test_run` section stores them; empty until a case is decided. */
export function resultsForFile(results: Results | null): Record<string, unknown> {
  if (!results || results.counters.cases_decided === 0) return {};
  const measures = Object.fromEntries(
    Object.entries(results.measures).map(([id, m]) => [id, { value: m.value, numerator: m.numerator ?? null, denominator: m.denominator ?? null, interval: m.interval }]),
  );
  return {
    evaluated_per: results.evaluated_per,
    counted_per_before_correction: results.counted_per_before_correction,
    counters: results.counters,
    measures,
    overall: results.overall,
    cases: results.cases,
  };
}

/** How many differences a sentence names before it says "and N more". */
export const NAMED_DIFFERENCES = 5;

/** The note shown when a loaded file's numbers do not follow from its data: what was stored and what it is now. */
export function differenceNote(differences: readonly Difference[], named: number = NAMED_DIFFERENCES): string | null {
  if (differences.length === 0) return null;
  const shown = differences.slice(0, named).map((d) => `${d.what} was ${d.stored} in the file and is ${d.recomputed} when recomputed`);
  const rest = differences.length - shown.length;
  return `The numbers recomputed from this file differ from the ones it stored: ${shown.join('; ')}${rest > 0 ? `; and ${rest} more` : ''}. The recomputed numbers are the ones shown.`;
}

const TOLERANCE = 1e-9;
const SAME_PLACE = '(none)';

function flatten(value: unknown, path: string, into: Map<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) into.set(path, '[]');
    value.forEach((item, i) => flatten(item, `${path}[${i}]`, into));
  } else if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) into.set(path, '{}');
    for (const [key, item] of entries) flatten(item, path === '' ? key : `${path}.${key}`, into);
  } else {
    into.set(path, value === undefined ? 'null' : JSON.stringify(value));
  }
}

const sameValue = (a: string, b: string): boolean => {
  if (a === b) return true;
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= TOLERANCE * Math.max(1, Math.abs(x), Math.abs(y));
};

function compareResults(stored: Record<string, unknown>, recomputed: Record<string, unknown>): Difference[] {
  const left = new Map<string, string>();
  const right = new Map<string, string>();
  flatten(stored, '', left);
  flatten(recomputed, '', right);
  const places = [...new Set([...left.keys(), ...right.keys()])];
  const found: Difference[] = [];
  for (const place of places) {
    const a = left.get(place);
    const b = right.get(place);
    if (a !== undefined && b !== undefined && sameValue(a, b)) continue;
    found.push({ what: place === '' ? 'results' : `results.${place}`, stored: a ?? SAME_PLACE, recomputed: b ?? SAME_PLACE });
  }
  return found;
}

/**
 * Recalculates the results of a loaded test project from its judge set, cases, replies and decisions, with the
 * metric parameters and thresholds it stores, and lists what differs from what its test run says (SC-003).
 * A file without a test run stored no numbers, so nothing differs.
 */
export function recompute(loaded: LoadedTestProject, metric: MetricDefinition, versions: { judgeVersion: string; testCasesVersion: string }): Recomputed {
  const { stored } = loaded;
  const results = computeResults(loaded.project, metric, stored?.minimumSample);
  if (stored === undefined) return { results, differences: [] };
  const differences: Difference[] = [];
  if (stored.judgeVersion !== undefined && stored.judgeVersion !== versions.judgeVersion) {
    differences.push({ what: 'judge version', stored: stored.judgeVersion, recomputed: versions.judgeVersion });
  }
  if (loaded.testCasesVersion !== undefined && loaded.testCasesVersion !== versions.testCasesVersion) {
    differences.push({ what: 'test cases version', stored: loaded.testCasesVersion, recomputed: versions.testCasesVersion });
  }
  const recomputed = JSON.parse(JSON.stringify(resultsForFile(results))) as Record<string, unknown>;
  differences.push(...compareResults(stored.results, recomputed));
  return { results, differences };
}
