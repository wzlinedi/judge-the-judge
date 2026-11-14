// quickstart.md V3: clean cases and the table (SC-021, SC-034, User Story 3). The CSV import belongs to User Story 5.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startFromAccuracy } from '../helpers/start-project';

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'Lighthouse keeper', fields: { source_text: 'A keeper lights the lamp every evening and writes in a log.', summary: 'The keeper lights the lamp each evening and keeps a log.' }, expected_errors: [], ...over });

async function start(page: Page) {
  await startFromAccuracy(page);
}
const testWindow = (page: Page) => page.getByRole('dialog', { name: 'Test case' });
const row = (page: Page, name: string) => page.getByRole('row').filter({ hasText: name });

test('a clean case is made from a prompt and an answer, and checked as it is pasted', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('row')).toHaveCount(4); // header and the three clean cases of the example
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await testWindow(page).getByRole('button', { name: 'Clean case' }).click();

  await testWindow(page).getByLabel('Name').fill('Keeper');
  await testWindow(page).getByLabel('Comment (optional)').fill('About a lighthouse');
  await testWindow(page).getByLabel('Like case (optional)').selectOption({ index: 1 });
  const prompt = testWindow(page).getByRole('textbox', { name: 'Prompt for your LLM' });
  await expect(prompt).toHaveValue(/About a lighthouse/);
  await expect(prompt).toHaveValue(/\{\{source_text\}\}/);
  await expect(prompt).toHaveValue(/factual-error/);
  await testWindow(page).getByRole('button', { name: 'Copy prompt' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('About a lighthouse');

  // an answer with expected errors points to From JSON; nothing can be approved
  const box = testWindow(page).getByLabel('Answer of your LLM');
  await box.fill(answer({ expected_errors: [{ description: 'x', fragment: 'lamp' }] }));
  await expect(testWindow(page).getByText(/Use "From JSON"/)).toBeVisible();
  await expect(testWindow(page).getByRole('button', { name: 'Save case' })).toBeDisabled();

  await box.fill('{ "name": ');
  await expect(testWindow(page).getByText(/Line 1, column \d+/)).toBeVisible();

  await box.fill(answer());
  await expect(testWindow(page).getByText('The keeper lights the lamp each evening and keeps a log.')).toBeVisible();
  await testWindow(page).getByRole('button', { name: 'Save case' }).click();
  await expect(testWindow(page)).toHaveCount(0);
  await expect(row(page, 'Keeper')).toContainText('Clean');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
});

test('Rename and Remove work from the row buttons, a copy is made with Show JSON and From JSON, and a base in use cannot be removed', async ({ page }) => {
  await start(page);
  const first = page.getByRole('row').nth(1);
  const firstName = (await first.getByRole('cell').nth(1).textContent()) ?? '';

  // no Clone button (T218); a copy is made with Show JSON and From JSON
  await expect(first.getByRole('button', { name: 'Clone' })).toHaveCount(0);
  await first.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Show JSON' }).click();
  const shown = await page.getByRole('textbox', { name: 'Case JSON' }).inputValue();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await testWindow(page).getByRole('button', { name: 'From JSON' }).click();
  await testWindow(page).getByLabel('Case JSON').fill(JSON.stringify({ ...JSON.parse(shown), name: `${firstName} (copy)` }));
  await testWindow(page).getByRole('button', { name: 'Save case' }).click();
  await expect(row(page, `${firstName} (copy)`)).toBeVisible();

  // rename: a taken name is refused, a free name accepted
  await row(page, `${firstName} (copy)`).getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('New name').fill(firstName.toUpperCase());
  await page.getByRole('dialog', { name: 'Rename test case' }).getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('dialog', { name: 'Rename test case' }).getByRole('alert')).toContainText('already used by case 1');
  await page.getByLabel('New name').fill('Free name');
  await page.getByRole('dialog', { name: 'Rename test case' }).getByRole('button', { name: 'Rename' }).click();
  await expect(row(page, 'Free name')).toBeVisible();

  // remove the copy, after confirming
  await row(page, 'Free name').getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('dialog', { name: 'Remove test case' }).getByRole('button', { name: 'Remove' }).click();
  await expect(row(page, 'Free name')).toHaveCount(0);

  // a case made from case 1 makes it a base in use
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await testWindow(page).getByRole('button', { name: 'From JSON' }).click();
  const source = 'Anna is a baker in a small town. She opens her shop at five every morning and sells bread to the neighbours. In 1998 she bought a second oven.';
  await testWindow(page).getByLabel('Case JSON').fill(JSON.stringify({
    name: 'Anna with a wrong year', base: '1',
    fields: { source_text: source, summary: 'Anna, a baker in a small town, opens her shop at five each morning. In 2005 she bought a second oven.' },
    expected_errors: [{ category: 'wrong-number', fragment: 'In 2005', description: 'The year is 1998.', difficulty: 'subtle' }],
  }));
  await testWindow(page).getByRole('button', { name: 'Save case' }).click();
  await expect(row(page, 'Anna with a wrong year')).toContainText('Injected errors');
  await first.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('Anna with a wrong year');
  await expect(page.getByRole('dialog', { name: 'Remove test case' })).toHaveCount(0);
  await expect(row(page, firstName).first()).toBeVisible();
});

test('Open shows a case read-only with Previous and Next, and the Test cases pages have no accessibility violations', async ({ page }) => {
  await start(page);
  const axe = async () => (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(await axe()).toEqual([]);
  await page.getByRole('row').nth(1).getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('dialog', { name: /Case 1/ })).toBeVisible();
  expect(await axe()).toEqual([]);
  await page.getByRole('button', { name: 'Next case' }).click();
  await expect(page.getByRole('dialog', { name: /Case 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'Show JSON' }).click();
  await expect(page.getByLabel('Case JSON')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Add test case…' }).click();
  await testWindow(page).getByRole('button', { name: 'Clean case' }).click();
  expect(await axe()).toEqual([]);
});
