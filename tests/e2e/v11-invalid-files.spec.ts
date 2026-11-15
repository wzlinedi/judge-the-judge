// quickstart.md V11: invalid and unsupported files (SC-004, SC-016, SC-017). Each one is rejected with a message that says what to fix,
// and the data already loaded is unchanged every time. There is one test project file (T289): the evaluation format is gone, and a
// file with an invalid test run is refused before the load question is asked.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles, type MemoryFiles } from '../helpers/memory-files';
import { accuracyStarterProject, startFromAccuracy } from '../helpers/start-project';
import { loadQuestion, loadTestProject, TEST_RUN_STEP } from '../helpers/test-run-flow';
import { invalidFiles } from '../../scripts/invalid-files';

const demoProject = readFileSync('examples/demo/test-project.json', 'utf8');
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
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
};

async function openDemo(page: Page): Promise<MemoryFiles> {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', demoProject);
  await page.goto('/');
  await loadTestProject(page, memory, 'books.json', 'with');
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step');
  return memory;
}

/** Offers a file to "Load test project…" and returns what the page says about it. */
async function refusedBy(page: Page, memory: MemoryFiles, name: string, text: string): Promise<string> {
  memory.files.set(name, text);
  memory.chooseOpenName(name);
  await menu(page, 'Load test project…');
  const alert = page.getByRole('alert').filter({ hasText: 'The file was not loaded. Nothing has changed.' });
  await expect(alert).toBeVisible();
  return alert.innerText();
}

test('a broken JSON file, a newer schema version, a test project without a prompt, a file of another format and a retired catalog file are refused, with what to fix', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);

  expect(await refusedBy(page, memory, 'broken.json', '{ "format": "judge-the-judge-test-project", ')).toMatch(/not readable JSON.*line \d+, column \d+/s);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'newer.json', JSON.stringify({ ...project, schema_version: 3 }))).toMatch(/schema version 3, which is newer than this tool knows.*up to 2/s);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'no-prompt.json', JSON.stringify({ ...project, judge_set: judgeWithoutPrompt }))).toMatch(/prompt/);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'other.json', JSON.stringify({ format: 'judge-the-judge-something-else', schema_version: 1 }))).toMatch(/format "judge-the-judge-something-else".*reads "judge-the-judge-test-project"/s);
  expect(await snapshot(page)).toEqual(before);

  expect(await refusedBy(page, memory, 'catalog.json', JSON.stringify({ format: 'judge-the-judge-error-catalog', schema_version: 1, categories: [] }))).toMatch(
    /format "judge-the-judge-error-catalog".*reads "judge-the-judge-test-project"/s,
  );
  expect(await snapshot(page)).toEqual(before);
});

test('a file of the evaluation format of earlier builds gets the message for an unknown format, and names no other command (T289)', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);
  const message = await refusedBy(page, memory, 'evaluation.json', JSON.stringify({ ...project, format: 'judge-the-judge-evaluation', schema_version: 1 }));
  expect(message).toMatch(/format "judge-the-judge-evaluation".*reads "judge-the-judge-test-project"/s);
  expect(message).not.toContain('Load evaluation');
  expect(await snapshot(page)).toEqual(before);
});

test('an invalid test run is refused with its field path before the load question is asked, and nothing changes', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);
  const broken = JSON.parse(demoProject);
  broken.test_run.replies['1'].reply = '';
  expect(await refusedBy(page, memory, 'broken-run.json', JSON.stringify(broken))).toContain('test_run.replies.1.reply');
  await expect(loadQuestion(page)).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
});

test('a version 1 file of earlier builds is upgraded with a note and loads with the test run not started (T289)', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  const old = JSON.parse(demoProject);
  delete old.test_run;
  old.schema_version = 1;
  old.dataset.finalized = true;
  memory.files.set('old.json', JSON.stringify(old));
  await page.goto('/');
  await loadTestProject(page, memory, 'old.json'); // a version 1 file never holds a test run, so there is no question
  await expect(loadQuestion(page)).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('schema version 1');
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('region', { name: 'What next' }).getByRole('button', { name: 'Start test run' })).toBeVisible();
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
  const message = await refusedBy(page, memory, 'bad-metric.json', JSON.stringify(file));
  expect(message).toMatch(/median/);
  expect(message).toMatch(/metric\.definition\.measures\[0\]\.operation/);
  expect(await snapshot(page)).toEqual(before);
});

// The files of `npm run invalid-files` (scripts/invalid-files.ts), the ones the owner would try by hand: each gets the message of quickstart V11.
test('the files of "npm run invalid-files" get the messages of the quickstart, and nothing changes (T313)', async ({ page }) => {
  const memory = await openDemo(page);
  const before = await snapshot(page);
  const refused: Array<[string, RegExp[]]> = [
    ['1-broken.json', [/not readable JSON.*line \d+, column \d+/s]],
    ['2-newer-version.json', [/schema version 3, which is newer than this tool knows.*up to 2/s]],
    ['3-no-prompt.json', [/prompt/]],
    ['4-other-format.json', [/format "judge-the-judge-something-else".*reads "judge-the-judge-test-project"/s]],
    ['5-error-catalog.json', [/format "judge-the-judge-error-catalog".*reads "judge-the-judge-test-project"/s]],
    ['6-evaluation-file.json', [/format "judge-the-judge-evaluation".*reads "judge-the-judge-test-project"/s]],
    ['7-invalid-test-run.json', [/test_run\.replies\.1\.reply/]],
    ['9-unknown-operation.json', [/median/, /metric\.definition\.measures\[0\]\.operation/]],
  ];
  for (const [name, patterns] of refused) {
    const message = await refusedBy(page, memory, name, invalidFiles[name]!);
    for (const pattern of patterns) expect(message, name).toMatch(pattern);
    expect(message, name).not.toContain('Load evaluation');
    await expect(loadQuestion(page), name).toHaveCount(0);
    expect(await snapshot(page), name).toEqual(before);
  }

  const importWindow = page.getByRole('dialog', { name: 'Import test cases…' });
  memory.files.set('10-cases-501.json', invalidFiles['10-cases-501.json']!);
  memory.chooseOpenName('10-cases-501.json');
  await menu(page, 'Import test cases…');
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow.getByRole('alert')).toContainText(/limit is 500\. Nothing was imported\./);
  await importWindow.getByRole('button', { name: 'Cancel' }).click();

  memory.files.set('11-field-100001-characters.json', invalidFiles['11-field-100001-characters.json']!);
  memory.chooseOpenName('11-field-100001-characters.json');
  await menu(page, 'Import test cases…');
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow.getByRole('list', { name: 'Invalid rows' })).toContainText(/Too long.*100,000/s);
  await expect(importWindow.getByRole('button', { name: 'Import test cases…' })).toBeDisabled();
  await importWindow.getByRole('button', { name: 'Cancel' }).click();
  expect(await snapshot(page)).toEqual(before);

  // the version 1 file last: it replaces the loaded work, with a note and no question
  memory.files.set('8-version-1.json', invalidFiles['8-version-1.json']!);
  memory.chooseOpenName('8-version-1.json');
  await menu(page, 'Load test project…');
  await expect(loadQuestion(page)).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('schema version 1');
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('region', { name: 'What next' }).getByRole('button', { name: 'Start test run' })).toBeVisible();
});
