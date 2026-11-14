import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The last element outside a window that had the focus. The page behind a window is made inert as the window opens, which takes the focus
 * away before the window can ask what had it, so it is followed here.
 */
let lastOutside: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && !target.closest('.case-window, dialog')) lastOutside = target;
  });
}

/**
 * What every window that fills the screen does (Principle VII): it takes the focus when it opens and gives it back when it closes, Escape
 * closes it and Tab stays inside it. The page behind is inert, so without this the focus would be lost to the start of the document.
 * A dialog open inside the window handles its own Escape and Tab.
 */
export function useWindow(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const previous = active && active !== document.body ? active : lastOutside;
    ref.current?.focus();
    return () => {
      // after the window has left the document, or the removal would take the focus away again
      queueMicrotask(() => {
        if (previous?.isConnected) previous.focus();
        else document.querySelector<HTMLElement>('.step-bar [aria-current="step"], .app-page button')?.focus();
      });
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    const window = ref.current;
    if (!window || event.defaultPrevented || window.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(window.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === window)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { ref, onKeyDown, tabIndex: -1 as const };
}
