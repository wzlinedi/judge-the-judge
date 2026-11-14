// A judge that gives one verdict for the whole text, in the interface (FR-061, FR-066 to FR-070; T164).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { createState } from '../../../src/app/store';
import { computeResults, reviewEvaluation } from '../../../src/core/evaluation/results';
import type { Evaluation } from '../../../src/core/model';
import { JudgeStep } from '../../../src/ui/steps/judge/JudgeStep';
import { ResultsStep } from '../../../src/ui/steps/results/ResultsStep';
import { CaseWindowHarness } from '../../helpers/case-window-harness';
import { accuracyJudgeSet, accuracyMetric, biasVerdictMetric, verdictEvaluation } from '../../helpers/fixtures';

const show = (e: Evaluation, metric = biasVerdictMetric) =>
  render(<ResultsStep results={computeResults(e, metric)} evaluation={e} reviewed={reviewEvaluation(e, metric)} onContinue={vi.fn()} onRerun={vi.fn()} onExport={vi.fn()} onThreshold={vi.fn()} onLoadChecks={vi.fn()} onOpenCase={vi.fn()} />);
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const win = () => screen.getByRole('dialog', { name: /^Case / });

describe('the Judge step', () => {
  it('says the judge is evaluated per case when every rule uses only fields outside any list', () => {
    render(<JudgeStep state={{ ...createState(), evaluation: verdictEvaluation() }} onEdit={() => {}} />);
    expect(screen.getByText(/evaluated per case/i)).toBeTruthy();
    expect(screen.getByText(/one verdict for the whole text/i)).toBeTruthy();
  });

  it('says nothing of the kind for a judge that lists its findings', () => {
    const e = { ...verdictEvaluation(), judge_set: accuracyJudgeSet() };
    render(<JudgeStep state={{ ...createState(), evaluation: e }} onEdit={() => {}} />);
    expect(screen.queryByText(/evaluated per case/i)).toBeNull();
  });
});

