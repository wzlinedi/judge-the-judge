// The HTML report (contracts/file-formats.md, section 8; FR-072): one self-contained page with inline styles, no script
// and no external resource, in the order of the tool: summary, error analysis, test case list, then the judge set.
// Every value is escaped. Details are collapsible on screen and expanded in print.
import { ruleList, whereTheErrorIs } from '../judge/findings';
import { composePrompt } from '../judge/compose';
import type { Evaluation } from '../model';
import { differenceNote, rulesCorrectedAfterReplies, type Difference } from '../evaluation/recompute';
import { countingSwitchNote, PER_CASE_SENTENCE, PER_CASE_WHY } from '../evaluation/counting-note';
import { errorAnalysis, falsePositiveShares, type GroupRow } from '../evaluation/analysis';
import { measuresInUse } from '../evaluation/measures';
import { MINIMUM_SAMPLE, type ReviewedCase, type Results } from '../evaluation/results';
import { SOURCE_LABELS, STATE_LABELS } from '../evaluation/source-labels';
import type { EvaluationMeta } from './evaluation-file';

const esc = (value: unknown): string =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const STYLE = `
body { font-family: system-ui, sans-serif; line-height: 1.45; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; color: #111; background: #fff; }
h1 { font-size: 1.6rem; } h2 { margin-top: 2rem; border-bottom: 2px solid #111; padding-bottom: .2rem; } h3 { margin-top: 1.5rem; }
table { border-collapse: collapse; width: 100%; margin: .5rem 0 1rem; } th, td { border: 1px solid #888; padding: .3rem .5rem; text-align: left; vertical-align: top; }
pre { white-space: pre-wrap; word-break: break-word; background: #f4f4f4; border: 1px solid #ccc; padding: .5rem; }
dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: .2rem 1rem; } dl.meta dd { margin: 0; }
.provisional { border: 2px solid #b00; padding: .5rem .75rem; font-weight: 600; }
.note { border-left: 4px solid #666; padding-left: .75rem; }
.case { border: 1px solid #888; padding: .5rem 1rem; margin: 1rem 0; break-inside: avoid-page; }
summary { cursor: pointer; font-weight: 600; }
@media print {
  body { max-width: none; margin: 0; }
  details > summary { list-style: none; }
  details::details-content { content-visibility: visible; display: block; height: auto; }
  details:not([open]) > *:not(summary) { display: block; }
}
`;

