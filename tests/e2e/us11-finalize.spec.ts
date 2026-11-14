// User Story 11: mix hand-made and loaded cases, then finalize (FR-004, FR-052, FR-053; quickstart V5 step 5).
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles, type MemoryFiles } from '../helpers/memory-files';
import { startFromAccuracy } from '../helpers/start-project';

const accuracy = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8'));
const base = accuracy.judge_set.clean_base_cases[0] as { name: string; fields: { source_text: string; summary: string } };
const demo = JSON.parse(readFileSync('examples/demo/evaluation.json', 'utf8')) as { dataset: { cases: Array<{ id: string }> }; replies: Record<string, { reply: string }> };
const testProject = readFileSync('examples/demo/test-project.json', 'utf8');

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const card = (page: Page) => page.getByRole('region', { name: 'Test project' });
const win = (page: Page) => page.getByRole('dialog', { name: 'Test case' });
const summary = (page: Page) => page.getByRole('dialog', { name: 'Finalize the test cases?' });
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
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Import test cases…' }).click();
  const importWindow = page.getByRole('dialog', { name: 'Import test cases…' });
  await importWindow.getByRole('button', { name: 'Choose file…' }).click();
  await importWindow.getByRole('button', { name: 'Import test cases…' }).click();
}
async function openDemoRun(page: Page) {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', testProject);
  memory.chooseOpenName('books.json');
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load test project…' }).click();
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  return memory;
}

test('cases from a file and cases made by hand join one test project; the summary comes first, and finalizing fixes the prompt but leaves Add test case', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.files.set('ten.csv', ['name,field:source_text,field:summary', ...Array.from({ length: 10 }, (_, i) => `Imported ${i + 1},Source text ${i + 1},Summary text ${i + 1}`)].join('\n'));
  await start(page, memory);
  await expect(card(page)).toContainText('3 test cases');

  await importRows(page, memory, 'ten.csv');
  await pasteCase(page, json({ name: 'By hand, clean', fields: { ...base.fields, summary: `${base.fields.summary} (reworded)` } }));
  const words = Array.from(new Set(base.fields.summary.split(' '))).filter((w) => w.length > 3).slice(0, 2);
  await pasteCase(page, json({ name: 'By hand, two errors', fields: { ...base.fields, source_text: `${base.fields.source_text} (changed)` }, expected_errors: words.map((w, i) => ({ category: 'factual-error', fragment: w, description: `Change ${i + 1}`, difficulty: i === 0 ? 'subtle' : 'obvious' })) }));
  await expect(card(page)).toContainText('15 test cases: 1 with injected errors, 14 clean, 0 with a reply.');
  expect(await buttons(page)).toEqual(['Finalize test cases…']);

  // the summary first: counts, balance, test size and the warnings; Cancel changes nothing
  await next(page).getByRole('button', { name: 'Finalize test cases…' }).click();
  await expect(summary(page)).toContainText('15 test cases: 1 with injected errors, 14 clean.');
  await expect(summary(page).getByRole('group', { name: 'Test size' })).toContainText('Injected errors: 2 of 30 (28 missing)');
  await expect(summary(page).getByRole('list', { name: 'Warnings' })).toContainText('Inconclusive');
  await summary(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(summary(page)).toHaveCount(0);
  expect(await buttons(page)).toEqual(['Finalize test cases…']);

  // confirming fixes the test cases
  await next(page).getByRole('button', { name: 'Finalize test cases…' }).click();
  await summary(page).getByRole('button', { name: 'Finalize test cases…' }).click();
  await expect(summary(page)).toHaveCount(0);
  await expect(card(page)).toContainText('The test cases are finalized');
  expect(await buttons(page)).toEqual(['Continue', 'Reopen test cases']);

  // the prompt is fixed, and the way out is named
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt')).toHaveAttribute('readonly', '');
  await expect(page.getByText(/The prompt is fixed/)).toContainText('New evaluation');
  expect(await buttons(page)).toEqual(['Continue', 'Reopen test cases']);
  await expect(page.getByRole('button', { name: 'Add test case…' })).toHaveCount(0); // T228: on Judge there is no such button

  // a case can still be added, and it joins the same project
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await pasteCase(page, json({ name: 'After finalizing', fields: { ...base.fields, summary: `${base.fields.summary} (after)` } }));
  await expect(card(page)).toContainText('16 test cases');
  await expect(page.getByRole('row').filter({ hasText: 'After finalizing' })).toBeVisible();
  await expect(card(page)).toContainText('The test cases are finalized');
});

test('Reopen test cases stands in the "what next" line of Run and Add test case above its cases; Reopen test cases keeps the file and opens the prompt again; after the first reply it is gone', async ({ page }) => {
  const memory = await openDemoRun(page);
  expect(await buttons(page)).toEqual(['Continue', 'Reopen test cases']);
  await expect(page.getByRole('region', { name: 'Cases' }).getByRole('button', { name: 'Add test case…' })).toBeEnabled();

  await next(page).getByRole('button', { name: 'Reopen test cases' }).click();
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('open again');
  expect(await buttons(page)).toEqual(['Finalize test cases…']);
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt')).not.toHaveAttribute('readonly', '');

  // nothing is lost and the remembered file is kept: saving does not ask for a file again
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name: 'Save test project', exact: true }).click();
  expect(memory.asked()).toBe(0);
  expect(JSON.parse(memory.files.get('books.json')!).dataset.finalized).toBe(false);
  expect(JSON.parse(memory.files.get('books.json')!).dataset.cases).toHaveLength(demo.dataset.cases.length);

  // replies only after finalizing again
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await next(page).getByRole('button', { name: 'Finalize test cases…' }).click();
  await summary(page).getByRole('button', { name: 'Finalize test cases…' }).click();
  await page.getByRole('button', { name: /3\s*Run/ }).click();
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const caseWindow = page.getByRole('dialog', { name: /^Case \d+ / });
  const first = demo.dataset.cases[0]!.id;
  await page.evaluate((t) => navigator.clipboard.writeText(t), demo.replies[first]!.reply);
  await caseWindow.getByRole('button', { name: 'Paste reply' }).click();
  await expect(caseWindow.getByRole('textbox', { name: 'Judge reply' })).toHaveValue(demo.replies[first]!.reply);
  await caseWindow.getByRole('button', { name: 'Close' }).click();

  expect(await buttons(page)).not.toContain('Reopen test cases');
  expect(await buttons(page)).not.toContain('Add test case');
  await expect(page.getByRole('region', { name: 'Cases' }).getByRole('button', { name: 'Add test case…' })).toBeEnabled();
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

  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name: 'Save test project', exact: true }).click();
  await expect(page.getByText('All changes saved').first()).toBeVisible();
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => page.isClosed()).toBe(true);
  expect(types).toEqual(['beforeunload']);
});
