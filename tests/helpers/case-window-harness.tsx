// A stateful stand-in for the page around the case window of Run, so a test can act in the window and read the evaluation.
import { useState } from 'preact/hooks';
import { createState } from '../../src/app/store';
import { reviewEvaluation } from '../../src/core/evaluation/results';
import type { Evaluation } from '../../src/core/model';
import { CaseWindow } from '../../src/ui/windows/case-window/CaseWindow';
import { accuracyMetric } from './fixtures';

export interface HarnessProps {
  start: Evaluation;
  caseId: string;
  onlyAwaiting?: boolean;
  /** Called with the evaluation after every change made in the window. */
  seen?: (evaluation: Evaluation) => void;
}

export function CaseWindowHarness({ start, caseId, onlyAwaiting = false, seen }: HarnessProps) {
  const [evaluation, setEvaluation] = useState(start);
  const [current, setCurrent] = useState(caseId);
  const [only, setOnly] = useState(onlyAwaiting);
  return (
    <CaseWindow
      evaluation={evaluation}
      reviewed={reviewEvaluation(evaluation, accuracyMetric)}
      caseId={current}
      onChange={(next) => {
        setEvaluation(next);
        seen?.(next);
      }}
      onNavigate={setCurrent}
      onClose={() => {}}
      onlyAwaiting={only}
      onOnlyAwaitingChange={setOnly}
      saveBar={{ fileName: null, repliesSinceSave: 0, onSave: () => {}, onSaveAs: () => {} }}
      reply={{ save: async () => ({ state: createState(), status: 'unchanged' }), paste: async () => ({ state: createState(), status: 'unchanged' }) }}
    />
  );
}
