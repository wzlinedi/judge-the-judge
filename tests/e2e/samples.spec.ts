// The sample test projects of examples/samples/ load with "Load test project…": the judge, the ten test cases and the metric come from the file.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installMemoryFiles } from '../helpers/memory-files';
import { loadTestProject } from '../helpers/test-run-flow';

for (const { file, prompt } of [
  { file: 'completeness-test-project.json', prompt: 'List every important fact of the SOURCE that the SUMMARY leaves out' },
  { file: 'bias-test-project.json', prompt: 'List every sentence that is biased against a group of people' },
]) {
  test(`${file} loads with its judge and ten test cases`, async ({ page }) => {
    const memory = await installMemoryFiles(page);
    memory.files.set(file, readFileSync(`examples/samples/${file}`, 'utf8'));
    await page.goto('/');
    await loadTestProject(page, memory, file);
    await page.getByRole('button', { name: /1\s*Judge/ }).click();
    await expect(page.getByLabel('Judge prompt')).toHaveValue(new RegExp(prompt));
    await page.getByRole('button', { name: /2\s*Test cases/ }).click();
    await expect(page.getByRole('row')).toHaveCount(11); // the header and ten cases
  });
}
