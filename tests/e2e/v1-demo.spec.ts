// quickstart.md V1: first run with the demo data (SC-001, SC-009, User Stories 1 and 9).
// The export of the HTML report (User Story 9) is checked by tests/e2e/us9-results.spec.ts.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const expected = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8'));

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: /3\s*Test run/ }).click();
}

const item = (page: Page, kind: 'expected' | 'additional', id: string) => page.locator(`[data-${kind}="${id}"]`);

test('the Judge step has no welcome section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/welcome/i)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'What next' }).getByRole('button')).toHaveCount(1);
});

test('the demo opens on Judge, and Run shows 15 of 20 cases decided, and Continue opens the first case awaiting verification', async ({ page }) => {
  await loadDemo(page);
  const next = page.getByRole('region', { name: 'What next' });
  await expect(next).toContainText('15 of 20 cases decided');
  await expect(page.getByRole('button', { name: /3\s*Test run/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByText('All changes saved').or(page.getByText('Nothing to save yet'))).toBeVisible();
  await next.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: /Case 3/ })).toBeVisible();
  await expect(page.getByText('1 of 5').or(page.getByText('3 of 20'))).toBeVisible();
});

test('while cases await verification Results says how many are not decided yet and is Inconclusive, with the test size', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  await expect(page.getByRole('status', { name: 'Cases not decided' })).toContainText('5 cases are not decided yet');
  await expect(page.getByText(/provisional/i)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Overall result' })).toContainText('Inconclusive');
  await expect(page.getByRole('region', { name: 'Test size' })).toContainText('21 of 30 expected errors');
});

test('deciding the five cases gives the numbers of the expected results file', async ({ page }) => {
  await loadDemo(page);
  await page.getByRole('region', { name: 'What next' }).getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Only cases awaiting verification').check();

  // 3: a false positive
  await expect(page.getByRole('dialog', { name: /Case 3 /})).toBeVisible();
  await item(page, 'additional', 'claims[]#2').getByRole('button', { name: 'False positive' }).click();
  await page.getByRole('button', { name: 'Next case' }).click();

  // 10: a reply that cannot be read; approve it
  await expect(page.getByRole('dialog', { name: /Case 10 /})).toBeVisible();
  await expect(page.getByText(/could not be read/i)).toBeVisible();
  await page.getByRole('button', { name: 'No more findings' }).click();
  await page.getByRole('button', { name: 'Next case' }).click();

  // 14: a partly matching finding is the error
  await expect(page.getByRole('dialog', { name: /Case 14 /})).toBeVisible();
  await item(page, 'expected', 'e2').getByRole('button', { name: /^(● )?Found$/ }).click();
  await page.getByRole('button', { name: 'Next case' }).click();

  // 17: a missed error and a false positive
  await expect(page.getByRole('dialog', { name: /Case 17 /})).toBeVisible();
  await item(page, 'expected', 'e2').getByRole('button', { name: 'Not found' }).click();
  await item(page, 'additional', 'claims[]#2').getByRole('button', { name: 'False positive' }).click();
  await page.getByRole('button', { name: 'Next case' }).click();

  // 19: a real error that was not injected
  await expect(page.getByRole('dialog', { name: /Case 19 /})).toBeVisible();
  await item(page, 'additional', 'claims[]#3').getByRole('button', { name: 'Genuine error' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('region', { name: 'What next' })).toContainText('20 of 20 cases decided');
  await page.getByRole('button', { name: /4\s*Results/ }).click();

  const c = expected.after_deciding.counters;
  await expect(page.getByRole('status', { name: 'Cases not decided' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Overall result' })).toContainText('Works');
  await expect(page.getByRole('group', { name: 'Expected errors' })).toContainText(`Found${c.expected_found}`);
  await expect(page.getByRole('group', { name: 'Rates' })).toContainText('Detection rate90% (27 of 30)');
  await expect(page.getByRole('group', { name: 'Rates' })).toContainText('False-positive rate6.7% (2 of 30)');
  await expect(page.getByRole('region', { name: 'Test size' })).toContainText('30 of 30 expected errors, 10 of 10 clean cases');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
});

test('the demo pages have no accessibility violations', async ({ page }) => {
  await loadDemo(page);
  const run = await new AxeBuilder({ page }).analyze();
  expect(run.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.getByRole('region', { name: 'What next' }).getByRole('button', { name: 'Continue' }).click();
  const window = await new AxeBuilder({ page }).analyze();
  expect(window.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: /4\s*Results/ }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
