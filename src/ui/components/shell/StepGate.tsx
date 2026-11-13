import type { StepGateInfo } from '../../../app/selectors';
import type { StepId } from '../../../app/store';

/** Shown instead of a step that is not available yet: one sentence and a button that leads to what is needed. */
export function StepGate({ gate, onGo }: { gate: StepGateInfo; onGo: (step: StepId) => void }) {
  return (
    <section class="step-gate" role="region" aria-label="Not available yet">
      <p>{gate.sentence}</p>
      <button type="button" class="primary" onClick={() => onGo(gate.action.go)}>
        {gate.action.label}
      </button>
    </section>
  );
}