describe('the case window of Run', () => {
  const open = (caseId: string) => render(<CaseWindowHarness start={verdictEvaluation()} caseId={caseId} />);

  it('says the judge is evaluated per case, and whether the text was flagged', () => {
    open('1');
    expect(within(win()).getByText(/This judge is evaluated per case/)).toBeTruthy();
    expect(within(win()).getByText(/The text was flagged/)).toBeTruthy();
  });

  it('says the text was not flagged', () => {
    open('2');
    expect(within(win()).getByText(/The text was not flagged/)).toBeTruthy();
  });

  it('marks every expected error of a flagged case found, with the source Automatic, and lets the user change it', () => {
    open('1');
    for (const id of ['e1', 'e2']) {
      const item = document.querySelector<HTMLElement>(`[data-expected="${id}"]`) as HTMLElement;
      expect(within(item).getByRole('button', { name: 'Found' }).getAttribute('aria-pressed')).toBe('true');
      expect(item.textContent).toContain('Automatic');
    }
    const first = document.querySelector<HTMLElement>('[data-expected="e1"]') as HTMLElement;
    fireEvent.click(within(first).getByRole('button', { name: 'Not found' }));
    expect(within(first).getByRole('button', { name: 'Not found' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('leaves a flagged clean case to the user as an additional finding', () => {
    open('4');
    const finding = document.querySelector<HTMLElement>('[data-additional="reply"]') as HTMLElement;
    expect(finding.textContent).toContain('A finding about the whole reply');
    expect(within(finding).getByRole('button', { name: 'False positive' })).toBeTruthy();
    expect(win().textContent).toContain('Awaiting verification');
  });

  it('says nothing about per case for a judge that lists its findings', () => {
    render(<CaseWindowHarness start={{ ...verdictEvaluation(), judge_set: accuracyJudgeSet() }} caseId="3" />);
    expect(win().textContent).not.toMatch(/evaluated per case/);
  });
});

describe('the Summary', () => {
  it('says in one sentence that cases were counted, and shows no per-error counts', () => {
    show(verdictEvaluation());
    expect(screen.getByText(/one verdict for the whole text, so the tool counts cases, not errors/i)).toBeTruthy();
    for (const name of ['Expected errors', 'Additional findings', 'Subtle errors']) expect(screen.queryByRole('group', { name })).toBeNull();
  });

  it('counts cases with errors (flagged, not flagged) and clean cases (flagged wrongly, not flagged)', () => {
    show(verdictEvaluation());
    const withErrors = screen.getByRole('group', { name: 'Cases with expected errors' }).textContent ?? '';
    expect(withErrors).toMatch(/Decided\s*2/);
    expect(withErrors).toMatch(/Flagged\s*1/);
    expect(withErrors).toMatch(/Not flagged\s*1/);
    const clean = screen.getByRole('group', { name: 'Clean cases' }).textContent ?? '';
    expect(clean).toMatch(/Decided\s*3/);
    expect(clean).toMatch(/Flagged wrongly\s*1/);
    expect(clean).toMatch(/Not flagged\s*2/);
  });

  it('names the two rates "Case detection rate" and "Clean-case false-positive rate"', () => {
    show(verdictEvaluation());
    const rates = screen.getByRole('group', { name: 'Rates' }).textContent ?? '';
    expect(rates).toMatch(/Case detection rate\s*50%\s*\(1 of 2\)/);
    expect(rates).toMatch(/Clean-case false-positive rate\s*33\.3%\s*\(1 of 3\)/);
    expect(rates).not.toMatch(/^Detection rate/);
  });

  it('counts the test size in cases with errors and clean cases', () => {
    show(verdictEvaluation());
    expect(screen.getByRole('region', { name: 'Test size' }).textContent).toMatch(/Decided so far: 2 of 30 cases with errors, 3 of 10 clean cases/);
    expect(screen.getByRole('region', { name: 'Overall result' }).textContent).toContain('The judge was evaluated per case.');
  });

  it('shows the two case-level thresholds in Details', () => {
    show(verdictEvaluation());
    const details = screen.getByText('Details').closest('details') as HTMLElement;
    expect((within(details).getByLabelText('Case detection rate: at least (%)') as HTMLInputElement).value).toBe('80');
    expect((within(details).getByLabelText('Clean-case false-positive rate: at most (%)') as HTMLInputElement).value).toBe('10');
    expect(within(details).queryByLabelText(/^Detection rate/)).toBeNull();
  });
});

describe('Error analysis per case', () => {
  it('counts cases once in each category and difficulty, counts only, with one sentence why', () => {
    show(verdictEvaluation());
    tab('Error analysis');
    const byCategory = screen.getByRole('table', { name: 'By category' });
    const row = (name: string) => [...within(byCategory).getByRole('cell', { name }).closest('tr')!.querySelectorAll('td')].map((c) => c.textContent);
    expect(row('gender-bias')).toEqual(['gender-bias', '1', '1', '0']);
    expect(row('age-bias')).toEqual(['age-bias', '1', '0', '1']);
    expect(within(byCategory).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Group', 'Cases with errors', 'Flagged', 'Not flagged']);
    expect(byCategory.textContent).not.toMatch(/%/);
    expect(within(screen.getByRole('table', { name: 'By difficulty' })).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText(/does not say which error it found/i)).toBeTruthy();
  });
});

describe('a correction of the rules that switched the way of counting', () => {
  it('names the way used before and after', () => {
    const e: Evaluation = { ...verdictEvaluation(), reply_counted_per: 'case', judge_set: accuracyJudgeSet() };
    show(e, accuracyMetric);
    const notice = screen.getByRole('region', { name: 'Notices' }).textContent ?? '';
    expect(notice).toMatch(/counted per case when the replies were received and is counted per expected error now/);
  });

  it('has no such notice when the way did not change', async () => {
    show({ ...verdictEvaluation(), reply_counted_per: 'case', reply_judge_version: undefined });
    await waitFor(() => expect(screen.queryByText(/counted per case when/)).toBeNull());
  });
});
