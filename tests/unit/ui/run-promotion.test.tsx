// T253: in the case window of Run a real error is added to the expected errors of the case at once, and goes when its mark changes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import type { Evaluation } from '../../../src/core/model';
import { CaseWindowHarness } from '../../helpers/case-window-harness';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.evaluation;
const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, unknown>;

const open = (caseId: string) => {
  const seen: Evaluation[] = [];
  render(<CaseWindowHarness start={demo} caseId={caseId} seen={(e) => seen.push(e)} />);
  return seen;
};
const item = (kind: 'expected' | 'additional', id: string) => document.querySelector<HTMLElement>(`[data-${kind}="${id}"]`) as HTMLElement;
const REAL = 'Real error (missed in scenario)';
const note = () => screen.getByRole('status', { name: 'Expected errors changed' }).textContent;
const errorsOf = (e: Evaluation, id: string) => e.dataset.cases.find((c) => c.id === id)!.expected_errors;

describe('Real error (missed in scenario)', () => {
  it('adds the finding to the expected errors of the case at once, says so in the window, and keeps it in Additional errors with its mark', () => {
    const seen = open('19');
    const before = errorsOf(demo, '19').length;
    fireEvent.click(within(item('additional', 'claims[]#3')).getByRole('button', { name: REAL }));
    const after = errorsOf(seen.at(-1)!, '19');
    expect(after).toHaveLength(before + 1);
    expect(note()).toBe(`Added to the expected errors of case 19 as E${before + 1}.`);
    const finding = item('additional', 'claims[]#3');
    expect(within(finding).getByRole('button', { name: REAL }).getAttribute('aria-pressed')).toBe('true');
    expect(finding.textContent).toContain(`Added to the expected errors as E${before + 1}.`);
    const made = item('expected', after.at(-1)!.id);
    expect(made.textContent).toContain('Found. Added here from a real error of the judge');
    expect(within(made).queryByRole('group')).toBeNull();
  });

  it('the meter counts the pair once, and the case passes', () => {
    open('19');
    const meter = () => screen.getByText(/^Marked \d+ of \d+$/).textContent;
    const total = Number(/of (\d+)/.exec(meter() ?? '')![1]);
    fireEvent.click(within(item('additional', 'claims[]#3')).getByRole('button', { name: REAL }));
    expect(Number(/of (\d+)/.exec(meter() ?? '')![1])).toBe(total);
  });

  it('changing the mark takes the expected error out again, and says so', () => {
    const seen = open('19');
    const before = errorsOf(demo, '19').length;
    fireEvent.click(within(item('additional', 'claims[]#3')).getByRole('button', { name: REAL }));
    fireEvent.click(within(item('additional', 'claims[]#3')).getByRole('button', { name: 'False positive' }));
    expect(errorsOf(seen.at(-1)!, '19')).toHaveLength(before);
    expect(note()).toBe(`Removed from the expected errors of case 19: E${before + 1}.`);
    expect(item('additional', 'claims[]#3').textContent).not.toContain('Added to the expected errors');
  });

  it('Add finding… adds a real error, so it is an expected error at once; Remove takes it out', () => {
    const seen = open('19');
    const before = errorsOf(demo, '19').length;
    fireEvent.click(screen.getByRole('button', { name: 'Add finding…' }));
    const dialog = screen.getByRole('dialog', { name: 'Add finding…' });
    fireEvent.input(within(dialog).getByLabelText('Text of the finding'), { target: { value: 'the old man is young' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(errorsOf(seen.at(-1)!, '19')).toHaveLength(before + 1);
    expect(errorsOf(seen.at(-1)!, '19').at(-1)).toMatchObject({ fragment: 'the old man is young' });
    fireEvent.click(within(document.querySelector('[data-additional="added#1"]') as HTMLElement).getByRole('button', { name: 'Remove' }));
    expect(errorsOf(seen.at(-1)!, '19')).toHaveLength(before);
  });

  it('an applied second opinion that says real promotes the finding', () => {
    const seen = open('19');
    fireEvent.click(screen.getByRole('button', { name: 'Second opinion…' }));
    const dialog = screen.getByRole('dialog', { name: 'Second opinion' });
    fireEvent.input(within(dialog).getByRole('textbox', { name: 'Opinion of your LLM' }), { target: { value: JSON.stringify(opinions['19']) } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply opinion' }));
    expect(errorsOf(seen.at(-1)!, '19')).toHaveLength(errorsOf(demo, '19').length + 1);
    expect(reviewEvaluation(seen.at(-1)!, accuracyMetric).find((r) => r.testCase.id === '19')!.status).toBe('pass');
  });
});
