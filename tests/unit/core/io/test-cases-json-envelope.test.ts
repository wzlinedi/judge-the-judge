// "Import test cases…" given a test project file checks its format and schema version as "Load test project…" does
// (contracts/file-formats.md, Common rules; FR-005, FR-027, T415).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTestCasesJson } from '../../../../src/core/io/test-cases-json';
import { readTestProject } from '../../../../src/core/io/test-project-file';

const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8'));

describe('importing test cases from a test project file (T415)', () => {
  it('refuses a newer schema version with the same message as the load', () => {
    const text = JSON.stringify({ ...demo, schema_version: 99 });
    const imported = readTestCasesJson(text);
    const loaded = readTestProject(text);
    expect(imported.ok).toBe(false);
    expect(loaded.ok).toBe(false);
    if (imported.ok || loaded.ok) return;
    expect(imported.problems.map((p) => p.message)).toEqual(loaded.problems.map((p) => p.message));
  });

  it('reads the cases and reports an unknown top-level key once as a note', () => {
    const read = readTestCasesJson(JSON.stringify({ ...demo, zzz_extra: 1 }));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(read.value.drafts.length).toBe(demo.dataset.cases.length);
    expect(read.notes.filter((n) => n.includes('zzz_extra'))).toHaveLength(1);
  });
});
