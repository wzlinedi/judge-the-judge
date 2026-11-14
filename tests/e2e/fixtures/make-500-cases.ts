// A generated evaluation of 500 test cases for the performance check of FR-036 and SC-018 (quickstart "Performance checks").
// Built from the demo evaluation: each case copies one of its 20 cases, with a number added to its name and fields so that
// no two cases are alike. Every second case has injected errors, every fourth case has a reply, and no decision is made.
import { readFileSync } from 'node:fs';

interface DemoCase {
  id: string;
  name: string;
  fields: Record<string, string>;
  expected_errors: unknown[];
}
interface Demo {
  dataset: { name: string; version?: string; finalized: boolean; cases: DemoCase[] };
  replies: Record<string, unknown>;
  decisions: Record<string, unknown>;
  results: unknown;
  [key: string]: unknown;
}

export const CASE_COUNT = 500;

export interface Large {
  text: string;
  withInjectedErrors: number;
  withReply: number;
  /** The cases with injected errors and no reply: what the independent test of User Story 15 filters to. */
  injectedWithoutReply: number;
}

export function make500Cases(): Large {
  const demo = JSON.parse(readFileSync('examples/demo/evaluation.json', 'utf8')) as Demo;
  const withErrors = demo.dataset.cases.filter((c) => c.expected_errors.length > 0);
  const clean = demo.dataset.cases.filter((c) => c.expected_errors.length === 0);
  const cases: DemoCase[] = [];
  const replies: Record<string, unknown> = {};
  let injected = 0;
  let replied = 0;
  let injectedWithoutReply = 0;
  for (let i = 1; i <= CASE_COUNT; i++) {
    const pool = i % 2 === 0 ? withErrors : clean;
    const from = pool[i % pool.length]!;
    const id = String(i);
    cases.push({
      id,
      name: `Case ${i} ${from.name}`,
      fields: Object.fromEntries(Object.entries(from.fields).map(([key, text]) => [key, `${text} (variant ${i})`])),
      expected_errors: from.expected_errors,
    });
    if (from.expected_errors.length > 0) injected++;
    if (i % 4 === 0) {
      replies[id] = demo.replies[from.id] ?? Object.values(demo.replies)[0];
      replied++;
    } else if (from.expected_errors.length > 0) injectedWithoutReply++;
  }
  const { version: _version, ...dataset } = demo.dataset; // the content version is recomputed on load
  const file = { ...demo, dataset: { ...dataset, cases }, replies, decisions: {}, results: {} };
  return { text: JSON.stringify(file), withInjectedErrors: injected, withReply: replied, injectedWithoutReply };
}
