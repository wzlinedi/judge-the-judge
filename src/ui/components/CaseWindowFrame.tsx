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
  /** For a list that is filtered while the open case is not in it: the text to show and whether each side can move. */
  positionLabel?: string;
  canPrevious?: boolean;
  canNext?: boolean;
}

/**
 * The frame shared by the case window of Run, the read-only case view and the test case window
 * (research.md, section 20): fills the screen, a header that never scrolls, two columns that scroll
 * on their own and stack below 760 px.
 */
export function CaseWindowFrame({ title, index, total, left, right, onPrevious, onNext, onClose, headerExtra, positionLabel, canPrevious, canNext }: CaseWindowFrameProps) {
  const first = canPrevious === undefined ? index <= 0 : !canPrevious;
  const last = canNext === undefined ? index >= total - 1 : !canNext;

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
    <div class="case-window" role="dialog" aria-modal="true" aria-label={title}>
      <div class="case-window-header">
        <h2 class="case-window-title">{title}</h2>
        <div class="case-window-nav">
          <button type="button" onClick={onPrevious} disabled={first}>
            {labels.previousTestCase}
          </button>
          <span class="case-window-position">{positionLabel ?? `${index + 1} of ${total}`}</span>
          <button type="button" onClick={onNext} disabled={last}>
            {labels.nextTestCase}
          </button>
        </div>
        {headerExtra}
        <button type="button" onClick={onClose}>
          {labels.close}
        </button>
      </div>
      <div class="case-columns">
        <section class="case-pane">{left}</section>
        <section class="case-pane">{right}</section>
      </div>
    </div>
  );
}
