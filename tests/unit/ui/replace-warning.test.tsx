// The three-choice warning before work is replaced (FR-004, FR-051).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { guardFor, hasWork, installBeforeUnload, replaceQuestion, type GuardedAction } from '../../../src/app/guard';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { saveTestProject } from '../../../src/app/actions/files';
import { createState, type AppState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';
import { expectCancelFirstMainLast } from '../../helpers/dialog-actions';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const unsaved = (): AppState => ({ ...createState(), step: 'run', project: sampleProject(), unsaved: true });
const renderApp = (ports: FakePorts, state: AppState) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={state} />);
const menu = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
};

const REPLACING: Array<[string, GuardedAction]> = [
  ['Load test project…', 'load-test-project'],
  ['Load demo…', 'load-example'],
  ['New test project', 'start-new-evaluation'],
];

describe('with unsaved changes', () => {
  it.each(REPLACING)('%s asks with Save test project first, Discard and Cancel', (item) => {
    renderApp(createFakePorts(), unsaved());
    menu(item);
    const dialog = screen.getByRole('dialog', { name: 'Unsaved changes' });
    const buttons = within(dialog).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(expect.arrayContaining(['Save test project first', 'Discard', 'Cancel']));
    expect(buttons).toHaveLength(3);
  });

  it('Cancel changes nothing', () => {
    const ports = createFakePorts();
    renderApp(ports, unsaved());
    menu('New test project');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
    expect(screen.getByRole('button', { name: /3\s*Test run/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('Discard goes on with the action', async () => {
    const ports = createFakePorts();
    renderApp(ports, unsaved());
    menu('New test project');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step'));
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
  });

  it('Save test project first saves, then goes on', async () => {
    const ports = createFakePorts();
    renderApp(ports, unsaved());
    menu('New test project');
    fireEvent.click(screen.getByRole('button', { name: 'Save test project first' }));
    await waitFor(() => expect(ports.testProjectTarget.lastText).not.toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step'));
  });

  it('Save test project first stays put when the save is cancelled', async () => {
    const ports = createFakePorts();
    ports.testProjectTarget.nextResult = { status: 'cancelled' };
    renderApp(ports, unsaved());
    menu('New test project');
    fireEvent.click(screen.getByRole('button', { name: 'Save test project first' }));
    await waitFor(() => expect(ports.testProjectTarget.lastText).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /3\s*Test run/ }).getAttribute('aria-current')).toBe('step');
  });
});

const saved = (): AppState => ({ ...unsaved(), unsaved: false });
const REPLACE_TITLE = 'Replace the current work?';
const CONFIRM: Array<[string, string]> = [
  ['Load test project…', 'Load test project'],
  ['Load demo…', 'Load demo'],
  ['New test project', 'New test project'],
];

describe('with work that is saved (T343)', () => {
  it.each(CONFIRM)('%s asks "Replace the current work?" with Cancel first and the action last', (item, confirm) => {
    renderApp(createFakePorts(), saved());
    menu(item);
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
    const dialog = screen.getByRole('dialog', { name: REPLACE_TITLE });
    expectCancelFirstMainLast(dialog, ['Cancel', confirm]);
    expect(dialog.textContent).toMatch(/judge, the test cases and the test run/);
    expect(dialog.textContent).toMatch(/save the test project first/i);
  });

  it('asks right after Save test project', async () => {
    const ports = createFakePorts();
    const done = await saveTestProject(unsaved(), ports, fileEnv);
    renderApp(ports, done.state);
    menu('New test project');
    expect(screen.getByRole('dialog', { name: REPLACE_TITLE })).toBeTruthy();
  });

  it('Cancel changes nothing', () => {
    renderApp(createFakePorts(), saved());
    menu('New test project');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: REPLACE_TITLE })).toBeNull();
    expect(screen.getByRole('button', { name: /3\s*Test run/ }).getAttribute('aria-current')).toBe('step');
  });

  it('the action button goes on with the action', async () => {
    renderApp(createFakePorts(), saved());
    menu('New test project');
    fireEvent.click(within(screen.getByRole('dialog', { name: REPLACE_TITLE })).getByRole('button', { name: 'New test project' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step'));
    expect(screen.queryByRole('dialog', { name: REPLACE_TITLE })).toBeNull();
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
  });

  it('Load demo goes on with the demo after the question', async () => {
    renderApp(createFakePorts(), saved());
    menu('Load demo…');
    fireEvent.click(within(screen.getByRole('dialog', { name: REPLACE_TITLE })).getByRole('button', { name: 'Load demo' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: REPLACE_TITLE })).toBeNull());
    expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step');
  });

  it('with unsaved changes too, only "Unsaved changes" shows', () => {
    renderApp(createFakePorts(), unsaved());
    menu('Load demo…');
    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: REPLACE_TITLE })).toBeNull();
  });
});

describe('with an empty project', () => {
  it.each(CONFIRM)('%s asks nothing', (item) => {
    renderApp(createFakePorts(), createState());
    menu(item);
    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: REPLACE_TITLE })).toBeNull();
  });
});

describe('hasWork and replaceQuestion (T343)', () => {
  it('an empty project has no work', () => {
    expect(hasWork(createState())).toBe(false);
  });

  it.each([
    ['a prompt', (s: AppState): AppState => ({ ...s, project: { ...s.project, judge_set: { ...s.project.judge_set, prompt: 'x' } } })],
    ['a test case', (s: AppState): AppState => ({ ...s, project: sampleProject() })],
    ['a loaded or saved file', (s: AppState): AppState => ({ ...s, hasFile: true })],
  ])('%s is work', (_name, make) => {
    expect(hasWork(make(createState()))).toBe(true);
  });

  it('a blank prompt is no work', () => {
    const s = createState();
    expect(hasWork({ ...s, project: { ...s.project, judge_set: { ...s.project.judge_set, prompt: '  ' } } })).toBe(false);
  });

  it.each<[string, GuardedAction]>([
    ['Load test project', 'load-test-project'],
    ['Load demo', 'load-example'],
    ['New test project', 'start-new-evaluation'],
  ])('the question for %s names the action', (confirm, action) => {
    const q = replaceQuestion(saved(), action);
    expect(q?.title).toBe(REPLACE_TITLE);
    expect(q?.confirm).toBe(confirm);
  });

  it('asks nothing for an empty project, for unsaved work (the other dialog) or for Edit test cases', () => {
    expect(replaceQuestion(createState(), 'load-example')).toBeNull();
    expect(replaceQuestion(unsaved(), 'load-example')).toBeNull();
    expect(replaceQuestion(saved(), 'edit-test-cases')).toBeNull();
  });
});

describe('the guard itself', () => {
  const all: GuardedAction[] = ['load-test-project', 'load-example', 'start-new-evaluation'];
  it.each(all)('%s asks only when there are unsaved changes', (action) => {
    expect(guardFor(unsaved(), action)?.choices).toEqual(['Save test project first', 'Discard', 'Cancel']);
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
