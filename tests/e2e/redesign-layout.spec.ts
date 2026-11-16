// Phase 23, steps 2 to 4 (T321, T327, T331; FR-092, FR-093, SC-030, SC-031, SC-041, SC-042, SC-047): the layout of the shell, of the views and of the case window at the sizes of the redesign, measured in the browser.
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
        [...document.querySelectorAll<HTMLElement>('.case-half, .form-grid, .judge-work-area')].flatMap((box) => {
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

test.describe('layout of the views (T327, FR-093)', () => {
  test('on Judge at 1280 × 720 the preview of the findings stays in view while a rule is changed', async ({ page }) => {
    await loadDemo(page, 1280, 720);
    await page.getByRole('button', { name: STEPS[0] }).click();
    const lastRule = page.getByRole('group', { name: /^Rule \d+$/ }).last();
    const value = lastRule.getByLabel(/^Value of condition 1 of rule \d+$/);
    await value.scrollIntoViewIfNeeded();
    await value.fill('contradicted');
    await expect(page.getByRole('table', { name: 'Preview of the findings' })).toBeInViewport();
    // The preview is the right column of the work area and sticks, so it stays in view when the rules are longer than the screen.
    const columns = await page.locator('.judge-work-area').evaluate((area) => {
      const [rules, preview] = [...area.children].map((c) => c.getBoundingClientRect());
      return { sideBySide: (preview as DOMRect).left >= (rules as DOMRect).right - 1, position: getComputedStyle(area.children[1] as Element).position };
    });
    expect(columns).toEqual({ sideBySide: true, position: 'sticky' });
  });

  test('on Results the overall result is the largest text, and the numbers of a table are right-aligned', async ({ page }) => {
    await loadDemo(page, 1280, 720);
    await page.getByRole('button', { name: STEPS[3] }).click();
    const sizes = await page.evaluate(() => {
      const own = parseFloat(getComputedStyle(document.querySelector('.overall-result') as Element).fontSize);
      let largest = 0;
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        if (el.closest('.overall-result')) continue;
        const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
        if (hasText && el.offsetParent !== null) largest = Math.max(largest, parseFloat(getComputedStyle(el).fontSize));
      }
      return { own, largest };
    });
    expect(sizes.own).toBeGreaterThan(0);
    expect(sizes.own, 'no other text on the page is as large as the overall result').toBeGreaterThan(sizes.largest);
    await page.getByRole('tab', { name: 'Error analysis' }).click();
    const aligns = await page.locator('td.num').evaluateAll((cells) => cells.map((c) => getComputedStyle(c).textAlign));
    expect(aligns.length).toBeGreaterThan(0);
    for (const align of aligns) expect(align).toBe('right');
  });

  test('on Test run at 1280 × 720 the table spans the content width', async ({ page }) => {
    await loadDemo(page, 1280, 720);
    await page.getByRole('button', { name: STEPS[2] }).click();
    const widths = await page.evaluate(() => {
      const inner = (el: Element) => {
        const style = getComputedStyle(el);
        return el.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
      };
      const main = document.querySelector('.app-main') as Element;
      const card = (document.querySelector('.table-scroll') as Element).closest('.card') as Element;
      const frame = (document.querySelector('.table-scroll') as Element);
      const table = frame.querySelector('table') as Element;
      return { main: inner(main), card: card.getBoundingClientRect().width, cardInner: inner(card), frame: frame.getBoundingClientRect().width, table: table.getBoundingClientRect().width };
    });
    expect(Math.abs(widths.card - widths.main), 'the card fills the content width').toBeLessThanOrEqual(2);
    expect(Math.abs(widths.frame - widths.cardInner), 'the frame fills the card').toBeLessThanOrEqual(2);
    expect(Math.abs(widths.table - widths.frame), 'the table fills its frame').toBeLessThanOrEqual(2);
  });
});

test.describe('layout of the case window (T331, FR-092)', () => {
  const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });

  /** The demo case with a reply and three expected errors, the most of any demo case, opened from Test run. */
  async function openMobyDick(page: Page, width: number, height: number) {
    await loadDemo(page, width, height);
    await page.getByRole('button', { name: STEPS[2] }).click();
    await page.getByRole('row').filter({ hasText: 'Moby-Dick + 3 errors' }).getByRole('button', { name: 'Open' }).click();
    const win = caseWindow(page);
    await expect(win).toHaveAccessibleName(/^Case 12 · Moby-Dick \+ 3 errors$/);
    return win;
  }

  for (const [width, height] of [[1440, 900], [1280, 720], [768, 1024], [390, 844]] as const) {
    test(`SC-042: at ${width} × ${height} Previous, Next and Close stay in view at the end of the case, and Alt + arrows move`, async ({ page }) => {
      const win = await openMobyDick(page, width, height);
      await win.locator('.case-window-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      for (const name of ['Previous case', 'Next case', 'Close']) await expect(win.getByRole('button', { name, exact: true })).toBeInViewport();
      await page.keyboard.press('Alt+ArrowRight');
      await expect(win).toHaveAccessibleName(/^Case 13 /);
      await page.keyboard.press('Alt+ArrowLeft');
      await expect(win).toHaveAccessibleName(/^Case 12 /);
    });
  }

  test('SC-030: at 1280 × 720, after Next case, the header, the case name and part 1 are in view without scrolling', async ({ page }) => {
    const win = await openMobyDick(page, 1280, 720);
    await win.getByRole('button', { name: 'Next case' }).click();
    await expect(win).toHaveAccessibleName(/^Case 13 /);
    await expect(win.locator('.case-window-header')).toBeInViewport();
    await expect(win.locator('.case-window-title')).toBeInViewport();
    await expect(win.getByRole('heading', { name: '1. Case' })).toBeInViewport();
  });

  test('SC-031: at 1280 × 720 "Show the issue" scrolls the one page so each passage is in view below the header', async ({ page }) => {
    const win = await openMobyDick(page, 1280, 720);
    const body = win.locator('.case-window-body');
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight), 'the page of the case is longer than the screen').toBe(true);
    const ids = await win.locator('[data-expected]').evaluateAll((items) => items.map((i) => i.getAttribute('data-expected') as string));
    expect(ids).toHaveLength(3);
    for (const id of ids) {
      const passage = win.locator(`.marked-fields [data-error="${id}"]`);
      await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(passage).not.toBeInViewport();
      const button = win.locator(`[data-expected="${id}"]`).getByRole('button', { name: 'Show the issue' });
      await button.scrollIntoViewIfNeeded();
      const before = await body.evaluate((el) => el.scrollTop);
      await button.click();
      await expect.poll(() => body.evaluate((el) => el.scrollTop), 'the page that scrolls is the body of the window').not.toBe(before);
      await expect(passage).toHaveClass(/fragment-strong/);
      await expect(passage).toBeInViewport();
      const [top, headerBottom] = await Promise.all([passage.evaluate((el) => el.getBoundingClientRect().top), win.locator('.case-window-header').evaluate((el) => el.getBoundingClientRect().bottom)]);
      expect(top, 'the header does not cover the passage').toBeGreaterThanOrEqual(headerBottom);
    }
    const own = await win.locator('.case-pane, .reply-read, .decide-list').evaluateAll((items) => items.map((i) => `${i.className}: ${getComputedStyle(i).overflowY}`));
    expect(own.length).toBeGreaterThan(0);
    expect(own.filter((o) => !o.endsWith(': visible')), 'no part of the case scrolls on its own').toEqual([]);
  });

  test('from 760 px the judged field is right of the other fields; at 390 × 844 it is below them', async ({ page }) => {
    const sides = async (win: ReturnType<typeof caseWindow>) => {
      const [others, judged] = await Promise.all([win.locator('.case-fields-others').boundingBox(), win.locator('.case-fields-judged').boundingBox()]);
      return { others: others!, judged: judged! };
    };
    let win = await openMobyDick(page, 768, 1024);
    const wide = await sides(win);
    expect(wide.judged.x, 'right of the other fields').toBeGreaterThanOrEqual(wide.others.x + wide.others.width - 1);
    expect(Math.abs(wide.judged.y - wide.others.y)).toBeLessThan(4);
    await page.setViewportSize({ width: 390, height: 844 });
    win = caseWindow(page);
    const narrow = await sides(win);
    expect(narrow.judged.y, 'below the other fields').toBeGreaterThanOrEqual(narrow.others.y + narrow.others.height - 1);
    expect(Math.abs(narrow.judged.x - narrow.others.x)).toBeLessThan(4);
  });

  test('at 390 × 844 the header reads on screen in the order of the DOM, with Close last and no CSS order', async ({ page }) => {
    const win = await openMobyDick(page, 390, 844);
    const result = await win.locator('.case-window-header').evaluate((header) => {
      const items = [...header.children].flatMap((child) => (child.classList.contains('case-window-nav') ? [...child.children] : [child])).filter((el) => (el as HTMLElement).offsetParent !== null);
      const boxes = items.map((el) => ({ text: (el.textContent ?? '').trim(), box: el.getBoundingClientRect() }));
      // Items whose vertical ranges overlap are on one line; the lines go from top to bottom, and inside a line from left to right
      const lines: (typeof boxes)[] = [];
      for (const item of [...boxes].sort((a, b) => a.box.top - b.box.top)) {
        const line = lines.find((l) => l.some((o) => item.box.top < o.box.bottom && o.box.top < item.box.bottom));
        if (line) line.push(item);
        else lines.push([item]);
      }
      const onScreen = lines.flatMap((l) => [...l].sort((a, b) => a.box.left - b.box.left)).map((i) => i.text);
      const ordered = [...header.querySelectorAll('*')].filter((el) => getComputedStyle(el).order !== '0').map((el) => el.className || el.tagName);
      return { dom: boxes.map((i) => i.text), onScreen, ordered };
    });
    expect(result.onScreen).toEqual(result.dom);
    expect(result.dom.at(-1)).toBe('Close');
    expect(result.ordered).toEqual([]);
  });
});

