import { describe, expect, it } from 'vitest';
import { countingMode } from '../../../../src/core/judge/counting-mode';
import { evaluateCondition, evaluateRule, validateRules } from '../../../../src/core/judge/rules';
import { recognizeFields } from '../../../../src/core/judge/fields';
import type { Condition, ErrorRule } from '../../../../src/core/model';

const c = (comparison: Condition['comparison'], value?: string): Condition => ({ field: 'f', comparison, value });

describe('evaluateCondition', () => {
  it('compares text ignoring letter case and surrounding spaces', () => {
    expect(evaluateCondition(c('equals', 'Contradicted'), '  contradicted ')).toBe('holds');
    expect(evaluateCondition(c('equals', 'a'), 'b')).toBe('fails');
    expect(evaluateCondition(c('not_equals', 'a'), 'b')).toBe('holds');
    expect(evaluateCondition(c('not_equals', 'a'), 'A')).toBe('fails');
  });

  it('matches typed true and false against JSON booleans', () => {
    expect(evaluateCondition(c('equals', 'true'), true)).toBe('holds');
    expect(evaluateCondition(c('equals', 'false'), true)).toBe('fails');
    expect(evaluateCondition(c('equals', 'TRUE'), false)).toBe('fails');
  });

  it('compares two values that read as numbers as numbers', () => {
    expect(evaluateCondition(c('equals', '3'), 3)).toBe('holds');
    expect(evaluateCondition(c('equals', '3.0'), '3')).toBe('holds');
    expect(evaluateCondition(c('greater_than', '2'), 3)).toBe('holds');
    expect(evaluateCondition(c('less_than', '2'), 3)).toBe('fails');
    expect(evaluateCondition(c('greater_than', '10'), '9')).toBe('fails');
  });

  it('is unknown for greater_than and less_than with a non-number', () => {
    expect(evaluateCondition(c('greater_than', '2'), 'high')).toBe('unknown');
    expect(evaluateCondition(c('less_than', 'many'), 3)).toBe('unknown');
  });

  it('is_empty holds for null, empty text and an empty list', () => {
    expect(evaluateCondition(c('is_empty'), null)).toBe('holds');
    expect(evaluateCondition(c('is_empty'), '')).toBe('holds');
    expect(evaluateCondition(c('is_empty'), '  ')).toBe('holds');
    expect(evaluateCondition(c('is_empty'), [])).toBe('holds');
    expect(evaluateCondition(c('is_empty'), 'x')).toBe('fails');
    expect(evaluateCondition(c('is_not_empty'), 'x')).toBe('holds');
    expect(evaluateCondition(c('is_not_empty'), null)).toBe('fails');
  });

  it('is unknown for an absent field', () => {
    for (const comparison of ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'] as const) {
      expect(evaluateCondition(c(comparison, '1'), undefined)).toBe('unknown');
    }
  });
});

describe('evaluateRule', () => {
  const rule = (match: 'all' | 'any'): ErrorRule => ({ name: 'r', match, conditions: [{ field: 'a', comparison: 'equals', value: 'x' }, { field: 'b', comparison: 'equals', value: 'y' }] });
  const run = (match: 'all' | 'any', a: unknown, b: unknown) => evaluateRule(rule(match), (field) => (field === 'a' ? a : b));

  it('any holds when one holds', () => {
    expect(run('any', 'x', 'no').result).toBe('holds');
    expect(run('any', 'no', 'no').result).toBe('fails');
  });

  it('any is unknown when none holds and one is unknown', () => {
    expect(run('any', 'no', undefined).result).toBe('unknown');
    expect(run('any', 'x', undefined).result).toBe('holds');
  });

  it('all fails when one fails', () => {
    expect(run('all', 'x', 'y').result).toBe('holds');
    expect(run('all', 'no', undefined).result).toBe('fails');
  });

  it('all is unknown when none fails and one is unknown', () => {
    expect(run('all', 'x', undefined).result).toBe('unknown');
  });

  it('names the fields that were unknown', () => {
    expect(run('all', 'x', undefined).unknownFields).toEqual(['b']);
  });
});

describe('validateRules', () => {
  const recognized = (() => {
    const r = recognizeFields(JSON.stringify({ overall: { ok: true }, claims: [{ text: 'a', verdict: 'v' }], sections: [{ title: 't', claims: [{ text: 'x' }] }] }));
    if (!r.ok) throw new Error('bad');
    return r;
  })();
  const rule = (...fields: string[]): ErrorRule => ({ name: 'r', match: 'any', conditions: fields.map((field) => ({ field, comparison: 'is_not_empty' as const })) });

  it('accepts a rule over one list, with fields outside any list mixed in', () => {
    expect(validateRules([rule('claims[].verdict', 'overall.ok')], recognized)).toEqual([{ usable: true, list: 'claims[]' }]);
    expect(validateRules([rule('overall.ok')], recognized)).toEqual([{ usable: true, list: undefined }]);
  });

  it('marks a rule broken for a field the sample does not contain, naming it', () => {
    const [v] = validateRules([rule('claims[].missing')], recognized);
    expect(v?.usable).toBe(false);
    expect(v && !v.usable && v.reason).toContain('claims[].missing');
  });

  it('marks a rule broken when it uses two lists, an enclosing list counting as another', () => {
    const [a] = validateRules([rule('claims[].verdict', 'sections[].title')], recognized);
    const [b] = validateRules([rule('sections[].title', 'sections[].claims[].text')], recognized);
    expect(a?.usable).toBe(false);
    expect(b?.usable).toBe(false);
  });

  it('marks a rule with no conditions broken', () => {
    expect(validateRules([{ name: 'r', match: 'all', conditions: [] }], recognized)[0]?.usable).toBe(false);
  });

  it('needs a value except for the two "empty" comparisons', () => {
    const noValue: ErrorRule = { name: 'r', match: 'all', conditions: [{ field: 'overall.ok', comparison: 'equals' }] };
    expect(validateRules([noValue], recognized)[0]?.usable).toBe(false);
  });
});

describe('countingMode', () => {
  const rule = (field: string): ErrorRule => ({ name: 'r', match: 'any', conditions: [{ field, comparison: 'equals', value: 'yes' }] });
  it('is per_case when every rule uses only fields outside any list', () => {
    expect(countingMode([rule('verdict.biased'), rule('overall')])).toBe('per_case');
  });
  it('is per_expected_error with a list field in any rule, or with no rules', () => {
    expect(countingMode([rule('verdict.biased'), rule('claims[].verdict')])).toBe('per_expected_error');
    expect(countingMode([])).toBe('per_expected_error');
    expect(countingMode([{ name: 'r', match: 'any', conditions: [] }])).toBe('per_expected_error');
  });
});
