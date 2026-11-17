// T441, T442 (FR-091, FR-092, SC-048, SC-049; research.md, 35.3 to 35.5): the Editorial redesign in the browser. The fonts come only from
// the site, the section labels are seen but not read, the content is at most 1560 px wide, and every link is underlined.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const LABELS_BY_STEP: Record<string, string[]> = {
  Judge: ['Step 01 / Instructions', 'Step 01 / Sample output', 'Step 01 / Detection logic', 'Live preview'],
  'Test cases': ['Step 02 / Dataset'],
  'Test run': ['Step 03 / Run progress', 'Step 03 / Case queue'],
  Results: ['Step 04 / Verdict'],
};
const ALL_LABELS = [...Object.values(LABELS_BY_STEP).flat(), 'Step 04 / Error analysis', 'Step 04 / Case list'];
/** The names of the four step buttons recorded before the redesign (T426). */
const STEP_NAMES = ['1 Judge', '2 Test cases', '3 Test run', '4 Results'];
const FAMILIES = ['Inter', 'Instrument Serif', 'Newsreader', 'JetBrains Mono'];

const stepButton = (page: Page, name: string) => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: new RegExp(`\\d\\s*${name}$`) });
const goTo = async (page: Page, name: string) => {
  await stepButton(page, name).click();
  await expect(stepButton(page, name)).toHaveAttribute('aria-current', 'step');
};
async function loadDemo(page: Page) {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load demo…', exact: true }).click();
  await expect(stepButton(page, 'Judge')).toHaveAttribute('aria-current', 'step');
}

test('SC-048: nothing is requested from another host, every font comes from the site, and each family loads', async ({ page, baseURL }) => {
  const origin = new URL(baseURL as string).origin;
  const elsewhere: string[] = [];
  const fonts: string[] = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin) {
      elsewhere.push(url);
      return route.abort();
    }
    return route.continue();
  });
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.woff2')) fonts.push(response.url());
  });

  await page.goto('/');
  await loadDemo(page);
  for (const name of ['Judge', 'Test cases', 'Test run', 'Results']) await goTo(page, name);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await goTo(page, 'Test run');
  await page.getByRole('region', { name: 'What next' }).getByRole('button', { name: 'Continue' }).click();
  const caseWindow = page.getByRole('dialog', { name: /^Case \d+ / });
  await expect(caseWindow).toBeVisible();

  const loaded = await page.evaluate(async (families) => {
    const specs = [...families.map((f) => `16px "${f}"`), '600 16px "Inter"'];
    const out: Record<string, string[]> = {};
    for (const spec of specs) out[spec] = (await document.fonts.load(spec)).map((face) => face.status);
    return out;
  }, FAMILIES);
  await caseWindow.getByRole('button', { name: 'Close' }).click();

  expect(elsewhere, 'requests to another host').toEqual([]);
  expect(fonts.length, 'the page loaded font files').toBeGreaterThan(0);
  for (const url of fonts) expect(new URL(url).origin, url).toBe(origin);
  for (const [spec, statuses] of Object.entries(loaded)) {
    expect(statuses.length, `${spec} has a face`).toBeGreaterThan(0);
    for (const status of statuses) expect(status, spec).toBe('loaded');
  }
});

test('SC-049: the section labels are seen but not read, and the step buttons keep their names', async ({ page }) => {
  await page.goto('/');
  await loadDemo(page);
  const buttons = page.getByRole('navigation', { name: 'Steps' }).getByRole('button');
  await expect(buttons).toHaveCount(4);
  for (const [i, name] of STEP_NAMES.entries()) await expect(buttons.nth(i)).toHaveAccessibleName(name);

  for (const [step, labels] of Object.entries(LABELS_BY_STEP)) {
    await goTo(page, step);
    for (const text of labels) await expect(page.locator('.eyebrow').filter({ hasText: new RegExp(`^${text}$`) }), text).toBeVisible();
    const snapshot = await page.locator('body').ariaSnapshot();
    for (const text of [...ALL_LABELS, 'Step 0']) expect(snapshot, `${step}: the accessibility tree reads "${text}"`).not.toContain(text);
  }
  for (const [tab, text] of [['Error analysis', 'Step 04 / Error analysis'], ['Test case list', 'Step 04 / Case list']] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.locator('.eyebrow').filter({ hasText: new RegExp(`^${text}$`) })).toBeVisible();
    expect(await page.locator('body').ariaSnapshot()).not.toContain(text);
  }
});

test('FR-092: at 1440 × 900 the content is wider than 1280 px and at most 1560 px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await loadDemo(page);
  const width = await page.locator('.app-main').evaluate((main) => main.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(1280);
  expect(width).toBeLessThanOrEqual(1560);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`links: every link is underlined and axe finds no link told only by its color, on Results and Help (${scheme} scheme)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await loadDemo(page);
    await goTo(page, 'Results');
    const places: Array<[string, () => Promise<void>]> = [
      ['Results', async () => {}],
      ['Help', async () => page.getByRole('button', { name: 'Help', exact: true }).click()],
    ];
    for (const [place, open] of places) {
      await open();
      const axe = await new AxeBuilder({ page }).withRules(['link-in-text-block']).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), place).toEqual([]);
      const plain = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('a, .link-button')]
          .filter((el) => el.checkVisibility())
          .filter((el) => !getComputedStyle(el).textDecorationLine.includes('underline'))
          .map((el) => el.outerHTML.slice(0, 80)),
      );
      expect(plain, `${place}: links without an underline`).toEqual([]);
    }
  });
}

test('T445 (M5): the message banner lines up with the content at 1440 × 900 and keeps its 16 px margins at 390 × 844', async ({ page }) => {
  const banner = page.getByRole('status', { name: 'Message' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await loadDemo(page);
  await expect(banner).toContainText('The demo was loaded');
  const wide = await page.evaluate(() => {
    const main = document.querySelector('.app-main') as HTMLElement;
    const box = main.getBoundingClientRect();
    const style = getComputedStyle(main);
    const message = (document.querySelector('[role="status"][aria-label="Message"]') as HTMLElement).getBoundingClientRect();
    return {
      contentLeft: box.left + parseFloat(style.paddingLeft),
      contentRight: box.right - parseFloat(style.paddingRight),
      left: message.left,
      right: message.right,
    };
  });
  expect(Math.abs(wide.left - wide.contentLeft), `banner left ${wide.left}, content left ${wide.contentLeft}`).toBeLessThanOrEqual(1);
  expect(Math.abs(wide.right - wide.contentRight), `banner right ${wide.right}, content right ${wide.contentRight}`).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(banner).toContainText('The demo was loaded');
  const narrow = await page.evaluate(() => {
    const message = document.querySelector('[role="status"][aria-label="Message"]') as HTMLElement;
    const box = message.getBoundingClientRect();
    return { left: box.left, right: box.right, width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth };
  });
  expect(narrow.left).toBeCloseTo(16, 0);
  expect(narrow.width - narrow.right).toBeCloseTo(16, 0);
  expect(narrow.scroll).toBeLessThanOrEqual(narrow.width);
});