test.describe('layout of the dialogs (T338, FR-093)', () => {
  /** What the user sees of a dialog on a phone: the title and every button in view, the page not scrolled sideways. */
  async function expectFits(page: Page, name: string) {
    const dialog = page.getByRole('dialog', { name, exact: true });
    await expect(dialog.getByRole('heading', { name, exact: true })).toBeInViewport();
    const buttons = dialog.locator('.dialog-actions button');
    expect(await buttons.count()).toBeGreaterThan(0);
    for (const button of await buttons.all()) await expect(button).toBeInViewport();
    expect(await noPageScroll(page), 'the page scrolls sideways').toBe(true);
    return dialog;
  }

  test('at 360 × 640 "Show prompt" and "Second opinion…" keep the title and the buttons in view, and the body scrolls inside', async ({ page }) => {
    await loadDemo(page, 360, 640);
    await page.getByRole('button', { name: STEPS[2] }).click();
    await page.getByRole('row').filter({ hasText: 'Moby-Dick + 3 errors' }).getByRole('button', { name: 'Open' }).click();
    const win = page.getByRole('dialog', { name: /^Case \d+ / });

    await win.getByRole('button', { name: 'Show prompt' }).click();
    const prompt = await expectFits(page, 'Complete judge prompt');
    await prompt.getByRole('button', { name: 'Close' }).click();

    await win.getByRole('button', { name: 'Second opinion…' }).click();
    const opinion = await expectFits(page, 'Second opinion');
    const scrolls = await opinion.locator('.dialog-body').evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolls, 'the body of the dialog scrolls').toBe(true);
    await expect(opinion.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  });
});
