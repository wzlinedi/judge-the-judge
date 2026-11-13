import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';
import { labels } from '../labels';

/** A small control that opens one explanation on demand (FR-001). */
export function Explain({ children }: { children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span class="explain">
      <button type="button" class="link-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {labels.explain}
      </button>
      {open ? (
        <div id={id} class="explain-body">
          {children}
        </div>
      ) : null}
    </span>
  );
}
