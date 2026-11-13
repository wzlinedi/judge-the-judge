// Loading a whole evaluation into the session (FR-026, FR-073).
import { readEvaluation } from '../../core/io/evaluation-file';
import type { Evaluation } from '../../core/model';
import { reviewEvaluation } from '../../core/evaluation/results';
import type { MetricDefinition } from '../../core/metrics/types';
import { forgetBothFiles, type AppState, type StepId } from '../store';
import type { Ports } from '../ports/types';

/** The first step with unfinished work (FR-073): Judge with no prompt, Test cases when not finalized, Run while a case is undecided, else Results. */
export function firstUnfinishedStep(evaluation: Evaluation, metric?: Pick<MetricDefinition, 'parameters'>): StepId {
  if (evaluation.judge_set.prompt.trim() === '') return 'judge';
  if (!evaluation.dataset.finalized) return 'cases';
  const undecided = reviewEvaluation(evaluation, metric).some((r) => r.status === 'not_run' || r.status === 'awaiting');
  return undecided ? 'run' : 'results';
}

/** "Load example…" with the demo: both remembered files are forgotten (FR-076) and the demo opens where work is unfinished. */
export function loadExample(state: AppState, evaluationText: string, ports: Ports, metric?: MetricDefinition): AppState {
  const read = readEvaluation(evaluationText);
  if (!read.ok) throw new Error('The bundled example could not be read: ' + read.problems.map((p) => p.message).join(' '));
  forgetBothFiles(ports);
  const { evaluation } = read.value;
  return {
    ...state,
    evaluation,
    unsaved: false,
    repliesSinceSave: 0,
    testProjectFile: null,
    evaluationFile: null,
    hasFile: false,
    openCase: null,
    step: firstUnfinishedStep(evaluation, metric),
  };
}
