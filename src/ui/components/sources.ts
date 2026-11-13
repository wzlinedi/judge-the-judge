import type { EffectiveSource } from '../../core/evaluation/decisions';

export const SOURCE_LABELS: Record<EffectiveSource, string> = {
  automatic: 'Automatic',
  manual: 'Set by you',
  'llm-approved': 'LLM opinion, approved by you',
};
