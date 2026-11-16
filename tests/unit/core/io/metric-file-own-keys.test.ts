// A prompt variable may be a built-in JavaScript name (S1, Constitution IX): a clean case without that field is reported, not read from the prototype (T392).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMetric } from '../../../../src/core/io/metric-file';

const example = JSON.parse(readFileSync('examples/metrics/bias-example.json', 'utf8'));

function withVariable(name: string) {
  const file = structuredClone(example);
  const set = file.judge_set;
  set.prompt = `${set.prompt}\n{{${name}}}`;
  return JSON.stringify(file);
}

describe('a metric file whose prompt has a variable that is a built-in JavaScript name', () => {
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])('{{%s}}: a clean case with no such field is reported, and the reader does not crash', (name) => {
    const result = readMetric(withVariable(name));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((p) => p.message.includes(`no text for the variable "${name}"`))).toBe(true);
  });

  it('{{constructor}}: a clean case that has the field is accepted', () => {
    const file = JSON.parse(withVariable('constructor'));
    for (const c of file.judge_set.clean_base_cases) Object.defineProperty(c.fields, 'constructor', { value: 'Some text.', enumerable: true, writable: true, configurable: true });
    const result = readMetric(JSON.stringify(file));
    expect(result.ok).toBe(true);
  });
});
