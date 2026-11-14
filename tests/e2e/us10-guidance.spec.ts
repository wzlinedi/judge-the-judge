// User Story 10: guidance while building the test project (FR-045, FR-046).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const accuracy = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8'));
const base = accuracy.judge_set.clean_base_cases[0] as { name: string; fields: { source_text: string; summary: string } };
const win = (page: Page) => page.getByRole('dialog', { name: 'Test case' });
const card = (page: Page) => page.getByRole('region', { name: 'Test project' });
const json = (over: Record<string, unknown> = {}) => JSON.stringify({ name: 'A case', fields: base.fields, expected_errors: [], ...over });

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Accuracy' }).click();
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
}
async function pasteCase(page: Page, text: string) {
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'From JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(text);
  await win(page).getByRole('button', { name: 'Save case' }).click();
}

test('the card shows the counts and the test size; only clean cases warn; a case with errors removes the warning; a duplicate is flagged', async ({ page }) => {
  await start(page);
  await expect(card(page)).toContainText('3 test cases: 0 with injected errors, 3 clean, 0 with a reply.');
  await expect(card(page)).toContainText(/Test cases version [0-9a-f]{12}/);
  const size = card(page).getByRole('group', { name: 'Test size' });
  await expect(size).toContainText('Injected errors: 0 of 30 (30 missing)');
  await expect(size).toContainText('Clean cases: 3 of 10 (7 missing)');
  await expect(size).toContainText('A final answer needs at least 30 injected errors and 10 clean cases; until then the result is Inconclusive.');
  const warnings = card(page).getByRole('list', { name: 'Warnings' });
  await expect(warnings).toContainText('no cases with injected errors');
  await expect(warnings).toContainText('detection rate cannot be computed');
  await expect(card(page)).toContainText('497 more test cases can be added (500 at most).');

  // a case with two errors, one subtle: the warning goes, the totals and the groups follow
  const words = Array.from(new Set(base.fields.summary.split(' '))).filter((w) => w.length > 3).slice(0, 2);
  await pasteCase(page, json({ name: 'Two errors', fields: { ...base.fields, source_text: `${base.fields.source_text} (changed)` }, expected_errors: words.map((w, i) => ({ category: 'factual-error', fragment: w, description: `Change ${i + 1}`, difficulty: i === 0 ? 'subtle' : 'obvious' })) }));
  await expect(card(page)).toContainText('4 test cases: 1 with injected errors, 3 clean');
  await expect(size).toContainText('Injected errors: 2 of 30 (28 missing)');
  await expect(size).toContainText('1 case with 2 errors');
  await expect(warnings).toHaveCount(0);

  // a duplicate text is flagged in the card and in the table, with no change to what was saved
  await pasteCase(page, json({ name: 'Same fields as the first' }));
  await expect(card(page).getByRole('list', { name: 'Warnings' })).toContainText('have identical fields');
  await expect(page.getByRole('row').filter({ hasText: 'Same fields as the first' })).toContainText('Identical fields to case 1');
  await expect(page.getByRole('row').filter({ hasText: base.name }).first()).toContainText('Identical fields to case');
  await expect(page.getByText('Unsaved changes').first()).toBeVisible(); // the one indicator is the header's
  await expect(card(page)).not.toContainText('Unsaved');
});

test('a category shows its description and example where it is chosen', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'Case with errors' }).click();
  const first = accuracy.judge_set.error_catalog[0] as { name: string; description: string; example: string };
  const second = accuracy.judge_set.error_catalog[1] as { name: string; description: string; example: string };
  const row = win(page).getByRole('group', { name: 'Error 1' });
  await expect(row).toContainText(first.description);
  await expect(row).toContainText(first.example);
  await row.getByLabel('Category').selectOption(second.name);
  await expect(row).toContainText(second.description);
  await expect(row).not.toContainText(first.description);
});

test('the limit of 500: the remaining capacity is shown, an import beyond it is refused, and at the limit adding is refused with the reason', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  const csv = (n: number) => ['name,field:source_text,field:summary', ...Array.from({ length: n }, (_, i) => `Row ${i},Source text ${i},Summary text ${i}`)].join('\n');
  memory.files.set('too-many.csv', csv(498));
  memory.files.set('exactly.csv', csv(497));
  await start(page);

  memory.chooseOpenName('too-many.csv');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Import test cases…' }).click();
  const importWindow = page.getByRole('dialog', { name: 'Import test cases…' });
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow).toContainText('500');
  await importWindow.getByRole('button', { name: 'Cancel' }).click();
  await expect(card(page)).toContainText('497 more test cases can be added (500 at most).');

  memory.chooseOpenName('exactly.csv');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Import test cases…' }).click();
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await importWindow.getByRole('button', { name: 'Import test cases…' }).click();
  await expect(card(page)).toContainText('The limit of 500 test cases is reached. Remove a case before adding another.');
  await expect(page.getByRole('button', { name: 'Add test case…' })).toBeDisabled();
});
