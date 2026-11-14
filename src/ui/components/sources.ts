import type { EffectiveSource } from '../../core/evaluation/decisions';

export const SOURCE_LABELS: Record<EffectiveSource, string> = {
  automatic: 'Automatic',
  manual: 'Set by hand',
  'llm-approved': 'LLM opinion, approved by the user',
};
