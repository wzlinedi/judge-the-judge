// quickstart.md V12, steps 1 and 2: another metric and my own catalog (SC-005, User Story 14).
// Steps 3 and 4 belong to User Stories 9 and 14 (part 2).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const bias = readFileSync('examples/metrics/bias-example.json', 'utf8');
const testWindow = (page: Page) => page.getByRole('dialog', { name: 'Test case' });

test('a new metric is offered after loading its file, with no other change, and starts a project with one field', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.files.set('bias-example.json', bias);
  memory.chooseOpenName('bias-example.json');
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  const window = page.getByRole('dialog', { name: 'Load example…' });
  await expect(window.getByRole('button', { name: 'Bias' })).toHaveCount(0);
  await window.getByRole('button', { name: 'Load metric definition…' }).click();
  await window.getByRole('button', { name: 'Bias', exact: true }).click();

  await expect(page.getByLabel('Judge prompt', { exact: true })).toHaveValue(/\{\{text\}\}/);
  await expect(page.getByRole('list', { name: 'Variables' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await expect(page.getByRole('row')).toHaveCount(4);
  await page.getByRole('row').nth(1).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('dialog', { name: /Case 1/ }).getByRole('heading', { name: /^text/ })).toBeVisible();
});

test('an invalid metric file is explained and nothing changes', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.files.set('bad.json', '{ "format": "judge-the-judge-metric", "schema_version": 1, "id": "Bad Id" }');
  memory.chooseOpenName('bad.json');
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  const window = page.getByRole('dialog', { name: 'Load example…' });
  await window.getByRole('button', { name: 'Load metric definition…' }).click();
  await expect(window.getByRole('alert')).toContainText('Nothing has changed');
  await expect(window.getByRole('button', { name: 'Accuracy' })).toBeVisible();
});

test('the Error categories section: a new category from a case, rename, remove', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.files.set('bias-example.json', bias);
  memory.chooseOpenName('bias-example.json');
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  const window = page.getByRole('dialog', { name: 'Load example…' });
  await window.getByRole('button', { name: 'Load metric definition…' }).click();
  await window.getByRole('button', { name: 'Bias', exact: true }).click();
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();

  // starts collapsed, with the count
  const heading = page.getByRole('button', { name: /Error categories/ });
  await expect(heading).toHaveAttribute('aria-expanded', 'false');
  await expect(heading).toContainText('3 categories');

  // a case whose category is new
  await page.getByRole('button', { name: 'Add test case' }).click();
  await testWindow(page).getByRole('button', { name: 'Paste JSON' }).click();
  await testWindow(page).getByLabel('Case JSON').fill(JSON.stringify({
    name: 'Team update, one-sided',
    fields: { text: 'The team finished the report on time. Only the men on the team reviewed the numbers. The manager thanked everyone.' },
    expected_errors: [{ category: 'exclusion', fragment: 'Only the men on the team', description: 'Women are left out.', difficulty: 'obvious' }],
  }));
  await expect(testWindow(page).getByText(/"exclusion" is new/)).toBeVisible();
  await testWindow(page).getByRole('button', { name: 'Save case' }).click();
  await expect(heading).toContainText('4 categories');

  await heading.click();
  const category = (name: string) => page.getByRole('listitem', { name, exact: true });
  await expect(category('exclusion')).toContainText('Used by 1 test case');
  await expect(category('exclusion').getByRole('button', { name: 'Remove' })).toBeDisabled();
  await expect(category('exclusion')).toContainText('Remove that test case first, or rename the category.');

  // rename applies to the case
  await category('exclusion').getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('New name').fill('Left Out');
  await page.getByRole('dialog', { name: 'Rename category' }).getByRole('button', { name: 'Rename' }).click();
  await expect(category('left-out')).toContainText('Used by 1 test case');
  await expect(page.getByRole('row').filter({ hasText: 'Team update, one-sided' })).toContainText('left-out');

  // an unused one is removed at once
  await category('age-bias').getByRole('button', { name: 'Remove' }).click();
  await expect(category('age-bias')).toHaveCount(0);

  // typed categories
  await page.getByLabel('Categories to add').fill('Tone - the wrong tone\nstereotype');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(category('tone')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('Already in the catalog: stereotype');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
});
