// "Export HTML report" (FR-072): the report of the current work at any time, also while it is provisional.
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
  provisional: boolean;
  message: string;
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';

export async function exportReport(state: AppState, env: FileEnv, metric: MetricDefinition | undefined): Promise<ReportExport> {
  const { evaluation } = state;
  const results = computeResults(evaluation, metric as MetricDefinition);
  const html = buildHtmlReport(evaluation, results, reviewEvaluation(evaluation, metric), {
    now: env.now(),
    toolVersion: env.toolVersion,
    judgeVersion: await judgeVersion(evaluation.judge_set),
    testCasesVersion: await testCasesVersion(evaluation.dataset.cases),
  }, recomputeDifferences(state));
  const provisional = results.provisional;
  return {
    fileName: `${safeName(evaluation.dataset.name)} - report${provisional ? ' (provisional)' : ''}.html`,
    html,
    provisional,
    message: provisional
      ? `The report was exported. It is marked provisional because ${results.undecided} ${results.undecided === 1 ? 'case is' : 'cases are'} not decided yet.`
      : 'The report was exported.',
  };
}
