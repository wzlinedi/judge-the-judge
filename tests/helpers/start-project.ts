// A new test project for the e2e tests that need a judge and a few clean cases: the Accuracy starter, loaded with
// "Load test project…" from an in-memory file (the app itself no longer offers a starter, T243).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { writeTestProject } from '../../src/core/io/test-project-file';
import type { TestCase } from '../../src/core/model';
import { installMemoryFiles, type MemoryFiles } from './memory-files';

const accuracy = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8'));
const checks = JSON.parse(readFileSync('src/core/metrics/builtin/checks.default.json', 'utf8'));

type MetricFile = { id: string; name: string; description: string; limitations: string; output_format: string; parameters: Record<string, { default: number }>; measures: unknown[]; judge_set: { clean_base_cases: Array<{ name: string; fields: Record<string, string> }> } & Record<string, unknown> };

/** A new test project with the judge, the catalog and the clean cases of a metric file; a metric that is not built in is embedded in it. */
export function starterProject(metric: MetricFile, embed: boolean): string {
  const { clean_base_cases: clean, ...judgeSet } = metric.judge_set;
  const cases: TestCase[] = clean.map((c, i) => ({ id: String(i + 1), name: c.name, fields: c.fields, expected_errors: [] }));
  const { name, description, limitations, output_format, parameters, measures } = metric;
  return writeTestProject(
    {
      judge_set: judgeSet as never,
      dataset: { name: 'Untitled test cases', finalized: false, cases },
      metric: {
        id: metric.id,
        parameters: Object.fromEntries(Object.entries(metric.parameters).map(([k, v]) => [k, v.default])),
        ...(embed ? { definition: { name, description, limitations, output_format, parameters, measures } as never } : {}),
      },
      checks,
    },
    { toolVersion: 'test', testCasesVersion: 'starter' },
  );
}

export const accuracyStarterProject = () => starterProject(accuracy, false);

/** Like startFromAccuracy, for a metric file of examples/metrics. */
export async function startFromMetricFile(page: Page, metric: MetricFile, memory?: MemoryFiles): Promise<MemoryFiles> {
  const files = memory ?? (await installMemoryFiles(page));
  files.files.set('starter.json', starterProject(metric, true));
  return open(page, files);
}

async function open(page: Page, files: MemoryFiles): Promise<MemoryFiles> {
  files.chooseOpenName('starter.json');
  await page.goto('/');
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Load test project…', exact: true }).click();
  return files;
}

/** Opens the page on a new Accuracy project (three clean cases, nothing finalized) and goes to the Test cases step. */
export async function startFromAccuracy(page: Page, memory?: MemoryFiles): Promise<MemoryFiles> {
  const files = memory ?? (await installMemoryFiles(page));
  files.files.set('starter.json', accuracyStarterProject());
  await open(page, files);
  await page.getByRole('button', { name: /2\s*Test cases/ }).click();
  return files;
}
