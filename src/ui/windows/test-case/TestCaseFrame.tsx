import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export interface TestCaseFrameProps {
  title: string;
  /** True once something was typed or pasted: closing then asks first (FR-038). */
  dirty: boolean;
  onClose: () => void;
  headerExtra?: ComponentChildren;
  left: ComponentChildren;
  right?: ComponentChildren;
}

/** The test case window: it fills the screen, always shows "Close without saving", and has two columns that scroll on their own. */
export function TestCaseFrame({ title, dirty, onClose, headerExtra, left, right }: TestCaseFrameProps) {
  const [asking, setAsking] = useState(false);
  return (
    <div class="case-window" role="dialog" aria-modal="true" aria-label="Test case">
      <div class="case-window-header">
        <h2 class="case-window-title">{title}</h2>
        {headerExtra}
        <button type="button" onClick={() => (dirty ? setAsking(true) : onClose())}>
          {labels.closeWithoutSaving}
        </button>
      </div>
      <div class="case-columns">
        <section class="case-pane">{left}</section>
        <section class="case-pane">{right}</section>
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
