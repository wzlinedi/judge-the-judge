// The three-choice warning before work is replaced (FR-004, FR-051).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { guardFor, installBeforeUnload, type GuardedAction } from '../../../src/app/guard';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { saveEvaluation } from '../../../src/app/actions/files';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const unsaved = (): AppState => ({ ...createState(), step: 'run', evaluation: sampleEvaluation(), unsaved: true });
const renderApp = (ports: FakePorts, state: AppState) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={state} />);
const menu = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'File' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
};

const REPLACING: Array<[string, GuardedAction]> = [
  ['Load test project', 'load-test-project'],
  ['Load evaluation', 'load-evaluation'],
  ['Load example…', 'load-example'],
  ['Start new evaluation', 'start-new-evaluation'],
];

describe('with unsaved changes', () => {
  it.each(REPLACING)('%s asks with Save evaluation first, Discard and Cancel', (item) => {
    renderApp(createFakePorts(), unsaved());
    menu(item);
    const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' });
    const buttons = within(dialog).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(expect.arrayContaining(['Save evaluation first', 'Discard', 'Cancel']));
    expect(buttons).toHaveLength(3);
  });

  it('Cancel changes nothing', () => {
    const ports = createFakePorts();
    renderApp(ports, unsaved());
    menu('Start new evaluation');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
    expect(screen.getByRole('button', { name: /3\s*Run/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('Discard goes on with the action', async () => {
    const ports = createFakePorts();
    renderApp(ports, unsaved());
    menu('Start new evaluation');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step'));
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
  });

  it('Save evaluation first saves, then goes on', async () => {
    const ports = createFakePorts();
    renderApp(ports, unsaved());
    menu('Start new evaluation');
    fireEvent.click(screen.getByRole('button', { name: 'Save evaluation first' }));
    await waitFor(() => expect(ports.evaluationTarget.lastText).not.toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step'));
  });

  it('Save evaluation first stays put when the save is cancelled', async () => {
    const ports = createFakePorts();
    ports.evaluationTarget.nextResult = { status: 'cancelled' };
    renderApp(ports, unsaved());
    menu('Start new evaluation');
    fireEvent.click(screen.getByRole('button', { name: 'Save evaluation first' }));
    await waitFor(() => expect(ports.evaluationTarget.lastText).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /3\s*Run/ }).getAttribute('aria-current')).toBe('step');
  });
});

describe('with nothing unsaved', () => {
  it.each(REPLACING)('%s asks nothing', (item) => {
    renderApp(createFakePorts(), { ...unsaved(), unsaved: false });
    menu(item);
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
  });

  it('asks nothing right after Save evaluation', async () => {
    const ports = createFakePorts();
    const saved = await saveEvaluation(unsaved(), ports, fileEnv);
    renderApp(ports, saved.state);
    menu('Start new evaluation');
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
  });
});

describe('the guard itself', () => {
  const all: GuardedAction[] = ['load-test-project', 'load-evaluation', 'load-example', 'start-new-evaluation', 'edit-judge-and-run-again'];
  it.each(all)('%s asks only when there are unsaved changes', (action) => {
    expect(guardFor(unsaved(), action)?.choices).toEqual(['Save evaluation first', 'Discard', 'Cancel']);
    expect(guardFor({ ...unsaved(), unsaved: false }, action)).toBeNull();
  });

  it('warns on leaving the page only with unsaved changes', () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    const target = { addEventListener: (n: string, l: (e: unknown) => void) => void (listeners[n] = l), removeEventListener: vi.fn() };
    let state = unsaved();
    installBeforeUnload(target as never, () => state);
    const event = { preventDefault: vi.fn(), returnValue: undefined as unknown };
    listeners['beforeunload']?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    state = { ...state, unsaved: false };
    const quiet = { preventDefault: vi.fn(), returnValue: undefined as unknown };
    listeners['beforeunload']?.(quiet);
    expect(quiet.preventDefault).not.toHaveBeenCalled();
  });
});
