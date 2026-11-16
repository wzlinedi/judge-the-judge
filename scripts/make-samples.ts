// Produces examples/samples/: two test projects with ten cases each, for the Completeness and Bias metrics. Each file carries its
// metric (metric.definition), so "Load test project…" opens it. There is no test run: run the cases with your own model and paste the replies.
// Run with `npm run samples`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import accuracy from '../src/core/metrics/builtin/accuracy.json';
import checksDefault from '../src/core/metrics/builtin/checks.default.json';
import { testCasesVersion } from '../src/core/cases/version';
import { writeTestProject } from '../src/core/io/test-project-file';
import { judgeVersion } from '../src/core/judge/version';
import type { JudgeSet, MetricRef, TestCase, TestProject } from '../src/core/model';
import { BIAS_CASES, COMPLETENESS_CASES, type SampleCase } from './sample-data';

const NOW = '2026-11-16T10:00:00Z';
const TOOL_VERSION = '1.0.0';
const checks = { rules: checksDefault.rules } as TestProject['checks'];

const toCases = (samples: SampleCase[]): TestCase[] =>
  samples.map((s, i) => ({
    id: String(i + 1),
    name: s.name,
    fields: s.fields,
    expected_errors: s.errors.map((e, n) => ({ id: `e${n + 1}`, category: e.category, fragment: e.fragment, description: e.description, difficulty: e.difficulty })),
  }));

const bias = JSON.parse(readFileSync('examples/metrics/bias-example.json', 'utf8'));
const completeness = {
  id: 'completeness',
  name: 'Completeness',
  description: 'Checks that the judge finds every fact of a source text that a summary leaves out.',
  limitations: 'Measures only the kinds of omission injected into the test data.',
  output_format: 'A JSON object with a list of the missing facts, each with its text (in the words of the source) and a reason.',
  parameters: accuracy.parameters,
  measures: accuracy.measures,
  judge_set: {
    prompt: 'You are a careful editor. Read the SOURCE and the SUMMARY.\nList every important fact of the SOURCE that the SUMMARY leaves out. If the summary is complete, return an empty list.\nAnswer only with JSON in this form:\n{"missing_facts": [{"text": "the fact, in the words of the source", "reason": "one sentence"}]}\n\nSOURCE:\n{{source_text}}\n\nSUMMARY:\n{{summary}}',
    judged_text: 'source_text',
    sample_reply: '{"missing_facts":[{"text":"ends in June","reason":"The summary does not say when the work ends."}]}',
    reply_mapping: { finding_text: { 'missing_facts[]': 'missing_facts[].text' } },
    error_rules: [{ name: 'Missing fact', match: 'all', conditions: [{ field: 'missing_facts[].text', comparison: 'is_not_empty' }] }],
    error_catalog: [
      { name: 'omitted-date', description: 'A date or a time that the summary leaves out. Example: the work ends in June.' },
      { name: 'omitted-number', description: 'A number or an amount that the summary leaves out. Example: the project costs 2 million euros.' },
      { name: 'omitted-event', description: 'A thing that happens or a rule that the summary leaves out. Example: entry is free on Sundays.' },
      { name: 'omitted-outcome', description: 'A result or a conclusion that the summary leaves out. Example: the effect was strongest in people over 60.' },
    ],
  },
};

async function write(file: string, metric: typeof bias, samples: SampleCase[], name: string) {
  const { clean_base_cases: _starter, ...judgeSetBase } = metric.judge_set;
  const judge_set = structuredClone(judgeSetBase) as JudgeSet;
  const { id, name: metricName, description, limitations, output_format, parameters, measures } = metric;
  const ref: MetricRef = {
    id,
    parameters: Object.fromEntries(Object.entries(parameters as Record<string, { default: number }>).map(([k, v]) => [k, v.default])),
    definition: { name: metricName, description, limitations, output_format, parameters, measures } as MetricRef['definition'] & object,
  };
  const cases = toCases(samples);
  const project: TestProject = { judge_set, dataset: { name, cases }, metric: ref, checks };
  const versions = { judgeVersion: await judgeVersion(judge_set), testCasesVersion: await testCasesVersion(cases) };
  writeFileSync(file, writeTestProject(project, null, { now: NOW, toolVersion: TOOL_VERSION, ...versions }));
}

mkdirSync('examples/samples', { recursive: true });
await write('examples/samples/completeness-test-project.json', completeness as typeof bias, COMPLETENESS_CASES, 'Completeness, 10 cases');
await write('examples/samples/bias-test-project.json', bias, BIAS_CASES, 'Bias, 10 cases');
console.log('written: examples/samples/completeness-test-project.json, bias-test-project.json');
