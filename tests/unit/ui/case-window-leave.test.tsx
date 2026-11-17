// T464 (code review 2026-11-17 of Phase 34, finding 6; FR-055, FR-056): a readable JSON that comes into the empty box in one change (a paste)
// is saved at once, and leaving the case while that save runs waits for it instead of asking about a reply that is being saved.
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { describe, expect, it, vi } from 'vitest';
import type { ReplyOutcome } from '../../../src/app/actions/replies';
import { createState } from '../../../src/app/store';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { readTestProject } from '../../../src/core/io/test-project-file';
import type { TestProject } from '../../../src/core/model';
import { CaseWindow } from '../../../src/ui/windows/case-window/CaseWindow';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.project;
const first = demo.dataset.cases[0]!.id;
const pastedText = demo.testRun!.replies[first]!.reply;

/** The demo with no reply for the first case. */
function withoutFirstReply(): TestProject {
  const p = structuredClone(demo);
  delete p.testRun!.replies[first];
  return p;
}

/** A save that ends only when the test says so. */
function slowSave() {
  let finish: (outcome: ReplyOutcome) => void = () => {};
  const save = vi.fn(() => new Promise<ReplyOutcome>((resolve) => (finish = resolve)));
  return { save, finish: (status: ReplyOutcome['status']) => finish({ state: createState(), status }) };
}

function Window({ save, onNavigate, onClose = () => {} }: { save: () => Promise<ReplyOutcome>; onNavigate: (id: string) => void; onClose?: () => void }) {
  const [evaluation, setEvaluation] = useState(withoutFirstReply());
  const [current, setCurrent] = useState(first);
  return (
    <CaseWindow
      evaluation={evaluation}
      reviewed={reviewEvaluation(evaluation, accuracyMetric)}
      caseId={current}
      onChange={setEvaluation}
      onNavigate={(id) => {
        onNavigate(id);
        setCurrent(id);
      }}
      onClose={onClose}
      onlyAwaiting={false}
      onOnlyAwaitingChange={() => {}}
      repliesSinceSave={0}
      reply={{ save, paste: async () => ({ state: createState(), status: 'unchanged' }) }}
    />
  );
}

const askDialog = () => screen.queryByRole('dialog', { name: 'The reply in the box is not saved' });

describe('leaving a case while the save of a paste runs (T464)', () => {
  it('waits for the save, asks nothing, and moves on once the reply is saved', async () => {
    const { save, finish } = slowSave();
    const onNavigate = vi.fn();
    render(<Window save={save} onNavigate={onNavigate} />);
    fireEvent.input(screen.getByRole('textbox', { name: 'Judge reply' }), { target: { value: pastedText } });
    expect(save).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next case' }));
    expect(askDialog()).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
    await act(async () => finish('saved'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(askDialog()).toBeNull();
  });
});

// T465 (code review 2026-11-17 of Phase 34, finding 7): leaving twice while the save runs goes on once, to the first target.
describe('leaving twice while the save runs (T465)', () => {
  it('Next case twice moves on once', async () => {
    const { save, finish } = slowSave();
    const onNavigate = vi.fn();
    render(<Window save={save} onNavigate={onNavigate} />);
    fireEvent.input(screen.getByRole('textbox', { name: 'Judge reply' }), { target: { value: pastedText } });
    fireEvent.click(screen.getByRole('button', { name: 'Next case' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next case' }));
    await act(async () => finish('saved'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(demo.dataset.cases[1]!.id);
  });

  it('Next case, then Close, moves on to the next case and does not close', async () => {
    const { save, finish } = slowSave();
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<Window save={save} onNavigate={onNavigate} onClose={onClose} />);
    fireEvent.input(screen.getByRole('textbox', { name: 'Judge reply' }), { target: { value: pastedText } });
    fireEvent.click(screen.getByRole('button', { name: 'Next case' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await act(async () => finish('saved'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
