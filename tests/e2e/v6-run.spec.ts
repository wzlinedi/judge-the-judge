// quickstart.md V6: run every case by hand (User Story 7), with the clipboard of the browser context and the in-memory save file.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject, saveButton, startTestRun, TEST_RUN_STEP } from '../helpers/test-run-flow';

const testProject = readFileSync('examples/demo/test-project.json', 'utf8');
const demo = JSON.parse(testProject) as { dataset: { cases: Array<{ id: string }> }; test_run: { replies: Record<string, { reply: string }> } };
const replyOf = (id: string) => demo.test_run.replies[id]!.reply;
const ids = demo.dataset.cases.map((c) => c.id);

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });
const box = (page: Page) => caseWindow(page).getByRole('textbox', { name: 'Judge reply' });
/** A saved reply is read-only, formatted and marked (T293); "Change reply" opens the box. */
const shown = (page: Page) => caseWindow(page).locator('.reply-read');
const changeReply = (page: Page) => caseWindow(page).locator('.reply-pane').getByRole('button', { name: 'Change reply' }).click();
const saveReply = (page: Page) => caseWindow(page).locator('.reply-pane').getByRole('button', { name: 'Save reply' }).click();
const clip = (page: Page, text: string) => page.evaluate((t) => navigator.clipboard.writeText(t), text);

/** The demo test cases with the test run started and no reply: "Load the test project only", then "Start test run" (T289). */
async function openRunWithoutReplies(page: Page) {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', testProject);
  await page.goto('/');
  await loadTestProject(page, memory, 'books.json', 'only');
  await expect(page.getByRole('button', { name: /2\s*Test cases/ })).toHaveAttribute('aria-current', 'step'); // the test run has not started
  await startTestRun(page);
  await page.getByRole('button', { name: TEST_RUN_STEP }).click();
  await expect(page.getByRole('button', { name: TEST_RUN_STEP })).toHaveAttribute('aria-current', 'step');
  return memory;
}

/** The three actions of one case: Copy prompt, Paste reply, then the next case. */
async function runCase(page: Page, id: string, move: 'click' | 'key' | 'stay') {
  const win = caseWindow(page);
  await win.getByRole('button', { name: 'Copy prompt' }).click();
  await clip(page, replyOf(id));
  await win.getByRole('button', { name: 'Paste reply' }).click();
  await expect(shown(page)).toBeVisible();
  if (move === 'key') await page.keyboard.press('Alt+ArrowRight');
  else if (move === 'click') await win.getByRole('button', { name: 'Next case' }).click();
}

test('T263/T264: the table has four counts, and a case with errors and no reply already lists its expected errors with no marks', async ({ page }) => {
  await openRunWithoutReplies(page);
  const headers = page.getByRole('region', { name: 'Test cases to run' }).getByRole('columnheader');
  await expect(headers).toHaveText(['Id', 'Name', 'Kind', 'Expected errors', 'Additional findings', 'Added by hand', 'Status', 'Items to decide', 'Actions']);
  const row = page.getByRole('row').filter({ hasText: 'Injected errors' }).first();
  const cells = row.getByRole('cell');
  await expect(cells.nth(4)).toHaveText('0');
  await expect(cells.nth(5)).toHaveText('0');
  await expect(cells.nth(7)).toHaveText('0');
  await row.getByRole('button', { name: 'Open' }).click();
  const win = caseWindow(page);
  const list = win.getByRole('list', { name: 'Expected errors' });
  await expect(list.getByRole('listitem').first()).toBeVisible();
  await expect(list.getByRole('button', { name: 'Show the issue' }).first()).toBeVisible();
  await expect(list.getByRole('button', { name: /Found|Missed|Ignored/ })).toHaveCount(0);
  await expect(win).toContainText('The judge’s findings and the marks appear when its reply is saved.');
});

