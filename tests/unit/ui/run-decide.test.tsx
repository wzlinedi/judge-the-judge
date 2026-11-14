import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { createState } from '../../../src/app/store';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import type { Evaluation } from '../../../src/core/model';
import { CaseWindow } from '../../../src/ui/windows/case-window/CaseWindow';
import { RunStep } from '../../../src/ui/steps/run/RunStep';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.evaluation;

function Window({ caseId, start = demo, onlyAwaiting = false }: { caseId: string; start?: Evaluation; onlyAwaiting?: boolean }) {
  const [evaluation, setEvaluation] = useState(start);
  const [current, setCurrent] = useState(caseId);
  const [only, setOnly] = useState(onlyAwaiting);
  return (
    <CaseWindow
      evaluation={evaluation}
      reviewed={reviewEvaluation(evaluation, accuracyMetric)}
      caseId={current}
      onChange={setEvaluation}
      onNavigate={setCurrent}
      onClose={() => {}}
      onlyAwaiting={only}
      onOnlyAwaitingChange={setOnly}
      saveBar={{ fileName: null, repliesSinceSave: 0, onSave: () => {}, onSaveAs: () => {} }}
      reply={{ save: async () => ({ state: createState(), status: 'unchanged' }), paste: async () => ({ state: createState(), status: 'unchanged' }) }}
    />
  );
}

const item = (kind: 'expected' | 'additional', id: string) => document.querySelector<HTMLElement>(`[data-${kind}="${id}"]`) as HTMLElement;

describe('Run list', () => {
  const reviewed = reviewEvaluation(demo, accuracyMetric);
  const props = { evaluation: demo, reviewed, fileName: null, repliesSinceSave: 3, onOpen: vi.fn(), onAdd: vi.fn(), onSave: vi.fn(), onSaveAs: vi.fn(), onModelDetails: vi.fn() };

  it('shows every case with its status as a word and a sign, and Open', () => {
    render(<RunStep {...props} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(20);
    expect(within(rows[2] as HTMLElement).getByText(/Awaiting verification/)).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText(/Pass/)).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Open' })).toBeTruthy();
  });

  it('can put the cases awaiting verification first, or show only them', () => {
    render(<RunStep {...props} />);
    const select = screen.getByLabelText('Show') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'awaiting-first' } });
    expect(within(screen.getAllByRole('row')[1] as HTMLElement).getByText('3')).toBeTruthy();
    fireEvent.change(select, { target: { value: 'only-awaiting' } });
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(5);
  });

  it('shows progress and the evaluation file card', () => {
    render(<RunStep {...props} fileName="run.json" />);
    expect(screen.getByText(/15 of 20 cases decided/)).toBeTruthy();
    expect(screen.getByText(/3 replies not saved to a file/)).toBeTruthy();
    expect(screen.getByText(/run\.json/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save evaluation' }).classList.contains('primary')).toBe(true);
    expect(screen.getByRole('button', { name: 'Save evaluation as' })).toBeTruthy();
  });

  it('opens a case', () => {
    render(<RunStep {...props} />);
    fireEvent.click(within(screen.getAllByRole('row')[3] as HTMLElement).getByRole('button', { name: 'Open' }));
    expect(props.onOpen).toHaveBeenCalledWith('3');
  });
});

