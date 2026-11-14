import type { ComponentChildren } from 'preact';

/**
 * A wide table scrolls inside its own container, never the page (Principle VII). A container that scrolls is a region the keyboard can reach,
 * so that a keyboard user can scroll it too.
 */
export function TableScroll({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
