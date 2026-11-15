// quickstart.md V5: import and export test cases (SC-015 to SC-020, User Story 5). Step 5 belongs to User Stories 9 and 11.
// The one test project file, its test run and the load question (T289): FR-020, FR-052, FR-053, FR-076.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installMemoryFiles, type MemoryFiles } from '../helpers/memory-files';
import { startFromAccuracy } from '../helpers/start-project';
import { loadTestProject, saveButton, startTestRun, TEST_RUN_STEP } from '../helpers/test-run-flow';

const importWindow = (page: Page) => page.getByRole('dialog', { name: 'Import test cases…' });
const rows = (page: Page) => page.getByRole('row');
const menu = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
};
const startAccuracy = (page: Page, memory: MemoryFiles) => startFromAccuracy(page, memory);
const csv = (lines: string[]) => `name,field:source_text,field:summary\n${lines.join('\n')}\n`;

test('the example file, a CSV with an invalid row and Polish characters, and a JSON file with a new category and a used identifier', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await startAccuracy(page, memory);

  await menu(page, 'Import test cases…');
  expect(await new AxeBuilder({ page }).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  const [download] = await Promise.all([page.waitForEvent('download'), importWindow(page).getByRole('button', { name: 'Download example file' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const example = await (await import('node:fs/promises')).readFile((await download.path()) as string, 'utf8');
  expect(example).toContain('name,field:source_text,field:summary');

  memory.files.set('cases.csv', csv(['"Zażółć gęślą","Źródło, z ""cudzysłowem""","Krótko"', 'Pusty,,', 'Dora,"Dwa\nwiersze","Jaźń"']));
  memory.chooseOpenName('cases.csv');
  await importWindow(page).getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow(page).getByText('2 test cases can be imported.')).toBeVisible();
  await expect(importWindow(page).getByRole('list', { name: 'Invalid rows' })).toContainText('Row 3');
  expect(await new AxeBuilder({ page }).analyze().then((r) => r.violations.map((v) => v.id))).toEqual([]);
  await importWindow(page).getByRole('button', { name: 'Import test cases…' }).click();
  await expect(rows(page)).toHaveCount(6); // header and 3 + 2 cases
  await expect(page.getByText('Zażółć gęślą')).toBeVisible();

  const json = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [{ id: '1', name: 'From JSON', fields: { source_text: 'Source', summary: 'Tone words here' }, expected_errors: [{ description: 'Tone', category: 'tone-shift', fragment: 'Tone words' }] }] };
  memory.files.set('cases.json', JSON.stringify(json));
  memory.chooseOpenName('cases.json');
  await menu(page, 'Import test cases…');
  await importWindow(page).getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow(page)).toContainText('tone-shift');
  await expect(importWindow(page)).toContainText('1 identifier was already used and got a new one');
  await importWindow(page).getByRole('button', { name: 'Import test cases…' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'From JSON' })).toContainText('Injected errors');
  await expect(page.getByRole('button', { name: /Error categories.*6/ })).toBeVisible();
});

test('Export test cases, a new test project, Import test cases; and the test project reloads identical', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await startAccuracy(page, memory);

  memory.chooseSaveName('exported.json');
  await menu(page, 'Export test cases…');
  await expect(page.getByText(/Exported 3 test cases/)).toBeVisible();
  await expect.poll(() => memory.files.has('exported.json')).toBe(true);
  const exported = JSON.parse(memory.files.get('exported.json') ?? '{}');
  expect(exported.format).toBe('judge-the-judge-test-cases');
  expect(exported.cases).toHaveLength(3);
  expect(exported).not.toHaveProperty('finalized');

  await menu(page, 'New test project');
  // nothing is unsaved after loading an example and exporting, so there is no question to answer
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  memory.chooseOpenName('exported.json');
  await menu(page, 'Import test cases…');
  await importWindow(page).getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow(page)).toContainText('3 test cases can be imported.');
  await importWindow(page).getByRole('button', { name: 'Import test cases…' }).click();
  await expect(rows(page)).toHaveCount(4);

  memory.chooseSaveName('again.json');
  await menu(page, 'Export test cases…');
  await expect.poll(() => memory.files.has('again.json')).toBe(true); // the write is asynchronous
  expect(JSON.parse(memory.files.get('again.json') ?? '{}').cases).toEqual(exported.cases);

  // Save test project, reload, Load test project
  memory.chooseSaveName('project.json');
  await saveButton(page).click();
  await expect.poll(() => memory.files.has('project.json')).toBe(true);
  expect(JSON.parse(memory.files.get('project.json')!)).not.toHaveProperty('test_run'); // not started: no test run section
  await page.reload();
  await loadTestProject(page, memory, 'project.json'); // no test run in the file, so no question
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByRole('dialog', { name: 'Load test project' })).toHaveCount(0);

  // a new test project has no judge prompt, and the test run cannot start without one
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await page.getByLabel('Judge prompt').fill('Find the errors in {{answer}} using {{source_text}}.');
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  // "Start test run": the one file now holds an empty test run, and loading it asks the question
  await startTestRun(page);
  await saveButton(page).click(); // the remembered file is overwritten, with no picker
  await expect.poll(() => JSON.parse(memory.files.get('project.json') ?? '{}').test_run !== undefined).toBe(true);
  expect(JSON.parse(memory.files.get('project.json')!).test_run).toMatchObject({ replies: {}, decisions: {}, results: {} });
  expect(memory.asked()).toBe(3); // exported.json, again.json and project.json asked once each; this save did not ask again
  await page.reload();
  await loadTestProject(page, memory, 'project.json', 'with');
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('button', { name: /Reopen test cases/ })).toHaveCount(0);
});

test('one more case after the first reply starts as Not run, and 100 cases are summarized within 5 seconds', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  await page.goto('/');
  await menu(page, 'Load demo…');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: /3\s*Test run/ }).click();
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  const before = await rows(page).count();

  memory.files.set('one.csv', csv(['Late,"A text","A summary"']));
  memory.chooseOpenName('one.csv');
  await menu(page, 'Import test cases…');
  await importWindow(page).getByRole('button', { name: 'Choose file…' }).click();
  await importWindow(page).getByRole('button', { name: 'Import test cases…' }).click();
  await expect(rows(page)).toHaveCount(before + 1);
  await expect(page.getByRole('row').filter({ hasText: 'Late' })).toContainText('added after first reply');
  await page.getByRole('button', { name: /3\s*Test run/ }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Late' })).toContainText('Not run');
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();

  const hundred = csv(Array.from({ length: 100 }, (_, i) => `Case ${i + 1},"Source text number ${i + 1}, with a comma","Summary ${i + 1}"`));
  memory.files.set('hundred.csv', hundred);
  memory.chooseOpenName('hundred.csv');
  await menu(page, 'Import test cases…');
  const started = Date.now();
  await importWindow(page).getByRole('button', { name: 'Choose file…' }).click();
  await expect(importWindow(page).getByText('100 test cases can be imported.')).toBeVisible({ timeout: 5000 });
  expect(Date.now() - started).toBeLessThan(5000);
});
