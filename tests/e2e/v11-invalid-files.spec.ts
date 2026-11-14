// quickstart.md V11: invalid and unsupported files (SC-004, SC-016, SC-017). Each one is rejected with a message that says what to fix,
// and the data already loaded is unchanged every time.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles, type MemoryFiles } from '../helpers/memory-files';
import { accuracyStarterProject, startFromAccuracy } from '../helpers/start-project';

const demoProject = readFileSync('examples/demo/test-project.json', 'utf8');
const demoEvaluation = readFileSync('examples/demo/evaluation.json', 'utf8');
const biasMetric = JSON.parse(readFileSync('examples/metrics/bias-example.json', 'utf8')) as { measures: Array<Record<string, unknown>> };

const project = JSON.parse(demoProject) as Record<string, unknown> & { judge_set: Record<string, unknown> };
const aCase = (n: number, over: Record<string, unknown> = {}) => ({ name: `Case ${n}`, fields: { source_text: `Source ${n}`, summary: `Summary ${n}` }, expected_errors: [], ...over });
const casesFile = (cases: unknown[]) => JSON.stringify({ format: 'judge-the-judge-test-cases', schema_version: 1, cases });
const { prompt: _prompt, ...judgeWithoutPrompt } = project.judge_set;

/** Everything the screen says about the loaded work: the header (step, file, saved state) and the step on show. */
async function snapshot(page: Page) {
  return { header: await page.locator('header').first().innerText(), main: await page.locator('main').innerText(), step: await page.locator('[aria-current="step"]').innerText() };
}
const menu = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
};

async function openDemo(page: Page): Promise<MemoryFiles> {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', demoProject);
  memory.chooseOpenName('books.json');
  await page.goto('/');
  await menu(page, 'Load test project…');
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  return memory;
}

/** Offers a file to a loader of the File menu and returns what the page says about it. */
async function refusedBy(page: Page, memory: MemoryFiles, loader: 'Load evaluation…' | 'Load test project…', name: string, text: string): Promise<string> {
  memory.files.set(name, text);
  memory.chooseOpenName(name);
  await menu(page, loader);
  const alert = page.getByRole('alert').filter({ hasText: 'The file was not loaded. Nothing has changed.' });
  await expect(alert).toBeVisible();
  return alert.innerText();
}

test('a broken JSON file, a newer schema version, a test project without a prompt, a file of another format and a retired catalog file are refused by the loaders, with what to fix', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);

  expect(await refusedBy(page, memory, 'Load evaluation…', 'broken.json', '{ "format": "judge-the-judge-evaluation", ')).toMatch(/not readable JSON.*line \d+, column \d+/s);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'Load test project…', 'newer.json', JSON.stringify({ ...project, schema_version: 2 }))).toMatch(/schema version 2, which is newer than this tool knows.*up to 1/s);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'Load test project…', 'no-prompt.json', JSON.stringify({ ...project, judge_set: judgeWithoutPrompt }))).toMatch(/prompt/);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'Load evaluation…', 'other.json', JSON.stringify({ format: 'judge-the-judge-something-else', schema_version: 1 }))).toMatch(/format "judge-the-judge-something-else".*reads "judge-the-judge-evaluation"/s);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'Load test project…', 'catalog.json', JSON.stringify({ format: 'judge-the-judge-error-catalog', schema_version: 1, categories: [] }))).toMatch(
    /format "judge-the-judge-error-catalog".*reads "judge-the-judge-test-project"/s,
  );
  expect(await snapshot(page)).toEqual(before);
});

test('a test project given to Load evaluation, and an evaluation given to Load test project, are refused and name the right command', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);

  expect(await refusedBy(page, memory, 'Load evaluation…', 'project.json', demoProject)).toContain('Use "Load test project…" to open it.');
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'Load test project…', 'evaluation.json', demoEvaluation)).toContain('Use "Load evaluation…" to open it.');
  expect(await snapshot(page)).toEqual(before);
});

test('a test-case file that would make 501 cases, and a case with a field of 100,001 characters, import nothing and say why', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await startFromAccuracy(page, memory);
  const before = await snapshot(page);
  const importWindow = page.getByRole('dialog', { name: 'Import test cases…' });

  // 3 cases are in the project: 498 more is the limit, 498 + 1 is not
  memory.files.set('501.json', casesFile(Array.from({ length: 498 }, (_, i) => aCase(i + 100))));
  memory.chooseOpenName('501.json');
  await menu(page, 'Import test cases…');
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow.getByRole('alert')).toContainText('The file was not read. Nothing has changed.');
  await expect(importWindow.getByRole('alert')).toContainText(/501 test cases.*limit is 500\. Nothing was imported\./);
  await importWindow.getByRole('button', { name: 'Cancel' }).click();
  expect(await snapshot(page)).toEqual(before);

  const long = 'x'.repeat(100_001);
  memory.files.set('long.json', casesFile([aCase(1, { name: 'Too long', fields: { source_text: long, summary: 'Short' } })]));
  memory.chooseOpenName('long.json');
  await menu(page, 'Import test cases…');
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow.getByRole('list', { name: 'Invalid rows' })).toContainText('Too long');
  await expect(importWindow.getByRole('list', { name: 'Invalid rows' })).toContainText(/100,000/);
  await expect(importWindow.getByRole('button', { name: 'Import test cases…' })).toBeDisabled();
  await importWindow.getByRole('button', { name: 'Cancel' }).click();
  expect(await snapshot(page)).toEqual(before);
});

test('a metric definition with an unknown operation, inside a test project, is refused by Load test project and the work stays as it was (T243)', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);
  const file = JSON.parse(accuracyStarterProject());
  file.metric = { id: 'bias', parameters: {}, definition: { ...biasMetric, measures: biasMetric.measures.map((m, i) => (i === 0 ? { ...m, operation: 'median' } : m)) } };
  const message = await refusedBy(page, memory, 'Load test project…', 'bad-metric.json', JSON.stringify(file));
  expect(message).toMatch(/median/);
  expect(message).toMatch(/metric\.definition\.measures\[0\]\.operation/);
  expect(await snapshot(page)).toEqual(before);
});
