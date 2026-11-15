// The Results step: Details, Error analysis, the Test case list, the read-only case view and the report card (FR-065, FR-069 to FR-072, SC-007).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { errorAnalysis } from '../../../src/core/evaluation/analysis';
import { computeResults, reviewEvaluation } from '../../../src/core/evaluation/results';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import type { Evaluation } from '../../../src/core/model';
import { ResultsStep } from '../../../src/ui/steps/results/ResultsStep';
import { errorsSummary, ReadOnlyCaseView } from '../../../src/ui/windows/case-window/ReadOnlyCaseView';
import { accuracyMetric, sampleEvaluation } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const decisionsAfter = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8')).decisions_after;
const decided: Evaluation = { ...loaded.value.evaluation, decisions: decisionsAfter };

const ctx = (e: Evaluation) => ({ evaluation: e, reviewed: reviewEvaluation(e, accuracyMetric), results: computeResults(e, accuracyMetric) });
const handlers = () => ({ onContinue: vi.fn(), onRerun: vi.fn(), onExport: vi.fn(), onThreshold: vi.fn(), onLoadChecks: vi.fn(), onOpenCase: vi.fn() });
const show = (e: Evaluation, h = handlers()) => {
  render(<ResultsStep {...ctx(e)} {...h} />);
  return h;
};
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

describe('Details in the Summary', () => {
  it('is closed by default and holds the two thresholds with a sentence each', () => {
    show(decided);
    const details = screen.getByText('Details').closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    const detection = within(details).getByLabelText('Detection rate: at least (%)') as HTMLInputElement;
    const fp = within(details).getByLabelText('False-positive rate: at most (%)') as HTMLInputElement;
    expect(detection.value).toBe('80');
    expect(fp.value).toBe('10');
    expect(details.textContent).toMatch(/works only if the detection rate is at least 80%/i);
    expect(details.textContent).toMatch(/false-positive rate is at most 10%/i);
  });

  it('changes a threshold as the number is typed, as a share from 0 to 1', () => {
    const h = show(decided);
    fireEvent.input(screen.getByLabelText('Detection rate: at least (%)'), { target: { value: '65' } });
    expect(h.onThreshold).toHaveBeenCalledWith('detection_rate', 0.65);
  });

  it('does not pass a value that is not a number from 0 to 100', () => {
    const h = show(decided);
    for (const value of ['abc', '150', '-3', '']) fireEvent.input(screen.getByLabelText('Detection rate: at least (%)'), { target: { value } });
    expect(h.onThreshold).not.toHaveBeenCalled();
  });

  it('has Load check settings', () => {
    const h = show(decided);
    fireEvent.click(screen.getByRole('button', { name: 'Load check settings…' }));
    expect(h.onLoadChecks).toHaveBeenCalled();
  });

  it('shows the 95% interval of each rate and both borderline notes', () => {
    const e = ctx(decided);
    const results = { ...e.results, overall: { ...e.results.overall, borderline: ['Detection rate is borderline: its 95% interval 74% to 97% contains the threshold 80%.', 'False-positive rate is borderline: its 95% interval 2% to 21% contains the threshold 10%.'] } };
    render(<ResultsStep {...e} results={results} {...handlers()} />);
    const details = screen.getByText('Details').closest('details') as HTMLElement;
    for (const id of ['detection_rate', 'false_positive_rate']) {
      const m = results.measures[id]!;
      expect(details.textContent).toContain(`${pct(m.interval!.lower)} to ${pct(m.interval!.upper)}`);
    }
    expect(details.textContent).toContain('Detection rate is borderline');
    expect(details.textContent).toContain('False-positive rate is borderline');
  });

  it('shows, as information, the share of cases with a false positive and the same for clean cases', () => {
    show(decided);
    const details = screen.getByText('Details').closest('details') as HTMLElement;
    expect(details.textContent).toMatch(/Cases with at least one false positive: 2 of 20/);
    expect(details.textContent).toMatch(/Clean cases with a false positive: 1 of 10/);
  });

  it('is the only place that changes data: the Results step has no mark, approval or save button', () => {
    show(decided);
    for (const name of ['Approve', 'Ignore', 'Found', 'Add finding…', 'Remove', 'Save evaluation', 'Save reply']) expect(screen.queryByRole('button', { name })).toBeNull();
    const inputs = [...document.querySelectorAll('input, textarea, select')].map((el) => el.getAttribute('aria-label') || el.id || el.closest('label')?.textContent);
    expect(inputs).toHaveLength(2);
  });
});

