// quickstart.md V13: privacy, accessibility and layout (SC-006, FR-007, Principle VII). The projects of playwright.config.ts run it in Chrome and in Edge.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { contrastFailures } from '../helpers/contrast';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject, saveButton } from '../helpers/test-run-flow';

const demoProject = readFileSync('examples/demo/test-project.json', 'utf8');
/** The confirming buttons of a window the user opened and must answer (ui-flow.md, Rules for every screen). */
const CONFIRMING = ['Save case', 'Save case', 'Apply opinion', 'Import test cases…', 'Approve'];
/** Inside a window the action needed next is the primary one: before a file is chosen, that is choosing it. */
const NEEDED_NEXT: Record<string, string[]> = { 'Import window': ['Choose file…'] };

const menu = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
};
const step = (page: Page, name: RegExp) => page.getByRole('button', { name }).click();
const next = (page: Page) => page.getByRole('region', { name: 'What next' });
/** A window the user opened: a native dialog, or the case window that fills the screen. */
const WINDOW = 'dialog[open], .case-window';
const openWindow = (page: Page) => page.locator(WINDOW);
/** The window on top: a dialog opened inside the case window covers it. */
const topWindow = async (page: Page) => ((await page.locator('dialog[open]').count()) > 0 ? 'dialog[open]' : '.case-window');

type Rgb = [number, number, number];
async function colors(page: Page) {
  return page.evaluate(() => {
    const read = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];
    const primary = document.querySelector('.app-page button.primary');
    return { page: read(getComputedStyle(document.body).backgroundColor), text: read(getComputedStyle(document.body).color), accent: primary ? read(getComputedStyle(primary).backgroundColor) : null };
  });
}
const luminance = ([r, g, b]: Rgb) => {
  const c = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};

