// T222: a refusal or a warning is shown where the user acted, and stays in view when the page is scrolled (found by the T221 run).
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles, type MemoryFiles } from '../helpers/memory-files';
import { startFromAccuracy } from '../helpers/start-project';

async function start(page: Page, memory?: MemoryFiles) {
  await startFromAccuracy(page, memory);
}
const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name }).first();
const message = (page: Page) => page.getByRole('status', { name: 'Message' });

test('a rename to a taken name is refused inside the Rename window, which stays open and says the name was not changed', async ({ page }) => {
  await start(page);
  const names = await page.getByRole('row').locator('td:nth-child(2)').allInnerTexts();
  await row(page, names[0]!.trim()).getByRole('button', { name: 'Rename' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename test case' });
  await dialog.getByLabel('New name').fill(names[1]!.trim());
  await dialog.getByRole('button', { name: 'Rename' }).click();
  await expect(dialog.getByRole('alert')).toContainText(/already used by case/);
  await expect(dialog.getByRole('alert')).toContainText(/not changed/i);
  await expect(dialog.getByRole('alert')).toBeInViewport();
});

test('a message of the tool is a visible banner, not small grey text', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await start(page, memory);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Export test cases…' }).click();
  const banner = message(page);
  await expect(banner).toContainText(/Exported/);
  const style = await banner.evaluate((e) => ({ border: getComputedStyle(e).borderTopWidth, size: parseFloat(getComputedStyle(e).fontSize) }));
  expect(style.border).not.toBe('0px');
  expect(style.size).toBeGreaterThanOrEqual(16);
});
