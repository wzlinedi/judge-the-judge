import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { labels } from '../labels';

export interface CaseWindowFrameProps {
  title: string;
  /** Zero-based position of the case and the number of cases. */
  index: number;
  total: number;
  left: ComponentChildren;
  right: ComponentChildren;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  /** More controls in the header, for example the save buttons of Run. */
  headerExtra?: ComponentChildren;
}

/**
 * The frame shared by the case window of Run, the read-only case view and the test case window
 * (research.md, section 20): fills the screen, a header that never scrolls, two columns that scroll
 * on their own and stack below 760 px.
 */
export function CaseWindowFrame({ title, index, total, left, right, onPrevious, onNext, onClose, headerExtra }: CaseWindowFrameProps) {
  const first = index <= 0;
  const last = index >= total - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key === 'ArrowLeft' && !first) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight' && !last) {
        event.preventDefault();
        onNext();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [first, last, onPrevious, onNext]);

  return (
    <div class="case-window" role="group" aria-label={title}>
      <header class="case-window-header" role="banner">
        <h2 class="case-window-title">{title}</h2>
        <div class="case-window-nav">
          <button type="button" onClick={onPrevious} disabled={first}>
            {labels.previousTestCase}
          </button>
          <span class="case-window-position">{`${index + 1} of ${total}`}</span>
          <button type="button" onClick={onNext} disabled={last}>
            {labels.nextTestCase}
          </button>
        </div>
        {headerExtra}
        <button type="button" onClick={onClose}>
          {labels.close}
        </button>
      </header>
      <div class="case-columns">
        <section class="case-pane">{left}</section>
        <section class="case-pane">{right}</section>
      </div>
    </div>
  );
}
