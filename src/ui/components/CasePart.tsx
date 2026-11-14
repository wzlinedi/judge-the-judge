import type { ComponentChildren } from 'preact';

/** One numbered part of a window that is one page; the parts follow one another from top to bottom (T229, T230). */
export function Part({ number, title, children }: { number: number; title: string; children: ComponentChildren }) {
  return (
    <section class="case-part">
      <h3>{`${number}. ${title}`}</h3>
      {children}
    </section>
  );
}
