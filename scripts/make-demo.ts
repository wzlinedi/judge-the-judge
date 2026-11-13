// Produces examples/demo/ (research.md, section 23): the evaluation file the demo of "Load example…"
// loads, the same test as a test project file, the opinions ready for the cases that await
// verification, and the expected results. Run with `npm run demo`.
import { mkdirSync, writeFileSync } from 'node:fs';
import accuracy from '../src/core/metrics/builtin/accuracy.json';
import checksDefault from '../src/core/metrics/builtin/checks.default.json';
import { testCasesVersion } from '../src/core/cases/version';
import { computeResults, reviewEvaluation } from '../src/core/evaluation/results';
import { writeEvaluation } from '../src/core/io/evaluation-file';
import { composePrompt } from '../src/core/judge/compose';
import { judgeVersion } from '../src/core/judge/version';
import type { CaseDecisions, Evaluation, JudgeSet, TestCase } from '../src/core/model';
import type { MetricDefinition } from '../src/core/metrics/types';
import { BOOKS, type DemoBook } from './demo-data';

const metric = accuracy as unknown as MetricDefinition;
const { clean_base_cases: _starter, ...judgeSetBase } = metric.judge_set;
const judge_set: JudgeSet = structuredClone(judgeSetBase);
const NOW = '2026-11-13T10:00:00Z';
const TOOL_VERSION = '1.0.0';

/** Splits at a full stop after a lowercase letter or digit, so initials such as "J. R. R." stay whole. */
const sentences = (text: string) => {
  const parts = text.split(/(?<=[a-z0-9])\.\s+(?=[A-Z])/);
  return parts.map((s, i) => (i < parts.length - 1 ? `${s}.` : s));
};

function injectedSummary(book: DemoBook): string {
  let summary = book.summary;
  for (const e of book.errors) {
    if (!summary.includes(e.from)) throw new Error(`"${e.from}" is not in the summary of ${book.name}`);
    summary = summary.replace(e.from, e.to);
    if (!summary.includes(e.fragment)) throw new Error(`fragment "${e.fragment}" is not in the summary of ${book.name}`);
  }
  if (book.unrecorded) {
    if (!summary.includes(book.unrecorded.from)) throw new Error(`unrecorded change not found in ${book.name}`);
    summary = summary.replace(book.unrecorded.from, book.unrecorded.to);
  }
  return summary;
}

const cases: TestCase[] = [];
BOOKS.forEach((book, i) => {
  cases.push({ id: String(i + 1), name: book.name, fields: { source_text: book.source, summary: book.summary }, expected_errors: [] });
});
BOOKS.forEach((book, i) => {
  cases.push({
    id: String(i + 11),
    name: `${book.name} + 3 errors`,
    base: String(i + 1),
    fields: { source_text: book.source, summary: injectedSummary(book) },
    expected_errors: book.errors.map((e, n) => ({ id: `e${n + 1}`, category: e.category, fragment: e.fragment, description: e.description, difficulty: e.difficulty })),
  });
});

type Claim = [text: string, verdict: 'supported' | 'contradicted' | 'unsupported'];
const reply = (claims: Claim[]) => JSON.stringify({ claims: claims.map(([text, verdict]) => ({ text, verdict, reason: verdict === 'supported' ? 'The source says so.' : verdict === 'contradicted' ? 'The source says something else.' : 'The source does not say this.' })) }, null, 2);

function replyFor(testCase: TestCase): string {
  const id = Number(testCase.id);
  const parts = sentences(testCase.fields['summary'] as string);
  const flagged = (index: number) => testCase.expected_errors.some((e) => e.fragment && parts[index]?.includes(e.fragment));
  const all = (): Claim[] => parts.map((s, i) => [s, flagged(i) ? 'contradicted' : 'supported']);

  if (id === 3) return reply(parts.map((s, i): Claim => [s, i === 1 ? 'unsupported' : 'supported'])); // a false positive
  if (id === 7) return 'Here is my analysis of the summary:\n\n```json\n' + reply(all()) + '\n```\n\nI hope this helps.'; // a fenced reply
  if (id === 10) return 'I looked at the summary and it seems fine to me.'; // cannot be read
  if (id === 14) return reply([[parts[0] as string, 'contradicted'], ['Victor and the creature', 'contradicted'], [parts[2] as string, 'contradicted']]); // a partial match
  if (id === 16) return reply(all().map(([t, v], i): Claim => [t, i === 1 ? 'supported' : v])); // a missed error
  if (id === 17) {
    const [s1, s2, s3] = parts as [string, string, string];
    return reply([[s1, 'contradicted'], ['Gandalf persuades Bilbo Baggins', 'unsupported'], [s2.replace('Gandalf persuades Bilbo Baggins to ', ''), 'supported'], [s3, 'contradicted']]); // missed + false positive
  }
  if (id === 18) return reply(all().map(([t, v], i): Claim => [t, i === 2 ? 'supported' : v])); // a missed error
  if (id === 19) {
    const [s1, s2, s3] = parts as [string, string, string];
    const [head, tail] = s2.split(', fights ') as [string, string];
    return reply([[s1, 'contradicted'], [`${head}.`, 'contradicted'], [`Santiago fights ${tail}`, 'contradicted'], [s3, 'contradicted']]); // a real error that was not injected
  }
  return reply(all());
}

