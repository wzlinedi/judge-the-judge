// FR-030: the example file of the import window.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exampleCsv } from '../../../../src/core/io/example-csv';
import { readTestCasesCsv } from '../../../../src/core/io/test-cases-csv';

describe('exampleCsv', () => {
  it('has name and one field: column per variable, two clean cases, and a byte order mark', () => {
    const { text } = exampleCsv(['source_text', 'summary']);
    expect(text.startsWith('﻿')).toBe(true);
    const lines = text.slice(1).trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,field:source_text,field:summary');
    expect(lines).toHaveLength(3);
  });

  it('uses field:field_1 and says so when the prompt has no variable yet', () => {
    const { text, note } = exampleCsv([]);
    expect(text).toContain('field:field_1');
    expect(note).toMatch(/no variables/i);
  });

  it('imports back without problems, as two clean cases', () => {
    const variables = ['source_text', 'summary'];
    const read = readTestCasesCsv(exampleCsv(variables).text.replace(/^﻿/, ''), variables);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.invalid).toEqual([]);
    expect(read.value.drafts).toHaveLength(2);
    expect(read.value.drafts.every((d) => d.draft.expected_errors.length === 0)).toBe(true);
    expect(read.value.unmatchedFields).toEqual([]);
    expect(read.value.missingVariables).toEqual([]);
  });

  it('is the file examples/files/test-cases-example.csv for the variables of the Accuracy metric', () => {
    expect(readFileSync('examples/files/test-cases-example.csv', 'utf8')).toBe(exampleCsv(['source_text', 'summary']).text);
  });
});

// A prompt variable may be a built-in JavaScript name (S1, Constitution IX): a row is checked against its own columns only (T394).
describe('readTestCasesCsv with a variable that is a built-in JavaScript name', () => {
  it.each(['constructor', 'toString', 'hasOwnProperty'])('{{%s}}: a row with no such column is read, and no crash', (name) => {
    const result = readTestCasesCsv('name,field:summary\nA,Anna is a doctor.\n', ['summary', name]);
    expect(result.ok).toBe(true);
  });

  it('{{constructor}}: a row whose column exists and is empty is refused as empty', () => {
    const result = readTestCasesCsv('name,field:summary,field:constructor\nA,Anna is a doctor.,\n', ['summary', 'constructor']);
    expect(result.ok && result.value.invalid.map((r) => r.reason).join(' ')).toContain('The field "constructor" is empty.');
  });
});
