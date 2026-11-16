// "Show the issue" finds the passage of an expected error and a field by comparing their names in code, never with a CSS
// selector built from them (Constitution IX, S9, T408): an error id or a field name may hold quotes and brackets.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import { useShowIssue, type ShowTarget } from '../../../src/ui/windows/case-window/useShowIssue';

function Harness({ errors, fields, target }: { errors: string[]; fields: string[]; target: ShowTarget }) {
  const ref = useRef<HTMLDivElement>(null);
  const { show } = useShowIssue(ref);
  return (
    <div>
      <button type="button" onClick={() => show(target)}>
        Show the issue
      </button>
      <div ref={ref}>
        {fields.map((name) => (
          <section key={name} data-field={name} data-testid={`field:${name}`}>
            {errors.map((id) => (
              <span key={id} data-error={id} tabIndex={-1} data-testid={`error:${id}`}>
                passage
              </span>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

let scrolled: Element[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('"Show the issue" with an error id or a field name that holds quotes and brackets (T408)', () => {
  it.each(['e1"]', 'e1\\', "e1'] a"])('error id %s: the focus lands on that error\'s own passage and nothing throws', (id) => {
    render(<Harness errors={['e2', id]} fields={['summary']} target={{ expectedId: id, spots: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the issue' }));
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(document.activeElement).toBe(screen.getByTestId(`error:${id}`));
  });

  it('an error id written to look like a second selector points at its own passage, not at another error', () => {
    const id = 'x"],[data-error="e2';
    render(<Harness errors={['e2', id]} fields={['summary']} target={{ expectedId: id, spots: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the issue' }));
    vi.runAllTimers();
    expect(document.activeElement).toBe(screen.getByTestId(`error:${id}`));
  });

  it('a field name with a quote: the field is brought into view and nothing throws', () => {
    const name = 'source "text"]';
    render(<Harness errors={[]} fields={['summary', name]} target={{ spots: [{ field: name, start: 0, end: 1 }] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the issue' }));
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(scrolled).toEqual([screen.getByTestId(`field:${name}`)]);
  });
});
