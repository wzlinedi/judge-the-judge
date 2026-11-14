// quickstart.md V4: a case with injected errors in three parts, Open, Show JSON, Clone, Correct expected errors
// (SC-022 to SC-024, SC-031, SC-033, SC-035, SC-036, User Story 4).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const accuracy = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8'));
const base = accuracy.judge_set.clean_base_cases[0] as { name: string; fields: { source_text: string; summary: string } };
const win = (page: Page) => page.getByRole('dialog', { name: 'Test case' });
const json = (over: Record<string, unknown> = {}) => JSON.stringify({ name: 'Anna, two errors', fields: base.fields, expected_errors: [], ...over });
const firstWord = base.fields.summary.split(' ')[0] as string; // "Anna,"
const withErrors = (fragments: [string, string]) => {
  const summary = base.fields.summary.replace(firstWord, fragments[0]).replace(/\S+$/, fragments[1]);
  return json({
    fields: { ...base.fields, summary },
    expected_errors: [
      { category: 'factual-error', fragment: fragments[0], description: 'The name was changed', difficulty: 'obvious' },
      { category: 'tone-shift', fragment: fragments[1], description: 'The last word was changed', difficulty: 'subtle' },
    ],
  });
};

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Accuracy' }).click();
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`);

test('a case with injected errors in three parts: prompt, JSON, case view, save', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add test case' }).click();
  await win(page).getByRole('button', { name: 'Case with injected errors' }).click();

  // part 1: a base, two errors (one with a new category), the prompt
  await win(page).getByLabel('Base case (optional)').selectOption({ index: 1 });
  await win(page).getByRole('button', { name: 'Add error' }).click();
  const second = win(page).getByRole('group', { name: 'Error 2' });
  await second.getByLabel('Category').selectOption('New category…');
  await second.getByLabel('New category name').fill('tone-shift');
  await second.getByLabel('Difficulty').selectOption('Subtle');
  const prompt = win(page).getByRole('textbox', { name: 'Prompt for your LLM' });
  await expect(prompt).toHaveValue(/\{\{source_text\}\}/);
  await expect(prompt).toHaveValue(new RegExp(base.fields.summary.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(prompt).toHaveValue(/Error 2[^]*tone-shift/);
  await expect(prompt).toHaveValue(/A statement that is simply untrue/); // the catalog description of the first category
  await win(page).getByRole('button', { name: 'Copy prompt' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('tone-shift');
  expect(await axe(page)).toEqual([]);

  // part 2: one paste, checked as it is pasted
  await win(page).getByRole('button', { name: 'Next' }).click();
  const box = win(page).getByLabel('Case JSON');
  await box.fill('{ "name": ');
  await expect(win(page).getByText(/Line 1, column \d+/)).toBeVisible();
  await expect(win(page).getByRole('button', { name: 'Next' })).toBeDisabled();
  await box.fill(withErrors(['Zorro,', 'Quartz.']));
  await win(page).getByRole('button', { name: 'Next' }).click();

  // part 3: highlights, the check line, Show in text
  await expect(win(page).getByText('Text and list agree')).toBeVisible();
  await expect(win(page).locator('mark[data-error]')).toHaveCount(2);
  await expect(win(page).locator('mark[data-error]').first()).toContainText('E1');
  await win(page).getByRole('button', { name: 'Show in text' }).nth(1).click();
  await expect(win(page).locator('mark.fragment-strong')).toContainText('Quartz');
  expect(await axe(page)).toEqual([]);

  // a fragment that no longer occurs turns the line into "not in the text" at once
  const text = await box.inputValue();
  await box.fill(text.replace(/"fragment":\s*"Quartz\."/, '"fragment": "Quartzzz"'));
  await expect(win(page).getByText(/1 expected error not in the text/)).toBeVisible();
  await expect(win(page).getByRole('button', { name: 'Show in text' }).nth(1)).toBeDisabled();
  await win(page).getByRole('button', { name: 'Save case' }).click();
  const ask = page.getByRole('dialog', { name: 'Save with a mismatch?' });
  await expect(ask).toContainText('Quartzzz');
  await ask.getByRole('button', { name: 'Go back' }).click();

  // fix it and save
  await box.fill(text);
  await expect(win(page).getByText('Text and list agree')).toBeVisible();
  await win(page).getByRole('button', { name: 'Save case' }).click();
  await expect(win(page)).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: 'Anna, two errors' });
  await expect(row).toContainText('Injected errors');
  await expect(page.getByRole('button', { name: /Error categories.*6/ })).toBeVisible(); // the new category joined the five
  await page.getByRole('button', { name: /Error categories/ }).click();
  await expect(page.getByText('tone-shift', { exact: true }).first()).toBeVisible();
});

test('Paste JSON: a case identical to its base is refused with the reason', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add test case' }).click();
  await win(page).getByRole('button', { name: 'Paste JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(json({ name: 'Same', base: '1', expected_errors: [{ description: 'x', fragment: firstWord }] }));
  await expect(win(page).getByText(/identical to its base case 1/)).toBeVisible();
  await expect(win(page).getByRole('button', { name: 'Save case' })).toBeDisabled();
});

test('five expected errors are visible without scrolling, and Show JSON, Copy JSON and Paste JSON round-trip', async ({ page }) => {
  await start(page);
  const words = Array.from(new Set(base.fields.summary.split(' '))).filter((w) => w.length > 3).slice(0, 5);
  expect(words).toHaveLength(5);
  await page.getByRole('button', { name: 'Add test case' }).click();
  await win(page).getByRole('button', { name: 'Paste JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(json({ name: 'Five errors', expected_errors: words.map((w, i) => ({ category: 'factual-error', fragment: w, description: `Change ${i + 1}`, difficulty: i % 2 ? 'subtle' : 'obvious' })) }));
  await win(page).getByRole('button', { name: 'Save case' }).click();
  await page.getByRole('row').filter({ hasText: 'Five errors' }).getByRole('button', { name: 'Open' }).click();

  const view = page.getByRole('dialog', { name: /Five errors/ });
  const last = view.getByRole('list', { name: 'Expected errors' }).getByRole('listitem').nth(4);
  await expect(last).toBeVisible();
  const box = await last.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);

  await view.getByRole('button', { name: 'Show JSON' }).click();
  await view.getByRole('button', { name: 'Copy JSON' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(copied).expected_errors).toHaveLength(5);
  await view.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Add test case' }).click();
  await win(page).getByRole('button', { name: 'Paste JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(copied.replace('Five errors', 'Five errors pasted'));
  await win(page).getByRole('button', { name: 'Next' }).click();
  await expect(win(page).locator('mark[data-error]')).toHaveCount(5);
  await win(page).getByRole('button', { name: 'Save case' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Five errors pasted' })).toBeVisible();

  // Next test case moves through the cases
  await page.getByRole('row').filter({ hasText: 'Five errors pasted' }).getByRole('button', { name: 'Open' }).click();
  const position = page.locator('.case-window-position');
  await expect(position).toHaveText(/5 of 5/);
  await page.getByRole('button', { name: 'Previous test case' }).click();
  await expect(position).toHaveText(/4 of 5/);
});

test('after finalizing only the expected errors of a case without a reply can be corrected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Demo/ }).click();
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();

  // a case added after the first reply has no reply
  await page.getByRole('button', { name: 'Add test case' }).click();
  await win(page).getByRole('button', { name: 'Paste JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(JSON.stringify({ name: 'Late case', fields: { source_text: 'A keeper lights the lamp every evening.', summary: 'A keeper lights the lamp each morning.' }, expected_errors: [{ category: 'factual-error', fragment: 'each morning', description: 'Evening became morning', difficulty: 'obvious' }] }));
  await win(page).getByRole('button', { name: 'Save case' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Late case' });
  await expect(row).toContainText('added after first reply');

  await row.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Correct expected errors' }).click();
  const box = win(page).getByLabel('Case JSON');
  const original = await box.inputValue();
  await box.fill(original.replace('The expected', 'x').replace('"obvious"', '"subtle"'));
  await win(page).getByRole('button', { name: 'Save case' }).click();
  await expect(win(page)).toHaveCount(0);

  // a field cannot change
  await row.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Correct expected errors' }).click();
  await box.fill((await box.inputValue()).replace('each morning', 'each night'));
  await expect(win(page).getByText(/fields cannot change/i)).toBeVisible();
  await expect(win(page).getByRole('button', { name: 'Save case' })).toBeDisabled();

  // a case with a reply offers no correction
  await win(page).getByRole('button', { name: 'Close without saving' }).click();
  await page.getByRole('dialog', { name: 'Close without saving?' }).getByRole('button', { name: 'Close without saving' }).click();
  await page.getByRole('row').nth(1).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('button', { name: 'Correct expected errors' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Case 1/ }).getByText(/has a reply/)).toBeVisible();
});
