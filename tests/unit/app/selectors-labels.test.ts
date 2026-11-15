// T279 (FR-008): the names of actions are written once, in labels.ts; selectors.ts takes them from there.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { labels } from '../../../src/ui/labels';

describe('selectors.ts', () => {
  const source = readFileSync('src/app/selectors.ts', 'utf8');

  it('writes no action name as a literal', () => {
    const literals = Object.values(labels).filter((value) => source.includes(`'${value}'`));
    expect(literals).toEqual([]);
  });

  it('uses the labels of the "what next" line', () => {
    for (const key of ['nextTestCases', 'goToTestCases', 'nextResults']) expect(source).toContain(`labels.${key}`);
  });
});
