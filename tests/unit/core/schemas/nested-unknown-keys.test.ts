// "Unknown extra keys are ignored on load and reported once as a note" (contracts/file-formats.md, Common rules; FR-005, T419):
// also keys inside the file, not only at its top level.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readTestProject } from '../../../../src/core/io/test-project-file';
import { readTestCasesJson } from '../../../../src/core/io/test-cases-json';

const demo = JSON.parse(readFileSync('examples/demo/test-project.json', 'utf8'));
const ignored = (notes: readonly string[]) => notes.filter((n) => /ignored/i.test(n));

describe('unknown keys inside a test project file (T419)', () => {
  it('the demo as it is gets no such note', () => {
    const read = readTestProject(JSON.stringify(demo));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(ignored(read.notes)).toEqual([]);
  });

  it('one note names each unknown key with its path, and the file still loads', () => {
    const file = structuredClone(demo);
    file.dataset.cases[0].zzz = 1;
    file.judge_set.yyy = 'x';
    const read = readTestProject(JSON.stringify(file));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    const notes = ignored(read.notes);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('dataset.cases[0].zzz');
    expect(notes[0]).toContain('judge_set.yyy');
  });
});

describe('unknown keys inside a test cases file (T419)', () => {
  it('one note names each unknown key with its path, and the cases are read', () => {
    const text = JSON.stringify({
      format: 'judge-the-judge-test-cases',
      schema_version: 1,
      name: 'x',
      cases: [{ name: 'a', foo: 1, fields: { summary: 's' }, expected_errors: [{ description: 'd', bar: 2 }] }],
    });
    const read = readTestCasesJson(text);
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    expect(read.value.drafts).toHaveLength(1);
    const notes = ignored(read.notes);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('cases[0].foo');
    expect(notes[0]).toContain('cases[0].expected_errors[0].bar');
  });
});

// T456 (code review finding 9; T419): a version 1 file has `dataset.finalized`, which the upgrade drops on purpose and names in its own note.
describe('a version 1 test project file (T456)', () => {
  const v1 = (extra: (file: typeof demo) => void = () => {}) => {
    const file = structuredClone(demo);
    delete file.test_run;
    file.schema_version = 1;
    file.dataset.finalized = true;
    extra(file);
    const read = readTestProject(JSON.stringify(file));
    if (!read.ok) throw new Error(read.problems.map((p) => p.message).join('; '));
    return read.notes;
  };

  it('loads with the upgrade note and does not name dataset.finalized as an ignored key', () => {
    const notes = v1();
    expect(notes.join(' ')).toMatch(/schema version 1/);
    expect(notes.join(' ')).not.toContain('dataset.finalized');
    expect(ignored(notes)).toEqual([]);
  });

  it('still names a key that is really unknown', () => {
    const notes = ignored(v1((file) => (file.dataset.zzz = 1)));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('dataset.zzz');
    expect(notes[0]).not.toContain('dataset.finalized');
  });
});
