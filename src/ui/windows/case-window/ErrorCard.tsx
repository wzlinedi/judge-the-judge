import type { ComponentChildren } from 'preact';
import { labels } from '../../labels';
import type { ErrorSide } from './marks';

export interface ErrorCardProps {
  /** "E1" for an expected error; a finding of the judge has none. */
  name?: string;
  /** What is wrong: the description of an expected error, or the words that stand for a finding. */
  title: string;
  /** Short facts in one quiet line: category and difficulty, the rule. */
  facts?: readonly string[];
  /** The passages of the error: the words of the source, then the words of the judged text. */
  sides: readonly ErrorSide[];
  /** "Show the issue"; it is offered only when a passage is in the case. */
  onShow?: (() => void) | undefined;
  /** More buttons beside "Show the issue". */
  actions?: ComponentChildren;
  /** The marks, the state and the source: what differs between Test cases, Run and Results. */
  children?: ComponentChildren;
}

/**
 * One error, shown the same way in Test cases, Run and Results (T251): its number, what is wrong, and one line per side
 * with the name of the field and the passage ("source_text: …", "summary: …"), so that the two texts can be compared.
 */
export function ErrorCard({ name, title, facts = [], sides, onShow, actions, children }: ErrorCardProps) {
  const inCase = sides.some((s) => s.spot !== undefined);
  return (
    <div class="error-card">
      <div class="item-head">
        {name ? <strong>{name}</strong> : null}
        <span class="error-title">{title}</span>
        {facts.length > 0 ? <span class="muted error-facts">{facts.join(' · ')}</span> : null}
        {onShow && inCase ? (
          <button type="button" class="link-button" onClick={onShow}>
            {labels.showInText}
          </button>
        ) : null}
        {actions}
      </div>
      {sides.length > 0 ? (
        <dl class="error-sides">
          {sides.map((side) => (
            <div key={side.role} class={side.field === undefined ? 'error-side not-found' : 'error-side'} data-side={side.role}>
              <dt>{side.field ?? 'not found in the case'}</dt>
              <dd>{`“${side.text}”`}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </div>
  );
}
