import type { RefObject } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ErrorSide, ShownSpot } from './marks';

/** What "Show the issue" points at: an expected error by its identifier, and any other places in the fields. */
export interface ShowTarget {
  expectedId?: string;
  spots: ShownSpot[];
}

/** The places of the sides that are in the case; for an expected error its own fragment is highlighted through its identifier. */
export function showTargetOf(sides: readonly ErrorSide[], expectedId?: string): ShowTarget {
  const spots = sides.filter((s) => s.spot !== undefined && !(expectedId !== undefined && s.role === 'judged')).map((s) => s.spot as ShownSpot);
  return { ...(expectedId !== undefined ? { expectedId } : {}), spots };
}

/**
 * "Show the issue" (T240, T251): scrolls to the fields, puts the focus on the passage of the judged text and highlights
 * both passages strongly for a moment. One behaviour for Test cases, Run and Results.
 */
export function useShowIssue(root: RefObject<HTMLElement | null>) {
  const [target, setTarget] = useState<ShowTarget | null>(null);
  useEffect(() => {
    if (!target) return;
    const timer = setTimeout(() => setTarget(null), 2500);
    return () => clearTimeout(timer);
  }, [target]);

  const show = (next: ShowTarget) => {
    setTarget(next);
    // after the highlight is drawn, bring the fields into view and put the focus on the place
    setTimeout(() => {
      const fields = root.current;
      const own = next.expectedId !== undefined ? fields?.querySelector<HTMLElement>(`mark[data-error="${next.expectedId}"]`) : null;
      const el = own ?? fields?.querySelector<HTMLElement>('mark[data-shown]') ?? fields?.querySelector<HTMLElement>(`[data-field="${next.spots[0]?.field ?? ''}"]`);
      el?.scrollIntoView?.({ block: 'center' });
      el?.focus?.();
    }, 0);
  };
  return { strong: target?.expectedId ?? null, shown: target?.spots ?? [], show };
}
