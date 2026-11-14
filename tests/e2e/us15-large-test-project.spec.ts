// User Story 15: browse a large test project (FR-025, FR-036, SC-018; quickstart "Performance checks").
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { CASE_COUNT, make500Cases } from './fixtures/make-500-cases';

const SECOND = 2000;
const large = make500Cases();

const table = (page: Page) => page.getByRole('table', { name: 'Test cases' });
const bodyRows = (page: Page) => table(page).locator('tbody tr');
const count = (page: Page) => page.getByRole('status', { name: 'Shown test cases' });
const ids = async (page: Page) => (await bodyRows(page).locator('td:first-child').allTextContents()).map((t) => t.trim());
const sortBy = (page: Page, column: string) => page.getByRole('columnheader', { name: column }).getByRole('button').click();

/** How long the interface takes to show the result of an action: the action, then the count it must change. */
async function within(action: () => Promise<unknown>, shown: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await action();
  await shown();
  return Date.now() - start;
}

async function openLarge(page: Page): Promise<number> {
  const memory = await installMemoryFiles(page);
  memory.files.set('large.json', large.text);
  memory.chooseOpenName('large.json');
  await page.goto('/');
  const took = await within(
    async () => {
      await page.getByRole('button', { name: 'File' }).click();
      await page.getByRole('menuitem', { name: 'Load evaluation' }).click();
    },
    () => expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step'),
  );
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  return took;
}

test('500 cases load, list, search, filter and sort without the interface stopping for 2 seconds (SC-018)', async ({ page }) => {
  expect(large.withInjectedErrors).toBe(CASE_COUNT / 2);
  expect(await openLarge(page)).toBeLessThan(5 * SECOND); // a file read and a parse, not a freeze of the interface
  await expect(count(page)).toHaveText(`${CASE_COUNT} test cases`);
  await expect(bodyRows(page)).toHaveCount(CASE_COUNT);

  // the independent test: injected errors and without a reply
  const filtered = await within(
    async () => {
      await page.getByLabel('Kind').selectOption('injected');
      await page.getByLabel('Reply').selectOption('without');
    },
    () => expect(count(page)).toHaveText(`${large.injectedWithoutReply} of ${CASE_COUNT} test cases`),
  );
  expect(filtered).toBeLessThan(SECOND);
  await expect(bodyRows(page)).toHaveCount(large.injectedWithoutReply);
  const shown = await ids(page);
  expect(shown.every((id) => Number(id) % 2 === 0 && Number(id) % 4 !== 0)).toBe(true);
  await expect(table(page).locator('tbody tr', { hasText: 'Clean' })).toHaveCount(0);

  // the search looks in the texts of the fields, and narrows what the filters show instead of widening it
  const searched = await within(
    () => page.getByRole('searchbox', { name: 'Search test cases' }).fill('variant 22)'),
    () => expect(bodyRows(page)).toHaveCount(1),
  );
  expect(searched).toBeLessThan(SECOND);
  expect(await ids(page)).toEqual(['22']);
  await expect(count(page)).toHaveText(`1 of ${CASE_COUNT} test cases`);

  // a search that matches nothing says so, and clearing everything brings all the cases back
  await page.getByRole('searchbox', { name: 'Search test cases' }).fill('no such text');
  await expect(count(page)).toContainText('No test case matches');
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(count(page)).toHaveText(`${CASE_COUNT} test cases`);
  await expect(bodyRows(page)).toHaveCount(CASE_COUNT);

  // the kind filter alone: clean cases, then the cases with a reply
  await page.getByLabel('Kind').selectOption('clean');
  await expect(count(page)).toHaveText(`${CASE_COUNT / 2} of ${CASE_COUNT} test cases`);
  await page.getByLabel('Kind').selectOption('all');
  await page.getByLabel('Reply').selectOption('with');
  await expect(count(page)).toHaveText(`${large.withReply} of ${CASE_COUNT} test cases`);
});

test('sorting by a column is stable, ascending then descending then the original order, and each column says which way it runs', async ({ page }) => {
  await openLarge(page);
  const original = await ids(page);
  expect(original.slice(0, 3)).toEqual(['1', '2', '3']);

  const sorted = await within(
    () => sortBy(page, 'Name'),
    () => expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'ascending'),
  );
  expect(sorted).toBeLessThan(SECOND);
  const ascending = await ids(page);
  expect(ascending).toHaveLength(CASE_COUNT);
  expect(ascending.slice(0, 3)).toEqual(['1', '2', '3']); // numbers in a name are compared as numbers: Case 2 before Case 10
  await sortBy(page, 'Name');
  await expect(page.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'descending');
  expect((await ids(page))[0]).toBe('500');
  await sortBy(page, 'Name');
  await expect(page.getByRole('columnheader', { name: 'Name' })).not.toHaveAttribute('aria-sort', /ascending|descending/);
  expect(await ids(page)).toEqual(original);

  // by kind the clean cases (odd numbers) come first
  await sortBy(page, 'Kind');
  const byKind = await ids(page);
  expect(byKind[0]).toBe('1');
  expect(byKind[CASE_COUNT / 2]).toBe('2');
  await sortBy(page, 'Kind');
  await sortBy(page, 'Kind');

  // sorting by the number of expected errors puts the cases with the most first, and the cases of equal count by id
  await sortBy(page, 'Expected errors');
  await sortBy(page, 'Expected errors');
  await expect(page.getByRole('columnheader', { name: 'Expected errors' })).toHaveAttribute('aria-sort', 'descending');
  const first = await bodyRows(page).first().locator('td').nth(4).textContent();
  expect(Number(first)).toBeGreaterThan(0);

  // the sort and the filters work together, and a row still opens its case
  await page.getByLabel('Kind').selectOption('clean');
  await expect(count(page)).toHaveText(`${CASE_COUNT / 2} of ${CASE_COUNT} test cases`);
  await bodyRows(page).first().getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /^Case \d+ / })).toBeVisible();
});
