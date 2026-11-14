// quickstart.md V12 step 4: a judge that gives one verdict for the whole text is evaluated per case (User Story 14, part 2).
// The finalized test project is written by the test, because "Finalize test cases" belongs to User Story 11.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { testCasesVersion } from '../../src/core/cases/version';
import { writeTestProject } from '../../src/core/io/test-project-file';
import type { TestCase } from '../../src/core/model';
import { installMemoryFiles } from '../helpers/memory-files';

const metricText = readFileSync('examples/metrics/bias-verdict-example.json', 'utf8');
const metric = JSON.parse(metricText);
const checksText = readFileSync('examples/metrics/checks-example.json', 'utf8');
const { clean_base_cases: _clean, ...judgeSet } = metric.judge_set;

const textCase = (id: string, name: string, errors: TestCase['expected_errors'] = []): TestCase => ({ id, name, fields: { text: `Text of case ${id}.` }, expected_errors: errors });
const cases = [
  textCase('1', 'Sexist advert', [
    { id: 'e1', description: 'Gender bias.', category: 'gender-bias', fragment: 'Text of case 1', difficulty: 'obvious' },
    { id: 'e2', description: 'A stereotype, with no fragment.', category: 'stereotype', difficulty: 'subtle' },
  ]),
  textCase('2', 'Age advert', [{ id: 'e1', description: 'Age bias.', category: 'age-bias', fragment: 'Text of case 2', difficulty: 'obvious' }]),
  textCase('3', 'Neutral notice'),
  textCase('4', 'Neutral notice that gets flagged'),
];

async function projectFile(): Promise<string> {
  return writeTestProject(
    { judge_set: judgeSet, dataset: { name: 'Bias texts', finalized: true, cases }, metric: { id: metric.id, parameters: {} }, checks: JSON.parse(readFileSync('src/core/metrics/builtin/checks.default.json', 'utf8')) },
    { toolVersion: 'test', testCasesVersion: await testCasesVersion(cases) },
  );
}

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });
const clip = (page: Page, text: string) => page.evaluate((t) => navigator.clipboard.writeText(t), text);
const item = (page: Page, kind: 'expected' | 'additional', id: string) => page.locator(`[data-${kind}="${id}"]`);

async function pasteReply(page: Page, reply: string) {
  await clip(page, reply);
  await caseWindow(page).getByRole('button', { name: 'Paste reply from clipboard' }).click();
  await expect(caseWindow(page).getByRole('textbox', { name: 'Judge reply' })).toHaveValue(reply);
}

test('a verdict judge: the Judge step says so, replies decide whole cases, the Summary counts cases, and a correction that switches the way is named', async ({ page }) => {
  const memory = await installMemoryFiles(page);
  memory.files.set('bias-verdict-example.json', metricText);
  memory.files.set('bias-texts.json', await projectFile());
  memory.files.set('checks-example.json', checksText);
  await page.goto('/');

  // the metric is loaded without any other change; its example starts a project, and the Judge step says how it is counted
  memory.chooseOpenName('bias-verdict-example.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load example…' }).click();
  const examples = page.getByRole('dialog', { name: 'Load example…' });
  await examples.getByRole('button', { name: 'Load metric definition…' }).click();
  await examples.getByRole('button', { name: /^Bias/ }).filter({ hasText: /verdict/i }).first().click();
  await expect(page.getByRole('status', { name: 'Way of counting' })).toContainText('evaluated per case');

  // the test project with its cases is loaded and opens on Run
  memory.chooseOpenName('bias-texts.json');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load test project' }).click();
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);

  // a flagged case with errors: every expected error found, also the one without a fragment
  await pasteReply(page, '{"biased": true}');
  await expect(win).toContainText('This judge is evaluated per case. The text was flagged.');
  for (const id of ['e1', 'e2']) {
    await expect(item(page, 'expected', id).getByRole('button', { name: 'Found' })).toHaveAttribute('aria-pressed', 'true');
    await expect(item(page, 'expected', id)).toContainText('Automatic');
  }
  await expect(win).toContainText('Pass');
  await win.getByRole('button', { name: 'Next test case' }).click();

  // an unflagged case with errors fails
  await pasteReply(page, '{"biased": false}');
  await expect(win).toContainText('The text was not flagged.');
  await expect(item(page, 'expected', 'e1').getByRole('button', { name: 'Issue: missed' })).toHaveAttribute('aria-pressed', 'true');
  await expect(win).toContainText('Fail');
  await win.getByRole('button', { name: 'Next test case' }).click();

  // a clean case that is not flagged passes; one that is flagged awaits the user's decision
  await pasteReply(page, '{"biased": false}');
  await expect(win).toContainText('Pass');
  await win.getByRole('button', { name: 'Next test case' }).click();
  await pasteReply(page, '{"biased": true}');
  await expect(win).toContainText('Awaiting verification');
  await item(page, 'additional', 'reply').getByRole('button', { name: 'Issue: false positive' }).click();
  await expect(win).toContainText('Fail');
  await win.getByRole('button', { name: 'Close' }).click();

  // Results: cases are counted, the two rates have their case-level names, Error analysis counts cases
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(page.getByText('so the tool counts cases, not errors')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Cases with expected errors' })).toContainText(/Flagged\s*1/);
  await expect(page.getByRole('group', { name: 'Clean cases' })).toContainText(/Flagged wrongly\s*1/);
  await expect(page.getByRole('group', { name: 'Expected errors', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Rates' })).toContainText('Case detection rate');
  await expect(page.getByRole('group', { name: 'Rates' })).toContainText('Clean-case false-positive rate');
  await expect(page.getByRole('region', { name: 'Overall result' })).toContainText('The judge was evaluated per case.');
  await page.locator('details.details-section').getByText('Details', { exact: true }).click();
  await expect(page.getByLabel('Case detection rate: at least (%)')).toHaveValue('80');
  memory.chooseOpenName('checks-example.json');
  await page.getByRole('button', { name: 'Load check settings' }).click();
  await expect(page.getByLabel('Case detection rate: at least (%)')).toHaveValue('70');
  await page.getByRole('tab', { name: 'Error analysis' }).click();
  await expect(page.getByRole('table', { name: 'By category' })).toContainText('gender-bias');
  await expect(page.getByText(/does not say which error it found/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // a rule that uses a list field switches the way of counting; the result says how it was counted before and after
  await page.getByRole('button', { name: /1\s*Judge/ }).click();
  await page.getByLabel('Sample reply', { exact: true }).fill('{"biased":true,"findings":[{"text":"x","bad":true}]}');
  await page.getByLabel('Field of condition 1 of rule 1').selectOption('findings[].bad');
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(page.getByRole('region', { name: 'Notices' })).toContainText('counted per case when the replies were received and is counted per expected error now');
  await expect(page.getByRole('group', { name: 'Expected errors', exact: true })).toBeVisible();
});
