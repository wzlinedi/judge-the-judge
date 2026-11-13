import { describe, expect, it } from 'vitest';
import { labels } from '../../../src/ui/labels';

const required = [
  'Load test project', 'Save test project', 'Save test project as', 'Save evaluation', 'Save evaluation as',
  'Save evaluation first', 'Discard', 'Import test cases', 'Export test cases', 'Load example…',
  'Load metric definition…', 'Edit test cases', 'Continue', 'Explain', 'File', 'Add test case', 'Paste JSON',
  'Clean case', 'Case with injected errors', 'Approve and close', 'Save case', 'Close without saving', 'Open',
  'Clone', 'Rename', 'Show JSON', 'Copy JSON', 'Show in text', 'Correct expected errors',
  'Paste reply from clipboard', 'Save reply', 'Add finding', 'Second opinion…', 'Apply opinion', 'Approve',
  // the rest of FR-008
  'Load evaluation', 'Start new evaluation', 'Add rule', 'Add condition', 'Remove', 'Add category',
  'Finalize test cases', 'Download example file', 'Next', 'Copy prompt', 'Add error', 'Previous test case',
  'Next test case', 'Found', 'Issue: missed', 'Issue: false positive', 'Real error', 'Ignore', 'Cancel',
  'Summary', 'Error analysis', 'Test case list', 'Export HTML report', 'Load check settings',
  'Edit the judge and run again', 'Help',
];

const forbidden = [
  'Save judge set', 'Load judge set', 'Save test set', 'Load demo data', 'Read sample reply', 'Modify',
  'More actions', 'Read LLM answer', 'Read LLM opinion', 'Paste LLM opinion from clipboard',
  'Copy verification prompt', 'Use selected text as fragment', 'Describe errors again', 'Compare with base',
  'Export JSON', 'Approve all proposals',
];

const values = Object.values(labels);

describe('labels (FR-008)', () => {
  it.each(required)('has "%s" exactly once', (label) => {
    expect(values.filter((v) => v === label)).toHaveLength(1);
  });

  it('shares no label between two keys', () => {
    expect(new Set(values).size).toBe(values.length);
  });

  it('names removal "Remove" everywhere', () => {
    expect(labels.remove).toBe('Remove');
    expect(values.filter((v) => /^(Delete|Discard case|Drop)\b/i.test(v) && v !== 'Discard')).toEqual([]);
  });

  it.each(forbidden)('does not offer "%s"', (label) => {
    expect(values).not.toContain(label);
  });

  it('names no Verify, Compare or shelf action', () => {
    for (const value of values) expect(value).not.toMatch(/\b(verify|compare|shelf)\b/i);
  });
});
