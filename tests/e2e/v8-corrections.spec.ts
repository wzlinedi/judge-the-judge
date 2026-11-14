// quickstart.md V8: correct a rule after replies (User Stories 8 and 13; FR-053, FR-075).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const demo = JSON.parse(readFileSync('examples/demo/evaluation.json', 'utf8')) as { judge_version: string };
const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const notices = (page: Page) => page.getByRole('region', { name: 'Notices' });

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Demo/ }).click();
}

test('correcting a rule after replies keeps the replies, changes the judge version, and the Results step, the file and the report say so', async ({ page }, testInfo) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('corrected.json');
  await loadDemo(page);

  // nothing was corrected yet
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(page.getByRole('region', { name: 'Notices' })).toHaveCount(0);

  // the rule changes after the replies: its second condition is removed
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await page.getByRole('button', { name: 'Remove condition 2 of rule 1' }).click();
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();

  // Results: the note names the version the replies were received under and the one in force now
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(notices(page)).toContainText('The rules were corrected after the replies were received');
  await expect(notices(page)).toContainText(`was ${demo.judge_version}`);
  await expect(notices(page)).not.toContainText(`the current one is ${demo.judge_version}`);
  await expect(next(page)).toContainText('of 20 cases decided');

  // the evaluation file keeps the replies and records both versions
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect.poll(() => memory.files.has('corrected.json')).toBe(true);
  const file = JSON.parse(memory.files.get('corrected.json')!);
  expect(file.rules_corrected_after_replies).toBe(true);
  expect(file.reply_judge_version).toBe(demo.judge_version);
  expect(file.judge_version).not.toBe(demo.judge_version);
  expect(Object.keys(file.replies)).toHaveLength(20);

  // the report says it too
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('region', { name: 'Report and next version' }).getByRole('button', { name: 'Export HTML report' }).click()]);
  const path = testInfo.outputPath('corrected-report.html');
  await download.saveAs(path);
  const html = readFileSync(path, 'utf8');
  expect(html).toContain('The rules were corrected after the replies were received');
  expect(html).toContain(demo.judge_version);
  expect(html).toContain(file.judge_version);
});