describe('Error analysis', () => {
  it('has a table per category and one per difficulty, with a rate only for a group of 10 expected errors or more', () => {
    const e = ctx(decided);
    show(decided);
    tab('Error analysis');
    const a = errorAnalysis(e.results.counters);
    for (const [label, rows] of [['By category', a.byCategory], ['By difficulty', a.byDifficulty]] as const) {
      const table = screen.getByRole('table', { name: label });
      expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1);
      for (const row of rows) {
        const cells = [...within(table).getByRole('cell', { name: row.name }).closest('tr')!.querySelectorAll('td')].map((c) => c.textContent);
        expect(cells).toEqual([row.name, String(row.expected), String(row.found), String(row.missed), row.rate === null ? 'counts only' : pct(row.rate)]);
      }
    }
    expect(a.byCategory.some((r) => r.rate === null)).toBe(true);
    expect(a.byDifficulty.some((r) => r.rate !== null)).toBe(true);
  });

  it('has the additional findings per rule, per category and per difficulty, counts only, with "(no category)" and "(not set)"', () => {
    show(sampleEvaluation());
    tab('Error analysis');
    expect(within(screen.getByRole('table', { name: 'Additional findings per rule' })).getAllByRole('row').length).toBeGreaterThan(1);
    const byCategory = screen.getByRole('table', { name: 'Additional findings per category' });
    expect(byCategory.textContent).toContain('(no category)');
    expect(byCategory.textContent).toContain('factual-error');
    const byDifficulty = screen.getByRole('table', { name: 'Additional findings per difficulty' });
    expect(byDifficulty.textContent).toContain('(not set)');
    expect(byDifficulty.textContent).toContain('obvious');
    expect(byCategory.textContent).not.toMatch(/%/);
  });
});

describe('notices above the views', () => {
  it('names the cases added or corrected after the first reply', () => {
    show(sampleEvaluation());
    expect(screen.getByRole('region', { name: 'Notices' }).textContent).toMatch(/added after the first reply: case 2 \(Anna \+ 2 errors\)/i);
  });

  it('says the rules were corrected after the replies, naming the version in force when the replies were received', async () => {
    show(sampleEvaluation());
    await waitFor(() => expect(screen.getByRole('region', { name: 'Notices' }).textContent).toMatch(/rules were corrected after the replies/i));
    expect(screen.getByRole('region', { name: 'Notices' }).textContent).toContain('aaaaaaaaaaaa');
  });

  it('has no notice when nothing was corrected', async () => {
    show(loaded.value.evaluation);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('region', { name: 'Notices' })).toBeNull();
  });
});

describe('Test case list', () => {
  it('lists every case with its kind, expected errors, what the judge reported, status and the sources of its decisions', () => {
    show(sampleEvaluation());
    tab('Test case list');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const second = rows[1]!.textContent ?? '';
    expect(second).toContain('Anna + 2 errors');
    expect(second).toContain('Injected errors');
    expect(second).toMatch(/2 of 2 expected errors found/);
    expect(second).toMatch(/Fail/);
    expect(second).toContain('Set by hand');
    expect(second).toContain('LLM opinion, approved by the user');
    expect(rows[0]!.textContent).toContain('Automatic');
  });

  it('shows the category and difficulty of the findings added by hand', () => {
    show(sampleEvaluation());
    tab('Test case list');
    expect(screen.getAllByRole('row')[2]!.textContent).toMatch(/The oven was never bought[^]*factual-error · obvious/);
  });

  it('has Open for every case and opens the read-only case view through the application', () => {
    const h = show(decided);
    tab('Test case list');
    const row = screen.getAllByRole('row')[3]!;
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }));
    expect(h.onOpenCase).toHaveBeenCalledWith('3');
  });
});

describe('the "Report and next version" card', () => {
  it('has Export HTML report in the "what next" line when every case is decided, and says the JSON is the evaluation file', () => {
    const h = show(decided);
    const card = screen.getByRole('region', { name: 'Report and next version' });
    expect(card.textContent).toMatch(/evaluation file/);
    expect(card.textContent).toMatch(/Save evaluation/);
    fireEvent.click(within(screen.getByRole('region', { name: 'What next' })).getByRole('button', { name: 'Export HTML report…' }));
    expect(h.onExport).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: 'Export HTML report…' })).toHaveLength(1);
  });

  it('has Export HTML report in the card while cases are undecided, and says the report is then provisional', () => {
    const h = show(loaded.value.evaluation);
    const card = screen.getByRole('region', { name: 'Report and next version' });
    expect(card.textContent).toMatch(/provisional/i);
    fireEvent.click(within(card).getByRole('button', { name: 'Export HTML report…' }));
    expect(h.onExport).toHaveBeenCalled();
  });

  it('has no Export JSON', () => {
    show(decided);
    expect(screen.queryByRole('button', { name: /Export JSON/i })).toBeNull();
  });
});

describe('states', () => {
  it('says so when no case is decided yet', () => {
    const e = { ...sampleEvaluation(), replies: {}, decisions: {} };
    show(e);
    expect(screen.getByText(/No case is decided yet/)).toBeTruthy();
  });
});

