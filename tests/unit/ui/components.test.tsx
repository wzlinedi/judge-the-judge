import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { Dialog } from '../../../src/ui/components/Dialog';
import { CaseWindowFrame } from '../../../src/ui/components/CaseWindowFrame';
import { TestCaseFrame } from '../../../src/ui/windows/test-case/TestCaseFrame';
import { NextBar } from '../../../src/ui/components/shell/NextBar';
import { JsonBox } from '../../../src/ui/components/JsonBox';
import { Explain } from '../../../src/ui/components/Explain';
import { StatusMark } from '../../../src/ui/components/StatusMark';
import { EmptyState } from '../../../src/ui/components/EmptyState';
import { CopyButton } from '../../../src/ui/components/CopyButton';
import { FilePicker } from '../../../src/ui/components/FilePicker';
import { download } from '../../../src/ui/components/download';

describe('Dialog', () => {
  it('opens as a modal dialog, moves focus inside and returns it on close', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open it</button>
          <Dialog open={open} title="Title" onClose={() => setOpen(false)} actions={<button>Do</button>}>
            <input aria-label="Name" />
          </Dialog>
        </div>
      );
    }
    render(<Host />);
    const opener = screen.getByText('Open it');
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('traps Tab inside', async () => {
    render(
      <Dialog open title="T" onClose={() => {}} actions={<button>Last</button>}>
        <button>First</button>
      </Dialog>,
    );
    const last = await screen.findByText('Last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).not.toBe(last);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('pins the action row to the bottom, outside the scrolling content', async () => {
    render(
      <Dialog open title="T" onClose={() => {}} actions={<button>Go</button>}>
        <p>long</p>
      </Dialog>,
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('.dialog-body')).not.toBeNull();
    const actions = dialog.querySelector('.dialog-actions');
    expect(actions?.textContent).toContain('Go');
    expect(actions?.parentElement).toBe(dialog.querySelector('form, .dialog-frame') ?? dialog);
  });

  it('renders nothing when closed', () => {
    render(<Dialog open={false} title="T" onClose={() => {}}>x</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CaseWindowFrame', () => {
  const frame = (props: Partial<Parameters<typeof CaseWindowFrame>[0]> = {}) => {
    const handlers = { onPrevious: vi.fn(), onNext: vi.fn(), onClose: vi.fn() };
    render(
      <CaseWindowFrame title="Case A" index={1} total={3} left={<p>left pane</p>} right={<p>right pane</p>} {...handlers} {...props} />,
    );
    return handlers;
  };

  it('shows the position and a header with Previous, Next and Close', () => {
    frame();
    expect(screen.getByText('2 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous test case' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next test case' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Case A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' }).closest('.case-window-header')).not.toBeNull();
  });

  it('keeps two columns that scroll on their own', () => {
    frame();
    const panes = document.querySelectorAll('.case-pane');
    expect(panes).toHaveLength(2);
    expect(panes[0]?.textContent).toBe('left pane');
    expect(panes[1]?.textContent).toBe('right pane');
  });

  it('moves with the buttons and with Alt + Left and Alt + Right', () => {
    const h = frame();
    fireEvent.click(screen.getByRole('button', { name: 'Next test case' }));
    expect(h.onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true });
    expect(h.onPrevious).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
    expect(h.onNext).toHaveBeenCalledTimes(2);
  });

  it('disables Previous on the first case and Next on the last', () => {
    frame({ index: 0 });
    expect((screen.getByRole('button', { name: 'Previous test case' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next test case' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables Next on the last case, and Alt + arrow then does nothing', () => {
    const h = frame({ index: 2 });
    expect((screen.getByRole('button', { name: 'Next test case' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
    expect(h.onNext).not.toHaveBeenCalled();
  });

  describe('as a window (Principle VII: windows trap and return focus, and Escape closes)', () => {
    it('moves the focus into the window when it opens, and returns it to what had it when it closes', async () => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      const { unmount } = render(<CaseWindowFrame title="Case A" index={0} total={2} left={<p>left</p>} right={<p>right</p>} onPrevious={() => {}} onNext={() => {}} onClose={() => {}} />);
      expect(screen.getByRole('dialog', { name: 'Case A' }).contains(document.activeElement)).toBe(true);
      unmount();
      await waitFor(() => expect(document.activeElement).toBe(opener));
      opener.remove();
    });

    it('returns the focus to what had it even when opening the window already took it away (the page behind turns inert)', async () => {
      const opener = document.createElement('button');
      document.body.appendChild(opener);
      opener.focus();
      opener.blur(); // an inert page loses the focus before the window can ask what had it
      const { unmount } = render(<CaseWindowFrame title="Case A" index={0} total={2} left={<p>left</p>} right={<p>right</p>} onPrevious={() => {}} onNext={() => {}} onClose={() => {}} />);
      unmount();
      await waitFor(() => expect(document.activeElement).toBe(opener));
      opener.remove();
    });

    it('closes with Escape', () => {
      const h = frame();
      fireEvent.keyDown(screen.getByRole('dialog', { name: 'Case A' }), { key: 'Escape' });
      expect(h.onClose).toHaveBeenCalledTimes(1);
    });

    it('leaves Escape to a dialog that is open inside the window', () => {
      const h = frame({
        overlay: (
          <dialog open aria-label="Inner">
            <button>Inner button</button>
          </dialog>
        ),
      });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Inner button' }), { key: 'Escape' });
      expect(h.onClose).not.toHaveBeenCalled();
    });

    it('keeps Tab inside the window: from the last control to the first, and Shift + Tab the other way', () => {
      frame({ left: <button>First in the pane</button>, right: <button>Last in the pane</button> });
      const window = screen.getByRole('dialog', { name: 'Case A' });
      const controls = Array.from(window.querySelectorAll<HTMLElement>('button:not([disabled])'));
      const first = controls[0] as HTMLElement;
      const last = controls[controls.length - 1] as HTMLElement;
      last.focus();
      fireEvent.keyDown(last, { key: 'Tab' });
      expect(document.activeElement).toBe(first);
      first.focus();
      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  });
});

describe('TestCaseFrame as a window', () => {
  it('Escape closes it when nothing was typed, and asks first when something was', () => {
    const onClose = vi.fn();
    const { unmount } = render(<TestCaseFrame title="Test case" dirty={false} onClose={onClose}><p>left</p></TestCaseFrame>);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Test case' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    const again = vi.fn();
    render(<TestCaseFrame title="Test case" dirty onClose={again}><p>left</p></TestCaseFrame>);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Test case' }), { key: 'Escape' });
    expect(again).not.toHaveBeenCalled();
    expect(screen.getByText('What you typed or pasted has not been saved.')).toBeTruthy();
  });

  it('takes the focus when it opens', () => {
    render(<TestCaseFrame title="Test case" dirty={false} onClose={() => {}}><button>Inside</button></TestCaseFrame>);
    expect(screen.getByRole('dialog', { name: 'Test case' }).contains(document.activeElement)).toBe(true);
  });
});

describe('NextBar', () => {
  it('shows one sentence, an optional second line and exactly one primary action', () => {
    const onClick = vi.fn();
    render(<NextBar sentence="Add your first test case." detail="0 cases so far" action={{ label: 'Add test case', onClick }} />);
    expect(screen.getByText('Add your first test case.')).toBeTruthy();
    expect(screen.getByText('0 cases so far')).toBeTruthy();
    const primary = document.querySelectorAll('button.primary');
    expect(primary).toHaveLength(1);
    fireEvent.click(primary[0] as Element);
    expect(onClick).toHaveBeenCalled();
  });

  it('can disable the action', () => {
    render(<NextBar sentence="s" action={{ label: 'Next: Test cases', onClick: () => {}, disabled: true }} />);
    expect((screen.getByRole('button', { name: 'Next: Test cases' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('JsonBox', () => {
  it('checks as it changes and shows problems with line and column or field path, keeping the text', () => {
    const check = (text: string) =>
      text === 'bad' ? [{ message: 'Not readable', line: 2, column: 5 }, { message: 'Missing', path: 'fields.summary' }] : [];
    function Host() {
      const [text, setText] = useState('');
      return <JsonBox label="Case JSON" value={text} onChange={setText} check={check} />;
    }
    render(<Host />);
    const box = screen.getByLabelText('Case JSON') as HTMLTextAreaElement;
    fireEvent.input(box, { target: { value: 'bad' } });
    expect(box.value).toBe('bad');
    expect(screen.getByText(/Line 2, column 5/)).toBeTruthy();
    expect(screen.getByText(/fields\.summary/)).toBeTruthy();
    fireEvent.input(box, { target: { value: 'good' } });
    expect(screen.queryByText(/Line 2, column 5/)).toBeNull();
    expect(box.value).toBe('good');
  });
});

describe('Explain', () => {
  it('opens one explanation on demand', () => {
    render(<Explain>The longer explanation.</Explain>);
    const button = screen.getByRole('button', { name: 'Explain' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('The longer explanation.')).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('The longer explanation.')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByText('The longer explanation.')).toBeNull();
  });
});

describe('StatusMark', () => {
  it.each([
    ['pass', 'Pass', '✓'],
    ['fail', 'Fail', '✕'],
    ['awaiting', 'Awaiting verification', '…'],
    ['not_run', 'Not run', '–'],
  ] as const)('%s shows a word and a sign, not only a color', (status, word, sign) => {
    const { container } = render(<StatusMark status={status} />);
    expect(container.textContent).toContain(word);
    expect(container.textContent).toContain(sign);
  });
});

describe('EmptyState', () => {
  it('says what is missing and offers one action', () => {
    const onClick = vi.fn();
    render(<EmptyState title="No test cases yet" action={{ label: 'Add test case', onClick }}>Add one to begin.</EmptyState>);
    expect(screen.getByText('No test cases yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add test case' }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('CopyButton', () => {
  it('copies the text and confirms', async () => {
    const copy = vi.fn(async () => {});
    render(<CopyButton text="prompt text" label="Copy prompt" copy={copy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith('prompt text'));
    expect(await screen.findByText('Copied')).toBeTruthy();
  });
});

describe('FilePicker', () => {
  it('offers a picker button and reads a dropped file without remembering it', async () => {
    const onPick = vi.fn();
    const onFile = vi.fn();
    render(<FilePicker label="Load evaluation" onPick={onPick} onFile={onFile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load evaluation' }));
    expect(onPick).toHaveBeenCalled();
    const file = new File(['{}'], 'x.json', { type: 'application/json' });
    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file, 'drop');
  });
});

describe('download', () => {
  it('saves text through a link with the file name', () => {
    const created: string[] = [];
    const url = { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() };
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      created.push(this.download);
    });
    download('report.html', '<p>hi</p>', 'text/html', url);
    expect(created).toEqual(['report.html']);
    expect(url.createObjectURL).toHaveBeenCalled();
    expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });
});

describe('no "More actions" menu (FR-008)', () => {
  it('appears in no component', () => {
    const { container } = render(
      <div>
        <NextBar sentence="s" action={{ label: 'Go', onClick: () => {} }} />
        <EmptyState title="t" />
        <Explain>e</Explain>
        <CopyButton text="x" label="Copy prompt" />
      </div>,
    );
    expect(container.textContent).not.toMatch(/more actions/i);
  });
});
