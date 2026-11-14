// quickstart.md V10 steps 1 and 2: another version of the judge on the same test cases, and the same test with another LLM (User Story 12).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const demo = JSON.parse(readFileSync('examples/demo/evaluation.json', 'utf8')) as { dataset: { cases: Array<{ id: string }> }; replies: Record<string, { reply: string }> };
const firstId = demo.dataset.cases[0]!.id;
const firstReply = demo.replies[firstId]!.reply;

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });

async function versions(page: Page): Promise<{ judge: string; cases: string }> {
  const [judge, cases] = await page.getByRole('region', { name: 'Judge being run' }).locator('code').allTextContents();
  return { judge: judge!, cases: cases! };
}
async function file(page: Page, item: string) {
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}
async function enterFirstReply(page: Page) {
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), firstReply);
  await caseWindow(page).getByRole('button', { name: 'Paste reply' }).click();
  await expect(caseWindow(page).getByRole('textbox', { name: 'Judge reply' })).toHaveValue(firstReply);
  await caseWindow(page).getByRole('button', { name: 'Close' }).click();
}
async function exportReport(page: Page, testInfo: { outputPath: (name: string) => string }, name: string): Promise<string> {
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('region', { name: 'Report and next version' }).getByRole('button', { name: 'Export HTML report…' }).click()]);
  const path = testInfo.outputPath(name);
  await download.saveAs(path);
  return readFileSync(path, 'utf8');
}

test('another judge version on the same test cases, then the same test with another LLM; the files of the first run are never overwritten', async ({ page }, testInfo) => {
  const memory = await installMemoryFiles(page);
  await page.goto('/');
  await file(page, 'Load demo…');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: /3\s*Run/ }).click();

  // the first run: both files saved, a report exported
  const first = await versions(page);
  memory.chooseSaveName('run-1-evaluation.json');
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  memory.chooseSaveName('run-1-project.json');
  await file(page, 'Save test project');
  expect(memory.asked()).toBe(2);
  const projectOfFirstRun = memory.files.get('run-1-project.json')!;
  const evaluationOfFirstRun = memory.files.get('run-1-evaluation.json')!;
  const report1 = await exportReport(page, testInfo, 'report-1.html');
  expect(report1).toContain(first.judge);
  expect(report1).toContain(first.cases);

  // step 1: Run again with a new judge…. Nothing is unsaved, so it does not ask.
  await next(page).getByRole('button', { name: 'Run again with a new judge…' }).click();
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('replies and decisions were cleared');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step');
  const prompt = page.getByLabel('Judge prompt');
  await expect(prompt).not.toHaveAttribute('readonly', '');
  await prompt.fill(`${await prompt.inputValue()}\nBe strict about numbers and dates.`);

  await page.getByRole('button', { name: /3\s*Run/ }).click();
  const second = await versions(page);
  expect(second.cases).toBe(first.cases);
  expect(second.judge).not.toBe(first.judge);
  await expect(page.getByRole('region', { name: 'Progress' })).toContainText(`0 of ${demo.dataset.cases.length}`);

  // the first save of each file of the new run asks for a file and leaves the earlier run alone
  memory.chooseSaveName('run-2-project.json');
  await file(page, 'Save test project');
  expect(memory.asked()).toBe(3);
  await enterFirstReply(page);
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  memory.chooseSaveName('run-2-evaluation.json');
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect.poll(() => memory.files.has('run-2-evaluation.json')).toBe(true);
  expect(memory.asked()).toBe(4);
  expect(memory.files.get('run-1-project.json')).toBe(projectOfFirstRun);
  expect(memory.files.get('run-1-evaluation.json')).toBe(evaluationOfFirstRun);
  expect(JSON.parse(memory.files.get('run-2-project.json')!).judge_set.prompt).toContain('Be strict about numbers and dates.');

  const report2 = await exportReport(page, testInfo, 'report-2.html');
  expect(report2).toContain(second.judge);
  expect(report2).toContain(second.cases);
  expect(report2).not.toContain(first.judge);

  // step 2: the first run's test project again, other model details and the replies of another LLM
  memory.chooseOpenName('run-1-project.json');
  await file(page, 'Load test project…');
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  const third = await versions(page);
  expect(third).toEqual(first);
  await page.getByLabel('Model details').fill('another LLM, temperature 0.7');
  await enterFirstReply(page);
  memory.chooseSaveName('run-3-evaluation.json');
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect.poll(() => memory.files.has('run-3-evaluation.json')).toBe(true);
  expect(memory.asked()).toBe(5);
  const saved = JSON.parse(memory.files.get('run-3-evaluation.json')!);
  expect(saved.judge_version).toBe(first.judge);
  expect(saved.model_note).toBe('another LLM, temperature 0.7');

  const report3 = await exportReport(page, testInfo, 'report-3.html');
  expect(report3).toContain(first.judge);
  expect(report3).toContain(first.cases);
  expect(report3).toContain('another LLM, temperature 0.7');
  expect(memory.files.get('run-1-evaluation.json')).toBe(evaluationOfFirstRun);
});

test('with unsaved changes it asks first: Cancel keeps everything, Save evaluation first saves and then goes on', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await page.goto('/');
  await file(page, 'Load demo…');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await page.getByLabel('Model details').fill('changed after loading');
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();
  await page.getByRole('button', { name: /4\s*Results/ }).click();

  await next(page).getByRole('button', { name: 'Run again with a new judge…' }).click();
  const ask = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(ask.getByRole('button')).toHaveText(['Cancel', 'Discard', 'Save evaluation first']);
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: /4\s*Results/ })).toHaveAttribute('aria-current', 'step');
  expect(memory.asked()).toBe(0);

  memory.chooseSaveName('before-rerun.json');
  await next(page).getByRole('button', { name: 'Run again with a new judge…' }).click();
  await page.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save evaluation first' }).click();
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step');
  expect(JSON.parse(memory.files.get('before-rerun.json')!).model_note).toBe('changed after loading');
  expect(Object.keys(JSON.parse(memory.files.get('before-rerun.json')!).replies).length).toBeGreaterThan(0);
});
