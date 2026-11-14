// T232: the judge version of a file that has no per-rule field is the one it had before the field existed.
import { describe, expect, it } from 'vitest';
import { judgeVersion } from '../../../../src/core/judge/version';
import type { JudgeSet } from '../../../../src/core/model';

const set = (finding_text?: string): JudgeSet => ({
  prompt: 'Judge {{summary}}',
  reply_mapping: { finding_text: { 'claims[]': 'claims[].text', 'unused[]': 'unused[].text' } },
  error_rules: [{ name: 'Bad', match: 'any', conditions: [{ field: 'claims[].verdict', comparison: 'equals', value: 'bad' }], ...(finding_text !== undefined ? { finding_text } : {}) }],
  error_catalog: [],
});

describe('judgeVersion and the field of a rule', () => {
  it('is pinned for a set with no per-rule field, also with a mapping entry for a list that has no rule', async () => {
    expect(await judgeVersion(set())).toBe('2340a43f94d4');
  });

  it('changes when a rule gets its own field, and back when it is removed', async () => {
    const before = await judgeVersion(set());
    const after = await judgeVersion(set('claims[].reason'));
    expect(after).not.toBe(before);
    expect(await judgeVersion(set())).toBe(before);
  });
});
