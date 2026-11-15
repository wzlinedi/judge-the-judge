// The steps of the one-file flow that the e2e tests repeat (quickstart V5, V9 to V11; contracts/ui-flow.md, Shell and Step 2).
import { expect, type Page } from '@playwright/test';
import type { MemoryFiles } from './memory-files';

/** The progress bar button of the third step, named "Run" before T289. */
export const TEST_RUN_STEP = /3\s*Test run/;

export const whatNext = (page: Page) => page.getByRole('region', { name: 'What next' });

/** The confirmation of "Start test run": the summary, and the sentence that the prompt and the judged text are fixed. */
export const startDialog = (page: Page) => page.getByRole('dialog', { name: 'Start the test run?' });

/** The question that follows the pick of a file that holds a test run. */
export const loadQuestion = (page: Page) => page.getByRole('dialog', { name: 'Load test project' });

export const LOAD_WITH_TEST_RUN = 'Load with the test run';
export const LOAD_PROJECT_ONLY = 'Load the test project only';

/** "Start test run" in the "what next" line of Test cases, then its confirmation. */
export async function startTestRun(page: Page): Promise<void> {
  await whatNext(page).getByRole('button', { name: 'Start test run' }).click();
  await startDialog(page).getByRole('button', { name: 'Start test run' }).click();
  await expect(startDialog(page)).toHaveCount(0);
}

/**
 * More, then "Load test project…" on the file the next picker returns. A file with a test run asks the load question first;
 * `answer` says how it is answered, and 'none' leaves the question open (or there is none, for a file with no test run).
 */
export async function loadTestProject(page: Page, memory: MemoryFiles, name: string, answer: 'with' | 'only' | 'none' = 'none'): Promise<void> {
  memory.chooseOpenName(name);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load test project…' }).click();
  if (answer === 'none') return;
  await loadQuestion(page).getByRole('button', { name: answer === 'with' ? LOAD_WITH_TEST_RUN : LOAD_PROJECT_ONLY }).click();
  await expect(loadQuestion(page)).toHaveCount(0);
}

/** The one save button of the header. */
export const saveButton = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Save test project', exact: true });
