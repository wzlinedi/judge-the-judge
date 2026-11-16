// The HTML report (file-formats.md, section 8; FR-072, SC-008).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeResults, reviewEvaluation } from '../../src/core/evaluation/results';
import { buildHtmlReport } from '../../src/core/io/html-report';
import { readTestProject } from '../../src/core/io/test-project-file';
import type { TestProject } from '../../src/core/model';
import { accuracyMetric, sampleProject } from '../helpers/fixtures';

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.project;
const decisionsAfter = (JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8')) as { decisions_after: NonNullable<TestProject['testRun']>['decisions'] }).decisions_after;
const meta = { now: '2026-11-14T10:00:00Z', toolVersion: '1.2.3', judgeVersion: 'jjjjjjjjjjjj', testCasesVersion: 'cccccccccccc' };

const report = (e: TestProject, over: Partial<typeof meta> = {}) => buildHtmlReport(e, computeResults(e, accuracyMetric), reviewEvaluation(e, accuracyMetric), { ...meta, ...over });
const provisional = report(demo, { judgeVersion: demo.testRun!.reply_judge_version! });
const final = report({ ...demo, testRun: { ...demo.testRun!, decisions: decisionsAfter } }, { judgeVersion: demo.testRun!.reply_judge_version! });
const at = (html: string, text: string) => {
  const i = html.indexOf(text);
  expect(i, text).toBeGreaterThanOrEqual(0);
  return i;
};

describe('the HTML report is self-contained', () => {
  it('is a complete page with inline styles, no script and no external resource', () => {
    expect(provisional.startsWith('<!doctype html>')).toBe(true);
    expect(provisional).toContain('<style>');
    expect(provisional).not.toMatch(/<script/i);
    expect(provisional).not.toMatch(/<link\b/i);
    expect(provisional).not.toMatch(/\b(src|href)\s*=/i);
    expect(provisional).not.toMatch(/https?:\/\//);
    expect(provisional).not.toMatch(/@import|url\(/);
  });

  it('escapes every value: a script in a name, a field or the model details stays text', () => {
    const e = sampleProject();
    e.dataset.name = '<script>alert(1)</script>';
    e.testRun!.model_note = '<img src=x onerror=alert(2)>\nline two';
    e.dataset.cases[0]!.fields['summary'] = 'a "quoted" <b>bold</b> & more';
    const html = report(e);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('a &quot;quoted&quot; &lt;b&gt;bold&lt;/b&gt; &amp; more');
  });
});

describe('the order of the report', () => {
  it('goes from the title and versions to the three views and the judge set', () => {
    const html = report(sampleProject());
    const order = ['Book summaries', 'Test cases version', 'Judge version', 'Model details', 'Tool version', 'id="summary"', 'id="error-analysis"', 'id="test-case-list"', 'id="judge-set"'].map((t) => at(html, t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shows the versions, the tool version, the date and the model details with their lines', () => {
    const html = report(sampleProject());
    for (const text of ['jjjjjjjjjjjj', 'cccccccccccc', '1.2.3', '2026-11-14']) expect(html).toContain(text);
    expect(html).toMatch(/<pre[^>]*>model X\ntemperature 0<\/pre>/);
  });

  it('names the cases added or corrected after the first reply', () => {
    const html = report(sampleProject());
    expect(html).toMatch(/added after the first reply[^<]*[^]*Anna \+ 2 errors/);
  });

  it('names the sample reply in the note about corrected rules (R3)', () => {
    expect(report(sampleProject(), { judgeVersion: 'bbbbbbbbbbbb' })).toContain('the error rules, the reply mapping, or the sample reply turned a rule on or off');
  });

  it('notes that the rules were corrected after the replies, naming the version in force then', () => {
    const e = sampleProject();
    const html = report(e, { judgeVersion: 'bbbbbbbbbbbb' });
    expect(html).toMatch(/rules were corrected after the replies/i);
    expect(html).toContain(e.testRun!.reply_judge_version!);
    expect(report(e, { judgeVersion: e.testRun!.reply_judge_version! })).not.toMatch(/rules were corrected after the replies/i);
  });
});

describe('cases not decided yet (T267: the report is never called provisional)', () => {
  it('says at the top how many cases are not decided while a case is not run or awaits verification', () => {
    expect(provisional).toContain('5 cases are not decided yet');
    expect(provisional).not.toMatch(/provisional/i);
  });

  it('says nothing of the kind when every case is decided', () => {
    expect(final).not.toMatch(/not decided yet/);
    expect(final).not.toMatch(/provisional/i);
  });
});

describe('the three views', () => {
  it('has the Summary: counts, the two rates, the overall result with reasons and the thresholds', () => {
    const summary = final.slice(at(final, 'id="summary"'), at(final, 'id="error-analysis"'));
    for (const text of ['Expected errors', 'Additional findings', 'Subtle errors', 'Detection rate', 'False-positive rate', 'Works', 'at least 30 injected errors and 10 clean cases', '95% interval']) expect(summary).toContain(text);
    expect(summary).toMatch(/27 of 30/);
  });

  it('has the Error analysis: per category, per difficulty, per rule and additional findings per category and per difficulty', () => {
    const html = report(sampleProject());
    const analysis = html.slice(at(html, 'id="error-analysis"'), at(html, 'id="test-case-list"'));
    for (const text of ['By category', 'By difficulty', 'Additional findings per rule', 'Additional findings per category', 'Additional findings per difficulty', '(no category)', '(not set)', 'factual-error', 'A rate of a small group says little']) expect(analysis).toContain(text);
    expect(analysis).not.toContain('counts only');
  });

  it('has the Test case list with every prompt, expected error, reply and decision with its source', () => {
    const e = sampleProject();
    const html = report(e);
    const list = html.slice(at(html, 'id="test-case-list"'), at(html, 'id="judge-set"'));
    for (const id of ['1', '2']) {
      expect(list).toContain(escape(e.testRun!.replies[id]!.prompt));
    }
    for (const text of ['Anna is a doctor', 'second oven in 2005', 'Profession changed.']) expect(list).toContain(text);
    expect(list).toContain('Anna is a baker.');
    expect(list).toContain('Set by hand');
    expect(list).toContain('LLM opinion, approved by the user');
    expect(list).toContain('Automatic');
  });

  it('holds the complete prompt of every case of the demo, as sent to the judge', () => {
    for (const id of ['1', '14', '19']) expect(final).toContain(escape(demo.testRun!.replies[id]!.prompt));
    expect(final).toContain(escape(demo.testRun!.replies['10']!.reply));
  });

  it('shows the category and difficulty of added findings and lists ignored items as ignored', () => {
    const e = sampleProject();
    e.testRun!.decisions['2']!.added_findings[1]!.state = 'ignored';
    e.testRun!.decisions['2']!.expected['e2'] = { state: 'ignored', source: 'manual' };
    const html = report(e);
    const list = html.slice(at(html, 'id="test-case-list"'));
    expect(list).toContain('The oven was never bought');
    expect(list).toMatch(/factual-error[^]*obvious/);
    expect(list).toMatch(/Ignored/);
    expect(html).toMatch(/Ignored items/);
  });

  it('ends with the judge set: prompt, judged text, rules, finding text and catalog', () => {
    const e = sampleProject();
    const set = report(e).slice(at(report(e), 'id="judge-set"'));
    expect(set).toContain(e.judge_set.error_rules[0]!.name);
    expect(set).toContain(e.judge_set.judged_text!);
    expect(set).toContain('claims[]');
    expect(set).toContain(e.judge_set.error_catalog[0]!.name);
    expect(set).toContain('SUMMARY:');
  });
});

describe('print', () => {
  it('has details collapsible on screen and expanded in print', () => {
    expect(provisional).toContain('<details');
    expect(provisional).toMatch(/@media print[^}]*[^]*details/);
    expect(provisional).toMatch(/::details-content/);
  });
});

/** The report escapes text for HTML; the prompts in the test are compared the same way. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
