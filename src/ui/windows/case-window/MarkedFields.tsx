import type { RefObject } from 'preact';
import type { ChangedPlace } from '../../../core/cases/text-list-check';
import type { Effective } from '../../../core/evaluation/decisions';
import type { TestCase } from '../../../core/model';
import { fieldMarks } from './marks';

const SIGNS: Record<string, string> = { found: '✓', missed: '✕', undecided: '?', ignored: '–' };

export interface MarkedFieldsProps {
  testCase: Pick<TestCase, 'fields' | 'expected_errors'>;
  judged: string | undefined;
  /** The decisions, once there is a reply: the marks then say found, missed, undecided or ignored. */
  effective: Effective | null;
  /** Changed places that no expected error covers (FR-080). */
  uncovered: readonly ChangedPlace[];
  /** The expected error that "Show in text" points at. */
  strong?: string | null;
  rootRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The fields of a case with the fragments of its expected errors highlighted (FR-077). Every highlight
 * carries its number (E1 …) and a word, so a colour is never the only sign; the text itself is never changed.
 */
export function MarkedFields({ testCase, judged, effective, uncovered, strong, rootRef }: MarkedFieldsProps) {
  return (
    <div ref={rootRef} class="marked-fields">
      {Object.keys(testCase.fields).map((name) => (
        <section key={name} class="field-block">
          <h3>
            {name}
            {name === judged ? ' (judged text)' : ''}
          </h3>
          <p class="field-text">
            {fieldMarks(testCase, name, judged, effective, uncovered).map((segment, i) => {
              if (segment.error) {
                const { id, label, state } = segment.error;
                const sign = effective ? ` ${SIGNS[state] ?? ''}` : '';
                return (
                  <mark key={i} class={`fragment${effective ? ` fragment-${state}` : ''}${strong === id ? ' fragment-strong' : ''}`} data-error={id} tabIndex={-1} title={effective ? `${label} ${state}` : label}>
                    <sup>{`${label}${sign}`}</sup>
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