const replies: Evaluation['replies'] = {};
for (const c of cases) replies[c.id] = { prompt: composePrompt(judge_set.prompt, c).text, reply: replyFor(c) };

const checks = { rules: checksDefault.rules } as Evaluation['checks'];
const params = Object.fromEntries(Object.entries(metric.parameters).map(([k, v]) => [k, v.default]));

const evaluation: Evaluation = {
  judge_set,
  dataset: { name: 'Book summaries, set A', finalized: true, cases },
  metric: { id: metric.id, parameters: params },
  checks,
  model_note: 'Demo run: replies were prepared with a script, not by a real model.',
  replies,
  decisions: {},
};
evaluation.reply_judge_version = await judgeVersion(judge_set);

const op = (v: string | boolean, r: string, f: string) => ({ reason: r, fragment: f, ...(typeof v === 'boolean' ? {} : {}) });
void op;
const opinions = {
  '3': { opinion: { id: '3', expected: [], additional: [{ index: 1, real: false, reason: 'The source says the prince speaks about the rose.', fragment: 'The prince speaks about the rose he loves.' }], new: [] } },
  '14': { opinion: { id: '14', expected: [{ index: 2, found: true, reason: 'The judge pointed at Victor and the creature, which is the changed claim.', fragment: 'Victor and the creature' }], additional: [], new: [] } },
  '17': { opinion: { id: '17', expected: [{ index: 2, found: false, reason: 'No finding is about the number of dwarves.', fragment: 'join twelve dwarves' }], additional: [{ index: 1, real: false, reason: 'Gandalf does persuade Bilbo, as the source says.', fragment: 'Gandalf persuades Bilbo Baggins' }], new: [] } },
  '19': { opinion: { id: '19', expected: [], additional: [{ index: 1, real: true, reason: 'The source says three days, not five nights.', fragment: 'fights a huge marlin for five nights' }], new: [] } },
};

const approved = (over: Partial<CaseDecisions>): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: true, note: '', ...over });
const decisionsAfter: Record<string, CaseDecisions> = {
  '3': approved({ additional: { 'claims[]#2': { state: 'false_positive', source: 'llm-approved' } } }),
  '10': approved({}),
  '14': approved({ expected: { e2: { state: 'found', source: 'llm-approved' } } }),
  '17': approved({ expected: { e2: { state: 'missed', source: 'llm-approved' } }, additional: { 'claims[]#2': { state: 'false_positive', source: 'llm-approved' } } }),
  '19': approved({ additional: { 'claims[]#3': { state: 'real_error', source: 'llm-approved' } } }),
};

const versions = { judgeVersion: await judgeVersion(judge_set), testCasesVersion: await testCasesVersion(cases) };
const asLoaded = computeResults(evaluation, metric);
const finished: Evaluation = { ...evaluation, decisions: decisionsAfter };
const afterDeciding = computeResults(finished, metric);

const awaiting = reviewEvaluation(evaluation, metric).filter((r) => r.status === 'awaiting').map((r) => r.testCase.id);
console.log('awaiting verification:', awaiting.join(', '));
console.log('as loaded:', asLoaded.overall.result, `${asLoaded.counters.cases_decided} of ${cases.length} decided`);
console.log('after deciding:', afterDeciding.overall.result, afterDeciding.overall.reasons.join(' | '));

mkdirSync('examples/demo', { recursive: true });
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
writeFileSync('examples/demo/evaluation.json', writeEvaluation(evaluation, asLoaded, { now: NOW, toolVersion: TOOL_VERSION, ...versions }));
writeFileSync(
  'examples/demo/test-project.json',
  json({
    format: 'judge-the-judge-test-project',
    schema_version: 1,
    tool_version: TOOL_VERSION,
    judge_set,
    dataset: {
      name: evaluation.dataset.name,
      version: versions.testCasesVersion,
      finalized: true,
      cases: JSON.parse(writeEvaluation(evaluation, null, { now: NOW, toolVersion: TOOL_VERSION, ...versions })).dataset.cases,
    },
    metric: evaluation.metric,
    checks,
  }),
);
writeFileSync('examples/demo/opinions.json', json(opinions));
writeFileSync('examples/demo/expected-results.json', json({ awaiting_verification: awaiting, decisions_after: decisionsAfter, as_loaded: asLoaded, after_deciding: afterDeciding }));