describe('case window of Run, with a reply', () => {
  it('shows the reply in its box', () => {
    render(<Window caseId="3" />);
    expect((screen.getByLabelText('Judge reply') as HTMLTextAreaElement).value).toContain('"claims"');
  });

  it('shows each additional finding with its rule and the marks False positive, Real error and Ignore', () => {
    render(<Window caseId="3" />);
    const finding = item('additional', 'claims[]#2');
    expect(finding.textContent).toContain('The prince speaks about the rose he loves.');
    expect(finding.textContent).toContain('Contradicted or unsupported claim');
    for (const name of ['Issue: false positive', 'Real error', 'Ignore']) expect(within(finding).getByRole('button', { name })).toBeTruthy();
    expect(finding.querySelector('[aria-pressed="true"]')).toBeNull();
  });

  it('shows each expected error with Found, Issue: missed and Ignore, its source and the reason when undecided', () => {
    render(<Window caseId="14" />);
    const e1 = item('expected', 'e1');
    for (const name of ['Found', 'Issue: missed', 'Ignore']) expect(within(e1).getByRole('button', { name })).toBeTruthy();
    expect(within(e1).getByRole('button', { name: 'Found' }).getAttribute('aria-pressed')).toBe('true');
    expect(e1.textContent).toContain('Automatic');
    const e2 = item('expected', 'e2');
    expect(e2.querySelector('.reason')?.textContent).toMatch(/only partly matches/);
  });

  it('makes Approve the primary button while the case awaits verification', () => {
    render(<Window caseId="14" />);
    expect(screen.getByRole('button', { name: 'Approve' }).classList.contains('primary')).toBe(true);
    expect(screen.getAllByText(/Awaiting verification/).length).toBeGreaterThan(0);
  });

  it('takes a decision into account at once and shows who made it', () => {
    render(<Window caseId="3" />);
    fireEvent.click(within(item('additional', 'claims[]#2')).getByRole('button', { name: 'Issue: false positive' }));
    expect(within(item('additional', 'claims[]#2')).getByRole('button', { name: 'Issue: false positive' }).getAttribute('aria-pressed')).toBe('true');
    expect(item('additional', 'claims[]#2').textContent).toContain('Set by hand');
    expect(screen.getAllByText(/Fail/).length).toBeGreaterThan(0);
  });

  it('a real error does not fail the case', () => {
    render(<Window caseId="3" />);
    fireEvent.click(within(item('additional', 'claims[]#2')).getByRole('button', { name: 'Real error' }));
    expect(screen.getAllByText(/Pass/).length).toBeGreaterThan(0);
  });

  it('turns a partly matching finding into an additional finding when its error is marked missed', () => {
    render(<Window caseId="14" />);
    expect(document.querySelector('[data-additional]')).toBeNull();
    fireEvent.click(within(item('expected', 'e2')).getByRole('button', { name: 'Issue: missed' }));
    expect(document.querySelector('[data-additional]')?.textContent).toContain('Victor and the creature');
  });

  it('keeps a reply that could not be read, says why, and needs Approve after marking by hand', () => {
    render(<Window caseId="10" />);
    expect(screen.getByText(/could not be read/i)).toBeTruthy();
    expect(screen.getAllByText(/Awaiting verification/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getAllByText(/Pass/).length).toBeGreaterThan(0);
  });

  it('gives every expected error a mark or the reason it is undecided right after the reply is saved (SC-039)', () => {
    for (let id = 11; id <= 20; id++) {
      const { unmount } = render(<Window caseId={String(id)} />);
      const items = document.querySelectorAll('[data-expected]');
      expect(items).toHaveLength(3);
      for (const e of items) {
        const marked = e.querySelector('[aria-pressed="true"]');
        const reason = e.querySelector('.reason');
        expect(marked !== null || reason !== null, `case ${id} ${(e as HTMLElement).dataset['expected']}`).toBe(true);
      }
      unmount();
    }
  });

  it('shows the data of the case: kind, expected errors with their fragments in the text, and the complete prompt', () => {
    render(<Window caseId="11" />);
    expect(screen.getByText(/Injected errors/)).toBeTruthy();
    expect(document.querySelectorAll('mark.fragment')).toHaveLength(3);
    expect((screen.getByLabelText('Complete judge prompt') as HTMLTextAreaElement).value).toContain('SUMMARY:');
  });

  it('moves between cases with Previous and Next, and can be limited to cases awaiting verification', () => {
    render(<Window caseId="3" />);
    expect(screen.getByText('3 of 20')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next test case' }));
    expect(screen.getByText('4 of 20')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Only cases awaiting verification'));
    fireEvent.click(screen.getByRole('button', { name: 'Next test case' }));
    expect(screen.getByText(/of 5/)).toBeTruthy();
  });

  it('keeps the save buttons in the header', () => {
    render(<Window caseId="3" />);
    expect(screen.getByRole('button', { name: 'Save evaluation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save evaluation as' })).toBeTruthy();
  });
});
