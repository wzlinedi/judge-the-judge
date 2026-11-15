// Where to continue after a load (FR-073).
import type { TestProject } from '../model';
import { isStarted } from '../cases/test-run';
import type { MetricDefinition } from '../metrics/types';
import { reviewEvaluation } from './results';

export type ResumeStep = 'judge' | 'cases' | 'run' | 'results';

export interface ResumePoint {
  step: ResumeStep;
  /** On Run: the case **Continue** opens, the first awaiting verification, else the first not run. */
  caseId?: string;
  decided: number;
  total: number;
}

/** The first step with unfinished work: Judge with no prompt, Test cases while the test run has not started, Run while a case is undecided, else Results. */
export function resumePoint(evaluation: TestProject, metric?: Pick<MetricDefinition, 'parameters'>): ResumePoint {
  const reviewed = reviewEvaluation(evaluation, metric);
  const decided = reviewed.filter((r) => r.status === 'pass' || r.status === 'fail').length;
  const counts = { decided, total: reviewed.length };
  if (evaluation.judge_set.prompt.trim() === '') return { step: 'judge', ...counts };
  if (!isStarted(evaluation)) return { step: 'cases', ...counts };
  const next = (reviewed.find((r) => r.status === 'awaiting') ?? reviewed.find((r) => r.status === 'not_run'))?.testCase.id;
  if (next !== undefined) return { step: 'run', caseId: next, ...counts };
  return { step: 'results', ...counts };
}
