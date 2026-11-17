// An error while drawing shows a panel, not a white page; the work held in the state can still be saved (code review S3; Clarifications 2026-11-16).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { ErrorBoundary } from '../../../src/ui/components/ErrorPanel';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';

const flag = vi.hoisted(() => ({ boom: false, review: false }));
vi.mock('../../../src/core/evaluation/results', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/core/evaluation/results')>();
  return {
    ...original,
    reviewEvaluation: (...args: Parameters<typeof original.reviewEvaluation>) => {
      if (flag.review) throw new Error('The cases could not be read');
      return original.reviewEvaluation(...args);
    },
  };
});
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
  flag.review = false;
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

describe('ErrorBoundary with an error outside drawing (T391, Constitution IX, FR-084)', () => {
  it('shows the panel when a click handler throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);
    try {
      render(
        <ErrorBoundary onSave={async () => {}} onReload={() => {}}>
          <button
            type="button"
            onClick={() => {
              throw new Error('The click failed');
            }}
          >
            Do it
          </button>
        </ErrorBoundary>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The click failed'));
    } finally {
      window.removeEventListener('error', swallow);
    }
  });

  it('shows the panel when an action\'s promise is rejected and nobody catches it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary onSave={async () => {}} onReload={() => {}}>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new Error('The action failed');
    window.dispatchEvent(event);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The action failed'));
    expect(screen.getByRole('button', { name: 'Save test project as…' })).toBeTruthy();
  });

  it('ignores a browser error event with no error object (a foreign "Script error." or a ResizeObserver note)', async () => {
    render(
      <ErrorBoundary onSave={async () => {}}>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('All fine')).toBeTruthy();
  });

  it('stops listening once it is gone', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const view = render(
      <ErrorBoundary onSave={async () => {}}>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    view.unmount();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['error', 'unhandledrejection']));
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

describe('App when reading the cases throws (T411, Constitution IX, FR-084)', () => {
  it('shows the panel instead of a white page, and "Save test project as…" writes the work held in the state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    flag.review = true;
    const ports = createFakePorts();
    const project = sampleProject();
    render(<App ports={ports} env={{ showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } }} initialState={{ ...createState(), project, unsaved: true, step: 'run' }} />);
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByRole('alert').textContent).toContain('The cases could not be read');
    fireEvent.click(screen.getByRole('button', { name: 'Save test project as…' }));
    await waitFor(() => expect(ports.testProjectTarget.lastText).not.toBeNull());
    const written = JSON.parse(ports.testProjectTarget.lastText as string);
    expect(written.dataset.cases).toHaveLength(project.dataset.cases.length);
  });
});

describe('the save of the error panel says what happened (T416)', () => {
  it('shows the message the save returns, for example that the file would be too large', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refusal = 'The test project would be 96 MB; the tool saves files up to 50 MB. Nothing was saved. Remove test cases or shorten long texts, then save again.';
    render(
      <ErrorBoundary onSave={async () => refusal} onReload={() => {}}>
        <Thrower />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save test project as…' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Nothing was saved'));
  });
});

describe('the save of the error panel when the save itself fails (T452, code review finding 1)', () => {
  it('shows "The test project could not be saved: …" and leaves no promise unhandled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      render(
        <ErrorBoundary onSave={async () => { throw new Error('The disk is full'); }} onReload={() => {}}>
          <Thrower />
        </ErrorBoundary>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save test project as…' }));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The test project could not be saved: The disk is full'));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
