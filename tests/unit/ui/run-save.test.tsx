// US6 in the interface: where Save test project lives, the indicator, loading and Continue (FR-051, FR-073, FR-076, SC-038).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { saveTestProject } from '../../../src/app/actions/files';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { withoutTestRun } from '../../../src/core/cases/test-run';
import { sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const demoText = readFileSync('examples/demo/test-project.json', 'utf8');

const renderApp = (ports: FakePorts, initialState?: AppState) => render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={initialState} />);
const stateOn = (step: AppState['step'], evaluation: TestProject = sampleProject(), extra: Partial<AppState> = {}): AppState => ({ ...createState(), step, project: evaluation, ...extra });
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
  it('shows the one Save test project button in the header of every step, with its file name under it (T242, T303)', () => {
    for (const step of ['judge', 'run', 'cases', 'results', 'help'] as const) {
      const view = renderApp(createFakePorts(), stateOn(step, sampleProject(), { testProjectFile: 'books.json' }));
      const header = screen.getByRole('banner');
      expect(within(header).getAllByRole('button', { name: 'Save test project' })).toHaveLength(1);
      expect(within(header).queryByRole('button', { name: /Save evaluation/ })).toBeNull();
      expect(within(header).getByText('books.json')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Save evaluation/ })).toBeNull();
      view.unmount();
    }
  });

  it('says "no file yet" under a button before its first save', () => {
    renderApp(createFakePorts(), stateOn('judge'));
    expect(within(screen.getByRole('banner')).getAllByText('no file yet')).toHaveLength(1);
  });

  it('has no save button in the Run case window or on the Run step: the reminder points to the header', () => {
    renderApp(createFakePorts(), stateOn('run', sampleProject(), { openCase: '1' }));
    const dialog = screen.getByRole('dialog', { name: /Case 1/ });
    expect(within(dialog).queryByRole('button', { name: /Save test project/ })).toBeNull();
  });
});

describe('the indicator', () => {
  it('turns to "All changes saved" with the file name after Save test project', async () => {
    renderApp(createFakePorts(), stateOn('run', sampleProject(), { unsaved: true }));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    await waitFor(() => expect(screen.getByText('All changes saved (test-project.json)')).toBeTruthy());
  });

  it('turns to saved after Save test project also when replies exist, with no second message', async () => {
    renderApp(createFakePorts(), stateOn('judge', sampleProject(), { unsaved: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    await waitFor(() => expect(screen.getByText(/All changes saved/)).toBeTruthy());
    expect(screen.queryByText(/Replies are kept only/)).toBeNull();
    expect(screen.getByText('test-project.json')).toBeTruthy();
  });

  it('turns to saved after Save test project when there are no replies', async () => {
    renderApp(createFakePorts(), stateOn('judge', withRun(sampleProject(), { replies: {}, decisions: {} }), { unsaved: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    await waitFor(() => expect(screen.getByText(/All changes saved/)).toBeTruthy());
  });
});

describe('loading', () => {
  it('Load test project, answered "Load with the test run", opens the first step with unfinished work and says how far the work is', async () => {
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load test project…', demoText, 'demo-run.json');
    const question = await screen.findByRole('dialog', { name: 'Load test project' });
    fireEvent.click(within(question).getByRole('button', { name: 'Load with the test run' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /3\s*Run/ }).getAttribute('aria-current')).toBe('step'));
    const next = screen.getByRole('region', { name: 'What next' });
    expect(within(next).getByText('15 of 20 cases decided')).toBeTruthy();
    expect(screen.getByText('All changes saved (demo-run.json)')).toBeTruthy();
    fireEvent.click(within(next).getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('dialog', { name: /Case 3/ })).toBeTruthy();
  });

  it('a file with a test run asks first; "Cancel" changes nothing, "Load the test project only" opens Test cases with no remembered file', async () => {
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load test project…', demoText, 'demo-run.json');
    const question = await screen.findByRole('dialog', { name: 'Load test project' });
    fireEvent.click(within(question).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Load test project' })).toBeNull();
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
    await loadFile(ports, 'Load test project…', demoText, 'demo-run.json');
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Load test project' })).getByRole('button', { name: 'Load the test project only' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /2\s*Test cases/ }).getAttribute('aria-current')).toBe('step'));
    expect(within(screen.getByRole('banner')).getByText('no file yet')).toBeTruthy();
  });

  it('a file with no test run loads at once and shows its file name', async () => {
    const saver = createFakePorts();
    await saveTestProject(stateOn('judge', withoutTestRun(sampleProject())), saver, fileEnv);
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load test project…', saver.testProjectTarget.lastText!, 'books.json');
    await waitFor(() => expect(screen.getByRole('button', { name: /2\s*Test cases/ }).getAttribute('aria-current')).toBe('step'));
    expect(screen.getByText('books.json')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'What next' })).getByText('2 test cases')).toBeTruthy();
  });

  it('an invalid file shows a message with where the problem is and changes nothing', async () => {
    const ports = createFakePorts();
    renderApp(ports, stateOn('judge', sampleProject(), { testProjectFile: 'mine.json' }));
    await loadFile(ports, 'Load test project…', '{ "format": ');
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
    const e = sampleProject();
    e.testRun!.decisions = {};
    e.testRun!.replies = { '1': e.testRun!.replies['1']! };
    renderApp(createFakePorts(), stateOn('run', e));
    expect(within(screen.getByRole('region', { name: 'What next' })).getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('Results has no Continue even while cases are not decided: its main action is Export HTML report (T267)', async () => {
    const e = sampleProject();
    e.testRun!.decisions = {};
    e.testRun!.replies = { '1': e.testRun!.replies['1']! };
    renderApp(createFakePorts(), stateOn('results', e));
    const next = screen.getByRole('region', { name: 'What next' });
    expect(within(next).queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(within(next).getByRole('button', { name: 'Export HTML report…' })).toBeTruthy();
  });

  it('saving after loading goes to the same file', async () => {
    const saver = createFakePorts();
    await saveTestProject(stateOn('run'), saver, fileEnv);
    const ports = createFakePorts();
    renderApp(ports);
    await loadFile(ports, 'Load test project…', saver.testProjectTarget.lastText!, 'again.json');
    fireEvent.click(await screen.findByRole('button', { name: 'Load with the test run' }));
    await waitFor(() => expect(screen.getByText('All changes saved (again.json)')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /3\s*Run/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save test project' }));
    await waitFor(() => expect(ports.testProjectTarget.lastText).not.toBeNull());
    expect(ports.testProjectTarget.asked).toBe(0);
  });
});
