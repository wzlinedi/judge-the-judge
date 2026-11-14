import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/preact';
import { HelpStep } from '../../../src/ui/help/HelpStep';

const expected = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8'));

describe('Help (Principle VIII)', () => {
  it('has the sections written so far, in plain headings', () => {
    render(<HelpStep />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['What the tool does', 'How big a test needs to be', 'The four steps', 'Variables and the judged text', 'Sample reply, fields and error rules', 'Adding test cases', 'Importing test cases from a file', 'Error categories', 'Finalizing, and editing before the first reply', 'Working by hand: copy, run, paste', 'Pasting replies from the clipboard, and replacing a reply', 'Marking after each reply: Add finding, Remove, the second opinion and Ignore', 'Files: the test project and the evaluation', 'Files and their formats', 'Privacy and saving', 'Examples and demo data', 'Metrics and check settings', 'Reading the results', 'Judges that give only a verdict (for example bias: yes or no)', 'Overall result and thresholds', 'Exporting the report, and what provisional means']);
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
    for (const label of ['Load demo…', 'Continue', 'Approve', 'Issue: missed', 'Issue: false positive', 'Real error']) expect(text).toContain(label);
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

  it('explains the two kinds of case, From JSON, Clean case, the case JSON layout and the row buttons', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Add test case', 'From JSON', 'Clean case', 'Show JSON', 'Clone', 'Rename', 'Remove', 'Open']) expect(text).toContain(label);
    expect(text).toMatch(/clean case/i);
    expect(text).toMatch(/case with injected errors/i);
    expect(text).toContain('expected_errors');
    expect(text).toContain('fragment');
  });

  it('explains the catalog (one place, no file of its own) and how to add a metric', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/no file of its own/);
    expect(text).toContain('Add categories');
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
    for (const label of ['Copy prompt', 'Paste reply', 'Save reply', 'Model details', 'Next case', 'Save evaluation']) expect(text).toContain(label);
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

describe('Help for finalizing (US11)', () => {
  it('names the buttons, what is fixed and what can still change, and when Reopen test cases is offered', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Finalizing, and editing before the first reply' }).closest('section')!;
    const text = section.textContent ?? '';
    for (const label of ['Finalize test cases', 'Reopen test cases', 'Add test case', 'New evaluation', 'Edit expected errors', 'Run again with a new judge…']) expect(text).toContain(label);
    expect(text).toMatch(/10 cases imported from a file and 2 cases you add by hand make one test project of 12 cases/);
    expect(text).toMatch(/30 injected errors and 10 clean cases/);
    expect(text).toMatch(/After the first reply it is no longer offered/);
    expect(text).toMatch(/warns you before the page is closed/);
  });
});

describe('Help for testing another version of the judge (US12)', () => {
  it('explains Run again with a new judge… and the same test with another LLM, in the files section', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Files: the test project and the evaluation' }).closest('section')!;
    const text = (section.textContent ?? '').replace(/\s+/g, ' ');
    expect(within(section).getByText('Testing another version of the judge.')).toBeTruthy();
    expect(within(section).getByText('Running the same test with another LLM.')).toBeTruthy();
    for (const label of ['Run again with a new judge…', 'Save evaluation first', 'Discard', 'Cancel', 'Load test project', 'Save evaluation as']) expect(text).toContain(label);
    expect(text).toMatch(/replies and decisions are cleared/);
    expect(text).toMatch(/test cases are kept/);
    expect(text).toMatch(/ask for a file again/);
    expect(text).toMatch(/same judge version and the same test cases version/);
  });
});

describe('Help for reproducing and auditing a result (US13)', () => {
  it('explains the recomputation on load, what is compared and what is shown when it differs', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Files: the test project and the evaluation' }).closest('section')!;
    const text = (section.textContent ?? '').replace(/\s+/g, ' ');
    expect(within(section).getByText('Reproducing and auditing a result.')).toBeTruthy();
    expect(text).toMatch(/recalculates the numbers/);
    expect(text).toMatch(/judge version and the test cases version/);
    expect(text).toMatch(/shows the recomputed numbers/);
    expect(text).toMatch(/corrected after the replies were received/);
    expect(text).toMatch(/added or whose expected errors were corrected after the first reply/);
  });
});

describe('Help for browsing a large test project (US15)', () => {
  it('explains the search, the filters, the sorting and the count, and that nothing is changed', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Adding test cases' }).closest('section')!;
    const text = (section.textContent ?? '').replace(/\s+/g, ' ');
    expect(within(section).getByText('Searching, filtering and sorting.')).toBeTruthy();
    for (const label of ['Kind', 'Reply', 'With warnings', 'Clear search and filters', 'Id, Name, Kind or Expected errors']) expect(text).toContain(label);
    expect(text).toMatch(/name and in the texts of every field/);
    expect(text).toMatch(/how many cases are shown out of all of them/);
    expect(text).toMatch(/third returns to the order of the test project/);
    expect(text).toMatch(/Nothing here changes a case/);
  });
});

