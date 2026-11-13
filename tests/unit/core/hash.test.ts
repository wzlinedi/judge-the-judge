import { describe, expect, it } from 'vitest';
import { canonicalJson, sha256Short } from '../../../src/core/hash';
import { judgeVersion } from '../../../src/core/judge/version';
import { testCasesVersion } from '../../../src/core/cases/version';
import type { JudgeSet, TestCase } from '../../../src/core/model';

const judge: JudgeSet = {
  prompt: 'Judge {{summary}}',
  judged_text: 'summary',
  sample_reply: '{"claims":[]}',
  reply_mapping: { finding_text: { 'claims[]': 'claims[].text' } },
  error_rules: [{ name: 'r', match: 'any', conditions: [{ field: 'claims[].verdict', comparison: 'equals', value: 'bad' }] }],
  error_catalog: [{ name: 'wrong-number' }],
};

const cases: TestCase[] = [
  { id: '1', name: 'A', fields: { summary: 'one' }, expected_errors: [] },
  { id: '2', name: 'B', base: '1', fields: { summary: 'two' }, expected_errors: [{ id: 'e1', description: 'd' }] },
];

describe('hashing', () => {
  it('gives 12 hexadecimal characters', async () => {
    expect(await sha256Short('abc')).toMatch(/^[0-9a-f]{12}$/);
    expect(await sha256Short('abc')).toBe('ba7816bf8f01');
  });

  it('canonical JSON sorts keys and normalizes line endings', () => {
    expect(canonicalJson({ b: 1, a: { d: 'x\r\ny', c: [2, 1] } })).toBe('{"a":{"c":[2,1],"d":"x\\ny"},"b":1}');
  });
});

describe('judgeVersion', () => {
  it('is stable for identical content, whatever the key order', async () => {
    const reordered: JudgeSet = { error_catalog: judge.error_catalog, error_rules: judge.error_rules, reply_mapping: judge.reply_mapping, prompt: judge.prompt };
    expect(await judgeVersion(judge)).toBe(await judgeVersion(reordered));
  });

  it('changes with the prompt, the finding-text choices and the rules', async () => {
    const v = await judgeVersion(judge);
    expect(await judgeVersion({ ...judge, prompt: judge.prompt + '!' })).not.toBe(v);
    expect(await judgeVersion({ ...judge, reply_mapping: { finding_text: { 'claims[]': 'claims[].reason' } } })).not.toBe(v);
    expect(await judgeVersion({ ...judge, error_rules: [] })).not.toBe(v);
  });

  it('does not change with the sample reply, the catalog or the judged text', async () => {
    const v = await judgeVersion(judge);
    expect(await judgeVersion({ ...judge, sample_reply: 'other' })).toBe(v);
    expect(await judgeVersion({ ...judge, error_catalog: [] })).toBe(v);
    expect(await judgeVersion({ ...judge, judged_text: 'other' })).toBe(v);
  });

  it('treats line endings alike', async () => {
    expect(await judgeVersion({ ...judge, prompt: 'a\r\nb' })).toBe(await judgeVersion({ ...judge, prompt: 'a\nb' }));
  });
});

describe('testCasesVersion', () => {
  it('depends on the cases in order', async () => {
    const v = await testCasesVersion(cases);
    expect(await testCasesVersion([...cases].reverse())).not.toBe(v);
  });

  it('changes with fields, expected errors, names and bases', async () => {
    const v = await testCasesVersion(cases);
    const first = cases[0] as TestCase;
    const second = cases[1] as TestCase;
    expect(await testCasesVersion([{ ...first, fields: { summary: 'changed' } }, second])).not.toBe(v);
    expect(await testCasesVersion([first, { ...second, expected_errors: [] }])).not.toBe(v);
    expect(await testCasesVersion([{ ...first, name: 'Z' }, second])).not.toBe(v);
    expect(await testCasesVersion([first, { ...second, base: undefined }])).not.toBe(v);
  });

  it('is the same on repeat', async () => {
    expect(await testCasesVersion(cases)).toBe(await testCasesVersion(structuredClone(cases)));
  });
});