/** The demo: a finished run with five cases waiting for the user. It opens on the Judge step (T243); this goes on to Run. */
async function loadDemo(page: Page) {
  await menu(page, 'Load demo…');
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: /3\s*Test run/ }).click();
  await expect(page.getByRole('button', { name: /3\s*Test run/ })).toHaveAttribute('aria-current', 'step');
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every step, window and dialog passes axe, has 4.5:1 for every text pair and one primary action, in the ${scheme} scheme`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    const problems: string[] = [];

    /** Axe, the explicit contrast check and the rule of one primary action, for the page or for the window that is open. */
    const check = async (label: string) => {
      const windowOpen = (await openWindow(page).count()) > 0;
      const top = windowOpen ? await topWindow(page) : '';
      const scope = windowOpen ? top : '.app-page';
      const axe = await new AxeBuilder({ page }).include(scope).analyze();
      for (const v of axe.violations) problems.push(`${label}: axe ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
      for (const f of await contrastFailures(page, windowOpen ? top : 'body')) problems.push(`${label}: contrast ${f.ratio} ${f.where} "${f.text}" ${f.foreground} on ${f.background}`);

      const primaries = (await page.locator(windowOpen ? `${top} button.primary` : '.app-page button.primary').allInnerTexts()).map((t) => t.trim());
      if (windowOpen) {
        const allowed = [...CONFIRMING, ...(NEEDED_NEXT[label] ?? [])];
        if (primaries.length > 1 || primaries.some((name) => !allowed.includes(name))) problems.push(`${label}: primary buttons of the window: ${primaries.join(', ')}`);
      } else if (label === 'Help') {
        if (primaries.length > 0) problems.push(`${label}: Help has primary buttons: ${primaries.join(', ')}`);
      } else {
        const inBar = (await next(page).locator('button.primary').allInnerTexts()).map((t) => t.trim());
        const others = primaries.filter((name) => !inBar.includes(name));
        const allowed: string[] = [];
        if (inBar.length !== 1 || others.some((name) => !allowed.includes(name))) problems.push(`${label}: primary buttons: in "what next" ${inBar.join(', ') || 'none'}; elsewhere ${others.join(', ') || 'none'}`);
      }
    };

    // the five screens, before and after the demo is loaded
    await check('Judge');
    await step(page, /2\s*Test cases/);
    await check('Test cases (empty)');
    await step(page, /1\s*Judge/);

    await loadDemo(page);
    await check('Test run');

    await step(page, /1\s*Judge/);
    await check('Judge (demo)');
    await step(page, /2\s*Test cases/);
    await check('Test cases');
    await page.getByRole('button', { name: 'Add test case…' }).click();
    await expect(page.getByRole('dialog', { name: 'Test case' })).toBeVisible();
    await check('Test case window');
    await page.getByRole('dialog', { name: 'Test case' }).getByRole('button', { name: 'From JSON' }).click();
    await check('Test case window, paste JSON');
    await page.keyboard.press('Escape');
    await expect(openWindow(page)).toHaveCount(0);

    await menu(page, 'Import test cases…');
    await expect(page.getByRole('dialog', { name: 'Import test cases…' })).toBeVisible();
    await check('Import window');
    await page.getByRole('dialog', { name: 'Import test cases…' }).getByRole('button', { name: 'Cancel' }).click();

    await step(page, /3\s*Test run/);
    await next(page).getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('dialog', { name: /^Case \d+ / })).toBeVisible();
    await check('Case window');
    await page.getByRole('button', { name: 'Second opinion…' }).click();
    await expect(page.getByRole('dialog', { name: 'Second opinion' })).toBeVisible();
    await check('Second opinion dialog');
    await page.getByRole('dialog', { name: 'Second opinion' }).getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('dialog', { name: /^Case \d+ / }).getByRole('button', { name: 'Close' }).click();
    await expect(openWindow(page)).toHaveCount(0);

    await step(page, /4\s*Results/);
    await check('Results');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await check('Help');

    expect(problems).toEqual([]);
  });

  test(`the accent is red, on ${scheme === 'dark' ? 'a black' : 'a near-white'} background, with text that reads against it (${scheme} scheme)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await loadDemo(page);
    const { page: background, text, accent } = await colors(page);
    expect(accent, 'the Test run step has a primary action').not.toBeNull();
    const [r, g, b] = accent as Rgb;
    expect(r).toBeGreaterThanOrEqual(180);
    expect(r).toBeGreaterThan(2 * g);
    expect(r).toBeGreaterThan(1.5 * b);
    if (scheme === 'dark') {
      expect(luminance(background)).toBeLessThan(0.02);
      expect(luminance(text)).toBeGreaterThan(0.8);
    } else {
      expect(luminance(background)).toBeGreaterThan(0.9);
      expect(luminance(text)).toBeLessThan(0.02);
    }
  });

  test(`every error and "Fail" carries a word or a sign, never only its color (${scheme} scheme)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await loadDemo(page);
    await step(page, /4\s*Results/);
    const marks = await page.evaluate(() =>
      [...document.querySelectorAll('.pass, .fail, .error, .warn, .status-mark')].map((element) => ({
        className: element.className,
        text: (element.textContent ?? '').trim(),
        sign: getComputedStyle(element, '::before').content,
      })),
    );
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(mark.text.length + (mark.sign.replace(/["']|none|normal/g, '').trim().length), `a mark with the class ${mark.className} has neither a word nor a sign`).toBeGreaterThan(0);
    }
    const fails = marks.filter((m) => /\bfail\b/.test(m.className));
    for (const mark of fails) expect(`${mark.sign} ${mark.text}`).toMatch(/✕|Fail/);
  });
}

test('no request leaves the page or carries user data while the demo is loaded, replied to and saved (SC-006)', async ({ page }) => {
  const origin = new URL(test.info().project.use.baseURL ?? 'http://localhost:4173').origin;
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', demoProject);
  const requests: Array<{ url: string; method: string; body: string | null }> = [];
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method(), body: request.postData() }));

  await page.goto('/');
  await loadTestProject(page, memory, 'books.json', 'with');
  await expect(page.getByRole('button', { name: /3\s*Test run/ })).toHaveAttribute('aria-current', 'step');
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const caseWindow = page.getByRole('dialog', { name: /^Case \d+ / });
  await caseWindow.getByRole('button', { name: 'Copy prompt' }).click();
  await page.evaluate(() => navigator.clipboard.writeText('{"claims": []}'));
  await caseWindow.getByRole('button', { name: 'Paste reply' }).click();
  await caseWindow.getByRole('button', { name: 'Close' }).click();
  await saveButton(page).click();
  await expect.poll(() => memory.files.get('books.json')).not.toBe(demoProject); // the loaded file is remembered, so the save overwrites it

  const outside = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  expect(outside.map((r) => r.url)).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET' && r.method !== 'HEAD').map((r) => `${r.method} ${r.url}`)).toEqual([]);
  expect(requests.filter((r) => r.body !== null)).toEqual([]);

  // the Content Security Policy forbids every connection, so the page could not send anything even by mistake
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toMatch(/connect-src 'none'/);
  expect(policy).toMatch(/default-src 'none'|default-src 'self'/);

  // nothing remains in the browser after the page is closed
  const storage = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases?.())?.length ?? 0, cookies: document.cookie }));
  expect(storage).toEqual({ local: 0, session: 0, databases: 0, cookies: '' });
});

test('every action is reachable with the keyboard alone: the File menu, a dialog, the steps, and focus is visible', async ({ page }) => {
  await installMemoryFiles(page);
  await page.goto('/');
  const focusRing = () => page.evaluate(() => (document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : 'none'));

  // Tab until the File button has the focus, and open the menu and a dialog with Enter and the arrow keys
  const reach = async (name: RegExp | string, limit = 40) => {
    for (let i = 0; i < limit; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim());
      if (typeof name === 'string' ? label === name : name.test(label)) return;
    }
    throw new Error(`Could not reach ${String(name)} with Tab`);
  };
  await reach('More');
  expect(await focusRing()).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Load demo…' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Load demo…' }).focus();
  await page.keyboard.press('Enter');
  // the demo needs no window: it opens on the Judge step, and the step bar goes on to Run by keyboard
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: /3\s*Test run/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /3\s*Test run/ })).toHaveAttribute('aria-current', 'step');

  // the primary action of the step with Enter, then Escape closes the window and returns the focus
  await next(page).getByRole('button', { name: 'Continue' }).focus();
  await page.keyboard.press('Enter');
  const caseWindow = page.getByRole('dialog', { name: /^Case \d+ / });
  await expect(caseWindow).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(caseWindow).toHaveCount(0);
  // the focus comes back after the window is gone, so wait for it
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

  // the step bar by keyboard
  await page.getByRole('button', { name: /4\s*Results/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /4\s*Results/ })).toHaveAttribute('aria-current', 'step');
  expect(await focusRing()).not.toBe('none');
});

