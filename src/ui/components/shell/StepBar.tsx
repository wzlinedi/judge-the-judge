import { useEffect, useRef } from 'preact/hooks';
import { STEPS } from '../../../app/selectors';
import type { StepId } from '../../../app/store';

/** The four numbered steps. Help is in the top bar of the header (T246). On a narrow screen the bar scrolls sideways and keeps the current step in view (FR-092). */
export function StepBar({ current, onGo }: { current: StepId; onGo: (step: StepId) => void }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = bar.current?.querySelector<HTMLElement>('.step.current');
    element?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [current]);
  return (
    <nav class="step-bar" aria-label="Steps" ref={bar}>
      {STEPS.map((step) => (
        <button
          key={step.id}
          type="button"
          class={`step${current === step.id ? ' current' : ''}`}
          aria-current={current === step.id ? 'step' : undefined}
          onClick={() => onGo(step.id)}
        >
          <span class="step-number">{step.number}</span>
          <span class="step-name">{step.name}</span>
        </button>
      ))}
    </nav>
  );
}
