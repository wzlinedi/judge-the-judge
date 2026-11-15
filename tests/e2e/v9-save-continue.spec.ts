// quickstart.md V9, steps 1, 4 and 6: saving, continuing and the warning (User Story 6), with the in-memory save file.
// One file, one Save test project, and the question that a load with a test run asks (T289; FR-020, FR-051, FR-076).
// Steps 2, 3, 5 and 7 belong to User Stories 9, 12 and 4 and are checked by their own specs.
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadQuestion, loadTestProject, saveButton, TEST_RUN_STEP } from '../helpers/test-run-flow';

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const item = (page: Page, kind: 'expected' | 'additional', id: string) => page.locator(`[data-${kind}="${id}"]`);

async function loadDemo(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
}

/** Case 3 awaits verification in the demo: marking its extra finding a false positive is a change to save. */
async function decideCase3(page: Page) {
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case 3 / })).toBeVisible();
  await item(page, 'additional', 'claims[]#2').getByRole('button', { name: 'False positive' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
}

test('Save test project asks for a file once, overwrites it later, and loading it with the test run resumes where the work stopped', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('run-1.json');
  await page.goto('/');
  await loadDemo(page);

  await decideCase3(page);
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await saveButton(page).click();
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();
  expect(memory.asked()).toBe(1);

  // more work, second save: the same file, no picker
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case 10 / })).toBeVisible(); // its reply cannot be read
  await page.getByRole('button', { name: 'No more findings' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await saveButton(page).click();
  expect(memory.asked()).toBe(1);
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();

  // save as: asks, to a second file
  memory.chooseSaveName('run-2.json');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Save test project as…' }).click();
  await expect(page.getByText('All changes saved (run-2.json)')).toBeVisible();
  expect(memory.asked()).toBe(2);
  expect([...memory.files.keys()].sort()).toEqual(['run-1.json', 'run-2.json']);

  // reload and load the first file
  await page.reload();
  await expect(page.getByText('Nothing to save yet')).toBeVisible();
  await loadTestProject(page, memory, 'run-1.json', 'with');
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();
  await expect(next(page)).toContainText('of 20 cases decided');
  await next(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case \d+ / })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // saving goes to the loaded file: no picker (the in-memory file needs no permission)
  const before = memory.asked();
  await saveButton(page).click();
  await expect(page.getByText('All changes saved (run-1.json)')).toBeVisible();
  expect(memory.asked()).toBe(before);
});

test('when the file can no longer be written the work stays and the next save asks for a file', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('gone.json');
  await page.goto('/');
  await loadDemo(page);
  await decideCase3(page);
  await saveButton(page).click();
  await expect(page.getByText('All changes saved (gone.json)')).toBeVisible();

  await next(page).getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'No more findings' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  memory.failWrites(true);
  await saveButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: 'can no longer be written' })).toBeVisible();
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  memory.failWrites(false);
  memory.chooseSaveName('new-place.json');
  const asked = memory.asked();
  await saveButton(page).click();
  await expect(page.getByText('All changes saved (new-place.json)')).toBeVisible();
  expect(memory.asked()).toBe(asked + 1);
});

test('"Save test project first" saves the one file, test run included, before Load demo…', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('run.json');
  await page.goto('/');
  await loadDemo(page);
  await decideCase3(page);
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  const warning = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(warning.getByRole('button')).toHaveText(['Cancel', 'Discard', 'Save test project first']);
  await warning.getByRole('button', { name: 'Save test project first' }).click();
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step');
  const saved = JSON.parse(memory.files.get('run.json')!);
  expect(Object.keys(saved.test_run.replies)).toHaveLength(20);
  expect(saved.test_run.decisions['3']).toBeDefined();
  expect(saved.format).toBe('judge-the-judge-test-project');
});

test('the load question: Cancel changes nothing, and a file without a test run loads at once', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('books.json');
  await page.goto('/');
  await loadDemo(page);
  await saveButton(page).click();
  await expect(page.getByText('All changes saved (books.json)')).toBeVisible();

  await loadTestProject(page, memory, 'books.json');
  const question = loadQuestion(page);
  await expect(question.getByRole('button')).toHaveText(['Cancel', 'Load the test project only', 'Load with the test run']);
  await question.getByRole('button', { name: 'Cancel' }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step'); // nothing changed
  await expect(page.getByText('All changes saved (books.json)')).toBeVisible();

  // a file with no test run asks nothing
  const project = JSON.parse(memory.files.get('books.json')!);
  delete project.test_run;
  memory.files.set('cases-only.json', JSON.stringify(project));
  await loadTestProject(page, memory, 'cases-only.json');
  await expect(question).toHaveCount(0);
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step');
});

test('"Load the test project only" drops the test run, forgets the file, and the first save asks for a new file and never overwrites the loaded one (quickstart V5 steps 3 and 4)', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('books.json');
  await page.goto('/');
  await loadDemo(page);
  await saveButton(page).click();
  await expect(page.getByRole('banner').locator('.file-name').filter({ hasText: 'books.json' })).toBeVisible();
  const first = memory.files.get('books.json')!;

  await page.reload();
  await loadTestProject(page, memory, 'books.json', 'only');
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step'); // the test run has not started
  await expect(next(page).getByRole('button', { name: 'Start test run' })).toBeVisible();
  await expect(page.getByRole('banner').locator('.file-name').filter({ hasText: 'no file yet' })).toBeVisible();

  memory.chooseSaveName('books-2.json');
  const asked = memory.asked();
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('books-2.json')).toBe(true);
  expect(memory.asked()).toBe(asked + 1);
  expect(JSON.parse(memory.files.get('books-2.json')!)).not.toHaveProperty('test_run');
  expect(memory.files.get('books.json')).toBe(first); // the loaded test run is never overwritten
});

test('V9 step 7: in the test case window "Close without saving" asks first, and no file save is reachable while the window is open (T310)', async ({ page }) => {
  await installMemoryFiles(page);
  await page.goto('/');
  await loadDemo(page);
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  const rows = page.getByRole('row');
  const before = await rows.count();

  await page.getByRole('button', { name: 'Add test case…' }).click();
  const win = page.getByRole('dialog', { name: 'Test case' });
  await win.getByRole('button', { name: 'Case with errors' }).click();
  await win.getByLabel('Case JSON').fill(JSON.stringify({ name: 'Pasted and not saved', fields: {}, expected_errors: [] }));

  // the header still shows Save test project, but the open window blocks it
  await expect(saveButton(page).click({ trial: true, timeout: 1500 })).rejects.toThrow();
  await expect(win.getByRole('button', { name: /Save test project|Save test project as/ })).toHaveCount(0);

  await win.getByRole('button', { name: 'Close without saving' }).click();
  const ask = page.getByRole('dialog', { name: 'Close without saving?' });
  await ask.getByRole('button', { name: 'Keep editing' }).click();
  await expect(win).toBeVisible();
  await win.getByRole('button', { name: 'Close without saving' }).click();
  await page.getByRole('dialog', { name: 'Close without saving?' }).getByRole('button', { name: 'Close without saving' }).click();
  await expect(win).toHaveCount(0);
  await expect(rows).toHaveCount(before);
  await expect(page.getByText('Pasted and not saved')).toHaveCount(0);
});
