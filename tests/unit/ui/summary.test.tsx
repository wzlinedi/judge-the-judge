import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { computeResults, reviewEvaluation } from '../../../src/core/evaluation/results';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import { ResultsStep } from '../../../src/ui/steps/results/ResultsStep';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const expected = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8'));
const provisional = computeResults(loaded.value.evaluation, accuracyMetric);
const final = computeResults({ ...loaded.value.evaluation, decisions: expected.decisions_after }, accuracyMetric);

const finalEvaluation = { ...loaded.value.evaluation, decisions: expected.decisions_after };
const finalContext = { evaluation: finalEvaluation, reviewed: reviewEvaluation(finalEvaluation, accuracyMetric) };
const provisionalContext = { evaluation: loaded.value.evaluation, reviewed: reviewEvaluation(loaded.value.evaluation, accuracyMetric) };
const props = { onContinue: vi.fn(), onExport: undefined as undefined | (() => void), onThreshold: vi.fn(), onLoadChecks: vi.fn(), onOpenCase: vi.fn() };

describe('Summary', () => {
  it('shows three count groups first: expected errors, additional findings, subtle errors', () => {
    render(<ResultsStep results={final} {...finalContext} {...props} />);
    const groups = screen.getByRole('group', { name: 'Counts' });
    const text = groups.textContent ?? '';
    expect(text.indexOf('Expected errors')).toBeLessThan(text.indexOf('Additional findings'));
    expect(text.indexOf('Additional findings')).toBeLessThan(text.indexOf('Subtle errors'));
    const expectedGroup = within(screen.getByRole('group', { name: 'Expected errors' }));
    expect(expectedGroup.getByText('30')).toBeTruthy(); // total
    expect(expectedGroup.getByText('27')).toBeTruthy(); // found
    expect(expectedGroup.getByText('3')).toBeTruthy(); // missed
    const additional = screen.getByRole('group', { name: 'Additional findings' }).textContent ?? '';
    expect(additional).toMatch(/Real errors\s*1/);
    expect(additional).toMatch(/False positives\s*2/);
    const subtle = screen.getByRole('group', { name: 'Subtle errors' }).textContent ?? '';
    expect(subtle).toMatch(/Found\s*12/);
  });

  it('shows the ignored count only when it is not zero', () => {
    const { unmount } = render(<ResultsStep results={final} {...finalContext} {...props} />);
    expect(screen.queryByText(/Ignored/)).toBeNull();
    unmount();
    const withIgnored = { ...final, counters: { ...final.counters, ignored_expected: 2, ignored_additional: 1 } };
    render(<ResultsStep results={withIgnored} {...finalContext} {...props} />);
    expect(screen.getByText(/Ignored/).textContent).toMatch(/2 expected errors and 1 additional finding/);
  });

  it('shows the two rates with their counts', () => {
    render(<ResultsStep results={final} {...finalContext} {...props} />);
    const rates = screen.getByRole('group', { name: 'Rates' }).textContent ?? '';
    expect(rates).toMatch(/Detection rate\s*90%\s*\(27 of 30\)/);
    expect(rates).toMatch(/False-positive rate\s*6\.7%\s*\(2 of 30\)/);
  });

  it('shows exactly one line of overall result with its reasons', () => {
    render(<ResultsStep results={final} {...finalContext} {...props} />);
    const overall = screen.getByRole('region', { name: 'Overall result' });
    expect(overall.querySelectorAll('.overall-result')).toHaveLength(1);
    expect(overall.textContent).toContain('Works');
    expect(overall.textContent).toMatch(/Detection rate is 90%/);
  });

  it('shows the test size against the minimum', () => {
    render(<ResultsStep results={final} {...finalContext} {...props} />);
    const size = screen.getByRole('region', { name: 'Test size' }).textContent ?? '';
    expect(size).toMatch(/at least 30 injected errors and 10 clean cases/);
    expect(size).toMatch(/30 of 30 expected errors/);
    expect(size).toMatch(/10 of 10 clean cases/);
  });

  it('is marked provisional with the counts while cases are undecided, and the result is Inconclusive', () => {
    render(<ResultsStep results={provisional} {...provisionalContext} {...props} />);
    const notice = screen.getByRole('status', { name: 'Provisional' });
    expect(notice.textContent).toMatch(/provisional/i);
    expect(notice.textContent).toMatch(/5 cases/);
    expect(screen.getByRole('region', { name: 'Overall result' }).textContent).toContain('Inconclusive');
    expect(screen.getByRole('region', { name: 'Test size' }).textContent).toMatch(/21 of 30 expected errors/);
  });

  it('shows no provisional notice when all cases are decided', () => {
    render(<ResultsStep results={final} {...finalContext} {...props} />);
    expect(screen.queryByRole('status', { name: 'Provisional' })).toBeNull();
  });

  it('says in the "what next" line that the result is provisional and offers Continue', () => {
    render(<ResultsStep results={provisional} {...provisionalContext} {...props} />);
    const next = screen.getByRole('region', { name: 'What next' });
    expect(next.textContent).toMatch(/provisional/i);
    expect(next.textContent).toMatch(/15 of 20 cases decided/);
    fireEvent.click(within(next).getByRole('button', { name: 'Continue' }));
    expect(props.onContinue).toHaveBeenCalled();
  });

  it('offers Export HTML report when all cases are decided', () => {
    const onExport = vi.fn();
    render(<ResultsStep results={final} {...finalContext} {...props} onExport={onExport} />);
    const next = screen.getByRole('region', { name: 'What next' });
    fireEvent.click(within(next).getByRole('button', { name: 'Export HTML report' }));
    expect(onExport).toHaveBeenCalled();
  });

  it('has the three views as tabs in order: Summary, Error analysis, Test case list', () => {
    render(<ResultsStep results={final} {...finalContext} {...props} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Summary', 'Error analysis', 'Test case list']);
    expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe('true');
  });
});
