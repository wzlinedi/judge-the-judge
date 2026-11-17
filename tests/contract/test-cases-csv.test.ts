// file-formats.md, section 4: the shortened CSV (FR-027, FR-028 to FR-032, FR-037, SC-016, SC-017).
import { describe, expect, it } from 'vitest';
import { readTestCasesCsv } from '../../src/core/io/test-cases-csv';

const vars = ['source_text', 'summary'];
const read = (text: string) => {
  const r = readTestCasesCsv(text, vars);
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join(' | '));
  return r.value;
};
const problems = (text: string) => {
  const r = readTestCasesCsv(text, vars);
  return r.ok ? [] : r.problems.map((p) => p.message);
};

describe('the shortened CSV', () => {
  it('turns every row into a clean case, with name and one field per column', () => {
    const v = read('name,field:source_text,field:summary\nAnna,Source A,Summary A\nBert,Source B,Summary B\n');
    expect(v.drafts.map((d) => d.draft.name)).toEqual(['Anna', 'Bert']);
    expect(v.drafts[0]!.draft.fields).toEqual({ source_text: 'Source A', summary: 'Summary A' });
    expect(v.drafts.every((d) => d.draft.expected_errors.length === 0 && d.draft.id === undefined && d.draft.base === undefined)).toBe(true);
    expect(v.invalid).toEqual([]);
  });

  it('matches header names without regard to case, except the variable names after field:', () => {
    const v = read('NAME,Field:source_text,FIELD:summary\nAnna,A,B\n');
    expect(v.drafts[0]!.draft.name).toBe('Anna');
    expect(v.drafts[0]!.draft.fields).toEqual({ source_text: 'A', summary: 'B' });
    const other = read('name,field:Summary,field:source_text\nAnna,A,B\n');
    expect(other.unmatchedFields).toEqual(['Summary']);
    expect(other.missingVariables).toEqual(['summary']);
  });

  it('reads commas, quotes, line breaks and Polish characters inside cells, with any line ending', () => {
    const text = 'name,field:source_text,field:summary\r\n"Zażółć, ""gęślą""","Line one\nline two","Jaźń"\r\n';
    const v = read(text);
    expect(v.drafts[0]!.draft).toMatchObject({ name: 'Zażółć, "gęślą"', fields: { source_text: 'Line one\nline two', summary: 'Jaźń' } });
    expect(read(text.replace(/\r\n/g, '\r')).drafts).toHaveLength(1);
  });

  it('reads a semicolon-separated file, as spreadsheets in some countries write it', () => {
    const v = read('name;field:source_text;field:summary\nAnna;A;B\n');
    expect(v.drafts[0]!.draft.fields).toEqual({ source_text: 'A', summary: 'B' });
  });

  it('ignores any other column and names it', () => {
    const v = read('name,id,expected_errors,field:source_text,field:summary\nAnna,7,x,A,B\n');
    expect(v.ignoredColumns).toEqual(['id', 'expected_errors']);
    expect(v.drafts[0]!.draft.id).toBeUndefined();
  });

  it('lists an invalid row with its row number (the header is row 1) and the reason, and keeps the others', () => {
    const v = read('name,field:source_text,field:summary\nAnna,A,B\nBert,,\nCarl,"' + 'x'.repeat(100_001) + '",B\nDora,D,E\n');
    expect(v.drafts.map((d) => d.position)).toEqual([2, 5]);
    expect(v.invalid.map((r) => r.position)).toEqual([3, 4]);
    expect(v.invalid[0]!.reason).toMatch(/no text/i);
    expect(v.invalid[1]!.reason).toMatch(/100,000/);
  });

  it('a row with a missing text for a variable is invalid and names the variable', () => {
    const v = read('name,field:source_text,field:summary\nAnna,A,\n');
    expect(v.drafts).toHaveLength(0);
    expect(v.invalid[0]!.reason).toMatch(/summary/);
  });

  it('reports a column that matches no variable and a variable with no column', () => {
    const v = read('name,field:source_text,field:extra\nAnna,A,B\n');
    expect(v.unmatchedFields).toEqual(['extra']);
    expect(v.missingVariables).toEqual(['summary']);
    expect(v.drafts[0]!.draft.fields).toEqual({ source_text: 'A', extra: 'B' });
  });

  it('a name column is optional', () => {
    const v = read('field:source_text,field:summary\nA,B\n');
    expect(v.drafts[0]!.draft.name).toBe('');
  });

  it('an empty file, a header only and a file without a field: column are problems that say so', () => {
    expect(problems('')[0]).toMatch(/empty/i);
    expect(problems('name,field:source_text,field:summary\n')[0]).toMatch(/no rows|no case/i);
    expect(problems('name,text\nAnna,A\n')[0]).toMatch(/field:/);
  });

  it('a file with one case is fine', () => {
    expect(read('name,field:source_text,field:summary\nOnly,A,B').drafts).toHaveLength(1);
  });

  it('skips empty lines', () => {
    expect(read('name,field:source_text,field:summary\n\nAnna,A,B\n\n\n').drafts.map((d) => d.position)).toEqual([3]);
  });

  it('names a quote that is not doubled once per row, with the fix, and not Papa Parse\'s own line repeated', () => {
    const found = problems('name,field:source_text,field:summary\nAnna,"He said "hi" there","S"\nBert,"Say "no" now","S"\nCara,ok,fine\n');
    expect(found).toHaveLength(2);
    expect(found[0]).toMatch(/^Row 2 \(Anna\):/);
    expect(found[1]).toMatch(/^Row 3 \(Bert\):/);
    for (const line of found) {
      expect(line).toMatch(/quote/i);
      expect(line).toContain('""');
      expect(line).not.toMatch(/Trailing quote on quoted field is malformed/);
    }
  });
  it('names one quote problem with the right row, not a second line with a row that does not exist (T424)', () => {
    const found = problems('name,field:a\n"bad "quote" here,x\n');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^Row 2\b/);
    expect(found.join(' ')).not.toMatch(/Quoted field unterminated|Row 3/);
  });

  it('names a quote that is never closed with its row and the fix, not the reader\'s own words (T424)', () => {
    const found = problems('name,field:a\nok,y\n"unterminated,x\nmore,z\n');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^Row 3\b/);
    expect(found[0]).toMatch(/quote/i);
    expect(found[0]).not.toMatch(/Quoted field unterminated/);
  });
});
