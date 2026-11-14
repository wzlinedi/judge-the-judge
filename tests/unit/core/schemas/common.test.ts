import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checkEnvelope } from '../../../../src/core/schemas/common';
import { zodProblems } from '../../../../src/core/schemas/messages';

const support = { format: 'judge-the-judge-test-project', schemaVersion: 1, knownKeys: ['format', 'schema_version', 'tool_version', 'judge_set'] };

describe('checkEnvelope', () => {
  it('accepts a known format and version', () => {
    const result = checkEnvelope({ format: support.format, schema_version: 1 }, support);
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown format and names what was found and what is supported', () => {
    const result = checkEnvelope({ format: 'something-else', schema_version: 1 }, support);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems.map((p) => p.message).join(' ');
      expect(text).toContain('something-else');
      expect(text).toContain(support.format);
    }
  });

  it('rejects a newer schema version and says which versions are read', () => {
    const result = checkEnvelope({ format: support.format, schema_version: 2 }, support);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = result.problems[0]?.message ?? '';
      expect(text).toContain('2');
      expect(text).toContain('1');
    }
  });

  it('rejects a file with no format', () => {
    const result = checkEnvelope({ schema_version: 1 }, support);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]?.message).toMatch(/format/);
  });

  it('rejects something that is not an object', () => {
    expect(checkEnvelope([1, 2], support).ok).toBe(false);
    expect(checkEnvelope('text', support).ok).toBe(false);
    expect(checkEnvelope(null, support).ok).toBe(false);
  });

  it('accepts unknown extra keys and reports them once as a note', () => {
    const result = checkEnvelope({ format: support.format, schema_version: 1, extra_a: 1, extra_b: 2 }, support);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toContain('extra_a');
      expect(result.notes[0]).toContain('extra_b');
    }
  });
});

describe('zodProblems', () => {
  const schema = z.object({
    name: z.string().min(1),
    count: z.number(),
    fields: z.object({ summary: z.string() }),
    items: z.array(z.object({ description: z.string() })),
    difficulty: z.enum(['obvious', 'subtle']).optional(),
  });

  it('names the place and what to fix, in plain sentences', () => {
    const input = { name: '', count: 'x', fields: {}, items: [{ description: 3 }], difficulty: 'hard' };
    const parsed = schema.safeParse(input);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const problems = zodProblems(parsed.error, input);
    const byPath = Object.fromEntries(problems.map((p) => [p.path, p.message]));
    expect(byPath['name']).toMatch(/empty/);
    expect(byPath['count']).toMatch(/number/);
    expect(byPath['fields.summary']).toMatch(/missing/);
    expect(byPath['items[0].description']).toMatch(/text/);
    expect(byPath['difficulty']).toMatch(/obvious/);
    for (const p of problems) {
      expect(p.message).not.toMatch(/Invalid input/);
      expect(p.message).toContain(p.path ?? '');
    }
  });
  it('writes a limit with a thousands separator, as the rest of the tool does', () => {
    const parsed = z.object({ text: z.string().max(100_000) }).safeParse({ text: 'x'.repeat(100_001) });
    if (parsed.success) throw new Error('expected a failure');
    expect(zodProblems(parsed.error, {})[0]?.message).toBe('text is too long: at most 100,000 characters.');
  });
});
