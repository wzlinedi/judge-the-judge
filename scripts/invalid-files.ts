// The invalid and unsupported files of quickstart V11, by file name. `make-invalid-files.ts` writes them to disk (`npm run invalid-files`);
// the end-to-end test tests/e2e/v11-invalid-files.spec.ts loads the same files into the page.
import { readFileSync } from 'node:fs';

const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const biasMetric = JSON.parse(readFileSync('examples/metrics/bias-example.json', 'utf8')) as { measures: Array<Record<string, unknown>> };

const aCase = (n: number, over: Record<string, unknown> = {}) => ({ name: `Case ${n}`, fields: { source_text: `Source ${n}`, summary: `Summary ${n}` }, expected_errors: [], ...over });
const casesFile = (cases: unknown[]) => ({ format: 'judge-the-judge-test-cases', schema_version: 1, cases });

const { prompt: _prompt, ...judgeWithoutPrompt } = demo['judge_set'];
const noRun = structuredClone(demo);
delete noRun['test_run'];
const brokenRun = structuredClone(demo);
brokenRun['test_run'].replies['1'].reply = '';
const version1 = structuredClone(noRun);
version1['schema_version'] = 1;
version1['dataset'].finalized = true;

export const invalidFiles: Record<string, string> = {
  '1-broken.json': '{ "format": "judge-the-judge-test-project", ',
  '2-newer-version.json': JSON.stringify({ ...demo, schema_version: 3 }, null, 2),
  '3-no-prompt.json': JSON.stringify({ ...demo, judge_set: judgeWithoutPrompt }, null, 2),
  '4-other-format.json': JSON.stringify({ format: 'judge-the-judge-something-else', schema_version: 1 }, null, 2),
  '5-error-catalog.json': JSON.stringify({ format: 'judge-the-judge-error-catalog', schema_version: 1, categories: [] }, null, 2),
  '6-evaluation-file.json': JSON.stringify({ ...demo, format: 'judge-the-judge-evaluation', schema_version: 1 }, null, 2),
  '7-invalid-test-run.json': JSON.stringify(brokenRun, null, 2),
  '8-version-1.json': JSON.stringify(version1, null, 2),
  '9-unknown-operation.json': JSON.stringify(
    { ...noRun, metric: { id: 'bias', parameters: {}, definition: { ...biasMetric, measures: biasMetric.measures.map((m, i) => (i === 0 ? { ...m, operation: 'median' } : m)) } } },
    null,
    2,
  ),
  '10-cases-501.json': JSON.stringify(casesFile(Array.from({ length: 501 }, (_, i) => aCase(i + 1)))),
  '11-field-100001-characters.json': JSON.stringify(casesFile([aCase(1, { name: 'Too long', fields: { source_text: 'x'.repeat(100_001), summary: 'Short' } })])),
};
