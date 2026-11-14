import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, edit } from '../../../src/app/store';
import { labels } from '../../../src/ui/labels';

const supportedEnv = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };

const renderApp = (props: Partial<Parameters<typeof App>[0]> = {}) =>
  render(<App ports={createFakePorts()} env={supportedEnv} {...props} />);

describe('header', () => {
  it('shows the tool name, four numbered steps and Help', () => {
    renderApp();
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Judge the Judge')).toBeTruthy();
    const nav = within(header).getByRole('navigation', { name: 'Steps' });
    const steps = within(nav).getAllByRole('button');
    expect(steps.map((s) => s.textContent)).toEqual(['1Judge', '2Test cases', '3Run', '4Results', 'Help']);
    expect(steps[0]?.getAttribute('aria-current')).toBe('step');
  });

  it('shows the one indicator: nothing to save, unsaved, all saved with the file name', () => {
    const { unmount } = renderApp();
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
    unmount();

    renderApp({ initialState: edit(createState(), (e) => ({ ...e, model_note: 'x' })) });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('says "All changes saved" with the file name', () => {
    renderApp({ initialState: { ...createState(), hasFile: true, evaluationFile: 'run-1.json' } });
    expect(screen.getByText(/All changes saved/)).toBeTruthy();
    expect(screen.getByText(/run-1\.json/)).toBeTruthy();
  });

  it('has a File menu with exactly the file actions and no Save evaluation', () => {
    renderApp();
    const button = screen.getByRole('button', { name: labels.file });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(button);
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual([
      'Load evaluation…', 'Load test project…', 'Save test project', 'Save test project as…',
      'Import test cases…', 'Export test cases…', 'Load demo…', 'New evaluation',
    ]);
    expect(screen.queryByRole('button', { name: /^Save evaluation/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /^Save evaluation/ })).toBeNull();
  });

  it('shows the remembered test project file, or "no file chosen yet"', () => {
    const { unmount } = renderApp();
    expect(screen.getByText(/no file chosen yet/)).toBeTruthy();
    unmount();
    renderApp({ initialState: { ...createState(), testProjectFile: 'books.json' } });
    expect(screen.getByText(/books\.json/)).toBeTruthy();
  });

  it('opens and closes the menu with the keyboard and Escape', () => {
    renderApp();
    const button = screen.getByRole('button', { name: labels.file });
    button.focus();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0] as Element, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1] as Element, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('opens the "Load demo…" window with the ready examples and "Load metric definition…"', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: labels.file }));
    fireEvent.click(screen.getByRole('menuitem', { name: labels.loadExample }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Accuracy/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /Completeness/ })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: /demo/i })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: labels.loadMetricDefinition })).toBeTruthy();
  });
});

describe('the "what next" line', () => {
  it('shows one sentence and exactly one primary button, with no welcome section', () => {
    renderApp();
    const region = screen.getByRole('region', { name: 'What next' });
    expect(within(region).getAllByRole('button').filter((b) => b.classList.contains('primary'))).toHaveLength(1);
    expect(region.textContent?.trim().length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/welcome/i);
  });

  it('a step that is not available shows one sentence and a button that leads to the step needed', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: /3\s*Run/ }));
    const gate = screen.getByRole('region', { name: 'Not available yet' });
    expect(within(gate).getByText(/finalized/i)).toBeTruthy();
    const buttons = within(gate).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] as Element);
    expect(screen.getByRole('button', { name: /2\s*Test cases/ }).getAttribute('aria-current')).toBe('step');
  });
});

describe('footer and browser notice', () => {
  it('shows the tool version and that data stays on this device', () => {
    renderApp();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain(__TOOL_VERSION__);
    expect(footer.textContent).toMatch(/stays on this device/i);
  });

  it('shows no notice in Chrome or Edge', () => {
    renderApp();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the tool supports Chrome and Edge when the save file or the clipboard is missing', () => {
    renderApp({ env: { navigator: {} } });
    const notice = screen.getByRole('alert');
    expect(notice.textContent).toMatch(/Chrome/);
    expect(notice.textContent).toMatch(/Edge/);
  });
});
