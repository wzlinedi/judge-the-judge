import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STEPS } from '../../../src/app/selectors';
import { labels } from '../../../src/ui/labels';

const required = [
  'Load test project…', 'Save test project', 'Save test project as…', 'Save test project first', 'Discard', 'Import test cases…', 'Export test cases…', 'Load demo…',
  'Continue', 'Explain', 'More', 'Add test case…', 'From JSON',
  'Clean case', 'Case with errors', 'Save case', 'Close without saving', 'Open',
  'Rename', 'Rebuild prompt', 'Add category', 'Show the issue', 'Edit expected errors',
  'Paste reply', 'Save reply', 'Add finding…', 'Second opinion…', 'Apply opinion', 'No more findings',
  // the rest of FR-008
  'New test project', 'Add rule', 'Add condition', 'Remove',
  'Start test run', 'Download example file', 'Copy prompt', 'Add error', 'Previous case',
  'Next case', 'Found', 'Not found', 'False positive', 'Genuine error', 'Ignored', 'Cancel',
  'Summary', 'Error analysis', 'Test case list', 'Export HTML report…',
  'Help',
];

const forbidden = [
  'Save judge set', 'Load judge set', 'Save test set', 'Load demo data', 'Read sample reply', 'Modify',
  'More actions', 'Read LLM answer', 'Read LLM opinion', 'Paste LLM opinion from clipboard',
  'Copy verification prompt', 'Use selected text as fragment', 'Describe errors again', 'Compare with base',
  'Export JSON', 'Approve all proposals', 'Recreate the test case', 'Copy and recreate',
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

// T304 (f): the words of the old two-file flow are gone from the labels and the components.
// Not scanned: src/ui/help (its words are checked in help.test.tsx).
describe('no word of the old flow (T304 f)', () => {
  const banned = /evaluation file|Run again with a new judge|Reopen test cases|Finalize|Edit test cases|Save evaluation|Load evaluation|New evaluation|Open on Run/i;

  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'help' ? [] : sourceFiles(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });

  it('the labels outside the legacy keys use none of them', () => {
    for (const [key, value] of Object.entries(labels)) expect(value, key).not.toMatch(banned);
  });

  it('no file under src/ui (outside help) or src/app shows them in a string', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles('src/ui'), ...sourceFiles('src/app')]) {
      if (file.endsWith('src/ui/labels.ts')) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/?\*|\/\/|import )/.test(line)) return; // comments and import paths are not shown to anyone
        const code = line.replace(/\/\/.*$/, '');
        if (/['"`]/.test(code) && banned.test(code)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('has no label that only the Help used: the keys of the old two-file flow and of the old windows are gone (T225, T269)', () => {
    const gone = ['loadMetricDefinition', 'startNewEvaluation', 'loadEvaluation', 'saveEvaluation', 'saveEvaluationAs', 'saveEvaluationFirst', 'next', 'back', 'addCategory', 'clone', 'finalizeTestCases', 'editTestCases', 'editJudgeAndRunAgain', 'showJson', 'approve', 'loadCheckSettings'];
    expect(Object.keys(labels).filter((key) => gone.includes(key))).toEqual([]);
  });

  it('names the step "Test run" and the new menu item "New test project"', () => {
    expect(labels.startNewTestProject).toBe('New test project');
    expect(STEPS.map((s) => s.name)).toEqual(['Judge', 'Test cases', 'Test run', 'Results']);
  });
});
