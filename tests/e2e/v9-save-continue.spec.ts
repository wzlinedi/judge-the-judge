// quickstart.md V9, steps 1, 4 and 6: saving, continuing and the warning (User Story 6), with the in-memory save file.
// Steps 2, 3, 5 and 7 belong to User Stories 9, 12 and 4 and are checked by their own specs.
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const item = (page: Page, kind: 'expected' | 'additional', id: string) => page.locator(`[data-${kind}="${id}"]`);

async function loadDemo(page: Page) {
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Demo/ }).click();
}

/** Case 3 awaits verification in the demo: marking its extra finding a false positive is a change to save. */
async function decideCase3(page: Page) {
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case 3 / })).toBeVisible();
  await item(page, 'additional', 'claims[]#2').getByRole('button', { name: 'Issue: false positive' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
}

test('Save evaluation asks for a file once, overwrites it later, and Load evaluation resumes where the work stopped', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('run-1.json');
  await page.goto('/');
  await loadDemo(page);

  await decideCase3(page);
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();
  expect(memory.asked()).toBe(1);

  // more work, second save: the same file, no picker
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case 10 / })).toBeVisible(); // its reply cannot be read
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  expect(memory.asked()).toBe(1);
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();

  // save as: asks, to a second file
  memory.chooseSaveName('run-2.json');
  await page.getByRole('button', { name: 'Save evaluation as' }).click();
  await expect(page.getByText('All changes saved (run-2.json)')).toBeVisible();
  expect(memory.asked()).toBe(2);
  expect([...memory.files.keys()].sort()).toEqual(['run-1.json', 'run-2.json']);

  // reload and load the first file
  await page.reload();
  await expect(page.getByText('Nothing to save yet')).toBeVisible();
  memory.chooseOpenName('run-1.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load evaluation' }).click();
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();
  await expect(next(page)).toContainText('of 20 cases decided');
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case \d+ / })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // saving goes to the loaded file: no picker (the in-memory file needs no permission)
  const before = memory.asked();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();
  expect(memory.asked()).toBe(before);
});

test('when the file can no longer be written the work stays and the next save asks for a file', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('gone.json');
  await page.goto('/');
  await loadDemo(page);
  await decideCase3(page);
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect(page.getByText('All changes saved (gone.json)')).toBeVisible();

  await next(page).getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  memory.failWrites(true);
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'can no longer be written' })).toBeVisible();
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  memory.failWrites(false);
  memory.chooseSaveName('new-place.json');
  const asked = memory.asked();
  await page.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect(page.getByText('All changes saved (new-place.json)')).toBeVisible();
  expect(memory.asked()).toBe(asked + 1);
});

test('Save test project with replies keeps the indicator on, and "Save evaluation first" saves before Load example…', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('project.json');
  await page.goto('/');
  await loadDemo(page);
  await decideCase3(page);

  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Save test project', exact: true }).click();
  await expect(page.getByText(/Replies are kept only by "Save evaluation"/)).toBeVisible();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(page.getByText('Test project: project.json')).toBeVisible();
  expect(memory.files.get('project.json')).not.toContain('"replies"');

  memory.chooseSaveName('run.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  const warning = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(warning.getByRole('button')).toHaveText(['Cancel', 'Discard', 'Save evaluation first']);
  await warning.getByRole('button', { name: 'Save evaluation first' }).click();
  await expect(page.getByRole('dialog', { name: /Load example/ })).toBeVisible();
  expect(memory.files.get('run.json')).toContain('"replies"');
});

test('a saved test project loads back finalized on Run with no replies (quickstart V5 steps 3 and 4)', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('books.json');
  await page.goto('/');
  await loadDemo(page);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Save test project', exact: true }).click();
  await expect(page.getByText('Test project: books.json')).toBeVisible();

  await page.reload();
  memory.chooseOpenName('books.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load test project' }).click();
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  await expect(next(page)).toContainText('0 of 20 cases decided');
  await expect(page.getByText('Test project: books.json')).toBeVisible();
});
