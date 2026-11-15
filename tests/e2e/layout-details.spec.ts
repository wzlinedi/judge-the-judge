// T209 and T210: small layout and wording details found by the T221 run, measured in the browser at 1280 px.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject } from '../helpers/test-run-flow';

const demoProject = readFileSync('examples/demo/test-project.json', 'utf8');

async function openDemoCases(page: Page) {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', demoProject);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await loadTestProject(page, memory, 'books.json', 'with');
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  await expect(page.getByRole('table', { name: 'Test cases' })).toBeVisible();
}

test('the table of test cases at 1280 px: every header cell on one line and the same height, and the four actions of a row side by side', async ({ page }) => {
  await openDemoCases(page);
  const table = page.getByRole('table', { name: 'Test cases' });
  const headers = await table.locator('thead th').evaluateAll((cells) => cells.map((c) => ({ text: (c as HTMLElement).innerText.trim(), height: Math.round(c.getBoundingClientRect().height), top: Math.round(c.getBoundingClientRect().top) })));
  expect(new Set(headers.map((h) => h.top)).size, JSON.stringify(headers)).toBe(1);
  expect(new Set(headers.map((h) => h.height)).size, JSON.stringify(headers)).toBe(1);
  expect(headers[0]!.height, 'a header cell has one line of text').toBeLessThan(50);

  for (const row of await table.locator('tbody tr').all()) {
    const tops = await row.getByRole('button').evaluateAll((buttons) => buttons.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size, `the buttons of a row are on ${new Set(tops).size} lines`).toBe(1);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('the marker of a mark has room before the text it marks', async ({ page }) => {
  await openDemoCases(page);
  await page.getByRole('row').filter({ hasText: 'Injected errors' }).first().getByRole('button', { name: 'Open' }).click();
  await page.locator('.case-window').getByRole('button', { name: 'Show the issue' }).first().click(); // nothing is highlighted before (T257)
  const gap = await page.locator('.case-window .fragment-strong[data-error]').first().evaluate((mark) => {
    const sup = mark.querySelector('sup') as HTMLElement;
    const text = document.createRange();
    text.setStart(sup.nextSibling as Node, 0);
    text.setEnd(sup.nextSibling as Node, 1);
    return text.getBoundingClientRect().left - sup.getBoundingClientRect().right;
  });
  expect(gap, 'pixels between the marker and the first letter').toBeGreaterThanOrEqual(3);
});

test('the disabled Save case is quiet, not pale red, and says what is needed', async ({ page }) => {
  await openDemoCases(page);
  await page.getByRole('button', { name: 'Add test case…' }).click(); // cases can still be added after the test run has started
  await page.getByRole('button', { name: 'Clean case' }).click();
  const approve = page.getByRole('button', { name: 'Save case' });
  await expect(approve).toBeDisabled();
  await expect(page.getByText('Paste the answer of your LLM to approve.')).toBeVisible();
  const background = await approve.evaluate((b) => getComputedStyle(b).backgroundColor);
  const accent = await page.evaluate(() => {
    const probe = document.createElement('button');
    probe.className = 'primary';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(background).not.toBe(accent);
  expect(await approve.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
});

test('the More menu opens inside the screen, at a wide and at a narrow width, and More and Help stand on the line of the one save button (T246, T289)', async ({ page }) => {
  for (const width of [1280, 420]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    const box = (await page.getByRole('menu', { name: 'More' }).boundingBox())!;
    expect(box.x, `left edge at ${width}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `right edge at ${width}`).toBeLessThanOrEqual(width);
    expect(box.y + box.height, `bottom edge at ${width}`).toBeLessThanOrEqual(700);
    await expect(page.getByRole('menuitem', { name: 'New test project' })).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1280, height: 700 });
  const tops = await Promise.all(['Save test project', 'More', 'Help'].map(async (name) => Math.round((await page.getByRole('button', { name, exact: true }).boundingBox())!.y)));
  expect(new Set(tops).size, JSON.stringify(tops)).toBe(1);
});