describe('the read-only case view', () => {
  const evaluation = sampleEvaluation();
  const reviewed = reviewEvaluation(evaluation, accuracyMetric);
  const view = (caseId: string, over: Partial<{ onNavigate: (id: string) => void; onClose: () => void; onOpenOnRun: (id: string) => void }> = {}) => {
    const h = { onNavigate: vi.fn(), onClose: vi.fn(), onOpenOnRun: vi.fn(), ...over };
    render(<ReadOnlyCaseView evaluation={evaluation} reviewed={reviewed} caseId={caseId} {...h} />);
    return h;
  };

  it('shows the case, its complete judge prompt, the reply and every mark with its source, all read-only', () => {
    view('2');
    const win = screen.getByRole('dialog', { name: /^Case 2 / });
    // T256: the complete prompt is in part 1, not behind a button
    expect(within(win).queryByRole('button', { name: 'Show prompt' })).toBeNull();
    const promptBox = within(win).getByRole('textbox', { name: 'Complete judge prompt' }) as HTMLTextAreaElement;
    expect(promptBox.readOnly).toBe(true);
    expect(promptBox.value.length).toBeGreaterThan(0);
    const replyBox = within(win).getByRole('textbox', { name: 'Judge reply' }) as HTMLTextAreaElement;
    expect(replyBox.readOnly).toBe(true);
    expect(replyBox.value).toContain('Anna is a doctor.');
    expect(win.textContent).toContain('Fail');
    expect(win.textContent).toContain('Set by hand');
    expect(win.textContent).toContain('Automatic');
    expect(win.textContent).toMatch(/factual-error · obvious/);
  });

  it('offers no action that changes the case: only Previous, Next, Open on Run, Close and Show the issue (T256)', () => {
    view('2');
    const names = within(screen.getByRole('dialog')).getAllByRole('button').map((b) => b.textContent);
    expect(new Set(names)).toEqual(new Set(['Close', 'Next case', 'Open on Run', 'Previous case', 'Show the issue']));
    expect(names).not.toContain('Copy prompt');
  });

  it('moves with Previous case and Next case, shows the position, and stops at the ends', () => {
    const h = view('1');
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous case' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next case' }));
    expect(h.onNavigate).toHaveBeenCalledWith('2');
  });

  it('has Open on Run and Close', () => {
    const h = view('2');
    fireEvent.click(screen.getByRole('button', { name: 'Open on Run' }));
    expect(h.onOpenOnRun).toHaveBeenCalledWith('2');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(h.onClose).toHaveBeenCalled();
  });

  it('T256: is one page of three numbered parts: Case, Judge reply, Errors; the part Result is gone', () => {
    view('2');
    const win = screen.getByRole('dialog', { name: /^Case 2 / });
    const heads = Array.from(win.querySelectorAll('.case-part > h3')).map((h) => h.textContent);
    expect(heads).toEqual(['1. Case', '2. Judge reply', '3. Errors']);
    expect(win.querySelector('.case-columns')).toBeNull();
    expect(win.textContent).not.toMatch(/Marked \d+ of \d+/);
    const errors = within(win).getByRole('heading', { name: '3. Errors' }).closest('.case-part') as HTMLElement;
    expect(errors.querySelector('.error-side dt')?.textContent).toMatch(/^(summary|source_text|not found in the case)$/);
    expect(win.querySelector('.case-window-header')?.textContent).toMatch(/Fail|Pass|Awaiting/);
  });

  it('T256: the Errors part begins with a summary line, then the two groups, each item with Show the issue that highlights its passages', () => {
    view('2');
    const win = screen.getByRole('dialog', { name: /^Case 2 / });
    const errors = within(win).getByRole('heading', { name: '3. Errors' }).closest('.case-part') as HTMLElement;
    const summary = within(errors).getByRole('status', { name: 'Summary of the errors' });
    expect(summary.textContent).toMatch(/^\d+ expected: .+ · (Additional: .+|no additional errors)$/);
    expect(errors.firstElementChild?.nextElementSibling).toBe(summary);
    expect(within(errors).getByRole('heading', { name: 'Expected errors' })).toBeTruthy();
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(within(errors).getAllByRole('button', { name: 'Show the issue' })[0]!);
    expect(win.querySelectorAll('.fragment-strong').length).toBeGreaterThan(0);
  });

  it('T256: the summary line counts the states in the words of Run', () => {
    expect(errorsSummary({ expected: [{ state: 'found' }, { state: 'found' }, { state: 'missed' }], additional: [{ state: 'false_positive' }, { state: 'false_positive' }] } as never)).toBe('3 expected: 2 found, 1 not found · Additional: 2 false positive');
    expect(errorsSummary({ expected: [], additional: [{ state: 'real_error' }, { state: 'ignored' }] } as never)).toBe('No expected errors · Additional: 1 genuine error, 1 ignored');
    expect(errorsSummary({ expected: [{ state: 'undecided' }], additional: [] } as never)).toBe('1 expected: 1 undecided · no additional errors');
  });

  it('says so for a case without a reply', () => {
    const e = { ...evaluation, replies: {}, decisions: {} };
    render(<ReadOnlyCaseView evaluation={e} reviewed={reviewEvaluation(e, accuracyMetric)} caseId="1" onNavigate={() => {}} onClose={() => {}} onOpenOnRun={() => {}} />);
    expect(screen.getByText(/This case has no reply yet/)).toBeTruthy();
  });
});
