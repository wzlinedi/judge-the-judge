// Phase 23, step 2 (T321; FR-092, SC-041, SC-047): the layout of the shell at the four sizes of the redesign, measured in the browser.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject } from '../helpers/test-run-flow';

const demoProject = readFileSync('examples/demo/test-project.json', 'utf8');
const STEPS = [/1\s*Judge/, /2\s*Test cases/, /3\s*Test run/, /4\s*Results/] as const;

async function loadDemo(page: Page, width: number, height: number) {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', demoProject);
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await loadTestProject(page, memory, 'books.json', 'with');
}

const noPageScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function eachView(page: Page, check: () => Promise<void>) {
  for (const step of STEPS) {
    await page.getByRole('button', { name: step }).click();
    await check();
  }
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await check();
}

test.describe('layout of the shell (SC-041)', () => {
  test('at 1440 × 900 the content is wider than 1280 px and at most 1600 px', async ({ page }) => {
    await loadDemo(page, 1440, 900);
    const width = await page.locator('.app-main').evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(1280);
    expect(width).toBeLessThanOrEqual(1600);
  });

  for (const [width, height] of [[1280, 720], [768, 1024], [360, 740]] as const) {
    test(`at ${width} × ${height} no page of the four steps or Help scrolls sideways`, async ({ page }) => {
      await loadDemo(page, width, height);
      await eachView(page, async () => {
        await expect.poll(() => noPageScroll(page)).toBe(true);
      });
    });
  }

  test('at 360 × 740 nothing is cut off: buttons, messages, the save indicator and case names fit their box (SC-047)', async ({ page }) => {
    await loadDemo(page, 360, 740);
    await eachView(page, async () => {
      const cut = await page.evaluate(() => {
        const selectors = 'button, .notice-line, .error-message, .save-state, .save-group, .project-name, .case-window-title, td.name, .cell-name';
        return [...document.querySelectorAll<HTMLElement>(selectors)]
          .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible')
          .map((el) => `${el.tagName}.${el.className} "${(el.textContent ?? '').slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth} ${getComputedStyle(el).overflowX} in ${el.closest('.app-page')?.className ?? '?'}`);
      });
      expect(cut).toEqual([]);
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, .notice-line, .error-message, .save-state, .project-name')]
          .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !el.closest('.step-bar, .table-scroll'))
          .map((el) => `${el.tagName}.${el.className} "${(el.textContent ?? '').slice(0, 30)}"`),
      );
      expect(wide).toEqual([]);
    });
  });

  test('below 760 px (390 × 844) the two-column layouts are one column', async ({ page }) => {
    await loadDemo(page, 390, 844);
    await eachView(page, async () => {
      const sideBySide = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.case-half, .form-grid, .judge-work')].flatMap((box) => {
          const lefts = [...box.children].map((c) => Math.round(c.getBoundingClientRect().left));
          return new Set(lefts).size > 1 ? [`${box.className}: ${lefts.join(',')}`] : [];
        }),
      );
      expect(sideBySide).toEqual([]);
    });
  });

  test('at 360 × 740 the step bar scrolls sideways, the page does not, and the current step is in view', async ({ page }) => {
    await loadDemo(page, 360, 740);
    const bar = page.locator('.step-bar');
    const sideways = await bar.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(sideways, 'the step bar has more width than its box').toBe(true);
    expect(await noPageScroll(page)).toBe(true);
    await page.getByRole('button', { name: STEPS[3] }).click();
    const current = page.locator('.step.current');
    await expect(current).toBeVisible();
    const inView = await current.evaluate((el) => {
      const own = el.getBoundingClientRect();
      const box = (el.closest('.step-bar') as HTMLElement).getBoundingClientRect();
      return own.left >= box.left - 1 && own.right <= box.right + 1;
    });
    expect(inView, 'the current step lies inside the step bar').toBe(true);
  });

  test('a paragraph of the "what next" line is at most 72ch wide', async ({ page }) => {
    await loadDemo(page, 1440, 900);
    await page.getByRole('button', { name: STEPS[1] }).click();
    const widths = await page.locator('.next-bar p').evaluateAll((paragraphs) =>
      paragraphs.map((p) => {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
        probe.textContent = '0';
        p.append(probe);
        const zero = probe.getBoundingClientRect().width;
        probe.remove();
        return { width: p.getBoundingClientRect().width, limit: zero * 72 + 1 };
      }),
    );
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w.width).toBeLessThanOrEqual(w.limit);
  });
});
