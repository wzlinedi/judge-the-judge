// quickstart.md V9 steps 2 and 3, and V12 step 3: the three views, the read-only case view, the report and the thresholds (User Story 9; T265 to T268).
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, unknown>;
const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });

async function loadDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…' }).click();
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step'); // the demo opens on Judge (T243)
  await page.getByRole('button', { name: /3\s*Test run/ }).click();
}

const goToResults = (page: Page) => page.getByRole('button', { name: /4\s*Results/ }).click();

/** Settles the five cases that await verification: four with their opinion, the unreadable one with No more findings. */
async function decideEverything(page: Page) {
  for (const id of ['3', '10', '14', '17', '19']) {
    await next(page).getByRole('button', { name: 'Continue' }).click();
    await expect(caseWindow(page)).toContainText(`Case ${id} `);
    if (id === '10') {
      await caseWindow(page).getByRole('button', { name: 'No more findings' }).click(); // its reply cannot be read
    } else {
      await caseWindow(page).getByRole('button', { name: 'Second opinion…' }).click();
      await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('textbox', { name: 'Opinion of your LLM' }).fill(JSON.stringify(opinions[id]));
      await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('button', { name: 'Apply opinion' }).click();
    }
    await caseWindow(page).getByRole('button', { name: 'Close' }).click();
  }
  await expect(next(page)).toContainText('20 of 20 cases decided');
}

test('three views, the read-only case view and the thresholds in Details', async ({ page }) => {
  await loadDemo(page);
  await decideEverything(page);
  await goToResults(page);

  // Summary first; Details at the top of it, above the counts, closed by default (T265)
  await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Overall result' })).toContainText('Works');
  const details = page.locator('details.details-section');
  await expect(details).not.toHaveAttribute('open', '');
  expect((await details.boundingBox())!.y).toBeLessThan((await page.getByRole('group', { name: 'Counts' }).boundingBox())!.y);
  await details.getByText('Details', { exact: true }).click();
  await expect(details.getByLabel('Detection rate: at least (%)')).toHaveValue('80');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // a threshold changes and the overall result updates at once
  await details.getByLabel('Detection rate: at least (%)').fill('95');
  await expect(page.getByRole('region', { name: 'Overall result' })).toContainText('Does not work');
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  // there is no Load check settings (T266): the two thresholds are changed in their boxes, and the data they need is explained (T268)
  await expect(page.getByRole('button', { name: /Load check settings/ })).toHaveCount(0);
  await expect(details).toContainText('The overall result needs at least 30 expected errors and 10 clean cases');
  await details.getByLabel('Detection rate: at least (%)').fill('70');
  await details.getByLabel('False-positive rate: at most (%)').fill('15');
  await expect(page.getByRole('region', { name: 'Overall result' })).toContainText('Works');

  // Error analysis
  await page.getByRole('tab', { name: 'Error analysis' }).click();
  await expect(page.getByRole('table', { name: 'By category' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'By category' })).not.toContainText('counts only');
  await expect(page.getByRole('table', { name: 'By category' })).toContainText('misattribution');
  await expect(page.getByRole('table', { name: 'By category' }).getByRole('row').filter({ hasText: 'misattribution' })).toContainText('100%');
  await expect(page.getByRole('table', { name: 'By difficulty' })).toContainText(/obvious/);
  await expect(page.getByRole('table', { name: 'Additional findings per category' })).toContainText('(no category)');
  await expect(page.getByRole('table', { name: 'Additional findings per difficulty' })).toContainText('(not set)');

  // Test case list and the read-only case view
  await page.getByRole('tab', { name: 'Test case list' }).click();
  const rows = page.getByRole('table', { name: 'Test cases' }).getByRole('row');
  await expect(rows).toHaveCount(21);
  await rows.nth(3).getByRole('button', { name: 'Open' }).click();
  const view = caseWindow(page);
  await expect(view).toContainText('Case 3 ');
  await expect(view).toContainText('LLM opinion, approved by the user');
  await expect(view.getByRole('textbox', { name: 'Judge reply' })).toHaveAttribute('readonly', '');
  await expect(view.getByRole('textbox', { name: 'Complete judge prompt' })).toHaveAttribute('readonly', ''); // T256: the prompt is in part 1
  await expect(view.getByRole('status', { name: 'Summary of the errors' })).toContainText(/expected|No expected errors/);
  await expect(view.getByRole('button', { name: /Approve|Ignore|Found|Save/ })).toHaveCount(0);
  await view.getByRole('button', { name: 'Next case' }).click();
  await expect(view).toContainText('Case 4 ');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(view).toContainText('Case 3 ');
  await view.getByRole('button', { name: 'Open on Test run' }).click();
  await expect(page.getByRole('button', { name: /3\s*Test run/ })).toHaveAttribute('aria-current', 'step');
  await expect(caseWindow(page)).toContainText('Case 3 ');
  await expect(caseWindow(page).getByRole('button', { name: 'Second opinion…' })).toBeVisible();
});

test('the report is exported while cases are undecided and again when all are decided; neither is called provisional; it reads and prints without the tool', async ({ page, browser }, testInfo) => {
  await loadDemo(page);
  await goToResults(page);
  await expect(page.getByRole('region', { name: 'Report and next version' })).toHaveCount(0);
  await expect(next(page)).toContainText('15 of 20 cases decided · 5 not decided yet');
  await expect(next(page).getByRole('button', { name: 'Continue' })).toHaveCount(0);

  const [undecided] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report…' }).click()]);
  expect(undecided.suggestedFilename()).toBe('Book summaries, set A - report.html');
  const undecidedHtml = readFileSync((await undecided.path()) as string, 'utf8');
  expect(undecidedHtml).not.toMatch(/provisional/i);
  expect(undecidedHtml).toContain('5 cases are not decided yet');
  await expect(page.getByRole('status', { name: 'Message' })).toContainText('5 cases are not decided yet');

  await page.getByRole('button', { name: /3\s*Test run/ }).click();
  await decideEverything(page);
  await goToResults(page);
  const [final] = await Promise.all([page.waitForEvent('download'), next(page).getByRole('button', { name: 'Export HTML report…' }).click()]);
  expect(final.suggestedFilename()).toBe('Book summaries, set A - report.html');
  const path = testInfo.outputPath('report.html');
  await final.saveAs(path);
  expect(readFileSync(path, 'utf8')).not.toMatch(/provisional|not decided yet/i);

  // opened on its own, with no tool and with scripts off: readable, with the three views in order
  const context = await browser.newContext({ javaScriptEnabled: false });
  const reader = await context.newPage();
  await reader.goto(`file://${path}`);
  await expect(reader.getByRole('heading', { name: 'Judge the Judge report: Book summaries, set A' })).toBeVisible();
  const headings = await reader.getByRole('heading', { level: 2 }).allTextContents();
  const order = ['1. Summary', '2. Error analysis', '3. Test case list', 'The judge set'].map((h) => headings.indexOf(h));
  expect(order.every((i) => i >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  await expect(reader.getByText('Works').first()).toBeVisible();

  // print to PDF: the details are expanded and the page prints
  const prompt = reader.locator('article.case details pre').first();
  await expect(prompt).toBeHidden(); // collapsible on screen
  await reader.emulateMedia({ media: 'print' });
  await expect(prompt).toBeVisible(); // expanded in print
  await expect(reader.locator('details.details-section, section#summary details').first().getByText('Thresholds used')).toBeVisible();
  const pdf = await reader.pdf({ format: 'A4' });
  expect(pdf.length).toBeGreaterThan(5000);
  await context.close();
});
