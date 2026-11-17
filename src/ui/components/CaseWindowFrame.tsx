import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { labels } from '../labels';
import { useWindow } from './useWindow';

export interface CaseWindowFrameProps {
  title: string;
  /** Zero-based position of the case and the number of cases. */
  index: number;
  total: number;
  /** The two columns of the read-only views. */
  left?: ComponentChildren;
  right?: ComponentChildren;
  /** Instead of the two columns: one vertical page of numbered parts over the whole width (the case window of Run, T230, T247). */
  page?: ComponentChildren;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  /** More controls in the header, for example the save buttons of Run. */
  headerExtra?: ComponentChildren;
  /** For a list that is filtered while the open case is not in it: the text to show and whether each side can move. */
  positionLabel?: string;
  canPrevious?: boolean;
  canNext?: boolean;
  /** Dialogs of the window, rendered inside it so they stay on top of it. */
  overlay?: ComponentChildren;
}

/**
 * The frame shared by the case window of Run, the read-only case view and the test case window
 * (research.md, sections 20 and 33.5): fills the screen, a header that never scrolls, and one scroll area
 * for the whole page; the two columns of the read-only views scroll together and stack below 760 px.
 */
export function CaseWindowFrame({ title, index, total, left, right, page, onPrevious, onNext, onClose, headerExtra, positionLabel, canPrevious, canNext, overlay }: CaseWindowFrameProps) {
  const first = canPrevious === undefined ? index <= 0 : !canPrevious;
  const last = canNext === undefined ? index >= total - 1 : !canNext;

  // The key handler reads the latest values from a ref: a key pressed right after a move must not act on the case that was left.
  const latest = useRef({ first, last, onPrevious, onNext });
  latest.current = { first, last, onPrevious, onNext };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const now = latest.current;
      if (event.key === 'ArrowLeft' && !now.first) {
        event.preventDefault();
        now.onPrevious();
      } else if (event.key === 'ArrowRight' && !now.last) {
        event.preventDefault();
        now.onNext();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const window = useWindow(onClose);

  return (
    <div {...window} class="case-window" role="dialog" aria-modal="true" aria-label={title}>
      <div class="case-window-header">
        <h2 class="case-window-title">{title}</h2>
        <div class="case-window-nav">
          <button type="button" onClick={onPrevious} disabled={first}>
            {labels.previousTestCase}
          </button>
          <span class="case-window-position">{positionLabel ?? `case ${index + 1} of ${total}`}</span>
          <button type="button" onClick={onNext} disabled={last}>
            {labels.nextTestCase}
          </button>
        </div>
        {headerExtra}
        <button type="button" onClick={onClose}>
          {labels.close}
        </button>
      </div>
      {page !== undefined ? (
        <div class="case-window-body">
          <div class="case-page case-page-wide">{page}</div>
        </div>
      ) : (
        <div class="case-window-body">
          <div class="case-columns">
            <section class="case-pane">{left}</section>
            <section class="case-pane">{right}</section>
          </div>
        </div>
      )}
      {overlay}
    </div>
  );
}