test('Escape does not lose a reply that was typed and not saved: the window asks first, and Cancel keeps the text', async ({ page }) => {
  await installMemoryFiles(page);
  await page.goto('/');
  await loadDemo(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const caseWindow = page.getByRole('dialog', { name: /^Case \d+ / });
  // the case has a saved reply, so it is changed with "Change reply" (T293); typing saves nothing
  await caseWindow.locator('.reply-pane').getByRole('button', { name: 'Change reply' }).click();
  await caseWindow.getByRole('textbox', { name: 'Judge reply' }).fill('half a reply, typed by hand');
  await page.keyboard.press('Escape');
  const ask = page.getByRole('dialog', { name: 'The changes to the reply are not saved' });
  await expect(ask).toBeVisible();
  await expect(caseWindow).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(caseWindow.getByRole('textbox', { name: 'Judge reply' })).toHaveValue('half a reply, typed by hand');
});

test.describe('at 360 px wide', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const fits = (page: Page) => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));

  test('no screen scrolls sideways, the case window stacks the columns of its part 3 and the action row of the second opinion stays visible', async ({ page }) => {
    await page.goto('/');
    const sideways: string[] = [];
    const measure = async (label: string) => {
      const { scroll, client } = await fits(page);
      if (scroll > client) sideways.push(`${label}: ${scroll} > ${client}`);
      const axe = await new AxeBuilder({ page }).analyze();
      for (const v of axe.violations) sideways.push(`${label}: axe ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    };
    await measure('Judge');
    await loadDemo(page);
    await measure('Test run');
    await step(page, /1\s*Judge/);
    await measure('Judge (demo)');
    await step(page, /2\s*Test cases/);
    await measure('Test cases');
    await page.getByRole('button', { name: 'Add test case…' }).click();
    await measure('Test case window');
    await page.keyboard.press('Escape');
    await step(page, /4\s*Results/);
    await measure('Results');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await measure('Help');
    await step(page, /3\s*Test run/);
    await next(page).getByRole('button', { name: 'Continue' }).click();
    const caseWindow = page.getByRole('dialog', { name: /^Case \d+ / });
    await expect(caseWindow).toBeVisible();
    await measure('Case window');

    // the judge's reply and the errors of part 3 stand one above the other
    const columns = await caseWindow.locator('.case-half > section').evaluateAll((nodes) =>
      nodes.slice(0, 2).map((n) => {
        const box = n.getBoundingClientRect();
        return { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width) };
      }),
    );
    expect(columns, 'part 3 has two columns').toHaveLength(2);
    expect(columns[1]!.top, 'the second column is below the first').toBeGreaterThan(columns[0]!.top);
    expect(columns[1]!.left, 'both columns start at the same edge').toBe(columns[0]!.left);

    await caseWindow.getByRole('button', { name: 'Second opinion…' }).click();
    const opinion = page.getByRole('dialog', { name: 'Second opinion' });
    await expect(opinion).toBeVisible();
    await measure('Second opinion dialog');
    await opinion.getByRole('textbox', { name: 'Opinion of your LLM' }).fill('x'.repeat(4000));
    for (const name of ['Apply opinion', 'Cancel']) {
      const box = await opinion.getByRole('button', { name }).boundingBox();
      expect(box, `${name} is on the screen`).not.toBeNull();
      expect(box!.y + box!.height, `${name} stays inside the 740 px window`).toBeLessThanOrEqual(740);
      expect(box!.y).toBeGreaterThanOrEqual(0);
    }
    expect(sideways).toEqual([]);
  });
});

test('in a browser without saving to a file the tool says it supports Chrome and Edge', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
    delete (window as unknown as Record<string, unknown>)['showOpenFilePicker'];
  });
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'Chrome and Microsoft Edge' })).toBeVisible();
  // the notice does not stop the rest of the tool
  await expect(page.getByRole('button', { name: /1\s*Judge/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('with a supported browser there is no notice', async ({ page }) => {
  await installMemoryFiles(page);
  await page.goto('/');
  await expect(page.getByText('Chrome and Microsoft Edge')).toHaveCount(0);
});

test('the contrast check is not empty: it finds a pair below 4.5:1', async ({ page }) => {
  await page.goto('/');
  expect(await contrastFailures(page)).toEqual([]);
  // the CSP refuses a style tag, but not a change of the element's own style
  await page.evaluate(() => document.querySelectorAll('h1, h2, .next-sentence').forEach((e) => (e as HTMLElement).style.setProperty('color', '#9a9aa0', 'important')));
  const failures = await contrastFailures(page);
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.every((f) => f.ratio < 4.5)).toBe(true);
});