function table(label: string, head: string[], rows: string[][]): string {
  if (rows.length === 0) return `<p>${esc(label)}: none.</p>`;
  return `<table><caption>${esc(label)}</caption><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function groupRows(rows: GroupRow[], perCase = false): string[][] {
  if (perCase) return rows.map((g) => [g.name, String(g.expected), String(g.found), String(g.missed)]);
  return rows.map((g) => [g.name, String(g.expected), String(g.found), String(g.missed), g.rate === null ? 'counts only' : pct(g.rate)]);
}

function summary(evaluation: Evaluation, results: Results, reviewed: ReviewedCase[]): string {
  const c = results.counters;
  const out: string[] = ['<section id="summary"><h2>1. Summary</h2>'];
  const perCase = results.evaluated_per === 'case';
  out.push(
    '<h3>Counts</h3>',
    ...(perCase
      ? [
          `<p>${esc(PER_CASE_SENTENCE)}</p>`,
          table('Cases with expected errors', ['Decided', 'Flagged', 'Not flagged'], [[String(c.defective_cases_decided), String(c.defective_cases_flagged), String(c.defective_cases_decided - c.defective_cases_flagged)]]),
          table('Clean cases', ['Decided', 'Flagged wrongly', 'Not flagged'], [[String(c.clean_cases_decided), String(c.clean_cases_with_false_positive), String(c.clean_cases_decided - c.clean_cases_with_false_positive)]]),
        ]
      : [
          table('Expected errors', ['Total', 'Found', 'Missed'], [[String(c.expected_total), String(c.expected_found), String(c.expected_missed)]]),
          table('Additional findings', ['Total', 'Real errors', 'False positives'], [[String(c.additional_total), String(c.real_errors), String(c.false_positives)]]),
          table('Subtle errors', ['Total', 'Found', 'Missed'], [[String(c.subtle_total), String(c.subtle_found), String(c.subtle_missed)]]),
        ]),
  );

  const ignored: string[] = [];
  for (const r of reviewed) {
    for (const e of r.effective?.expected ?? []) if (e.state === 'ignored') ignored.push(`Case ${r.testCase.id}: expected error ${e.id}`);
    for (const a of r.effective?.additional ?? []) if (a.state === 'ignored') ignored.push(`Case ${r.testCase.id}: ${a.text === '' ? 'a finding about the whole reply' : `“${a.text}”`}`);
  }
  out.push(
    `<h3>Ignored items</h3>`,
    ignored.length === 0
      ? '<p>Nothing was ignored.</p>'
      : `<p>${plural(c.ignored_expected, 'expected error', 'expected errors')} and ${plural(c.ignored_additional, 'additional finding', 'additional findings')} were ignored and are left out of every count.</p><ul>${ignored.map((i) => `<li>Ignored: ${esc(i)}</li>`).join('')}</ul>`,
  );

  const use = measuresInUse(results.evaluated_per === 'case' ? 'per_case' : 'per_expected_error');
  const rates = use.map((id) => results.measures[id]).filter((m): m is NonNullable<typeof m> => m !== undefined);
  out.push(
    '<h3>Rates</h3>',
    table(
      'The two rates',
      ['Rate', 'Value', 'Counts', '95% interval'],
      rates.map((m) => [m.name, m.value === null ? 'not available' : pct(m.value), m.numerator === undefined ? '' : `${m.numerator} of ${m.denominator}`, m.interval ? `${pct(m.interval.lower)} to ${pct(m.interval.upper)}` : '']),
    ),
  );

  out.push(`<h3>Overall result: ${esc(results.overall.result)}</h3><ul>${results.overall.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`);
  for (const b of results.overall.borderline) out.push(`<p class="note">${esc(b)}</p>`);
  out.push(`<p>A final answer needs at least ${MINIMUM_SAMPLE.expected_errors} injected errors and ${MINIMUM_SAMPLE.clean_cases} clean cases.</p>`);

  const shares = falsePositiveShares(c);
  const thresholds = evaluation.checks.rules.filter((r) => use.includes(r.measure));
  out.push(
    '<details><summary>Details</summary>',
    table(
      'Thresholds used',
      ['Measure', 'Rule'],
      thresholds.map((r) => [results.measures[r.measure]?.name ?? r.measure, `${r.comparison === 'at_least' ? 'at least' : 'at most'} ${pct(r.value)}`]),
    ),
    `<p>Cases with at least one false positive: ${shares.cases.count} of ${shares.cases.of}. Clean cases with a false positive: ${shares.clean.count} of ${shares.clean.of}.</p>`,
    '</details></section>',
  );
  return out.join('\n');
}

function analysis(results: Results): string {
  const perCase = results.evaluated_per === 'case';
  const a = errorAnalysis(results.counters, perCase);
  const head = perCase ? ['Group', 'Cases with errors', 'Flagged', 'Not flagged'] : ['Group', 'Expected errors', 'Found', 'Missed', 'Detection rate'];
  return [
    '<section id="error-analysis"><h2>2. Error analysis</h2>',
    '<h3>By category</h3>',
    table('By category', head, groupRows(a.byCategory, perCase)),
    '<h3>By difficulty</h3>',
    table('By difficulty', head, groupRows(a.byDifficulty, perCase)),
    `<p>${esc(perCase ? PER_CASE_WHY : 'A group with fewer than 10 expected errors shows counts only, with no rate.')}</p>`,
    '<h3>Additional findings per rule</h3>',
    table('Additional findings per rule', ['Rule', 'Real errors', 'False positives'], a.perRule.map((r) => [r.rule, String(r.real), String(r.fp)])),
    '<h3>Additional findings per category</h3>',
    table('Additional findings per category', ['Category', 'Real errors', 'False positives'], a.additionalByCategory.map((r) => [r.name, String(r.real), String(r.fp)])),
    '<h3>Additional findings per difficulty</h3>',
    table('Additional findings per difficulty', ['Difficulty', 'Real errors', 'False positives'], a.additionalByDifficulty.map((r) => [r.name, String(r.real), String(r.fp)])),
    '</section>',
  ].join('\n');
}

const STATUS = { pass: 'Pass', fail: 'Fail', awaiting: 'Awaiting verification', not_run: 'Not run' } as const;

function testCase(evaluation: Evaluation, r: ReviewedCase): string {
  const t = r.testCase;
  const reply = evaluation.replies[t.id];
  const prompt = reply?.prompt ?? composePrompt(evaluation.judge_set.prompt, t).text;
  const decisions = evaluation.decisions[t.id];
  const out: string[] = [`<article class="case" id="case-${esc(t.id)}"><h3>Case ${esc(t.id)}: ${esc(t.name)}</h3>`];
  out.push(`<p>Kind: ${t.expected_errors.length === 0 ? 'clean' : 'injected errors'}. Status: <strong>${STATUS[r.status]}</strong>.${t.base ? ` Base: case ${esc(t.base)}.` : ''}</p>`);
  out.push(
    '<h4>Fields</h4>',
    `<dl>${Object.entries(t.fields)
      .map(([k, v]) => `<dt>${esc(k)}${k === evaluation.judge_set.judged_text ? ' (judged text)' : ''}</dt><dd><pre>${esc(v)}</pre></dd>`)
      .join('')}</dl>`,
  );
  out.push('<details><summary>Complete prompt</summary>', `<pre>${esc(prompt)}</pre>`, '</details>');

  if (t.expected_errors.length > 0) {
    out.push(
      table(
        'Expected errors',
        ['Id', 'Description', 'Category', 'Difficulty', 'Fragment', 'Mark', 'Source'],
        t.expected_errors.map((e) => {
          const eff = r.effective?.expected.find((x) => x.id === e.id);
          return [e.id, e.description, e.category ?? '', e.difficulty ?? '', e.fragment ?? '', eff ? STATE_LABELS[eff.state] ?? eff.state : 'Not run', eff && eff.state !== 'undecided' ? SOURCE_LABELS[eff.source] : ''];
        }),
      ),
    );
  }
  if (reply) {
    out.push('<h4>Received reply</h4>', `<pre>${esc(reply.reply)}</pre>`);
    const additional = r.effective?.additional ?? [];
    out.push(
      table(
        'Additional findings',
        ['Finding', 'Category', 'Difficulty', 'Mark', 'Source'],
        additional.map((a) => [a.text === '' ? 'A finding about the whole reply' : a.text, a.category ?? '', a.difficulty ?? '', STATE_LABELS[a.state] ?? a.state, a.state === 'undecided' ? '' : SOURCE_LABELS[a.source]]),
      ),
    );
    if (r.effective?.needsApproval) out.push(`<p>The reply could not be read automatically. ${r.effective.approved ? 'The user approved the case.' : 'The case waits for approval.'}</p>`);
  } else out.push('<p>No reply yet.</p>');
  if (decisions?.note) out.push(`<p>Note: ${esc(decisions.note)}</p>`);
  out.push('</article>');
  return out.join('\n');
}

function judgeSet(evaluation: Evaluation): string {
  const set = evaluation.judge_set;
  const places = set.error_rules.flatMap((rule) => {
    const list = ruleList(rule);
    if (list === undefined) return [{ name: rule.name, where: 'the whole reply' }];
    const field = whereTheErrorIs(rule, list, set.reply_mapping.finding_text);
    return field === undefined ? [] : [{ name: rule.name, where: field }];
  });
  return [
    '<section id="judge-set"><h2>The judge set</h2>',
    '<h3>Prompt</h3>',
    `<pre>${esc(set.prompt)}</pre>`,
    `<p>Judged text: ${esc(set.judged_text ?? 'not chosen')}</p>`,
    '<h3>Error rules</h3>',
    set.error_rules.length === 0
      ? '<p>There are no error rules.</p>'
      : `<ul>${set.error_rules
          .map((rule) => `<li>${esc(rule.name)} (${rule.match === 'all' ? 'all of' : 'any of'}): ${rule.conditions.map((c) => esc(`${c.field} ${c.comparison}${c.value === undefined ? '' : ` ${String(c.value)}`}`)).join('; ')}</li>`)
          .join('')}</ul>`,
    '<h3>Where the error is</h3>',
    places.length === 0 ? '<p>No rule has a field that shows where the error is.</p>' : `<ul>${places.map((p) => `<li>${esc(p.name)}: ${esc(p.where)}</li>`).join('')}</ul>`,
    '<h3>Error catalog</h3>',
    set.error_catalog.length === 0
      ? '<p>The catalog is empty.</p>'
      : `<ul>${set.error_catalog.map((c) => `<li>${esc(c.name)}${c.description ? `: ${esc(c.description)}` : ''}${c.example ? ` (example: ${esc(c.example)})` : ''}</li>`).join('')}</ul>`,
    '</section>',
  ].join('\n');
}

const MAX_LISTED_DIFFERENCES = 20;

export function buildHtmlReport(evaluation: Evaluation, results: Results, reviewed: ReviewedCase[], meta: EvaluationMeta, differences: readonly Difference[] = []): string {
  const c = results.counters;
  const name = evaluation.dataset.name;
  const head = [
    `<h1>Judge the Judge report: ${esc(name)}</h1>`,
    '<dl class="meta">',
    `<dt>Test project</dt><dd>${esc(name)}</dd>`,
    `<dt>Test cases version</dt><dd>${esc(meta.testCasesVersion)}</dd>`,
    `<dt>Judge version</dt><dd>${esc(meta.judgeVersion)}</dd>`,
    '</dl>',
    '<h2>Model details</h2>',
    `<pre>${esc(evaluation.model_note.trim() === '' ? 'none given' : evaluation.model_note)}</pre>`,
    `<p>Tool version ${esc(meta.toolVersion)}. Exported ${esc(meta.now)}.</p>`,
  ];
  if (results.provisional) {
    head.push(`<p class="provisional">Provisional. ${plural(results.undecided, 'case is', 'cases are')} not decided (${c.cases_not_run} not run, ${c.cases_awaiting} awaiting verification), so the numbers can still change.</p>`);
  }
  if (rulesCorrectedAfterReplies(evaluation.reply_judge_version, meta.judgeVersion)) {
    head.push(
      `<p class="note">The rules were corrected after the replies were received (the error rules or the reply mapping changed). The judge version in force when the replies were received was ${esc(evaluation.reply_judge_version)}; the current one is ${esc(meta.judgeVersion)}.</p>`,
    );
  }
  const mismatch = differenceNote(differences);
  if (mismatch) {
    head.push(
      `<p class="note">${esc(mismatch)}</p>`,
      `<ul class="differences">${differences.slice(0, MAX_LISTED_DIFFERENCES).map((d) => `<li>${esc(d.what)}: stored ${esc(d.stored)}, recomputed ${esc(d.recomputed)}</li>`).join('')}</ul>`,
    );
  }
  const switched = countingSwitchNote(results);
  if (switched) head.push(`<p class="note">${esc(switched)}</p>`);
  for (const [kind, text] of [['added', 'added'], ['corrected', 'corrected']] as const) {
    const cases = evaluation.dataset.cases.filter((t) => t.changed_after_first_reply === kind);
    if (cases.length > 0) head.push(`<p class="note">Cases ${text} after the first reply: ${cases.map((t) => esc(`case ${t.id} (${t.name})`)).join(', ')}.</p>`);
  }

  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Judge the Judge report: ${esc(name)}</title>`,
    `<style>${STYLE}</style></head><body>`,
    ...head,
    summary(evaluation, results, reviewed),
    analysis(results),
    `<section id="test-case-list"><h2>3. Test case list</h2>\n${reviewed.map((r) => testCase(evaluation, r)).join('\n')}\n</section>`,
    judgeSet(evaluation),
    '</body></html>',
  ].join('\n');
}
