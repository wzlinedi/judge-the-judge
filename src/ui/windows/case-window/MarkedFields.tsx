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
}

/**
 * The fields of a case (FR-077). Nothing is highlighted until "Show the issue" points at an error (T257). Every highlight carries its number (E1 …) or a word, so a colour is never the
 * only sign; the text itself is never changed.
 */
export function MarkedFields({ testCase, judged, effective, strong, shown = [], rootRef }: MarkedFieldsProps) {
  return (
    <div ref={rootRef} class="marked-fields">
      {Object.keys(testCase.fields).map((name) => (
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
      ))}
    </div>
  );
}
