// quickstart.md V9, steps 2, 3 and 5: reproduce and audit a finished result (User Stories 9, 12 and 13; SC-003).
// Steps 1, 4 and 6 are checked by v9-save-continue.spec.ts, step 7 by the test case window.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject, saveButton, TEST_RUN_STEP } from '../helpers/test-run-flow';

const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, unknown>;
const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });
const summary = async (page: Page) => ((await page.getByRole('tabpanel').textContent()) ?? '').replace(/\s+/g, ' ').trim();

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
}

async function decideEverything(page: Page) {
  for (const id of ['3', '10', '14', '17', '19']) {
    await next(page).getByRole('button', { name: 'Continue' }).click();
    await expect(caseWindow(page)).toContainText(`Case ${id} `);
    if (id === '10') {
      await caseWindow(page).getByRole('button', { name: 'No more findings' }).click();
    } else {
      await caseWindow(page).getByRole('button', { name: 'Second opinion…' }).click();
      await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('textbox', { name: 'Opinion of your LLM' }).fill(JSON.stringify(opinions[id]));
      await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('button', { name: 'Apply opinion' }).click();
    }
    await caseWindow(page).getByRole('button', { name: 'Close' }).click();
  }
  await expect(next(page)).toContainText('20 of 20 cases decided');
}

test('a finished result is reproduced from the test project file alone: identical numbers, versions and report (steps 2 and 3)', async ({ page, browser }, testInfo) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('finished.json');
  await loadDemo(page);
  await decideEverything(page);

  // Results: open a case, move to the next, change a threshold in Details
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await page.getByRole('tab', { name: 'Test case list' }).click();
  await page.getByRole('table', { name: 'Test cases' }).getByRole('row').nth(3).getByRole('button', { name: 'Open' }).click();
  await expect(caseWindow(page)).toContainText('Case 3 ');
  await caseWindow(page).getByRole('button', { name: 'Next case' }).click();
  await expect(caseWindow(page)).toContainText('Case 4 ');
  await caseWindow(page).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: 'Summary' }).click();
  const details = page.locator('details.details-section');
  await details.getByText('Details', { exact: true }).click();
  await details.getByLabel('Detection rate: at least (%)').fill('75');
  const numbers = await summary(page);

  const [first] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report…' }).click()]);
  await first.saveAs(testInfo.outputPath('first.html'));
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('finished.json')).toBe(true);
  const saved = JSON.parse(memory.files.get('finished.json')!);
  expect(saved.checks.rules.find((r: { measure: string }) => r.measure === 'detection_rate').value).toBe(0.75);

  // a fresh session: only the test project file, loaded with its test run
  await page.reload();
  memory.chooseSaveName('again.json');
  await loadTestProject(page, memory, 'finished.json', 'with');
  await expect(page.getByRole('status', { name: 'Message' })).not.toContainText('differ');
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(page.getByRole('region', { name: 'Notices' })).toHaveCount(0);
  await expect.poll(() => summary(page)).toBe(numbers);
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Save test project as…' }).click();
  await expect.poll(() => memory.files.has('again.json')).toBe(true);
  const again = JSON.parse(memory.files.get('again.json')!);
  expect(again.test_run.results).toEqual(saved.test_run.results);
  expect(again.test_run.judge_version).toBe(saved.test_run.judge_version);
  expect(again.dataset.version).toBe(saved.dataset.version);

  // the report generated from the loaded file is the same report, and reads without the tool (step 3)
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const [second] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report…' }).click()]);
  await second.saveAs(testInfo.outputPath('second.html'));
  const body = (file: string) => readFileSync(testInfo.outputPath(file), 'utf8').replace(/Exported [^<]*/, '');
  expect(body('second.html')).toBe(body('first.html'));
  const context = await browser.newContext({ javaScriptEnabled: false });
  const reader = await context.newPage();
  await reader.goto(`file://${testInfo.outputPath('second.html')}`);
  await expect(reader.getByRole('heading', { name: 'Judge the Judge report: Book summaries, set A' })).toBeVisible();
  await context.close();
});

test('a file whose stored numbers do not follow from its data is loaded, and the difference is shown with both numbers (SC-003)', async ({ page }, testInfo) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('finished.json');
  await loadDemo(page);
  await decideEverything(page);
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('finished.json')).toBe(true);
  const file = JSON.parse(memory.files.get('finished.json')!);
  const rate = file.test_run.results.measures.detection_rate.value as number;
  file.test_run.results.measures.detection_rate.value = 0.123;
  memory.files.set('tampered.json', JSON.stringify(file));

  await page.reload();
  await loadTestProject(page, memory, 'tampered.json', 'with');
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('differ');
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const notice = page.getByRole('region', { name: 'Notices' });
  await expect(notice).toContainText('results.measures.detection_rate.value was 0.123 in the file');
  await expect(notice).toContainText(`is ${rate} when recomputed`);

  // the report carries the same note
  const [download] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report…' }).click()]);
  await download.saveAs(testInfo.outputPath('tampered.html'));
  const html = readFileSync(testInfo.outputPath('tampered.html'), 'utf8');
  expect(html).toContain('The numbers recomputed from this file differ');
  expect(html).toContain('stored 0.123');

  // any change makes it other work: the note no longer applies
  await page.getByRole('tab', { name: 'Summary' }).click();
  const details = page.locator('details.details-section');
  await details.getByText('Details', { exact: true }).click();
  await details.getByLabel('Detection rate: at least (%)').fill('70');
  await expect(page.getByRole('region', { name: 'Notices' })).toHaveCount(0);
});

test('the earlier test run is never overwritten: after "Load the test project only" the first save asks for a new name (step 5)', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('project.json');
  await loadDemo(page);
  await decideEverything(page);
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('project.json')).toBe(true);
  expect(memory.asked()).toBe(1);
  await saveButton(page).click();
  expect(memory.asked()).toBe(1); // overwritten, not asked again
  const firstRun = memory.files.get('project.json')!;
  expect(JSON.parse(firstRun).test_run.results.overall.result).toBe('Works');

  // the same test cases for another judge: the test project only, with no replies and no remembered file
  await page.reload();
  await loadTestProject(page, memory, 'project.json', 'only');
  await expect(page.getByRole('banner').locator('.file-name').filter({ hasText: 'no file yet' })).toBeVisible();
  memory.chooseSaveName('project-2.json');
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('project-2.json')).toBe(true);
  expect(memory.asked()).toBe(2);
  expect(JSON.parse(memory.files.get('project-2.json')!)).not.toHaveProperty('test_run');
  expect(JSON.parse(memory.files.get('project-2.json')!).dataset.cases).toHaveLength(20);
  expect(memory.files.get('project.json')).toBe(firstRun); // the first test run is untouched
});
