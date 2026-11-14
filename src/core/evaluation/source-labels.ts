// How the source of a decision and the state of an item are worded, in the tool and in the report (FR-064).
import type { EffectiveSource } from './decisions';

export const SOURCE_LABELS: Record<EffectiveSource, string> = {
  automatic: 'Automatic',
  manual: 'Set by hand',
  'llm-approved': 'LLM opinion, approved by the user',
};

export const STATE_LABELS: Record<string, string> = {
  undecided: 'Undecided',
  found: 'Found',
  missed: 'Issue: missed',
  ignored: 'Ignored',
  false_positive: 'Issue: false positive',
  real_error: 'Real error',
};
