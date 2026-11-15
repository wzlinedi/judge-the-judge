// User Story 11: mix hand-made and loaded cases, then start the test run (FR-004, FR-052, FR-053; quickstart V5 step 5).
// "Start test run" replaced "Finalize test cases" and there is no way back (T288).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles, type MemoryFiles } from '../helpers/memory-files';
import { startFromAccuracy } from '../helpers/start-project';
import { loadTestProject, saveButton, startDialog, TEST_RUN_STEP } from '../helpers/test-run-flow';

const accuracy = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8'));
const base = accuracy.judge_set.clean_base_cases[0] as { name: string; fields: { source_text: string; summary: string } };
const testProject = readFileSync('examples/demo/test-project.json', 'utf8');

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const card = (page: Page) => page.getByRole('region', { name: 'Test project' });
const win = (page: Page) => page.getByRole('dialog', { name: 'Test case' });
const summary = startDialog;
const json = (over: Record<string, unknown> = {}) => JSON.stringify({ name: 'A case', fields: base.fields, expected_errors: [], ...over });
const buttons = async (page: Page) => (await next(page).getByRole('button').allTextContents()).map((t) => t.trim());

async function start(page: Page, memory?: MemoryFiles) {
  await startFromAccuracy(page, memory);
}
async function pasteCase(page: Page, text: string) {
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await win(page).getByRole('button', { name: 'From JSON' }).click();
  await win(page).getByLabel('Case JSON').fill(text);
  await win(page).getByRole('button', { name: 'Save case' }).click();
}
async function importRows(page: Page, memory: Awaited<ReturnType<typeof installMemoryFiles>>, name: string) {
  memory.chooseOpenName(name);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import test cases…' }).click();
  const importWindow = page.getByRole('dialog', { name: 'Import test cases…' });
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await importWindow.getByRole('button', { name: 'Import test cases…' }).click();
}
async function openDemoRun(page: Page) {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', testProject);
  await page.goto('/');
  await loadTestProject(page, memory, 'books.json', 'with');
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step');
  return memory;
}

test('cases from a file and cases made by hand join one test project; the summary comes first, and the start fixes the prompt but leaves Add test case', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.files.set('ten.csv', ['name,field:source_text,field:summary', ...Array.from({ length: 10 }, (_, i) => `Imported ${i + 1},Source text ${i + 1},Summary text ${i + 1}`)].join('\n'));
  await start(page, memory);
  await expect(card(page)).toContainText('3 test cases');

  await importRows(page, memory, 'ten.csv');
  await pasteCase(page, json({ name: 'By hand, clean', fields: { ...base.fields, summary: `${base.fields.summary} (reworded)` } }));
  const words = Array.from(new Set(base.fields.summary.split(' '))).filter((w) => w.length > 3).slice(0, 2);
  await pasteCase(page, json({ name: 'By hand, two errors', fields: { ...base.fields, source_text: `${base.fields.source_text} (changed)` }, expected_errors: words.map((w, i) => ({ category: 'factual-error', fragment: w, description: `Change ${i + 1}`, difficulty: i === 0 ? 'subtle' : 'obvious' })) }));
  await expect(card(page)).toContainText('15 test cases: 1 with injected errors, 14 clean, 0 with a reply.');
  expect(await buttons(page)).toEqual(['Start test run']);

  // the summary first: counts, balance, test size and the warnings; it says what is then fixed; Cancel changes nothing
  await next(page).getByRole('button', { name: 'Start test run' }).click();
  await expect(summary(page)).toContainText('15 test cases: 1 with injected errors, 14 clean.');
  await expect(summary(page).getByRole('group', { name: 'Test size' })).toContainText('Injected errors: 2 of 30 (28 missing)');
  await expect(summary(page).getByRole('list', { name: 'Warnings' })).toContainText('Inconclusive');
  await expect(summary(page)).toContainText('judge prompt');
  await expect(summary(page)).toContainText('no way back');
  await summary(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(summary(page)).toHaveCount(0);
  expect(await buttons(page)).toEqual(['Start test run']);

  // confirming starts it: nothing to reopen, and the prompt is fixed
  await next(page).getByRole('button', { name: 'Start test run' }).click();
  await summary(page).getByRole('button', { name: 'Start test run' }).click();
  await expect(summary(page)).toHaveCount(0);
  await expect(card(page)).toContainText('The test run has started');
  expect(await buttons(page)).toEqual(['Continue']);

  // the prompt is fixed, and the way out is named
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt')).toHaveAttribute('readonly', '');
  await expect(page.getByText(/The test run has started, so the prompt is fixed\./)).toContainText('Load the test project only');
  await expect(page.getByRole('button', { name: 'Load test project…' })).toBeVisible();
  expect(await buttons(page)).toEqual(['Continue']);
  await expect(page.getByRole('button', { name: 'Add test case…' })).toHaveCount(0); // T228: on Judge there is no such button

  // a case can still be added, and it joins the same project
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await pasteCase(page, json({ name: 'After the start', fields: { ...base.fields, summary: `${base.fields.summary} (after)` } }));
  await expect(card(page)).toContainText('16 test cases');
  await expect(page.getByRole('row').filter({ hasText: 'After the start' })).toBeVisible();
  await expect(card(page)).toContainText('The test run has started');
});

test('"Start test run" is at the top of Test cases, disabled with no cases; before it the Test run step shows its actions disabled with the reason', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  const startButton = next(page).getByRole('button', { name: 'Start test run' });
  await expect(startButton).toBeDisabled();
  await expect(next(page)).toContainText('Add test case');

  const memory = await installMemoryFiles(page);
  await startFromAccuracy(page, memory);
  await expect(next(page).getByRole('button', { name: 'Start test run' })).toBeEnabled();
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step');
  const reasons = page.getByText('Start the test run first');
  expect(await reasons.count()).toBeGreaterThanOrEqual(3); // beside Add test case, Model details and the Open buttons
  await expect(page.getByRole('button', { name: 'Add test case…' })).toBeDisabled();
  await expect(page.getByLabel('Model details')).toBeDisabled();
  for (const open of await page.getByRole('button', { name: 'Open' }).all()) await expect(open).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Notices' })).toHaveCount(0);
});

test('a test run that has started has no way back: no Reopen test cases, Add test case stays, and the prompt lock names Load test project…', async ({ page }) => {
  await openDemoRun(page);
  expect(await buttons(page)).toEqual(['Continue']);
  await expect(page.getByRole('button', { name: /Reopen test cases/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Cases' }).getByRole('button', { name: 'Add test case…' })).toBeEnabled();

  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await expect(next(page).getByRole('button', { name: 'Start test run' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit test cases' })).toHaveCount(0);

  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt')).toHaveAttribute('readonly', '');
  // the sample reply, the finding text and the rules stay editable
  await expect(page.getByRole('button', { name: 'Add rule' })).toBeEnabled();
});

test('leaving the page with unsaved cases warns; after saving the test project it does not (FR-004)', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await start(page, memory);
  await pasteCase(page, json({ name: 'Unsaved case', fields: { ...base.fields, summary: `${base.fields.summary} (unsaved)` } }));
  await expect(page.getByText('Unsaved changes').first()).toBeVisible();

  const types: string[] = [];
  page.on('dialog', (dialog) => {
    types.push(dialog.type());
    void dialog.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => types).toEqual(['beforeunload']);
  expect(page.isClosed()).toBe(false);

  await saveButton(page).click();
  await expect(page.getByText('All changes saved').first()).toBeVisible();
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => page.isClosed()).toBe(true);
  expect(types).toEqual(['beforeunload']);
});
