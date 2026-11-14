// quickstart.md V9, steps 2, 3 and 5: reproduce and audit a finished result (User Stories 9, 12 and 13; SC-003).
// Steps 1, 4 and 6 are checked by v9-save-continue.spec.ts, step 7 by the test case window.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, unknown>;
const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });
const summary = async (page: Page) => ((await page.getByRole('tabpanel').textContent()) ?? '').replace(/\s+/g, ' ').trim();

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Demo/ }).click();
}

async function decideEverything(page: Page) {
  for (const id of ['3', '10', '14', '17', '19']) {
    await next(page).getByRole('button', { name: 'Continue' }).click();
    await expect(caseWindow(page)).toContainText(`Case ${id} `);
    if (id === '10') {
      await caseWindow(page).getByRole('button', { name: 'Approve' }).click();
    } else {
      await caseWindow(page).getByRole('button', { name: 'Second opinion…' }).click();
      await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('textbox', { name: 'Opinion of your LLM' }).fill(JSON.stringify(opinions[id]));
      await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('button', { name: 'Apply opinion' }).click();
    }
    await caseWindow(page).getByRole('button', { name: 'Close' }).click();
  }
  await expect(next(page)).toContainText('20 of 20 cases decided');
}

async function loadEvaluation(page: Page, memory: Awaited<ReturnType<typeof installMemoryFiles>>, name: string) {
  memory.chooseOpenName(name);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load evaluation' }).click();
}

test('a finished result is reproduced from the evaluation file alone: identical numbers, versions and report (steps 2 and 3)', async ({ page, browser }, testInfo) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('finished.json');
  await loadDemo(page);
  await decideEverything(page);

  // Results: open a case, move to the next, change a threshold in Details
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await page.getByRole('tab', { name: 'Test case list' }).click();
  await page.getByRole('table', { name: 'Test cases' }).getByRole('row').nth(3).getByRole('button', { name: 'Open' }).click();
  await expect(caseWindow(page)).toContainText('Case 3 ');
  await caseWindow(page).getByRole('button', { name: 'Next test case' }).click();
  await expect(caseWindow(page)).toContainText('Case 4 ');
  await caseWindow(page).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: 'Summary' }).click();
  const details = page.locator('details.details-section');
  await details.getByText('Details', { exact: true }).click();
  await details.getByLabel('Detection rate: at least (%)').fill('75');
  const numbers = await summary(page);

  const [first] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report' }).click()]);
  await first.saveAs(testInfo.outputPath('first.html'));
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect.poll(() => memory.files.has('finished.json')).toBe(true);
  const saved = JSON.parse(memory.files.get('finished.json')!);
  expect(saved.checks.rules.find((r: { measure: string }) => r.measure === 'detection_rate').value).toBe(0.75);

  // a fresh session: only the evaluation file, no test project
  await page.reload();
  memory.chooseSaveName('again.json');
  await loadEvaluation(page, memory, 'finished.json');
  await expect(page.getByRole('status', { name: 'Message' })).not.toContainText('differ');
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(page.getByRole('region', { name: 'Notices' })).toHaveCount(0);
  await expect.poll(() => summary(page)).toBe(numbers);
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByRole('button', { name: 'Save evaluation as' }).click();
  await expect.poll(() => memory.files.has('again.json')).toBe(true);
  const again = JSON.parse(memory.files.get('again.json')!);
  expect(again.results).toEqual(saved.results);
  expect(again.judge_version).toBe(saved.judge_version);
  expect(again.dataset.version).toBe(saved.dataset.version);

  // the report generated from the loaded file is the same report, and reads without the tool (step 3)
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const [second] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report' }).click()]);
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
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect.poll(() => memory.files.has('finished.json')).toBe(true);
  const file = JSON.parse(memory.files.get('finished.json')!);
  const rate = file.results.measures.detection_rate.value as number;
  file.results.measures.detection_rate.value = 0.123;
  memory.files.set('tampered.json', JSON.stringify(file));

  await page.reload();
  await loadEvaluation(page, memory, 'tampered.json');
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('differ');
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const notice = page.getByRole('region', { name: 'Notices' });
  await expect(notice).toContainText('results.measures.detection_rate.value was 0.123 in the file');
  await expect(notice).toContainText(`is ${rate} when recomputed`);

  // the report carries the same note
  const [download] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report' }).click()]);
  await download.saveAs(testInfo.outputPath('tampered.html'));
  const html = readFileSync(testInfo.outputPath('tampered.html'), 'utf8');
  expect(html).toContain('The numbers recomputed from this file differ');
  expect(html).toContain('stored 0.123');

  // any change makes it another evaluation: the note no longer applies
  await page.getByRole('tab', { name: 'Summary' }).click();
  const details = page.locator('details.details-section');
  await details.getByText('Details', { exact: true }).click();
  await details.getByLabel('Detection rate: at least (%)').fill('70');
  await expect(page.getByRole('region', { name: 'Notices' })).toHaveCount(0);
});

test('the earlier run is never overwritten: after Edit the judge and run again both files ask for a new name (step 5)', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('project.json');
  await loadDemo(page);
  await decideEverything(page);
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Save test project', exact: true }).click();
  expect(memory.asked()).toBe(1);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Save test project', exact: true }).click();
  expect(memory.asked()).toBe(1); // overwritten, not asked again

  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await next(page).getByRole('button', { name: 'Edit the judge and run again' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); // saved, so nothing is asked

  memory.chooseSaveName('project-2.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Save test project', exact: true }).click();
  await expect.poll(() => memory.files.has('project-2.json')).toBe(true);
  const asked = memory.asked();
  memory.chooseSaveName('evaluation-2.json');
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect.poll(() => memory.files.has('evaluation-2.json')).toBe(true);
  expect(memory.asked()).toBe(asked + 1);
  expect(JSON.parse(memory.files.get('project.json')!).dataset.cases).toHaveLength(20);
});
