import type { RefObject } from 'preact';
import type { ChangedPlace } from '../../../core/cases/text-list-check';
import type { Effective } from '../../../core/evaluation/decisions';
import type { TestCase } from '../../../core/model';
import { fieldMarks, type ShownSpot } from './marks';

const SIGNS: Record<string, string> = { found: '✓', missed: '✕', undecided: '?', ignored: '–' };

export interface MarkedFieldsProps {
  testCase: Pick<TestCase, 'fields' | 'expected_errors'>;
  judged: string | undefined;
  /** The decisions, once there is a reply: the marks then say found, missed, undecided or ignored. */
  effective: Effective | null;
  /** Changed places that no expected error covers (FR-080). */
  uncovered: readonly ChangedPlace[];
  /** The expected error that "Show in text" points at. */
  strong?: string | readonly string[] | null;
  /** Other places that "Show the issue" points at: the words of the source, or the text of a finding of the judge (T251). */
  shown?: readonly ShownSpot[];
  rootRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The fields of a case with the fragments of its expected errors highlighted (FR-077). Every highlight
 * carries its number (E1 …) and a word, so a colour is never the only sign; the text itself is never changed.
 */
export function MarkedFields({ testCase, judged, effective, uncovered, strong, shown = [], rootRef }: MarkedFieldsProps) {
  return (
    <div ref={rootRef} class="marked-fields">
      {Object.keys(testCase.fields).map((name) => (
        <section key={name} class="field-block" data-field={name}>
          <h3>
            {name}
            {name === judged ? ' (judged text)' : ''}
          </h3>
          <p class="field-text">
            {fieldMarks(testCase, name, judged, effective, uncovered, shown).map((segment, i) => {
              if (segment.error) {
                const { id, label, state } = segment.error;
                const sign = effective ? ` ${SIGNS[state] ?? ''}` : '';
                return (
                  <mark key={i} class={`fragment${effective ? ` fragment-${state}` : ''}${(Array.isArray(strong) ? strong.includes(id) : strong === id) ? ' fragment-strong' : ''}`} data-error={id} tabIndex={-1} title={effective ? `${label} ${state}` : label}>
                    <sup>{`${label}${sign}`}</sup>
                    {segment.text}
                  </mark>
                );
              }
              if (segment.shown) {
                return (
                  <mark key={i} class="fragment fragment-strong" data-shown="true" tabIndex={-1}>
                    {segment.text}
                  </mark>
                );
              }
              if (segment.warning) {
                return (
                  <mark key={i} class="fragment fragment-uncovered" tabIndex={-1}>
                    <sup>{segment.warning}</sup>
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
