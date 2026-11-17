// R3 (code review 2026-11-16; research.md 14): the sample reply counts in the judge version only through the rules it turns off.
import { describe, expect, it } from 'vitest';
import { judgeVersion, judgeVersionWithoutUnusable } from '../../../../src/core/judge/version';
import type { JudgeSet } from '../../../../src/core/model';

const rules = [{ name: 'Bad', match: 'any' as const, conditions: [{ field: 'claims[].verdict', comparison: 'equals' as const, value: 'bad' }] }];
const set = (sample_reply: string): JudgeSet => ({
  prompt: 'Judge {{summary}}',
  reply_mapping: { finding_text: { 'claims[]': 'claims[].text' } },
  error_rules: rules,
  error_catalog: [],
  sample_reply,
});

describe('judgeVersion and the sample reply', () => {
  it('changes when the sample reply lacks the field of a rule', async () => {
    const works = await judgeVersion(set('{"claims": [{"text": "a", "verdict": "bad"}]}'));
    const broken = await judgeVersion(set('{"claims": [{"text": "a"}]}'));
    expect(broken).not.toBe(works);
  });

  it('does not change when the sample changes only a value, or the text around the JSON', async () => {
    const one = await judgeVersion(set('{"claims": [{"text": "a", "verdict": "bad"}]}'));
    const two = await judgeVersion(set('{"claims": [{"text": "other words", "verdict": "good"}]}'));
    const around = await judgeVersion(set('Here is the answer:\n{"claims": [{"text": "a", "verdict": "bad"}]}'));
    expect(two).toBe(one);
    expect(around).toBe(one);
  });

  it('keeps the version it has today when every rule works, or there is no sample', async () => {
    const works = await judgeVersion(set('{"claims": [{"text": "a", "verdict": "bad"}]}'));
    const without = await judgeVersion({ ...set(''), sample_reply: undefined } as JudgeSet);
    expect(without).toBe(works);
  });
});

// T459 (Clarifications 2026-11-17, finding 8, answer A; FR-075): files saved before R3 stored the version worked out without the list of
// rules turned off; the helper gives that version, so a load can accept it.
describe('judgeVersionWithoutUnusable (T459)', () => {
  it('differs from the version when the sample reply turns a rule off, and equals it otherwise', async () => {
    const broken = set('{"claims": [{"text": "a"}]}');
    const works = set('{"claims": [{"text": "a", "verdict": "bad"}]}');
    expect(await judgeVersionWithoutUnusable(broken)).not.toBe(await judgeVersion(broken));
    expect(await judgeVersionWithoutUnusable(broken)).toBe(await judgeVersion(works));
    expect(await judgeVersionWithoutUnusable(works)).toBe(await judgeVersion(works));
  });
});
