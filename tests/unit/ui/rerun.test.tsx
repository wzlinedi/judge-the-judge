// "Run again with a new judge…" on the Results step (FR-074, FR-051; User Story 12).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const resultsState = (over: Partial<AppState> = {}): AppState => ({ ...createState(), step: 'results', evaluation: sampleEvaluation(), hasFile: true, ...over });
const show = (state: AppState, ports = createFakePorts()) => render(<App ports={ports} env={env} initialState={state} />);
const bar = () => screen.getByRole('region', { name: 'What next' });
const rerunButton = () => within(bar()).getByRole('button', { name: 'Run again with a new judge…' });

describe('the Results step offers Run again with a new judge… beside its one primary action', () => {
  it('shows it as a quieter button; the primary action stays Export or Continue', () => {
    show(resultsState());
    expect(rerunButton().className).not.toContain('primary');
    expect(within(bar()).getAllByRole('button').filter((b) => b.className.includes('primary'))).toHaveLength(1);
  });

  it('without unsaved changes it goes to the Judge step at once, clears the run and opens the prompt', () => {
    show(resultsState({ unsaved: false }));
    fireEvent.click(rerunButton());
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Message' }).textContent).toMatch(/replies and decisions were cleared/i);
    expect((screen.getByLabelText('Judge prompt') as HTMLTextAreaElement).readOnly).toBe(false);
    expect(screen.getByText(/open for the next run/)).toBeTruthy();
  });

  it('with unsaved changes it asks first; Cancel changes nothing', () => {
    show(resultsState({ unsaved: true }));
    fireEvent.click(rerunButton());
    const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' });
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Discard', 'Save evaluation first']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
    expect(screen.getByRole('region', { name: 'What next' })).toBeTruthy();
    expect(screen.queryByLabelText('Judge prompt')).toBeNull();
  });

  it('Discard goes on without saving', () => {
    const ports = createFakePorts();
    show(resultsState({ unsaved: true }), ports);
    fireEvent.click(rerunButton());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Unsaved changes' })).getByRole('button', { name: 'Discard' }));
    expect(screen.getByLabelText('Judge prompt')).toBeTruthy();
    expect(ports.evaluationTarget.lastText).toBeNull();
  });

  it('Save evaluation first saves the evaluation, then goes on', async () => {
    const ports = createFakePorts();
    show(resultsState({ unsaved: true }), ports);
    fireEvent.click(rerunButton());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save evaluation first' }));
    await waitFor(() => expect(screen.getByLabelText('Judge prompt')).toBeTruthy());
    expect(ports.evaluationTarget.lastText).toContain('"replies"');
    expect(ports.evaluationTarget.fileName).toBeNull();
  });
});
