// Deciding after a reply: the buttons under the list of items (FR-008, FR-055, FR-060, FR-062 to FR-064, SC-027).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { RunStep } from '../../../src/ui/steps/run/RunStep';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import type { Evaluation } from '../../../src/core/model';
import { CaseWindowHarness } from '../../helpers/case-window-harness';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.evaluation;

const open = (caseId: string, start: Evaluation = demo) => {
  const seen: Evaluation[] = [];
  render(<CaseWindowHarness start={start} caseId={caseId} seen={(e) => seen.push(e)} />);
  return seen;
};
const win = () => screen.getByRole('dialog', { name: /^Case / });
const item = (kind: 'expected' | 'additional', id: string) => document.querySelector<HTMLElement>(`[data-${kind}="${id}"]`) as HTMLElement;
const addFinding = (text: string, category = '', difficulty = '') => {
  fireEvent.click(within(win()).getByRole('button', { name: 'Add finding…' }));
  const dialog = screen.getByRole('dialog', { name: 'Add finding…' });
  fireEvent.input(within(dialog).getByLabelText('Text of the finding'), { target: { value: text } });
  if (category) fireEvent.input(within(dialog).getByLabelText('Category (optional)'), { target: { value: category } });
  if (difficulty) fireEvent.change(within(dialog).getByLabelText('Difficulty (optional)'), { target: { value: difficulty } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
};

describe('the buttons under the list', () => {
  it('keeps Add finding and Second opinion… always visible, never in a collapsed section', () => {
    open('3');
    for (const name of ['Add finding…', 'Second opinion…']) {
      const button = within(win()).getByRole('button', { name });
      expect(button.closest('details')).toBeNull();
    }
    expect(win().textContent).not.toMatch(/More actions/);
  });

  it('shows Ignore on every item, expected errors and additional findings alike', () => {
    open('17');
    for (const el of document.querySelectorAll<HTMLElement>('[data-expected], [data-additional]')) {
      expect(within(el).getByRole('button', { name: 'Ignore' })).toBeTruthy();
    }
    fireEvent.click(within(item('additional', 'claims[]#2')).getByRole('button', { name: 'Ignore' }));
    expect(within(item('additional', 'claims[]#2')).getByRole('button', { name: 'Ignore' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Add finding…', () => {
  it('opens a dialog with the text, an optional category from the catalog and an optional difficulty', () => {
    open('3');
    fireEvent.click(within(win()).getByRole('button', { name: 'Add finding…' }));
    const dialog = screen.getByRole('dialog', { name: 'Add finding…' });
    expect(within(dialog).getByLabelText('Text of the finding')).toBeTruthy();
    const options = [...dialog.querySelectorAll('datalist option')].map((o) => o.getAttribute('value'));
    expect(options).toContain('factual-error');
    expect(within(dialog).getByLabelText('Difficulty (optional)')).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('adds a finding with its category and difficulty, a Remove button and the source "Set by hand"', () => {
    const seen = open('3');
    addFinding('The prince has a fox', 'factual-error', 'subtle');
    const added = document.querySelector<HTMLElement>('[data-additional="added#1"]') as HTMLElement;
    expect(added.textContent).toContain('The prince has a fox');
    expect(added.textContent).toContain('factual-error');
    expect(added.textContent).toContain('subtle');
    expect(added.textContent).toContain('Set by hand');
    expect(within(added).getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(seen.at(-1)?.decisions['3']?.added_findings[0]).toMatchObject({ text: 'The prince has a fox', category: 'factual-error', difficulty: 'subtle', source: 'manual' });
  });

  it('lets a new category name join the catalog', () => {
    const seen = open('3');
    addFinding('Something odd', 'Brand New Category');
    expect(seen.at(-1)?.judge_set.error_catalog.map((c) => c.name)).toContain('brand-new-category');
  });

  it('removes a finding added by hand, with its mark, and gives a finding read from the reply no Remove', () => {
    const seen = open('3');
    expect(within(item('additional', 'claims[]#2')).queryByRole('button', { name: 'Remove' })).toBeNull();
    addFinding('The prince has a fox');
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-additional="added#1"]') as HTMLElement).getByRole('button', { name: 'Remove' }));
    expect(document.querySelector('[data-additional="added#1"]')).toBeNull();
    expect(seen.at(-1)?.decisions['3']?.added_findings).toEqual([]);
  });

  it('is offered for a reply that could not be read, with the note that the case needs No more findings', () => {
    open('10');
    expect(win().textContent).toMatch(/could not be read/);
    expect(within(win()).getByText(/press No more findings/)).toBeTruthy();
    addFinding('The summary has no content');
    expect(document.querySelector('[data-additional="added#1"]')).not.toBeNull();
    expect(within(win()).getByRole('button', { name: 'No more findings' })).toBeTruthy();
  });
});

describe('the note of a case', () => {
  it('has no Note button or box in the window, and a note a file holds is kept', () => {
    const e = structuredClone(demo);
    e.decisions['3'] = { expected: {}, additional: {}, added_findings: [], approved: false, note: 'an earlier note' };
    const seen = open('3', e);
    expect(within(win()).queryByRole('button', { name: 'Note' })).toBeNull();
    expect(within(win()).queryByRole('textbox', { name: 'Note' })).toBeNull();
    fireEvent.click(within(item('additional', 'claims[]#2')).getByRole('button', { name: 'Real error' }));
    expect(seen.at(-1)?.decisions['3']?.note).toBe('an earlier note');
  });
});

describe('the source of every mark', () => {
  it('says "Automatic", "Set by hand" or "LLM opinion, approved by the user"', () => {
    const e = structuredClone(demo);
    e.decisions['17'] = { expected: { e1: { state: 'missed', source: 'manual' }, e3: { state: 'found', source: 'llm-approved' } }, additional: {}, added_findings: [], approved: false, note: '' };
    open('17', e);
    expect(item('expected', 'e1').textContent).toContain('Set by hand');
    expect(item('expected', 'e3').textContent).toContain('LLM opinion, approved by the user');
  });

  it('says "Automatic" for a mark nobody set', () => {
    open('14');
    expect(item('expected', 'e1').textContent).toContain('Automatic');
  });

  it('keeps the marks of single items visible after pressing them', () => {
    open('17');
    const e2 = item('expected', 'e2');
    fireEvent.click(within(e2).getByRole('button', { name: 'Missed' }));
    expect(within(item('expected', 'e2')).getByRole('button', { name: 'Missed' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('what the Run step does not have', () => {
  it('has no second-opinion card and no approval of several cases', () => {
    const reviewed = reviewEvaluation(demo, accuracyMetric);
    render(<RunStep evaluation={demo} reviewed={reviewed} repliesSinceSave={0} onOpen={() => {}} onAdd={() => {}} onModelDetails={() => {}} />);
    expect(document.body.textContent).not.toMatch(/Second opinion/);
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
  });
});

describe('only the cases that await verification', () => {
  it('limits Next case to them when the box of the window is ticked', () => {
    open('3');
    fireEvent.click(within(win()).getByLabelText('Only cases awaiting verification'));
    expect(within(win()).getByText('1 of 5')).toBeTruthy();
    fireEvent.click(within(win()).getByRole('button', { name: 'Next case' }));
    expect(screen.getByRole('dialog', { name: /^Case 10 / })).toBeTruthy();
  });
});
