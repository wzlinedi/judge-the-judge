// Loading a whole evaluation into the session (FR-026, FR-073).
import { readTestProject } from '../../core/io/test-project-file';
import type { TestProject } from '../../core/model';
import { resumePoint } from '../../core/evaluation/resume';
import type { MetricDefinition } from '../../core/metrics/types';
import { forgetFile, type AppState, type StepId } from '../store';
import type { Ports } from '../ports/types';

/** The first step with unfinished work (FR-073). */
export function firstUnfinishedStep(evaluation: TestProject, metric?: Pick<MetricDefinition, 'parameters'>): StepId {
  return resumePoint(evaluation, metric).step;
}

/** "Load demo…": the remembered file is forgotten (FR-076) and the demo opens on the Judge step (T243). */
export function loadExample(state: AppState, evaluationText: string, ports: Ports): AppState {
  const read = readTestProject(evaluationText);
  if (!read.ok) throw new Error('The bundled example could not be read: ' + read.problems.map((p) => p.message).join(' '));
  forgetFile(ports);
  const evaluation = read.value.project;
  return {
    ...state,
    project: evaluation,
    unsaved: false,
    repliesSinceSave: 0,
    testProjectFile: null,
    hasFile: false,
    openCase: null,
    step: 'judge',
  };
}
