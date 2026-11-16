import type { RefObject } from 'preact';
import type { Effective } from '../../../core/evaluation/decisions';
import type { TestCase } from '../../../core/model';
import { fieldMarks, type ShownSpot } from './marks';

const SIGNS: Record<string, string> = { found: '✓', missed: '✕', undecided: '?', ignored: '–' };

export interface MarkedFieldsProps {
  testCase: Pick<TestCase, 'fields' | 'expected_errors'>;
  judged: string | undefined;
  /** The decisions, once there is a reply: the marks then say found, missed, undecided or ignored. */
  effective: Effective | null;
  /** The expected error that "Show in text" points at. */
  strong?: string | readonly string[] | null;
  /** Other places that "Show the issue" points at: the words of the source, or the text of a finding of the judge (T251). */
  shown?: readonly ShownSpot[];
  rootRef?: RefObject<HTMLDivElement | null>;
  /** Part 1 of the case window and of the read-only case view: the other fields in one column and the judged field in the other (FR-055, FR-092). */
  columns?: boolean;
}

/**
 * The fields of a case (FR-077). Nothing is highlighted until "Show the issue" points at an error (T257). Every highlight carries its number (E1 …) or a word, so a colour is never the
 * only sign; the text itself is never changed.
 */
export function MarkedFields({ testCase, judged, effective, strong, shown = [], rootRef, columns = false }: MarkedFieldsProps) {
  const block = (name: string) => (
    <section key={name} class="field-block" data-field={name}>
      <h3>
        {name}
        {name === judged ? ' (judged text)' : ''}
      </h3>
      <p class="field-text">
        {fieldMarks(testCase, name, judged, effective, shown).map((segment, i) => {
          if (segment.error) {
            // the fragment of an expected error is highlighted only while "Show the issue" points at it (T257); the element stays, so the focus does
            const { id, label, state } = segment.error;
            const isStrong = Array.isArray(strong) ? strong.includes(id) : strong === id;
            if (!isStrong) {
              return (
                <span key={i} data-error={id} tabIndex={-1}>
                  {segment.text}
                </span>
              );
            }
            const sign = effective ? ` ${SIGNS[state] ?? ''}` : '';
            return (
              <span key={i} class={`fragment fragment-strong${effective ? ` fragment-${state}` : ''}`} data-error={id} tabIndex={-1} title={effective ? `${label} ${state}` : label}>
                <sup>{`${label}${sign}`}</sup>
                {segment.text}
              </span>
            );
          }
          if (segment.shown) {
            return (
              <mark key={i} class="fragment fragment-strong" data-shown="true" tabIndex={-1}>
                {segment.text}
              </mark>
            );
          }
          return <span key={i}>{segment.text}</span>;
        })}
      </p>
    </section>
  );

  const names = Object.keys(testCase.fields);
  if (!columns) {
    return (
      <div ref={rootRef} class="marked-fields">
        {names.map(block)}
      </div>
    );
  }
  // Two columns from 760 px: the other fields in the order of the case, then the judged field. The DOM order is the reading order (research.md, 33.5).
  const others = names.filter((name) => name !== judged);
  const own = judged !== undefined && names.includes(judged) ? judged : undefined;
  const single = others.length === 0 || own === undefined;
  return (
    <div ref={rootRef} class={`marked-fields case-fields${single ? ' single' : ''}`}>
      {others.length > 0 ? <div class="case-fields-others">{others.map(block)}</div> : null}
      {own !== undefined ? <div class="case-fields-judged">{block(own)}</div> : null}
    </div>
  );
}
