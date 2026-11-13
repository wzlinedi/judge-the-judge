import { STEPS } from '../../../app/selectors';
import type { StepId } from '../../../app/store';
import { labels } from '../../labels';

export function StepBar({ current, onGo }: { current: StepId; onGo: (step: StepId) => void }) {
  return (
    <nav class="step-bar" aria-label="Steps">
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
      <button
        type="button"
        class={`step help${current === 'help' ? ' current' : ''}`}
        aria-current={current === 'help' ? 'step' : undefined}
        onClick={() => onGo('help')}
      >
        {labels.help}
      </button>
    </nav>
  );
}
