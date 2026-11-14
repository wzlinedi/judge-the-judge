// FR-021: the tool warns when replies cannot be read automatically.
import { describe, expect, it } from 'vitest';
import { readabilityWarnings } from '../../../../src/core/judge/readability';
import { accuracyJudgeSet } from '../../../helpers/fixtures';

describe('readabilityWarnings', () => {
  it('has none for a complete judge set', () => {
    expect(readabilityWarnings(accuracyJudgeSet())).toEqual([]);
  });

  it('warns when there is no sample reply', () => {
    const set = { ...accuracyJudgeSet(), sample_reply: undefined };
    expect(readabilityWarnings(set).join(' ')).toMatch(/sample reply/);
  });

  it('warns when the sample reply cannot be read', () => {
    expect(readabilityWarnings({ ...accuracyJudgeSet(), sample_reply: '{ nope' }).join(' ')).toMatch(/sample reply/);
  });

  it('warns when there is no rule', () => {
    expect(readabilityWarnings({ ...accuracyJudgeSet(), error_rules: [] }).join(' ')).toMatch(/no error rule/);
  });

  it('warns about a broken rule and names it', () => {
    const set = accuracyJudgeSet();
    set.error_rules = [{ name: 'Ghost', match: 'all', conditions: [{ field: 'ghost', comparison: 'equals', value: 'x' }] }];
    expect(readabilityWarnings(set).join(' ')).toMatch(/Ghost/);
  });

  it('warns, naming the rule, when a rule about a list has no field that shows where the error is (T232)', () => {
    const set = accuracyJudgeSet();
    set.reply_mapping = { finding_text: {} };
    const rule = set.error_rules[0]!;
    expect(readabilityWarnings(set).join(' ')).toContain(`The rule "${rule.name}" has no field that shows where the error is`);
    set.error_rules = [{ ...rule, finding_text: 'claims[].text' }, ...set.error_rules.slice(1)];
    expect(readabilityWarnings(set).join(' ')).not.toContain(`The rule "${rule.name}" has no field`);
  });

  it('all warnings end with what it means: every case needs verification', () => {
    const w = readabilityWarnings({ ...accuracyJudgeSet(), error_rules: [] });
    expect(w.join(' ')).toMatch(/verification/);
  });
});
