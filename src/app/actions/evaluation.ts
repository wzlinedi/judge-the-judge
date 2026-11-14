// Loading a whole evaluation into the session (FR-026, FR-073).
import { readEvaluation } from '../../core/io/evaluation-file';
import type { Evaluation } from '../../core/model';
import { resumePoint } from '../../core/evaluation/resume';
import type { MetricDefinition } from '../../core/metrics/types';
import { forgetBothFiles, type AppState, type StepId } from '../store';
import type { Ports } from '../ports/types';

/** The first step with unfinished work (FR-073). */
export function firstUnfinishedStep(evaluation: Evaluation, metric?: Pick<MetricDefinition, 'parameters'>): StepId {
  return resumePoint(evaluation, metric).step;
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
