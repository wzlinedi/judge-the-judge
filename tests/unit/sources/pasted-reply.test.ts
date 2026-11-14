// The adapter that turns one pasted reply into a ReplyBatch (FR-056, contracts/core-api.md, JudgeReplySource).
import { describe, expect, it } from 'vitest';
import { pastedReplySource } from '../../../src/sources/pasted-reply';
import type { JudgeReplySource } from '../../../src/sources/types';

describe('pasted reply source', () => {
  it('implements JudgeReplySource and names itself', () => {
    const source: JudgeReplySource<{ caseId: string; text: string }> = pastedReplySource;
    expect(source.id).toBe('pasted-reply');
    expect(source.label).toBe('Pasted reply');
  });

  it('returns one item for the case with the text exactly as pasted', async () => {
    const batch = await pastedReplySource.collect({ caseId: '3', text: '  {"claims": []}\n' });
    expect(batch).toEqual({ items: [{ case_id: '3', reply: '  {"claims": []}\n' }], problems: [] });
  });

  it('accepts text that is not JSON, because any text is kept', async () => {
    const batch = await pastedReplySource.collect({ caseId: '3', text: 'I looked at it and it seems fine.' });
    expect(batch.items).toHaveLength(1);
    expect(batch.problems).toEqual([]);
  });

  it('refuses an empty reply with a problem and no item', async () => {
    for (const text of ['', '   ', '\n\t\n']) {
      const batch = await pastedReplySource.collect({ caseId: '3', text });
      expect(batch.items).toEqual([]);
      expect(batch.problems).toHaveLength(1);
      expect(batch.problems[0]?.message).toMatch(/empty/i);
    }
  });

  it('accepts a very large reply', async () => {
    const text = 'x'.repeat(2_000_000);
    const batch = await pastedReplySource.collect({ caseId: '1', text });
    expect(batch.items[0]?.reply).toHaveLength(2_000_000);
  });
});
