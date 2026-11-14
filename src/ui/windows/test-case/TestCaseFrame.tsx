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
  /** The save button and the reason it is disabled; it stands in the header next to "Close without saving" (T233). */
  headerAction?: ComponentChildren;
  children: ComponentChildren;
}

/** The test case window: it fills the screen; the header holds the title, the save button with the reason it is disabled, and "Close without saving"; the parts follow one another on one page, each in a frame. */
export function TestCaseFrame({ title, dirty, onClose, headerAction, children }: TestCaseFrameProps) {
  const [asking, setAsking] = useState(false);
  const leave = () => (dirty ? setAsking(true) : onClose());
  const window = useWindow(leave);
  return (
    <div {...window} class="case-window" role="dialog" aria-modal="true" aria-label="Test case">
      <div class="case-window-header">
        <h2 class="case-window-title">{title}</h2>
        {headerAction ? <div class="case-window-save">{headerAction}</div> : null}
        <button type="button" onClick={leave}>
          {labels.closeWithoutSaving}
        </button>
      </div>
      <div class="case-window-body">
        <div class="case-page">{children}</div>
      </div>
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
