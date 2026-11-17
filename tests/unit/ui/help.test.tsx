import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/preact';
import { HelpStep } from '../../../src/ui/help/HelpStep';

const expected = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8'));

describe('Help (Principle VIII)', () => {
  it('has the sections written so far, in plain headings', () => {
    render(<HelpStep />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['What the tool does', 'How big a test needs to be', 'The four steps', 'Variables and the judged text', 'Sample reply, fields and error rules', 'Adding test cases', 'Importing test cases from a file', 'Error categories', 'Starting the test run', 'Working by hand: copy, run, paste', 'Pasting replies from the clipboard, and replacing a reply', 'Marking after each reply: Add finding, Remove, the second opinion and Ignored', 'Files: the test project', 'Files and their formats', 'Privacy and saving', 'Examples and demo data', 'Metrics and check rules', 'Reading the results', 'Judges that give only a verdict (for example bias: yes or no)', 'Overall result and thresholds', 'Exporting the report']);
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
    for (const label of ['Load demo…', 'Continue', 'No more findings', 'Not found', 'False positive', 'Genuine error']) expect(text).toContain(label);
  });

  it('explains the one file, the indicator, "… as" and running the same test with another LLM', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Save test project', 'Save test project as', 'Load test project', 'Load with the test run', 'Load the test project only', 'All changes saved', 'Unsaved changes']) expect(text).toContain(label);
    expect(text).toMatch(/another LLM/);
    expect(text).toMatch(/one file of your own: the test project/);
    expect(text).toMatch(/also holds the test run: the replies, your decisions and the model details/);
    expect(text).toMatch(/name of the test project/); // the header shows it (FR-007, T320)
    expect(text).toMatch(/All changes saved<?[^.]*with the file name/);
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
    for (const label of ['Add test case', 'From JSON', 'Clean case', 'Rename', 'Remove', 'Open']) expect(text).toContain(label);
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
    expect(text).toContain('Load test project…'); // the metric of your own comes in the test project file
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
    for (const label of ['Copy prompt', 'Paste reply', 'Save reply', 'Change reply', 'Keep as text', 'Model details', 'Next case', 'Save test project']) expect(text).toContain(label);
    expect(text).toMatch(/new conversation/);
    expect(text).toMatch(/every 25|25 replies/);
    expect(text).toMatch(/Alt \+ Right/);
  });

  it('explains what happens to a reply that is not JSON and when replacing a reply asks', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/not JSON/);
    expect(text).toContain('No more findings');
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

describe('Help for starting the test run (US11, T285)', () => {
  it('names the button, what is fixed with no way back, what can still change, and how to test another judge', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Starting the test run' }).closest('section')!;
    const text = section.textContent ?? '';
    for (const label of ['Start test run', 'Add test case', 'Edit expected errors', 'Load the test project only']) expect(text).toContain(label);
    expect(text).toMatch(/10 cases imported from a file and 2 cases you add by hand make one test project of 12 cases/);
    expect(text).toMatch(/30 injected errors and 10 clean cases/);
    expect(text).toMatch(/no way back/);
    expect(text).toMatch(/warns you before the page is closed/);
  });
});

describe('Help for testing another version of the judge (US12)', () => {
  it('explains "Load the test project only" and the same test with another LLM, in the files section', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Files: the test project' }).closest('section')!;
    const text = (section.textContent ?? '').replace(/\s+/g, ' ');
    expect(within(section).getByText('Testing another version of the judge.')).toBeTruthy();
    expect(within(section).getByText('Running the same test with another LLM.')).toBeTruthy();
    for (const label of ['Load the test project only', 'Save test project first', 'Discard', 'Cancel', 'Load test project', 'Save test project as']) expect(text).toContain(label);
    expect(text).toMatch(/replies and decisions are left out/);
    expect(text).toMatch(/test cases stay exactly as they were/);
    expect(text).toMatch(/asks for a file/);
    expect(text).toMatch(/same judge version and the same test cases version/);
  });
});

describe('Help for replacing work (T343)', () => {
  it('names the question "Replace the current work?" and the three actions that ask it', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Files: the test project' }).closest('section')!;
    const text = (section.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Replace the current work?');
    for (const label of ['Load demo…', 'Load test project…', 'New test project']) expect(text).toContain(label);
    expect(text).toMatch(/An empty project asks nothing/);
  });
});

