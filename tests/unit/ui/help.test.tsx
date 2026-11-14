import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { HelpStep } from '../../../src/ui/help/HelpStep';

const expected = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8'));

describe('Help (Principle VIII)', () => {
  it('has the sections written so far, in plain headings', () => {
    render(<HelpStep />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['What the tool does', 'How big a test needs to be', 'The four steps', 'Variables and the judged text', 'Sample reply, fields and error rules', 'Adding test cases', 'Importing test cases from a file', 'Error categories', 'Working by hand: copy, run, paste', 'Pasting replies from the clipboard, and replacing a reply', 'Marking after each reply: Add finding, Remove, the second opinion and Ignore', 'Files: the test project and the evaluation', 'Privacy and saving', 'Examples and demo data', 'Metrics and check settings', 'Reading the results']);
  });

  it('quotes the numbers of the demo from the demo files, so they cannot drift', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    const c = expected.after_deciding.counters;
    expect(text).toContain(`${c.expected_found} of ${c.expected_total}`);
    expect(text).toContain(`${expected.awaiting_verification.length} cases`);
    expect(text).toMatch(/20 test cases/);
  });

  it('states the fixed minimum test size', () => {
    render(<HelpStep />);
    expect(document.body.textContent).toMatch(/at least 30 injected errors and 10 clean cases/);
  });

  it('names the buttons as they are labeled in the tool', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Load example…', 'Continue', 'Approve', 'Issue: missed', 'Issue: false positive', 'Real error']) expect(text).toContain(label);
  });

  it('explains the two files, the indicator, "… as" and running the same test with another LLM', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Save test project', 'Save evaluation', 'Save evaluation as', 'Load test project', 'Load evaluation', 'All changes saved', 'Unsaved changes']) expect(text).toContain(label);
    expect(text).toMatch(/another LLM/);
    expect(text).toMatch(/replies are kept only by/i);
  });

  it('explains privacy and saving: Chrome and Edge, the permission prompt, nothing leaves the browser, save often', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Chrome or Edge/);
    expect(text).toMatch(/permission/i);
    expect(text).toMatch(/never sent/i);
    expect(text).toMatch(/save often/i);
  });

  it('explains variables, the judged text and the limit on a literal double brace', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('{{name}}');
    expect(text).toMatch(/judged text/i);
    expect(text).toMatch(/last variable/i);
    expect(text).toMatch(/literal.*\{\{/i);
  });

  it('explains the sample reply, the finding text and rules, with Add rule and Add condition', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Add rule', 'Add condition', 'claims[].verdict']) expect(text).toContain(label);
    expect(text).toMatch(/never proposes a rule|does not propose a rule/i);
    expect(text).toMatch(/broken/i);
    expect(text).toMatch(/code fence/i);
  });

  it('explains the two kinds of case, Paste JSON, Clean case, the case JSON layout and the row buttons', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Add test case', 'Paste JSON', 'Clean case', 'Show JSON', 'Clone', 'Rename', 'Remove', 'Open']) expect(text).toContain(label);
    expect(text).toMatch(/clean case/i);
    expect(text).toMatch(/case with injected errors/i);
    expect(text).toContain('expected_errors');
    expect(text).toContain('fragment');
  });

  it('explains the catalog (one place, no file of its own) and how to add a metric', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/no file of its own/);
    expect(text).toContain('Add category');
    expect(text).toContain('Load metric definition…');
    expect(text).toContain('docs/how-to-add-a-metric.md');
    expect(text).toMatch(/graded ratings/);
    expect(text).toMatch(/30 expected errors and 10 clean cases/);
  });
});

describe('Help: importing test cases', () => {
  it('quotes the example files the tests validate, word for word', () => {
    render(<HelpStep />);
    const shown = Array.from(document.querySelectorAll('pre.example')).map((p) => p.textContent);
    expect(shown).toContain(readFileSync('examples/files/test-cases-example.csv', 'utf8').replace(/^﻿/, '').trimEnd());
    expect(shown).toContain(readFileSync('examples/files/test-cases-example.json', 'utf8').trimEnd());
  });
});

describe('Help for running by hand (US7)', () => {
  it('names the buttons, the new conversation, the model details and the reminder at 25 replies', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Copy prompt', 'Paste reply from clipboard', 'Save reply', 'Model details', 'Next test case', 'Save evaluation']) expect(text).toContain(label);
    expect(text).toMatch(/new conversation/);
    expect(text).toMatch(/every 25|25 replies/);
    expect(text).toMatch(/Alt \+ Right/);
  });

  it('explains what happens to a reply that is not JSON and when replacing a reply asks', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/not JSON/);
    expect(text).toMatch(/Approve/);
    expect(text).toMatch(/asks before replacing/i);
    expect(text).toMatch(/Ctrl \+ V/);
  });

  it('quotes the sample reply of the Accuracy metric, the file the tests validate', () => {
    render(<HelpStep />);
    const sample = JSON.parse(readFileSync('src/core/metrics/builtin/accuracy.json', 'utf8')).judge_set.sample_reply as string;
    const pre = [...document.querySelectorAll('pre.example')].map((p) => p.textContent ?? '');
    const compact = (t: string) => {
      try {
        return JSON.stringify(JSON.parse(t));
      } catch {
        return undefined;
      }
    };
    expect(pre.map(compact)).toContain(compact(sample));
  });
});

describe('Help for marking after each reply (US8)', () => {
  it('names the buttons and what each one does', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Add finding', 'Remove', 'Second opinion…', 'Apply opinion', 'Ignore', 'Note', 'Approve', 'Issue: false positive', 'Real error']) expect(text).toContain(label);
    expect(text).toMatch(/replaces a mark set by hand/);
    expect(text).toMatch(/classifies none/);
    expect(text).toMatch(/one case at a time/);
  });

  it('quotes an opinion from the demo files, so the example cannot drift', () => {
    render(<HelpStep />);
    const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, { opinion: unknown }>;
    const pre = [...document.querySelectorAll('pre.example')].map((p) => p.textContent ?? '');
    const compact = (t: string) => {
      try {
        return JSON.stringify(JSON.parse(t));
      } catch {
        return undefined;
      }
    };
    expect(pre.map(compact)).toContain(JSON.stringify(opinions['17']));
  });
});
