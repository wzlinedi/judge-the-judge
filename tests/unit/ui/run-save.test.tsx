// US6 in the interface: where Save evaluation lives, the indicator, loading and Continue (FR-051, FR-073, FR-076, SC-038).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { saveEvaluation, saveTestProject } from '../../../src/app/actions/files';
import { createState, type AppState } from '../../../src/app/store';
import type { Evaluation } from '../../../src/core/model';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const demoText = readFileSync('examples/demo/evaluation.json', 'utf8');

const renderApp = (ports: FakePorts, initialState?: AppState) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={initialState} />);
const stateOn = (step: AppState['step'], evaluation: Evaluation = sampleEvaluation(), extra: Partial<AppState> = {}): AppState => ({ ...createState(), step, evaluation, ...extra });
const menu = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
};
const loadFile = async (ports: FakePorts, menuItem: string, text: string, name = 'chosen.json') => {
  ports.opener.next = { name, text };
  menu(menuItem);
  await waitFor(() => expect(ports.opener.next).toBeNull());
};

describe('where saving lives (FR-076, SC-038)', () => {
  it('shows Save test project and Save evaluation in the header of every step, each with its file name under it (T242)', () => {
    for (const step of ['judge', 'run', 'cases', 'results', 'help'] as const) {
      const view = renderApp(createFakePorts(), stateOn(step, sampleEvaluation(), { evaluationFile: 'run-1.json', testProjectFile: 'books.json' }));
      const header = screen.getByRole('banner');
      expect(within(header).getByRole('button', { name: 'Save test project' })).toBeTruthy();
      expect(within(header).getByRole('button', { name: 'Save evaluation' })).toBeTruthy();
      expect(within(header).getByText('run-1.json')).toBeTruthy();
      expect(within(header).getByText('books.json')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Save evaluation as/ })).toBeNull();
      view.unmount();
    }
  });

  it('says "no file yet" under a button before its first save', () => {
    renderApp(createFakePorts(), stateOn('judge'));
    expect(within(screen.getByRole('banner')).getAllByText('no file yet')).toHaveLength(2);
  });

  it('has no save button in the Run case window or on the Run step: the reminder points to the header', () => {
    renderApp(createFakePorts(), stateOn('run', sampleEvaluation(), { openCase: '1' }));
    const dialog = screen.getByRole('dialog', { name: /Case 1/ });
    expect(within(dialog).queryByRole('button', { name: /Save evaluation/ })).toBeNull();
  });
});

describe('the indicator', () => {
  it('turns to "All changes saved" with the file name after Save evaluation', async () => {
    renderApp(createFakePorts(), stateOn('run', sampleEvaluation(), { unsaved: true }));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save evaluation' }));
    await waitFor(() => expect(screen.getByText('All changes saved (evaluation.json)')).toBeTruthy());
  });

  it('stays on after Save test project when replies exist, and says replies are kept only by Save evaluation', async () => {
    renderApp(createFakePorts(), stateOn('judge', sampleEvaluation(), { unsaved: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    await waitFor(() => expect(screen.getByText(/Replies are kept only by "Save evaluation"/)).toBeTruthy());
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.getByText('test-project.json')).toBeTruthy();
  });

  it('turns to saved after Save test project when there are no replies', async () => {
    renderApp(createFakePorts(), stateOn('judge', { ...sampleEvaluation(), replies: {}, decisions: {} }, { unsaved: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    await waitFor(() => expect(screen.getByText(/All changes saved/)).toBeTruthy());
  });
});

describe('loading', () => {
  it('Load evaluation opens the first step with unfinished work and says how far the work is', async () => {
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load evaluation…', demoText, 'demo-run.json');
    await waitFor(() => expect(screen.getByRole('button', { name: /3\s*Run/ }).getAttribute('aria-current')).toBe('step'));
    const next = screen.getByRole('region', { name: 'What next' });
    expect(within(next).getByText('15 of 20 cases decided')).toBeTruthy();
    expect(screen.getByText('All changes saved (demo-run.json)')).toBeTruthy();
    fireEvent.click(within(next).getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('dialog', { name: /Case 3/ })).toBeTruthy();
  });

  it('Load test project starts a new evaluation on Run and shows the file name in the File menu', async () => {
    const saver = createFakePorts();
    await saveTestProject(stateOn('judge'), saver, fileEnv);
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load test project…', saver.testProjectTarget.lastText!, 'books.json');
    await waitFor(() => expect(screen.getByRole('button', { name: /3\s*Run/ }).getAttribute('aria-current')).toBe('step'));
    expect(screen.getByText('books.json')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'What next' })).getByText('0 of 2 cases decided')).toBeTruthy();
  });

  it('an invalid file shows a message with where the problem is and changes nothing', async () => {
    const ports = createFakePorts();
    renderApp(ports, stateOn('judge', sampleEvaluation(), { testProjectFile: 'mine.json' }));
    await loadFile(ports, 'Load evaluation…', '{ "format": ');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/not readable JSON/);
    expect(alert.textContent).toMatch(/line 1/);
    expect(screen.getByRole('button', { name: /1\s*Judge/ }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('mine.json')).toBeTruthy();
  });

  it('says plainly that the metric of a file is not loaded (T274)', async () => {
    const saver = createFakePorts();
    await saveTestProject(stateOn('judge'), saver, fileEnv);
    const file = JSON.parse(saver.testProjectTarget.lastText!);
    file.metric = { id: 'bias', parameters: {} };
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load test project…', JSON.stringify(file));
    expect(await screen.findByText(/which is not loaded/)).toBeTruthy();
  });
});

describe('Continue on Run and Results', () => {
  it('Run offers Continue while a case awaits verification or is not run', () => {
    const e = sampleEvaluation();
    e.decisions = {};
    e.replies = { '1': e.replies['1']! };
    renderApp(createFakePorts(), stateOn('run', e));
    expect(within(screen.getByRole('region', { name: 'What next' })).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('Results has no Continue even while cases are not decided: its main action is Export HTML report (T267)', async () => {
    const e = sampleEvaluation();
    e.decisions = {};
    e.replies = { '1': e.replies['1']! };
    renderApp(createFakePorts(), stateOn('results', e));
    const next = screen.getByRole('region', { name: 'What next' });
    expect(within(next).queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(within(next).getByRole('button', { name: 'Export HTML report…' })).toBeTruthy();
  });

  it('saving after loading goes to the same file', async () => {
    const saver = createFakePorts();
    await saveEvaluation(stateOn('run'), saver, fileEnv);
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load evaluation…', saver.evaluationTarget.lastText!, 'again.json');
    await waitFor(() => expect(screen.getByText('All changes saved (again.json)')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /3\s*Run/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save evaluation' }));
    await waitFor(() => expect(ports.evaluationTarget.lastText).not.toBeNull());
    expect(ports.evaluationTarget.asked).toBe(0);
  });
});