describe('Help for reproducing and auditing a result (US13)', () => {
  it('explains the recomputation on load, what is compared and what is shown when it differs', () => {
    render(<HelpStep />);
    const section = screen.getByRole('heading', { name: 'Files: the test project' }).closest('section')!;
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
    for (const label of ['Add finding…', 'Remove', 'Second opinion…', 'Apply opinion', 'Ignored', 'Not found', 'False positive', 'Genuine error', 'No more findings']) expect(text).toContain(label);
    expect(text).toMatch(/until you point at another/); // the mark of a finding in Judge reply (T341, FR-055)
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
  it('explains the overall result and the thresholds in Details', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Details', 'Works', 'Does not work', 'Inconclusive', 'borderline', '95% interval']) expect(text).toContain(label);
    expect(text).toMatch(/at least 80%/);
    expect(text).toMatch(/at most 10%/);
    expect(text).toMatch(/minimum test size is fixed/i);
  });

  it('explains the three views, the read-only case view and what the report holds, and that files contain your data', () => {
    render(<HelpStep />);
    const text = document.body.textContent ?? '';
    for (const label of ['Export HTML report', 'Error analysis', 'Test case list', 'Open on Test run', 'not decided yet']) expect(text).toContain(label);
    expect(text).toMatch(/detection rate of every group/);
    expect(text).toMatch(/contain your data/i);
    expect(text).toMatch(/print/i);
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
      'From JSON', 'Clean case', 'Case with errors', 'Edit expected errors', 'Start test run',
      // loading
      'Import test cases', 'Load demo…',
      // marks of Test run, the second opinion
      'Found', 'Not found', 'False positive', 'Genuine error', 'Ignored', 'Add finding…', 'Second opinion', 'Apply opinion',
      // the one file, Continue, per case
      'Save test project', 'Load test project', 'Continue', 'evaluated per case',
      // results
      'Summary', 'Error analysis', 'Inconclusive', 'thresholds',
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
    expect(schemas.length).toBe(4);
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

// T225, T269, T341: the Help follows the tool as it is now.
describe('Help follows the tool (T225, T269, T341)', () => {
  const help = () => {
    render(<HelpStep />);
    return document.body.textContent ?? '';
  };
  const sectionHeadings = () => [...document.querySelectorAll('section[aria-labelledby] > h3[id]')] as HTMLElement[];

  it('starts with a list of its sections, and each entry links to the heading of one section, in order (T225)', () => {
    render(<HelpStep />);
    const nav = screen.getByRole('navigation', { name: 'Help sections' });
    const links = within(nav).getAllByRole('link');
    const headings = sectionHeadings();
    expect(links.length).toBe(headings.length);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(headings.map((h) => `#${h.id}`));
    expect(links.map((l) => l.textContent)).toEqual(headings.map((h) => h.textContent));
    expect(nav.compareDocumentPosition(headings[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // the list is above the first section
  });

  it('shows no name of the old flow, of removed buttons or of the old look (T225, T269, T341)', () => {
    const text = help();
    const stale = [
      'Save evaluation', 'Load evaluation', 'New evaluation', 'evaluation file', 'Finalize', 'Reopen test cases', 'Run again with a new judge',
      'Load check settings', 'check settings', 'check configuration', 'checks-example', 'judge-the-judge-checks', 'Load metric definition',
      'Approve', 'provisional', 'Provisional', 'Show JSON', 'Clone', 'File menu', 'Issue: missed', 'Issue: false positive', 'Real error',
      'Add categories', 'Open on Run', 'Judge’s reply', 'finalized',
    ];
    expect(stale.filter((word) => text.includes(word))).toEqual([]);
    expect(text).not.toMatch(/\bRun\b/); // the step is "Test run"
    expect(text).not.toMatch(/Part \d of \d/); // the window of a case is one page
    expect(text).not.toMatch(/\bNote\b/); // the per-case Note button is gone (T231)
  });

  it('names the check rules, not a check file: the thresholds are in Details and saved with the test project (T269)', () => {
    const text = help();
    expect(text).toMatch(/check rules/);
    expect(text).toMatch(/saved with the test project/);
    expect(text).not.toMatch(/judge-the-judge-checks/);
  });

  it('says that the field of an error rule is chosen in each rule, not once under the sample reply (T232)', () => {
    expect(help()).toMatch(/Where the error is/);
  });

  it('names the parts of the case window of Test run as they are, and the mark of a finding in Judge reply (T341, FR-055)', () => {
    const text = help();
    for (const label of ['Verify the judge reply', 'Show the issue']) expect(text).toContain(label);
    expect(text).toMatch(/whole JSON object/);
    expect(text).toMatch(/until you point at another/);
  });

  it('says that the demo opens on Judge (T243)', () => {
    expect(help()).toMatch(/opens on the Judge step/);
  });
});

// Phase 36 (T467-T469): the Help follows what Phases 25-35 changed on the normal path of a user (demo scope).
describe('Help follows Phases 25-35 (T467-T469)', () => {
  const help = () => {
    render(<HelpStep />);
    return (document.body.textContent ?? '').replace(/\s+/g, ' ');
  };

  it('Working by hand: the limit of a reply, "case N of M" and the wait for the save of a paste (T467)', () => {
    const text = help();
    expect(text).toContain('200,000 characters');
    expect(text).toContain('the tool keeps replies up to 200,000 characters');
    expect(text).toMatch(/case \d+ of \d+/);
    expect(text).toMatch(/Next case, Previous case and Close wait for the save of a reply you just pasted/);
  });

  it('Marking: when a finding matches an expected error clearly or partly (T468, research.md 10)', () => {
    const text = help();
    expect(text).toContain('When a finding matches an expected error');
    expect(text).toMatch(/as whole words/);
    expect(text).toContain('(matches E2)');
    expect(text).toContain('(partly matches E2)');
    expect(text).toMatch(/Paris/);
  });

  it('Marking: Not found turns a clearly matching finding into an additional finding, and a missing field marks nothing (T468)', () => {
    const text = help();
    expect(text).toMatch(/marked Not found.{0,80}clearly matched it.{0,80}additional finding/);
    expect(text).toMatch(/field a rule needs is missing.{0,80}nothing is marked automatically/);
  });

  it('Marking: the preview of the second opinion names a finding that only partly matches an undecided error (T468, T454)', () => {
    expect(help()).toMatch(/second opinion.{0,900}partly matches an undecided/);
  });

  it('Files: the limits of a file and of a reply, and a save without results (T469)', () => {
    const text = help();
    expect(text).toMatch(/larger than 50 MB.{0,80}not saved/);
    expect(text).toMatch(/longer than 200,000 characters.{0,120}test_run\.replies\./);
    expect(text).toContain('without its results');
  });
});

// Phase 37 (T472-T476): the five sections left out in Phase 36 follow what Phases 25-35 changed (demo scope, final Help).
describe('Help, the final version (T472-T476)', () => {
  const help = () => {
    render(<HelpStep />);
    return (document.body.textContent ?? '').replace(/\s+/g, ' ');
  };

  it('Files and their formats: what a load refuses for size, depth and repeated ids (T472; S4, S3, R7, S1)', () => {
    const text = help();
    expect(text).toMatch(/larger than 50 MB.{0,120}nothing changes/);
    expect(text).toContain('nested more than 100 levels deep');
    expect(text).toMatch(/same id.{0,160}dataset\.cases\[7\]\.id/);
    expect(text).toMatch(/id such as constructor works like any other id/);
  });

  it('Importing test cases: an identifier used twice in the file, and the size of the file (T473)', () => {
    const text = help();
    expect(text).toMatch(/identifier that appears twice in the file makes that row invalid/);
    expect(text).toMatch(/identifier the test project already uses is replaced by a new one/);
    expect(text).toMatch(/file may be up to 50 MB/);
  });

  it('Sample reply: a rule that the sample turns off counts in the judge version (T474; R3, FR-075)', () => {
    const text = help();
    expect(text).toMatch(/turns the rule off.{0,200}judge version/);
    expect(text).toMatch(/breaks or repairs a rule.{0,200}rules were corrected after the replies were received/);
    expect(text).toMatch(/cosmetic change does not/);
  });

  it('Overall result: every measure has a threshold from the start, and Details shows the ones that decide (T475; T414, FR-068)', () => {
    const text = help();
    expect(text).toMatch(/Every measure has a threshold from the start/);
    expect(text).toMatch(/Details shows the same thresholds that decide the overall result/);
    expect(text).toMatch(/per case.{0,200}80%.{0,120}10%/);
  });

  it('Privacy: the panel "Something went wrong", its two actions, and that the work is still in the page (T476; S3)', () => {
    const text = help();
    expect(text).toContain('Something went wrong');
    expect(text).toMatch(/Something went wrong.{0,300}Save test project as….{0,200}Reload/);
    expect(text).toMatch(/work is still in the page until you reload/);
  });

  it('T477 review: the Help says "reliable answer", as the screen and the report do, and no longer "final answer"', () => {
    const text = help();
    expect(text).toMatch(/For a reliable answer the tool needs at least 30 injected errors/);
    expect(text).toMatch(/and a reliable answer needs at least 30 decided cases/);
    expect(text).not.toMatch(/final answer/);
  });

  it('T477 review: a test case is pasted with "From JSON", the name of the button, not "Paste JSON"', () => {
    const text = help();
    expect(text).toMatch(/One test case: no format key, it is the case itself, opened with From JSON/);
    expect(text).not.toMatch(/Paste JSON/);
  });

  it('T477 review: the reply box shows only the place where the JSON breaks, it never says "Readable JSON"', () => {
    const text = help();
    expect(text).not.toMatch(/Readable JSON/);
    expect(text).toMatch(/The box is checked as the text changes: it shows the line and column where the JSON breaks/);
  });
});
