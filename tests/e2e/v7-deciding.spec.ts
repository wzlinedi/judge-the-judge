// quickstart.md V7: marking after each reply, with a second opinion (User Story 8). Uses the demo and its opinions.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, unknown>;
const opinionText = (id: string) => JSON.stringify(opinions[id]);

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });
const opinionWindow = (page: Page) => page.getByRole('dialog', { name: 'Second opinion' });
const item = (page: Page, kind: 'expected' | 'additional', id: string) => page.locator(`[data-${kind}="${id}"]`);
const opinionBox = (page: Page) => opinionWindow(page).getByRole('textbox', { name: 'Opinion of your LLM' });

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Demo/ }).click();
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
}

test('the Run step has no second-opinion card; a second opinion is previewed, applied, and its marks can be changed by hand', async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByRole('main')).not.toContainText('Second opinion');

  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await expect(win).toContainText('Case 3');
  await expect(win).toContainText('Awaiting verification');
  const finding = item(page, 'additional', 'claims[]#2');
  await expect(finding).toContainText('This finding matches no expected error');

  // the three buttons under the list are visible without opening anything
  for (const name of ['Add finding…', 'Second opinion…']) await expect(win.getByRole('button', { name })).toBeVisible();

  // 1. the window: prompt, box, preview; nothing changes before Apply opinion
  await win.getByRole('button', { name: 'Second opinion…' }).click();
  const dialog = opinionWindow(page);
  await expect(dialog).toContainText('The LLM checks 0 expected errors and 1 additional finding of this case.');
  await expect(dialog.getByRole('textbox', { name: 'Verification prompt' })).toHaveValue(/CASE "3"/);
  await dialog.getByRole('button', { name: 'Copy prompt' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('CASE "3"');
  await expect(dialog.getByRole('button', { name: 'Apply opinion' })).toBeDisabled();
  await opinionBox(page).fill(opinionText('3'));
  await expect(dialog.getByRole('list', { name: 'What will change' })).toContainText('A1 undecided → False positive');
  await expect(dialog.getByRole('list', { name: 'What will change' })).toContainText('The source says the prince speaks about the rose.');
  expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
  await expect(finding).toContainText('This finding matches no expected error'); // still undecided behind the dialog

  // 2. apply; the source says so; change the mark by hand; ignore it
  await dialog.getByRole('button', { name: 'Apply opinion' }).click();
  await expect(opinionWindow(page)).toHaveCount(0);
  await expect(finding).toContainText('LLM opinion, approved by the user');
  await expect(win).not.toContainText('Awaiting verification');
  await finding.getByRole('button', { name: 'Real error' }).click();
  await expect(finding).toContainText('Set by hand');
  await finding.getByRole('button', { name: 'Ignore' }).click();
  await expect(finding.getByRole('button', { name: 'Ignore' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/not saved/).first()).toBeVisible();
});

test('an opinion for another case, and one that answers nothing, cannot be applied; Cancel changes nothing', async ({ page }) => {
  await loadDemo(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await win.getByRole('button', { name: 'Second opinion…' }).click();
  const dialog = opinionWindow(page);

  await opinionBox(page).fill(opinionText('14'));
  await expect(dialog).toContainText('This opinion is for case 14, but this is case 3');
  await expect(dialog.getByRole('button', { name: 'Apply opinion' })).toBeDisabled();
  await expect(opinionBox(page)).toHaveValue(opinionText('14'));

  await opinionBox(page).fill(JSON.stringify({ opinion: { id: '3', expected: [], additional: [{ index: 1, reason: 'not sure' }] } }));
  await expect(dialog).toContainText('The opinion classifies none of the 1 items of this case. Nothing will change.');
  await expect(dialog.getByRole('button', { name: 'Apply opinion' })).toBeDisabled();

  await opinionBox(page).fill('{ "opinion": ');
  await expect(dialog).toContainText(/Line 1, column/);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(opinionWindow(page)).toHaveCount(0);
  await expect(item(page, 'additional', 'claims[]#2')).toContainText('This finding matches no expected error');
  await expect(win).toContainText('Awaiting verification');
});

test('only the cases awaiting verification; a reply that could not be read: Add finding, Remove, a new finding from an opinion, and it stays awaiting until approved', async ({ page }) => {
  await loadDemo(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);

  await win.getByLabel('Only cases awaiting verification').check();
  await expect(win).toContainText('1 of 5');
  await win.getByRole('button', { name: 'Next case' }).click();
  await expect(win).toContainText('Case 10');
  await expect(win).toContainText('The reply could not be read');
  await expect(win).toContainText('press No more findings');

  // Add finding with a category and a difficulty
  await win.getByRole('button', { name: 'Add finding…' }).click();
  const add = page.getByRole('dialog', { name: 'Add finding…' });
  await add.getByLabel('Text of the finding').fill('The summary says nothing about the book');
  await add.getByLabel('Category (optional)').fill('factual-error');
  await add.getByLabel('Difficulty (optional)').selectOption('subtle');
  await add.getByRole('button', { name: 'Add', exact: true }).click();
  const first = item(page, 'additional', 'added#1');
  await expect(first).toContainText('factual-error');
  await expect(first).toContainText('subtle');
  await first.getByRole('button', { name: 'False positive' }).click();
  await expect(first.getByRole('button', { name: 'False positive' })).toHaveAttribute('aria-pressed', 'true');

  // a second added finding is removed again; the one read from the reply has no Remove
  await win.getByRole('button', { name: 'Add finding…' }).click();
  await page.getByRole('dialog', { name: 'Add finding…' }).getByLabel('Text of the finding').fill('A wrong guess');
  await page.getByRole('dialog', { name: 'Add finding…' }).getByRole('button', { name: 'Add', exact: true }).click();
  await item(page, 'additional', 'added#2').getByRole('button', { name: 'Remove' }).click();
  await expect(item(page, 'additional', 'added#2')).toHaveCount(0);
  await expect(win).toContainText('Awaiting verification');

  // an opinion that adds a new finding with its category; applying it approves the case
  await win.getByRole('button', { name: 'Second opinion…' }).click();
  const dialog = opinionWindow(page);
  await opinionBox(page).fill(JSON.stringify({ opinion: { id: '10', expected: [], additional: [{ index: 1, real: true, reason: 'It is a real gap.' }], new: [{ text: 'The reply is not an analysis', real: true, reason: 'It has no claims.', category: 'omission', difficulty: 'obvious' }] } }));
  await expect(dialog.getByRole('list', { name: 'What will change' })).toContainText('+ new finding “The reply is not an analysis” → Real error');
  await expect(dialog.getByRole('list', { name: 'What will change' })).toContainText('A1 False positive → Real error (replaces a mark set by hand)');
  await dialog.getByRole('button', { name: 'Apply opinion' }).click();
  const added = item(page, 'additional', 'added#2');
  await expect(added).toContainText('The reply is not an analysis');
  await expect(added).toContainText('omission');
  await expect(added.getByRole('button', { name: 'Remove' })).toBeVisible();
  await expect(win).not.toContainText('Awaiting verification');
});
