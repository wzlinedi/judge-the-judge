// quickstart.md V10 steps 1 and 2: another version of the judge on the same test cases, and the same test with another LLM (User Story 12).
// Both start from "Load the test project only" on the test project of the first run (T289; FR-020, FR-053, FR-074, FR-076).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject, saveButton, startTestRun, TEST_RUN_STEP } from '../helpers/test-run-flow';

const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8')) as { dataset: { cases: Array<{ id: string }> }; test_run: { replies: Record<string, { reply: string }> } };
const firstId = demo.dataset.cases[0]!.id;
const firstReply = demo.test_run.replies[firstId]!.reply;

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });

async function versions(page: Page): Promise<{ judge: string; cases: string }> {
  const [judge, cases] = await page.getByRole('region', { name: 'Judge being run' }).locator('code').allTextContents();
  return { judge: judge!, cases: cases! };
}
async function file(page: Page, item: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}
async function enterFirstReply(page: Page) {
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), firstReply);
  await caseWindow(page).getByRole('button', { name: 'Paste reply' }).click();
  await expect(caseWindow(page).locator('.reply-read')).toBeVisible(); // the saved reply is read-only (T293)
  await caseWindow(page).getByRole('button', { name: 'Close' }).click();
}
async function exportReport(page: Page, testInfo: { outputPath: (name: string) => string }, name: string): Promise<string> {
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('region', { name: 'What next' }).getByRole('button', { name: 'Export HTML report…' }).click()]);
  const path = testInfo.outputPath(name);
  await download.saveAs(path);
  return readFileSync(path, 'utf8');
}

test('another judge version on the same test cases, then the same test with another LLM; the file of the first test run is never overwritten', async ({ page }, testInfo) => {
  const memory = await installMemoryFiles(page);
  await page.goto('/');
  await file(page, 'Load demo…');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();

  // the first test run: one file saved, a report exported
  const first = await versions(page);
  memory.chooseSaveName('run-1.json');
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('run-1.json')).toBe(true);
  expect(memory.asked()).toBe(1);
  const firstRun = memory.files.get('run-1.json')!;
  const report1 = await exportReport(page, testInfo, 'report-1.html');
  expect(report1).toContain(first.judge);
  expect(report1).toContain(first.cases);

  // after the start the prompt is locked, with the reason and a way to load another test project, and there is no way back
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt')).toHaveAttribute('readonly', '');
  await expect(page.getByText(/The test run has started, so the prompt is fixed\./)).toBeVisible();
  await expect(page.getByText(/Load the test project only/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load test project…' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Run again with a new judge/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Reopen test cases/ })).toHaveCount(0);

  // step 1: another judge. Nothing is unsaved, so the load does not ask about unsaved work; only the test project is loaded.
  await loadTestProject(page, memory, 'run-1.json', 'only');
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step'); // the test run has not started
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  const prompt = page.getByLabel('Judge prompt');
  await expect(prompt).not.toHaveAttribute('readonly', '');
  await prompt.fill(`${await prompt.inputValue()}\nBe strict about numbers and dates.`);
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await startTestRun(page);

  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  const second = await versions(page);
  expect(second.cases).toBe(first.cases);
  expect(second.judge).not.toBe(first.judge);
  await expect(page.getByRole('region', { name: 'Progress' })).toContainText(`0 of ${demo.dataset.cases.length}`);

  // the first save of the new test run asks for a file and leaves the first test run alone
  await enterFirstReply(page);
  memory.chooseSaveName('run-2.json');
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('run-2.json')).toBe(true);
  expect(memory.asked()).toBe(2);
  expect(memory.files.get('run-1.json')).toBe(firstRun);
  expect(JSON.parse(memory.files.get('run-2.json')!).judge_set.prompt).toContain('Be strict about numbers and dates.');

  const report2 = await exportReport(page, testInfo, 'report-2.html');
  expect(report2).toContain(second.judge);
  expect(report2).toContain(second.cases);
  expect(report2).not.toContain(first.judge);

  // step 2: the first test run's test project again, other model details and the replies of another LLM
  await loadTestProject(page, memory, 'run-1.json', 'only');
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0);
  await startTestRun(page);
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  const third = await versions(page);
  expect(third).toEqual(first);
  await page.getByLabel('Model details').fill('another LLM, temperature 0.7');
  await enterFirstReply(page);
  memory.chooseSaveName('run-3.json');
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('run-3.json')).toBe(true);
  expect(memory.asked()).toBe(3);
  const saved = JSON.parse(memory.files.get('run-3.json')!).test_run;
  expect(saved.judge_version).toBe(first.judge);
  expect(saved.model_note).toBe('another LLM, temperature 0.7');

  const report3 = await exportReport(page, testInfo, 'report-3.html');
  expect(report3).toContain(first.judge);
  expect(report3).toContain(first.cases);
  expect(report3).toContain('another LLM, temperature 0.7');
  expect(memory.files.get('run-1.json')).toBe(firstRun);
});

test('with unsaved changes the load asks first: Cancel keeps everything, "Save test project first" saves and then goes on', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await page.goto('/');
  await file(page, 'Load demo…');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  await page.getByLabel('Model details').fill('changed after loading');
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();
  await page.getByRole('button', { name: /4\s*Results/ }).click();

  await file(page, 'Load test project…');
  const ask = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(ask.getByRole('button')).toHaveText(['Cancel', 'Discard', 'Save test project first']);
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: /4\s*Results/ })).toHaveAttribute('aria-current', 'step');
  expect(memory.asked()).toBe(0);

  memory.chooseSaveName('before-load.json');
  memory.chooseOpenName('before-load.json');
  await file(page, 'Load test project…');
  await page.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save test project first' }).click();
  await page.getByRole('dialog', { name: 'Load test project' }).getByRole('button', { name: 'Load the test project only' }).click();
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step');
  const saved = JSON.parse(memory.files.get('before-load.json')!);
  expect(saved.test_run.model_note).toBe('changed after loading');
  expect(Object.keys(saved.test_run.replies).length).toBeGreaterThan(0);
});
