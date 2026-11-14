// T222: a refusal or a warning is shown where the user acted, and stays in view when the page is scrolled (found by the T221 run).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const accuracy = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8'));
const base = accuracy.judge_set.clean_base_cases[0] as { name: string; fields: { source_text: string; summary: string } };

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Accuracy' }).click();
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
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

test('removing a base case is refused in a banner that is in view where the button is, even when the page is scrolled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 320 });
  await start(page);
  // make a case from case 1, so that case 1 is the base of another case
  await page.getByRole('button', { name: 'Add test case' }).click();
  const win = page.getByRole('dialog', { name: 'Test case' });
  await win.getByRole('button', { name: 'Paste JSON' }).click();
  const changed = base.fields.summary.replace(/\b(\d{4})\b/, '1999');
  const summary = changed === base.fields.summary ? `${base.fields.summary} It happened in 1999.` : changed;
  await win.getByLabel('Case JSON').fill(JSON.stringify({ name: 'Made from case 1', base: '1', fields: { source_text: base.fields.source_text, summary }, expected_errors: [{ description: 'A changed year', fragment: '1999', category: 'wrong-number' }] }));
  await win.getByRole('button', { name: 'Save case' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Made from case 1' })).toBeVisible();
  const baseButton = page.getByRole('row').filter({ has: page.locator('td:first-child:text-is("1")') }).getByRole('button', { name: 'Remove' });
  await baseButton.scrollIntoViewIfNeeded();
  await baseButton.click();
  const banner = message(page);
  await expect(banner).toContainText(/Remove those cases first|is the base of/);
  await expect(banner).toContainText('Not done');
  await expect(banner).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('a message of the tool is a visible banner, not small grey text', async ({ page }) => {
  await installMemoryFiles(page);
  await start(page);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Export test cases' }).click();
  const banner = message(page);
  await expect(banner).toContainText(/Exported/);
  const style = await banner.evaluate((e) => ({ border: getComputedStyle(e).borderTopWidth, size: parseFloat(getComputedStyle(e).fontSize) }));
  expect(style.border).not.toBe('0px');
  expect(style.size).toBeGreaterThanOrEqual(16);
});
