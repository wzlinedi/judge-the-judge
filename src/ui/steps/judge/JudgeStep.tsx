import type { JudgeEdit } from '../../../app/actions/judge';
import type { AppState } from '../../../app/store';
import { countingModeOf } from '../../../core/judge/counting-mode';
import { readabilityWarnings } from '../../../core/judge/readability';
import { PromptSection } from './PromptSection';
import { RulesSection } from './RulesSection';
import { SampleReplySection } from './SampleReplySection';

export interface JudgeStepProps {
  state: AppState;
  onEdit: (result: JudgeEdit) => void;
}

/** One judge set: prompt, sample reply and rules. No welcome section and no buttons besides the rule ones (FR-088). */
export function JudgeStep({ state, onEdit }: JudgeStepProps) {
  const warnings = readabilityWarnings(state.evaluation.judge_set);
  return (
    <div class="judge-step">
      {warnings.length > 0 ? (
        <section class="notice warn" role="status" aria-label="Readability">
          <ul class="plain-list">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <PromptSection state={state} onEdit={onEdit} />
      <SampleReplySection state={state} onEdit={onEdit} />
      <RulesSection state={state} onEdit={onEdit} />
      {countingModeOf(state.evaluation.judge_set) === 'per_case' ? (
        <p class="notice" role="status" aria-label="Way of counting">
          This judge is evaluated per case: every rule uses only fields outside any list, so it gives one verdict for the whole text. A flagged reply makes every expected error of the case found, and the Summary counts cases.
        </p>
      ) : null}
    </div>
  );
}
