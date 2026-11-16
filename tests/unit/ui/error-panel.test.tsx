// An error while drawing shows a panel, not a white page; the work held in the state can still be saved (code review S3; Clarifications 2026-11-16).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { ErrorBoundary } from '../../../src/ui/components/ErrorPanel';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';

const flag = vi.hoisted(() => ({ boom: false }));
vi.mock('../../../src/ui/steps/judge/JudgeStep', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/ui/steps/judge/JudgeStep')>();
  return {
    ...original,
    JudgeStep: (props: Parameters<typeof original.JudgeStep>[0]) => {
      if (flag.boom) throw new Error('The step could not be drawn');
      return original.JudgeStep(props);
    },
  };
});

afterEach(() => {
  flag.boom = false;
  cleanup();
});

function Thrower(): never {
  throw new Error('Broken child');
}

describe('ErrorBoundary', () => {
  it('shows "Something went wrong" with the text of the error and the two buttons', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary onSave={async () => {}} onReload={() => {}}>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByRole('alert').textContent).toContain('Broken child');
    expect(screen.getByRole('button', { name: 'Save test project as…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });

  it('calls the save and the reload it was given, and draws the children when nothing is wrong', () => {
    const onSave = vi.fn(async () => {});
    const onReload = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary onSave={onSave} onReload={onReload}>
        <Thrower />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save test project as…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
    cleanup();
    render(
      <ErrorBoundary onSave={onSave} onReload={onReload}>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All fine')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});

describe('App with a step that throws', () => {
  it('shows the panel instead of a white page, and "Save test project as…" writes the work held in the state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    flag.boom = true;
    const ports = createFakePorts();
    const project = sampleProject();
    render(<App ports={ports} env={{ showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } }} initialState={{ ...createState(), project, unsaved: true, step: 'judge' }} />);
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByRole('alert').textContent).toContain('The step could not be drawn');
    fireEvent.click(screen.getByRole('button', { name: 'Save test project as…' }));
    await waitFor(() => expect(ports.testProjectTarget.lastText).not.toBeNull());
    const written = JSON.parse(ports.testProjectTarget.lastText as string);
    expect(written.dataset.name).toBe(project.dataset.name);
    expect(written.dataset.cases).toHaveLength(project.dataset.cases.length);
  });
});