test('the Test run step shows the judge on one line and the model details, and the case window runs a case in three actions', async ({ page }) => {
  await openRunWithoutReplies(page);

  const summary = page.getByRole('region', { name: 'Judge being run' });
  await expect(summary).toContainText(/Judge version [0-9a-f]{12}/);
  await expect(summary).toContainText('Book summaries, set A');
  await expect(summary).toContainText(/Test cases version [0-9a-f]{12}/);
  await expect(summary).toContainText('Judged text summary');
  await expect(summary).not.toContainText('SUMMARY');
  // T242: saving is in the page header only, each button with its file name under it
  await expect(page.getByRole('region', { name: 'Evaluation file' })).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Save evaluation' })).toHaveCount(0); // one save button (T289)
  await expect(saveButton(page)).toBeVisible();
  // "Load the test project only" does not remember the loaded file: the first save asks for a new one (FR-076)
  await expect(page.getByRole('banner').locator('.file-name').filter({ hasText: 'no file yet' })).toBeVisible();
  await expect(next(page)).toContainText('new conversation');

  const details = page.getByLabel('Model details');
  await details.fill('Model X\ntemperature 0');
  await expect(details).toHaveValue('Model X\ntemperature 0');
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await expect(win).toBeVisible();
  const frame = await win.boundingBox();
  expect(frame).toMatchObject({ width: 1280, height: 720 });
  await expect(win).toContainText('1 of 20');
  await expect(win.getByRole('heading', { name: 'Judge reply', exact: true })).toBeVisible();
  await expect(win.getByRole('button', { name: 'Copy prompt' })).toHaveClass(/primary/);
  await expect(box(page)).toBeVisible();

  // case 1: Copy prompt, Paste reply, Next case
  await win.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(win.getByRole('button', { name: 'Paste reply' })).toHaveClass(/primary/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('SUMMARY');
  await clip(page, replyOf('1'));
  await win.getByRole('button', { name: 'Paste reply' }).click();
  await expect(shown(page)).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  await expect(win).toContainText('1 not saved');
  await expect(win).toContainText('Pass');
  await win.getByRole('button', { name: 'Next case' }).click();
  await expect(win).toContainText('2 of 20');

  // case 2 with Alt + Right
  await runCase(page, '2', 'key');
  await expect(win).toContainText('3 of 20');
  await expect(win).toContainText('2 not saved');

  const axe = await new AxeBuilder({ page }).include('.case-window').analyze();
  expect(axe.violations).toEqual([]);

  // the window closes onto the list, which knows both replies
  await win.getByRole('button', { name: 'Close' }).click();
  await expect(next(page)).toContainText('2 of 20 cases decided');
  await expect(page.getByText('2 replies not saved to a file')).toBeVisible();
});

test('changing a saved reply asks first and names the marks set by hand (T261), and an empty or refused clipboard is explained', async ({ page }) => {
  await openRunWithoutReplies(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await runCase(page, '1', 'click');
  await runCase(page, '2', 'stay');
  await win.getByRole('button', { name: 'Previous case' }).click();
  await expect(win).toContainText('1 of 20');

  // changing a saved reply: "Change reply" opens the box, "Save reply" asks first, with no marks to name here; Cancel keeps the saved reply
  await changeReply(page);
  const saved = await box(page).inputValue();
  await box(page).fill(replyOf('3'));
  await expect(page.getByRole('dialog', { name: 'Change the judge’s reply?' })).toHaveCount(0); // typing saves nothing
  await saveReply(page);
  const question = page.getByRole('dialog', { name: 'Change the judge’s reply?' });
  await expect(question).toContainText('the results are counted from it');
  await expect(question).not.toContainText('you set');
  await question.getByRole('button', { name: 'Cancel' }).click();
  await expect(win).toContainText('2 not saved');
  await win.locator('.reply-pane').getByRole('button', { name: 'Cancel' }).click();
  await expect(box(page)).toHaveCount(0);
  await changeReply(page);
  await expect(box(page)).toHaveValue(saved);
  await win.locator('.reply-pane').getByRole('button', { name: 'Cancel' }).click();

  // after Change reply the case is marked again from the changed text, and the read-only view returns
  await changeReply(page);
  await box(page).fill(replyOf('3'));
  await saveReply(page);
  await question.getByRole('button', { name: 'Change reply' }).click();
  await expect(win).toContainText('3 not saved');
  await expect(shown(page)).toBeVisible();

  // it asks again for the next change, and names the mark set by hand; Change reply removes it
  await win.getByRole('button', { name: 'Next case' }).click();
  await win.getByRole('button', { name: 'Previous case' }).click();
  await expect(win).toContainText('1 of 20');
  await page.locator('[data-expected], [data-additional]').first().getByRole('button', { name: 'False positive' }).click();
  await changeReply(page);
  await box(page).fill(replyOf('1'));
  await saveReply(page);
  await expect(question).toContainText('The 1 mark you set');
  await question.getByRole('button', { name: 'Change reply' }).click();
  await expect(win).toContainText('4 not saved');
  await expect(win.locator('[aria-pressed="true"]')).toHaveCount(0);

  // an emptied box removes the reply after asking (T291)
  await changeReply(page);
  await box(page).fill('');
  await saveReply(page);
  const removal = page.getByRole('dialog', { name: 'Remove the judge’s reply?' });
  await expect(removal).toContainText('Not run again');
  await removal.getByRole('button', { name: 'Remove reply' }).click();
  await expect(win).toContainText('Not run');
  await expect(box(page)).toHaveValue('');
  await expect(win).toContainText('4 not saved'); // the count of unsaved replies does not go down

  // an empty clipboard is explained and changes nothing
  await clip(page, '');
  await win.getByRole('button', { name: 'Paste reply' }).click();
  await expect(win).toContainText('The clipboard is empty');
  await expect(win).toContainText('4 not saved');

  // a refused clipboard points to the box
  await page.evaluate(() => {
    navigator.clipboard.readText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await win.getByRole('button', { name: 'Paste reply' }).click();
  await expect(win).toContainText('Paste the reply into the box with Ctrl+V');

  // a reply that is not JSON, pasted into the box of a case without a reply with Ctrl + V
  await win.getByRole('button', { name: 'Next case' }).click();
  await win.getByRole('button', { name: 'Next case' }).click();
  await expect(win).toContainText('3 of 20');
  await box(page).fill('{"claims": [');
  await expect(win).toContainText(/Line 1, column/);
  await expect(win.getByRole('button', { name: 'Save reply' })).toHaveCount(0);
  await box(page).fill('');
  await box(page).focus();
  await page.evaluate(() => navigator.clipboard.writeText('I looked at it and it seems fine to me.'));
  await page.keyboard.press('Control+V');
  await expect(box(page)).toHaveValue('I looked at it and it seems fine to me.');
  await expect(win).toContainText(/This is not JSON/);
  await win.getByRole('button', { name: 'Keep as text' }).click();
  await expect(win).toContainText('5 not saved');
  await expect(shown(page)).toHaveText('I looked at it and it seems fine to me.');
  await expect(win).toContainText('Awaiting verification');
  await expect(win.getByRole('button', { name: 'No more findings' })).toHaveClass(/primary/);
  await expect(win.locator('[aria-pressed="true"]')).toHaveCount(0);
});

test('a reply that was typed and not saved is not lost by moving; and the reminder to save appears at 25 replies', async ({ page }) => {
  await openRunWithoutReplies(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);

  await box(page).fill('half a reply');
  await win.getByRole('button', { name: 'Next case' }).click();
  const question = page.getByRole('dialog', { name: /not saved/ });
  await question.getByRole('button', { name: 'Cancel' }).click();
  await expect(win).toContainText('1 of 20');
  await expect(box(page)).toHaveValue('half a reply');
  await box(page).fill('');

  for (const [i, id] of ids.entries()) await runCase(page, id, i < ids.length - 1 ? 'click' : 'stay');
  // after 20 cases the window is on the last case; replace five replies to reach 25 unsaved ones
  await expect(win).toContainText('20 not saved');
  for (let i = 0; i < 5; i++) {
    await win.getByRole('button', { name: 'Previous case' }).click();
    await changeReply(page);
    await box(page).fill(`{"claims": [], "changed": ${i}}`);
    await saveReply(page);
    await page.getByRole('dialog', { name: 'Change the judge’s reply?' }).getByRole('button', { name: 'Change reply' }).click(); // T261
    if (i < 4) await expect(win.getByRole('alert')).toHaveCount(0);
  }
  await expect(win).toContainText('25 not saved');
  await expect(win.getByRole('alert')).toContainText('25 replies are not saved to a file. Close the window and press Save test project at the top.');
  await expect(win.getByRole('button', { name: /Save test project/ })).toHaveCount(0);

  // the window closes, Save test project at the top clears the count and the reminder
  await win.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('25 replies are not saved to a file.', { exact: false }).first()).toBeVisible();
  await saveButton(page).click();
  await expect(page.getByText('0 replies not saved to a file')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the case window of Test run is one page: the fields, the actions row, then the judge reply and the errors side by side (T230)', async ({ page }) => {
  await openRunWithoutReplies(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await win.getByRole('button', { name: 'Copy prompt' }).click();
  await clip(page, replyOf('1'));
  await win.getByRole('button', { name: 'Paste reply' }).click();
  await expect(shown(page)).toBeVisible();

  const heading = (n: number) => win.locator('.case-part > h3').nth(n - 1);
  await expect(heading(1)).toHaveText('1. Case');
  await expect(heading(2)).toHaveText('2. Marking');
  await expect(heading(3)).toHaveText('3. Verify the judge reply');
  const tops = await Promise.all([1, 2, 3].map(async (n) => (await heading(n).boundingBox())!.y));
  expect(tops[0]!).toBeLessThan(tops[1]!);
  expect(tops[1]!).toBeLessThan(tops[2]!);

  await expect(win.getByText(/Marked \d+ of \d+/)).toBeVisible();
  await expect(win.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  // T235: the prompt is in a dialog with only Close; the left column of part 3 has only the paste button above the box
  await expect(win.getByRole('textbox', { name: 'Complete judge prompt' })).toHaveCount(0);
  await win.getByRole('button', { name: 'Show prompt' }).click();
  const prompt = page.getByRole('dialog', { name: 'Complete judge prompt' });
  await expect(prompt.getByRole('textbox', { name: 'Complete judge prompt' })).toHaveValue(/SUMMARY/);
  await expect(prompt.getByRole('button')).toHaveCount(1);
  await prompt.getByRole('button', { name: 'Close' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(win.getByRole('button', { name: 'Copy prompt' })).toHaveCount(1);
  await expect(win.locator('.reply-pane > .button-row').getByRole('button')).toHaveCount(2); // Change reply and Paste reply (T293)

  // 1280 px: the two columns of part 3 share the row, about half each
  const [left, right] = await Promise.all([win.locator('.case-half > section').nth(0).boundingBox(), win.locator('.case-half > section').nth(1).boundingBox()]);
  expect(Math.abs(left!.y - right!.y)).toBeLessThan(4);
  expect(right!.x).toBeGreaterThan(left!.x + left!.width - 2);
  expect(Math.abs(left!.width - right!.width)).toBeLessThan(8);

  // 360 px: one below the other, and the page does not scroll sideways
  await page.setViewportSize({ width: 360, height: 740 });
  const [a, b] = await Promise.all([win.locator('.case-half > section').nth(0).boundingBox(), win.locator('.case-half > section').nth(1).boundingBox()]);
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 2);
  const body = win.locator('.case-window-body');
  expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

// T453 (code review finding 2; FR-055, FR-056): a readable JSON typed one key at a time is saved when the box loses the focus. Leaving the
// case at that moment (Next case, Close or Escape) waits for that save and does not ask about a reply that is being saved.
for (const leaveBy of ['Next case', 'Close', 'Escape'] as const) {
  test(`T453: a readable JSON typed by hand is saved when the case is left with ${leaveBy}, and nothing asks`, async ({ page }) => {
    await openRunWithoutReplies(page);
    await next(page).getByRole('button', { name: 'Continue' }).click();
    const win = caseWindow(page);
    await expect(win).toBeVisible();
    const id = /^Case (\S+) /.exec((await win.getAttribute('aria-label')) ?? (await win.locator('h2, h1').first().innerText()))?.[1];
    expect(id, 'the id of the open case').toBeTruthy();
    await box(page).click();
    await box(page).pressSequentially('{"claims": []}');
    if (leaveBy === 'Escape') await page.keyboard.press('Escape');
    // the box loses the focus and the button is pressed in one task: the click comes before the save of the blur has ended
    else await win.getByRole('button', { name: leaveBy, exact: true }).evaluate((button) => {
      (document.activeElement as HTMLElement).blur();
      (button as HTMLElement).click();
    });
    await expect(page.getByRole('dialog', { name: 'The reply in the box is not saved' })).toHaveCount(0);
    if (leaveBy === 'Next case') {
      await expect(win).not.toHaveAccessibleName(new RegExp(`^Case ${id} `));
      await win.getByRole('button', { name: 'Previous case', exact: true }).click();
    } else {
      await expect(win).toHaveCount(0);
      await page.getByRole('row').filter({ has: page.getByRole('cell', { name: id!, exact: true }) }).getByRole('button', { name: 'Open' }).click();
    }
    await expect(win).toHaveAccessibleName(new RegExp(`^Case ${id} `));
    await expect(shown(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'The reply in the box is not saved' })).toHaveCount(0);
  });
}

test('T453: text that is not JSON still asks before Next case, and "Discard reply" leaves no reply', async ({ page }) => {
  await openRunWithoutReplies(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await expect(win).toBeVisible();
  await box(page).click();
  await box(page).pressSequentially('half a reply');
  await win.getByRole('button', { name: 'Next case', exact: true }).click();
  const ask = page.getByRole('dialog', { name: 'The reply in the box is not saved' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Discard reply' }).click();
  await expect(ask).toHaveCount(0);
  await win.getByRole('button', { name: 'Previous case', exact: true }).click();
  await expect(box(page)).toHaveValue('');
  await expect(shown(page)).toHaveCount(0);
});
