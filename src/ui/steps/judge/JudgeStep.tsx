import type { JudgeEdit } from '../../../app/actions/judge';
import type { AppState } from '../../../app/store';
import { countingModeOf } from '../../../core/judge/counting-mode';
import { readabilityWarnings } from '../../../core/judge/readability';
import { useId } from 'preact/hooks';
import { PromptSection } from './PromptSection';
import { RulePreview } from './RulePreview';
import { RulesSection } from './RulesSection';
import { SampleReplySection } from './SampleReplySection';
import { Eyebrow, EYEBROWS } from '../../components/Eyebrow';

export interface JudgeStepProps {
  state: AppState;
  onEdit: (result: JudgeEdit) => void;
  /** "Load test project…" beside the lock notice, once the test run has started. */
  onLoad?: () => void;
}

/** One judge set: prompt, sample reply and rules, with the preview of the findings beside the rules (T323). No welcome section and no buttons besides the rule ones (FR-088). */
export function JudgeStep({ state, onEdit, onLoad }: JudgeStepProps) {
  const id = useId();
  const warnings = readabilityWarnings(state.project.judge_set);
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
      <PromptSection state={state} onEdit={onEdit} onLoad={onLoad} />
      <SampleReplySection state={state} onEdit={onEdit} />
      <div class="judge-work-area">
        <RulesSection state={state} onEdit={onEdit} />
        <section class="card judge-preview" aria-labelledby={`${id}-preview`}>
          <Eyebrow text={EYEBROWS.livePreview} />
          <h2 id={`${id}-preview`}>Preview</h2>
          <RulePreview set={state.project.judge_set} />
        </section>
      </div>
      {countingModeOf(state.project.judge_set) === 'per_case' ? (
        <p class="notice" role="status" aria-label="Way of counting">
          This judge is evaluated per case: every rule uses only fields outside any list, so it gives one verdict for the whole text. A flagged reply makes every expected error of the case found, and the Summary counts cases.
        </p>
      ) : null}
    </div>
  );
}
