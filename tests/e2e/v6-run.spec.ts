// quickstart.md V6: run every case by hand (User Story 7), with the clipboard of the browser context and the in-memory save file.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';

const demo = JSON.parse(readFileSync('examples/demo/evaluation.json', 'utf8')) as { dataset: { cases: Array<{ id: string }> }; replies: Record<string, { reply: string }> };
const testProject = readFileSync('examples/demo/test-project.json', 'utf8');
const replyOf = (id: string) => demo.replies[id]!.reply;
const ids = demo.dataset.cases.map((c) => c.id);

const next = (page: Page) => page.getByRole('region', { name: 'What next' });
const caseWindow = (page: Page) => page.getByRole('dialog', { name: /^Case \d+ / });
const box = (page: Page) => caseWindow(page).getByRole('textbox', { name: 'Judge reply' });
const clip = (page: Page, text: string) => page.evaluate((t) => navigator.clipboard.writeText(t), text);

async function openRunWithoutReplies(page: Page) {
  const memory = await installMemoryFiles(page);
  memory.files.set('books.json', testProject);
  memory.chooseOpenName('books.json');
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Load test project' }).click();
  await expect(page.getByRole('button', { name: /3\s*Run/ })).toHaveAttribute('aria-current', 'step');
  return memory;
}

/** The three actions of one case: Copy prompt, Paste reply from clipboard, then the next case. */
async function runCase(page: Page, id: string, move: 'click' | 'key' | 'stay') {
  const win = caseWindow(page);
  await win.getByRole('button', { name: 'Copy prompt' }).click();
  await clip(page, replyOf(id));
  await win.getByRole('button', { name: 'Paste reply from clipboard' }).click();
  await expect(box(page)).toHaveValue(replyOf(id));
  if (move === 'key') await page.keyboard.press('Alt+ArrowRight');
  else if (move === 'click') await win.getByRole('button', { name: 'Next test case' }).click();
}

test('the Run step shows the judge on one line, the model details and the evaluation file, and the case window runs a case in three actions', async ({ page }) => {
  await openRunWithoutReplies(page);

  const summary = page.getByRole('region', { name: 'Judge being run' });
  await expect(summary).toContainText(/Judge version [0-9a-f]{12}/);
  await expect(summary).toContainText('Book summaries, set A');
  await expect(summary).toContainText(/Test cases version [0-9a-f]{12}/);
  await expect(summary).toContainText('Judged text summary');
  await expect(summary).not.toContainText('SUMMARY');
  await expect(page.getByRole('region', { name: 'Evaluation file' }).getByRole('button', { name: 'Save evaluation as' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: /Save evaluation/ })).toHaveCount(0);
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
  await expect(win.getByRole('heading', { name: 'Judge’s reply' })).toBeVisible();
  await expect(win.getByRole('button', { name: 'Copy prompt' })).toHaveClass(/primary/);
  await expect(box(page)).toBeVisible();

  // case 1: Copy prompt, Paste reply from clipboard, Next test case
  await win.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(win.getByRole('button', { name: 'Paste reply from clipboard' })).toHaveClass(/primary/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('SUMMARY');
  await clip(page, replyOf('1'));
  await win.getByRole('button', { name: 'Paste reply from clipboard' }).click();
  await expect(box(page)).toHaveValue(replyOf('1'));
  await expect(win).toContainText('1 not saved');
  await expect(win).toContainText('Pass');
  await win.getByRole('button', { name: 'Next test case' }).click();
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

test('replacing a reply asks only when decisions were set by hand, and an empty or refused clipboard is explained', async ({ page }) => {
  await openRunWithoutReplies(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);
  await runCase(page, '1', 'click');
  await runCase(page, '2', 'stay');
  await win.getByRole('button', { name: 'Previous test case' }).click();
  await expect(win).toContainText('1 of 20');

  // a case with only automatic decisions: the reply is replaced without a question
  await box(page).fill(replyOf('3'));
  await win.getByRole('button', { name: 'Save reply' }).click();
  await expect(win).toContainText('3 not saved');
  await expect(page.getByRole('dialog', { name: /Replace this reply/ })).toHaveCount(0);

  // a decision by hand: the second replacement asks and names it
  await page.locator('[data-expected], [data-additional]').first().getByRole('button').first().click();
  await box(page).fill(replyOf('1'));
  await win.getByRole('button', { name: 'Save reply' }).click();
  const question = page.getByRole('dialog', { name: /Replace this reply/ });
  await expect(question).toContainText('1 decision');
  await question.getByRole('button', { name: 'Replace reply' }).click();
  await expect(win).toContainText('4 not saved');
  await expect(win.locator('[aria-pressed="true"]')).toHaveCount(0);

  // an empty clipboard is explained and changes nothing
  await clip(page, '');
  await win.getByRole('button', { name: 'Paste reply from clipboard' }).click();
  await expect(win).toContainText('The clipboard is empty');
  await expect(win).toContainText('4 not saved');

  // a refused clipboard points to the box
  await page.evaluate(() => {
    navigator.clipboard.readText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await win.getByRole('button', { name: 'Paste reply from clipboard' }).click();
  await expect(win).toContainText('Paste the reply into the box with Ctrl+V');

  // a reply that is not JSON, pasted into the box with Ctrl + V
  await box(page).fill('{"claims": [');
  await expect(win).toContainText(/Line 1, column/);
  await box(page).fill('');
  await box(page).focus();
  await page.evaluate(() => navigator.clipboard.writeText('I looked at it and it seems fine to me.'));
  await page.keyboard.press('Control+V');
  await expect(box(page)).toHaveValue('I looked at it and it seems fine to me.');
  await win.getByRole('button', { name: 'Save reply' }).click();
  await expect(win).toContainText('5 not saved');
  await expect(win).toContainText('Awaiting verification');
  await expect(win.getByRole('button', { name: 'Approve' })).toHaveClass(/primary/);
  await expect(win.locator('[aria-pressed="true"]')).toHaveCount(0);
});

test('a reply that was typed and not saved is not lost by moving; and the reminder to save appears at 25 replies', async ({ page }) => {
  await openRunWithoutReplies(page);
  await next(page).getByRole('button', { name: 'Continue' }).click();
  const win = caseWindow(page);

  await box(page).fill('half a reply');
  await win.getByRole('button', { name: 'Next test case' }).click();
  const question = page.getByRole('dialog', { name: /not saved/ });
  await question.getByRole('button', { name: 'Cancel' }).click();
  await expect(win).toContainText('1 of 20');
  await expect(box(page)).toHaveValue('half a reply');
  await box(page).fill('');

  for (const [i, id] of ids.entries()) await runCase(page, id, i < ids.length - 1 ? 'click' : 'stay');
  // after 20 cases the window is on the last case; replace five replies to reach 25 unsaved ones
  await expect(win).toContainText('20 not saved');
  for (let i = 0; i < 5; i++) {
    await win.getByRole('button', { name: 'Previous test case' }).click();
    await box(page).fill(`changed reply ${i}`);
    await win.getByRole('button', { name: 'Save reply' }).click();
    if (i < 4) await expect(win.getByRole('alert')).toHaveCount(0);
  }
  await expect(win).toContainText('25 not saved');
  await expect(win.getByRole('alert')).toContainText('Save evaluation');

  // Save evaluation clears the count and the reminder
  await win.getByRole('button', { name: 'Save evaluation', exact: true }).click();
  await expect(win).toContainText('0 not saved');
  await expect(win.getByRole('alert')).toHaveCount(0);
});
