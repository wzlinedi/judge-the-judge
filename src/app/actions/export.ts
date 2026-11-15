// "Export HTML report" (FR-072): the report of the current work at any time; it says how many cases are not decided yet (T267).
import { testCasesVersion } from '../../core/cases/version';
import { computeResults, reviewEvaluation } from '../../core/evaluation/results';
import { buildHtmlReport } from '../../core/io/html-report';
import { judgeVersion } from '../../core/judge/version';
import type { MetricDefinition } from '../../core/metrics/types';
import { recomputeDifferences, type AppState } from '../store';
import type { FileEnv } from './files';

export interface ReportExport {
  fileName: string;
  html: string;
  message: string;
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';

export async function exportReport(state: AppState, env: FileEnv, metric: MetricDefinition | undefined): Promise<ReportExport> {
  const { project: evaluation } = state;
  const results = computeResults(evaluation, metric as MetricDefinition);
  const html = buildHtmlReport(evaluation, results, reviewEvaluation(evaluation, metric), {
    now: env.now(),
    toolVersion: env.toolVersion,
    judgeVersion: await judgeVersion(evaluation.judge_set),
    testCasesVersion: await testCasesVersion(evaluation.dataset.cases),
  }, recomputeDifferences(state));
  return {
    fileName: `${safeName(evaluation.dataset.name)} - report.html`,
    html,
    message: results.provisional
      ? `The report was exported. ${results.undecided} ${results.undecided === 1 ? 'case is' : 'cases are'} not decided yet, and the report says so.`
      : 'The report was exported.',
  };
}