describe('Help for marking after each reply (US8)', () => {
  it('names the buttons and what each one does', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Add finding…', 'Remove', 'Second opinion…', 'Apply opinion', 'Ignore', 'Note', 'Approve', 'Issue: false positive', 'Real error']) expect(text).toContain(label);
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

describe('Help for the Results step (US9)', () => {
  it('explains the overall result, the thresholds in Details and Load check settings', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Details', 'Load check settings', 'Works', 'Does not work', 'Inconclusive', 'borderline', '95% interval']) expect(text).toContain(label);
    expect(text).toMatch(/at least 80%/);
    expect(text).toMatch(/at most 10%/);
    expect(text).toMatch(/minimum test size is fixed/i);
  });

  it('explains the three views, the read-only case view and what the report holds, and that files contain your data', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Export HTML report', 'Error analysis', 'Test case list', 'Open on Run', 'provisional', 'counts only']) expect(text).toContain(label);
    expect(text).toMatch(/contain your data/i);
    expect(text).toMatch(/print/i);
  });

  it('quotes the example of check settings from examples/metrics', () => {
    render(<HelpStep />);
    const example = JSON.stringify(JSON.parse(readFileSync('examples/metrics/checks-example.json', 'utf8')));
    const pre = [...document.querySelectorAll('pre.example')].map((p) => {
      try {
        return JSON.stringify(JSON.parse(p.textContent ?? ''));
      } catch {
        return undefined;
      }
    });
    expect(pre).toContain(example);
  });
});

describe('Help for judges that give only a verdict (US14 part 2)', () => {
  it('explains per-case counting with the worked example and what is not covered', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/evaluated per case/);
    expect(text).toMatch(/30 biased texts, 27 flagged: 90%/);
    expect(text).toMatch(/10 neutral texts, 1 flagged: 10%/);
    for (const label of ['Case detection rate', 'Clean-case false-positive rate']) expect(text).toContain(label);
    expect(text).toMatch(/graded answers/);
    expect(text).toMatch(/number the judge returns/);
  });

  it('quotes the verdict example, so the example cannot drift', () => {
    render(<HelpStep />);
    const set = JSON.parse(readFileSync('examples/metrics/bias-verdict-example.json', 'utf8')).judge_set;
    const compact = (t: string) => {
      try {
        return JSON.stringify(JSON.parse(t));
      } catch {
        return undefined;
      }
    };
    expect([...document.querySelectorAll('pre.example')].map((p) => compact(p.textContent ?? ''))).toContain(compact(set.sample_reply));
  });
});

describe('Help is complete before the first release (T195, FR-006, contracts/ui-flow.md Help)', () => {
  const help = () => {
    render(<HelpStep />);
    return document.body.textContent ?? '';
  };

  it('names every part of the workflow that FR-006 lists', () => {
    const text = help();
    const names = [
      // adding and correcting test cases
      'From JSON', 'Clean case', 'Case with errors', 'Show JSON', 'Clone', 'Edit expected errors', 'Reopen test cases', 'Finalize test cases',
      // loading
      'Import test cases', 'Load check settings', 'Load example', 'Load metric definition',
      // marks of Run, the second opinion
      'Found', 'Issue: missed', 'Issue: false positive', 'Real error', 'Ignore', 'Add finding…', 'Second opinion', 'Apply opinion',
      // the two files, Continue, per case
      'Save test project', 'Save evaluation', 'Load test project', 'Load evaluation', 'Continue', 'evaluated per case',
      // results
      'Summary', 'Error analysis', 'provisional', 'Inconclusive', 'thresholds',
    ];
    expect(names.filter((name) => !text.includes(name))).toEqual([]);
  });

  it('says that the tool works in Chrome and Edge, and that the files it writes hold the user’s data', () => {
    const text = help();
    expect(text).toMatch(/Chrome or Edge/);
    expect(text).toMatch(/files you save and the report you export contain your data/i);
    expect(text).toMatch(/judge prompt, test cases and replies/i);
  });

  it('carries the limitation of the interval (research.md section 7) where the interval is explained and where the test size is', () => {
    const text = help();
    const sections = [...document.querySelectorAll('section')].map((s) => s.textContent ?? '');
    const sizeAndResults = sections.filter((s) => /95% interval/.test(s));
    expect(sizeAndResults.length).toBeGreaterThanOrEqual(2);
    for (const section of sizeAndResults) expect(section).toMatch(/not fully independent|optimistic/i);
    expect(text).toMatch(/two or three errors per case/i);
  });

  it('lists every file format of docs/schemas with its format name, the JSON Schema and the example file', () => {
    const text = help();
    const schemas = readdirSync('docs/schemas').filter((f) => f.endsWith('.schema.json'));
    expect(schemas.length).toBe(6);
    for (const file of schemas) {
      const schema = JSON.parse(readFileSync(`docs/schemas/${file}`, 'utf8')) as { properties: { format?: { const: string } } };
      expect(text, `${file} is not described in Help`).toContain(file);
      if (schema.properties.format) expect(text, `the format of ${file}`).toContain(schema.properties.format.const);
    }
    expect(text).toMatch(/CSV/);
    expect(text).toContain('docs/schemas');
  });

  it('shows that a file with an unknown format, a newer schema_version or extra keys is handled the way the readers do', () => {
    const text = help();
    expect(text).toMatch(/schema_version/);
    expect(text).toMatch(/newer/i);
    expect(text).toMatch(/keys the tool does not use/i);
  });

  it('tells the keyboard user how to move in and out of a window', () => {
    expect(help()).toMatch(/Escape closes the window/);
  });

  it('names the browsers the tool supports in plain words and what happens in another browser', () => {
    const text = help();
    expect(text).toMatch(/Chrome/);
    expect(text).toMatch(/Edge/);
    expect(text).toMatch(/other browsers the tool shows a notice/i);
  });
});
