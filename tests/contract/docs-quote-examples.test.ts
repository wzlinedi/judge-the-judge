// Principle VIII: the guide quotes the same files the tests validate, so it cannot drift from them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COUNTER_NAMES } from '../../src/core/metrics/operations';

const guide = readFileSync('docs/how-to-add-a-metric.md', 'utf8');

describe('docs/how-to-add-a-metric.md', () => {
  it.each(['examples/metrics/bias-example.json', 'examples/metrics/bias-verdict-example.json'])('quotes %s word for word', (file) => {
    expect(guide).toContain(readFileSync(file, 'utf8').trimEnd());
  });

  it('lists every counter and both operations, and states what cannot be expressed', () => {
    for (const counter of COUNTER_NAMES) expect(guide).toContain(counter);
    expect(guide).toContain('`ratio`');
    expect(guide).toContain('`complement`');
    expect(guide).toMatch(/graded ratings/);
    expect(guide).toMatch(/per case/);
  });
});
