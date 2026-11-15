// The default metric file (FR-019, Constitution VI): Accuracy is an ordinary definition in the registry, with no special place in code.
import { describe, expect, it } from 'vitest';
import { listExamples } from '../../../src/core/metrics/registry';
import { DEFAULT_REGISTRY, metricFor } from '../../../src/app/metrics';
import { composePrompt } from '../../../src/core/judge/compose';
import { findFindings } from '../../../src/core/judge/findings';
import { recognizeFields } from '../../../src/core/judge/fields';
import { findVariables } from '../../../src/core/judge/variables';
import { validateRules } from '../../../src/core/judge/rules';

describe('the default metric file', () => {
  it('starts with Accuracy only (Completeness was removed, T243)', () => {
    expect(listExamples(DEFAULT_REGISTRY).map((m) => m.id)).toEqual(['accuracy']);
  });

  it.each(['accuracy'])('%s: starter prompt, rules and clean cases agree with each other', (id) => {
    const metric = metricFor(id);
    const set = metric.judge_set;
    const variables = findVariables(set.prompt);
    expect(variables).toEqual(['source_text', 'summary']);
    expect(set.judged_text).toBe('summary');
    expect(set.error_catalog.length).toBeGreaterThanOrEqual(5);
    expect(set.clean_base_cases.length).toBeGreaterThanOrEqual(3);
    for (const c of set.clean_base_cases) {
      expect(Object.keys(c.fields)).toEqual(variables);
      expect(c.expected_errors).toEqual([]);
      expect(composePrompt(set.prompt, c).missing).toEqual([]);
    }
    const recognized = recognizeFields(set.sample_reply ?? '');
    if (!recognized.ok) throw new Error('sample reply unreadable');
    expect(validateRules(set.error_rules, recognized).every((v) => v.usable)).toBe(true);
    const found = findFindings(set.sample_reply ?? '', set.error_rules, set.reply_mapping.finding_text, recognized);
    expect(found.readable && found.findings.length).toBe(1);
  });
});
