// quickstart.md V4: a case with injected errors on one page (T229), Open, Edit expected errors
// (SC-022 to SC-024, SC-031, SC-033, SC-035, SC-036, User Story 4).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startFromAccuracy } from '../helpers/start-project';

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
  await startFromAccuracy(page);
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`);

test('a case with injected errors on one page: base, errors, prompt, JSON, expected errors, save', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'Case with errors' }).click();

  // part 1: a base, two errors (one with a new category), the prompt
  await win(page).getByLabel('Base case (optional)').selectOption({ index: 1 });
  await win(page).getByRole('button', { name: 'Add error' }).click();
  const second = win(page).getByRole('row', { name: 'Error 2' });
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

  // part 4: one paste, checked as it is pasted, on the same page
  const box = win(page).getByLabel('Case JSON');
  await box.fill('{ "name": ');
  await expect(win(page).getByText(/Line 1, column \d+/)).toBeVisible();
  await expect(win(page).getByRole('button', { name: 'Save case' })).toBeDisabled();
  await box.fill(withErrors(['Zorro,', 'Quartz.']));

  // part 5: the check line and the list of expected errors, read-only
  await expect(win(page).getByText('Text and list agree')).toBeVisible();
  await expect(win(page).getByRole('list', { name: 'Expected errors' }).getByRole('listitem')).toHaveCount(2);
  await expect(win(page).locator('mark')).toHaveCount(0);
  expect(await axe(page)).toEqual([]);

  // a fragment that no longer occurs turns the line into "not in the text" at once, and the error says "not found in the case"
  const text = await box.inputValue();
  await box.fill(text.replace(/"fragment":\s*"Quartz\."/, '"fragment": "Quartzzz"'));
  await expect(win(page).getByText(/1 expected error not in the text/)).toBeVisible();
  await expect(win(page).getByText('not found in the case', { exact: true })).toBeVisible();
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

test('From JSON: a case identical to its base is refused with the reason', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'From JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(json({ name: 'Same', base: '1', expected_errors: [{ description: 'x', fragment: firstWord }] }));
  await expect(win(page).getByText(/identical to its base case 1/)).toBeVisible();
  await expect(win(page).getByRole('button', { name: 'Save case' })).toBeDisabled();
});

test('five expected errors are visible without scrolling, and From JSON adds a case (Show JSON and Copy JSON are gone, T238)', async ({ page }) => {
  await start(page);
  const words = Array.from(new Set(base.fields.summary.split(' '))).filter((w) => w.length > 3).slice(0, 5);
  expect(words).toHaveLength(5);
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'From JSON' }).click();
  const five = json({ name: 'Five errors', expected_errors: words.map((w, i) => ({ category: 'factual-error', fragment: w, description: `Change ${i + 1}`, difficulty: i % 2 ? 'subtle' : 'obvious' })) });
  await win(page).getByLabel('Case JSON').fill(five);
  await win(page).getByRole('button', { name: 'Save case' }).click();
  await page.getByRole('row').filter({ hasText: 'Five errors' }).getByRole('button', { name: 'Open' }).click();

  const view = page.getByRole('dialog', { name: /Five errors/ });
  const last = view.getByRole('list', { name: 'Expected errors' }).getByRole('listitem').nth(4);
  await expect(last).toBeVisible();
  const box = await last.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);

  await expect(view.getByRole('button', { name: 'Show JSON' })).toHaveCount(0);
  await expect(view.getByRole('button', { name: 'Copy JSON' })).toHaveCount(0);
  await view.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'From JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(five.replace('Five errors', 'Five errors pasted'));
  await expect(win(page).getByRole('list', { name: 'Expected errors' }).getByRole('listitem')).toHaveCount(5);
  await win(page).getByRole('button', { name: 'Save case' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Five errors pasted' })).toBeVisible();

  // Next case moves through the cases
  await page.getByRole('row').filter({ hasText: 'Five errors pasted' }).getByRole('button', { name: 'Open' }).click();
  const position = page.locator('.case-window-position');
  await expect(position).toHaveText(/5 of 5/);
  await page.getByRole('button', { name: 'Previous case' }).click();
  await expect(position).toHaveText(/4 of 5/);
});

test('Edit expected errors is on every case: a case without a reply saves at once, a case with a reply asks first (T254)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit expected errors' });

  // a case added after the first reply has no reply: it saves at once
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'From JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(JSON.stringify({ name: 'Late case', fields: { source_text: 'A keeper lights the lamp every evening.', summary: 'A keeper lights the lamp each morning.' }, expected_errors: [{ category: 'factual-error', fragment: 'each morning', description: 'The lamp is lit in the evening.', difficulty: 'obvious' }] }));
  await win(page).getByRole('button', { name: 'Save case' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Late case' });
  await row.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Edit expected errors' }).click();
  await expect(dialog).toBeVisible();
  const box = dialog.getByLabel('Expected errors');
  const items = JSON.parse(await box.inputValue());
  expect(items).toHaveLength(1);
  items[0].difficulty = 'subtle';
  items[0].source_fragment = 'every evening';
  await box.fill(JSON.stringify(items));
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Save the expected errors?' })).toHaveCount(0);
  await expect(page.getByRole('listitem').filter({ hasText: 'E1' }).locator('.error-side').first()).toContainText('every evening');

  // the JSON of the list has no place for the fields: a broken list is refused with its place, and Save stays off
  await page.getByRole('button', { name: 'Edit expected errors' }).click();
  await box.fill('[ { "description": ');
  await expect(dialog.getByText(/Line 1, column/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  // a case with a reply: Edit expected errors is there, and Save asks first
  await page.getByRole('row').nth(1).getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Edit expected errors' }).click();
  const withReply = JSON.parse(await box.inputValue());
  withReply.push({ category: 'omission', description: 'a new one' });
  await box.fill(JSON.stringify(withReply));
  await dialog.getByRole('button', { name: 'Save' }).click();
  const ask = page.getByRole('dialog', { name: 'Save the expected errors?' });
  await expect(ask).toContainText('This case has a reply.');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('dialog', { name: 'Save the expected errors?' }).getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();
});

test('the window is one page: the error row is on one line, nothing scrolls sideways, Save case is in the header, the parts are in frames (T229, T233)', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'Case with errors' }).click();
  const row = win(page).getByRole('row', { name: 'Error 1' });
  // Category, Difficulty, Description and Remove sit side by side, in one table row (T249): their boxes overlap vertically
  const boxes = await row.locator('select, input, button').evaluateAll((items) => items.map((i) => ({ top: i.getBoundingClientRect().top, bottom: i.getBoundingClientRect().bottom })));
  expect(boxes).toHaveLength(4);
  const line = { top: Math.max(...boxes.map((b) => b.top)), bottom: Math.min(...boxes.map((b) => b.bottom)) };
  expect(line.top, 'the controls of the row are on more than one line').toBeLessThan(line.bottom);
  const save = win(page).getByRole('button', { name: 'Save case' });
  const body = win(page).locator('.case-window-body');
  // T233: Save case is in the header, beside Close without saving, and stays there while the page scrolls
  const header = await win(page).locator('.case-window-header').boundingBox();
  const saveBox = (await save.boundingBox())!;
  expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
  await expect(win(page).locator('.case-window-footer')).toHaveCount(0);
  // the category description stands under the category of its row, not between the controls (T249)
  const rowBox = (await row.boundingBox())!;
  const select = (await row.getByLabel('Category').boundingBox())!;
  const hint = row.locator('.category-hint').first();
  if (await hint.count()) expect((await hint.boundingBox())!.y).toBeGreaterThanOrEqual(select.y + select.height - 1);
  expect(rowBox.height).toBeGreaterThan(0);
  // every part has a frame
  const frames = await win(page).locator('.case-part').evaluateAll((items) => items.map((i) => getComputedStyle(i).borderTopWidth));
  expect(frames.length).toBe(5);
  for (const width of frames) expect(width).not.toBe('0px');
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await win(page).evaluate((element) => element.scrollWidth <= element.clientWidth), `the window scrolls sideways at ${width} px`).toBe(true);
    expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth), `the page of the window scrolls sideways at ${width} px`).toBe(true);
  }
  await expect(save).toBeInViewport();
});
