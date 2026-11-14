// quickstart.md V2: a judge from scratch (SC-011 to SC-014, SC-037, SC-038, User Story 2).
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installMemoryFiles } from '../helpers/memory-files';

const SAMPLE = JSON.stringify({ verdicts: [{ text: 'The hero is a doctor', verdict: 'bad', score: 2 }, { text: 'The hero is a baker', verdict: 'good', score: 9 }] }, null, 2);

async function buildJudge(page: Page) {
  await page.goto('/');
  await page.getByLabel('Judge prompt', { exact: true }).fill('Question: {{prompt_input}}\nAnswer: {{prompt_output}}\nContext: {{context}}');
  const variables = page.getByRole('list', { name: 'Variables' });
  await expect(variables.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: /context/ })).toBeChecked();
  await page.getByRole('radio', { name: /prompt_output/ }).check();

  // a broken sample keeps its text and says where the problem is; fixing it needs no button
  const sample = page.getByLabel('Sample reply', { exact: true });
  await sample.fill('{\n  "verdicts": [\n');
  await expect(page.getByText(/Line \d+, column \d+/)).toBeVisible();
  await expect(sample).toHaveValue('{\n  "verdicts": [\n');
  await sample.fill('Here is my reply:\n```json\n' + SAMPLE + '\n```');
  await expect(page.getByText(/Line \d+, column \d+/)).toHaveCount(0);
  const fields = page.getByRole('table', { name: 'Fields of the sample reply' });
  await expect(fields).toContainText('verdicts[].verdict');
  await expect(fields).toContainText('bad, good');

  // two rules: "any of" with two conditions, then "all of"
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByLabel('Name of rule 1').fill('Bad verdict');
  await page.getByLabel('Field of condition 1 of rule 1').selectOption('verdicts[].verdict');
  await page.getByLabel('Value of condition 1 of rule 1').fill('bad');
  await page.getByRole('button', { name: 'Add condition' }).click();
  await page.getByLabel('Field of condition 2 of rule 1').selectOption('verdicts[].score');
  await page.getByLabel('Comparison of condition 2 of rule 1').selectOption('less_than');
  await page.getByLabel('Value of condition 2 of rule 1').fill('4');
  await page.getByLabel('Conditions of rule 1').selectOption('any');
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByLabel('Name of rule 2').fill('Low and bad');
  await page.getByLabel('Field of condition 1 of rule 2').selectOption('verdicts[].verdict');
  await page.getByLabel('Value of condition 1 of rule 2').fill('bad');
  await page.getByLabel('Conditions of rule 2').selectOption('all');
}

test('the Judge step builds a judge from scratch, shows the preview, and survives save and load', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.chooseSaveName('judge.json');
  await buildJudge(page);

  // only the buttons of FR-088 (plus the Explain controls)
  const names = await page.getByRole('main').getByRole('button').allTextContents();
  for (const name of names.map((n) => n.trim())) expect(['Add rule', 'Add condition', 'Remove', 'Explain', 'Next: Test cases']).toContain(name);

  const preview = page.getByRole('table', { name: 'Preview of the findings' });
  await expect(preview.getByRole('row').nth(1)).toContainText('The hero is a doctor');
  await expect(preview.getByRole('row').nth(1)).toContainText('Finding');
  await expect(preview.getByRole('row').nth(1)).toContainText('Bad verdict');
  await expect(preview.getByRole('row').nth(2)).toContainText('No finding');

  const version = await page.getByText(/^Judge version: /).textContent();
  expect(version).toMatch(/Judge version: [0-9a-f]{12}/);

  // a new sample without the field used by a rule: the rule is marked broken
  await page.getByLabel('Sample reply', { exact: true }).fill(JSON.stringify({ other: [{ label: 'x' }] }));
  await expect(page.getByText(/Broken rule/).first()).toBeVisible();
  await expect(page.getByRole('status', { name: 'Readability' })).toContainText('broken');
  await page.getByLabel('Sample reply', { exact: true }).fill(SAMPLE);
  await expect(page.getByText(/Broken rule/)).toHaveCount(0);

  // save the test project, reload, load it
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('button', { name: 'Save test project', exact: true }).click();
  await expect(page.getByRole('banner').locator('.file-name').filter({ hasText: 'judge.json' })).toBeVisible();
  await page.reload();
  memory.chooseOpenName('judge.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load test project…' }).click();
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await expect(page.getByLabel('Judge prompt', { exact: true })).toHaveValue('Question: {{prompt_input}}\nAnswer: {{prompt_output}}\nContext: {{context}}');
  await expect(page.getByRole('radio', { name: /prompt_output/ })).toBeChecked();
  await expect(page.getByLabel('Name of rule 2')).toHaveValue('Low and bad');
  await expect(page.getByLabel('Conditions of rule 1')).toHaveValue('any');
  await expect(page.getByText(/^Judge version: /)).toHaveText(version as string);
});

test('Load demo… loads the demo with no window and opens the Judge step with its judge filled in (T243)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByLabel('Judge prompt', { exact: true })).toHaveValue(/\{\{source_text\}\}/);
  await expect(page.getByLabel('Name of rule 1')).not.toHaveValue('');
  await expect(page.getByRole('status', { name: 'Readability' })).toHaveCount(0);
});

test('the Judge step has no accessibility violations', async ({ page }) => {
  await buildJudge(page);
  const run = await new AxeBuilder({ page }).analyze();
  expect(run.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});
