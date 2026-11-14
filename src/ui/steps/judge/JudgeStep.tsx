import type { JudgeEdit } from '../../../app/actions/judge';
import type { AppState } from '../../../app/store';
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
    </div>
  );
}
