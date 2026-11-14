import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Dialog } from '../../components/Dialog';
import { useWindow } from '../../components/useWindow';
import { labels } from '../../labels';

export interface TestCaseFrameProps {
  title: string;
  /** True once something was typed or pasted: closing then asks first (FR-038). */
  dirty: boolean;
  onClose: () => void;
  /** The save button and the reason it is disabled; it stands at the bottom of the window (T229). */
  footer?: ComponentChildren;
  children: ComponentChildren;
}

/** The test case window: it fills the screen; the header holds only the title and "Close without saving", the parts follow one another on one page, and the save button is at the bottom. */
export function TestCaseFrame({ title, dirty, onClose, footer, children }: TestCaseFrameProps) {
  const [asking, setAsking] = useState(false);
  const leave = () => (dirty ? setAsking(true) : onClose());
  const window = useWindow(leave);
  return (
    <div {...window} class="case-window" role="dialog" aria-modal="true" aria-label="Test case">
      <div class="case-window-header">
        <h2 class="case-window-title">{title}</h2>
        <button type="button" onClick={leave}>
          {labels.closeWithoutSaving}
        </button>
      </div>
      <div class="case-window-body">
        <div class="case-page">{children}</div>
      </div>
      {footer ? <div class="case-window-footer">{footer}</div> : null}
      <Dialog
        open={asking}
        title="Close without saving?"
        onClose={() => setAsking(false)}
        actions={
          <>
            <button type="button" onClick={() => setAsking(false)}>
              Keep editing
            </button>
            <button type="button" class="primary" onClick={onClose}>
              {labels.closeWithoutSaving}
            </button>
          </>
        }
      >
        <p>What you typed or pasted has not been saved.</p>
      </Dialog>
    </div>
  );
}
