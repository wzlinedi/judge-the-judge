import { useId } from 'preact/hooks';
import { addCondition, addRule, removeCondition, removeRule, updateCondition, updateRule } from '../../../app/actions/judge';
import { recognizeFields } from '../../../core/judge/fields';
import { hasNoValue, needsValue, validateRules } from '../../../core/judge/rules';
import type { Comparison } from '../../../core/model';
import { Explain } from '../../components/Explain';
import { labels } from '../../labels';
import type { SectionProps } from './PromptSection';
import { RulePreview } from './RulePreview';

const COMPARISONS: ReadonlyArray<[Comparison, string]> = [
  ['equals', 'equals'],
  ['not_equals', 'does not equal'],
  ['greater_than', 'is greater than'],
  ['less_than', 'is less than'],
  ['is_empty', 'is empty'],
  ['is_not_empty', 'is not empty'],
];

const text = (event: Event) => (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;

/** Rules say when the judge has reported an error. The tool never proposes one (FR-013). */
export function RulesSection({ state, onEdit }: SectionProps) {
  const id = useId();
  const set = state.evaluation.judge_set;
  const sample = set.sample_reply ?? '';
  const recognized = sample.trim() === '' ? null : recognizeFields(sample);
  const fields = recognized?.ok ? recognized : null;
  const validations = fields ? validateRules(set.error_rules, fields) : [];

  return (
    <section class="card" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>Error rules</h2>
      <Explain>A rule says when the judge has reported an error. The judge has reported an error when at least one rule holds. The fields come from the sample reply, but a rule can use any value, not only the values seen in the sample.</Explain>
      {set.error_rules.map((rule, r) => {
        const n = r + 1;
        const validation = validations[r];
        return (
          <fieldset key={r} class="rule">
            <legend>{`Rule ${n}`}</legend>
            <div class="rule-head">
              <label>
                {`Name of rule ${n}`}
                <input type="text" value={rule.name} onInput={(event) => onEdit(updateRule(state, r, { name: text(event) }))} />
              </label>
              <label>
                {`Conditions of rule ${n}`}
                <select value={rule.match} onChange={(event) => onEdit(updateRule(state, r, { match: text(event) as 'all' | 'any' }))}>
                  <option value="all">All of the conditions hold</option>
                  <option value="any">Any of the conditions holds</option>
                </select>
              </label>
              <button type="button" aria-label={`Remove rule ${n}`} onClick={() => onEdit(removeRule(state, r))}>
                {labels.remove}
              </button>
            </div>
            {validation && !validation.usable && !validation.unfinished ? <p class="error-note">{`Broken rule: ${validation.reason}`}</p> : null}
            {validation && !validation.usable && validation.unfinished ? <p class="muted unfinished-note">{`Rule ${n} is not used until every condition has a value.`}</p> : null}
            {rule.conditions.map((condition, c) => {
              const m = c + 1;
              const known = fields?.fields.find((f) => f.path === condition.field);
              const takesValue = needsValue(condition);
              const unfinished = fields !== null && hasNoValue(condition);
              const listId = `${id}-values-${r}-${c}`;
              return (
                <div key={c} class="condition">
                  <select aria-label={`Field of condition ${m} of rule ${n}`} value={condition.field} onChange={(event) => onEdit(updateCondition(state, r, c, { field: text(event) }))}>
                    {fields && !known ? <option value={condition.field}>{`${condition.field} (not in the sample reply)`}</option> : null}
                    {fields ? null : <option value={condition.field}>{condition.field}</option>}
                    {fields?.fields.map((f) => (
                      <option key={f.path} value={f.path}>
                        {f.path}
                      </option>
                    ))}
                  </select>
                  <select aria-label={`Comparison of condition ${m} of rule ${n}`} value={condition.comparison} onChange={(event) => onEdit(updateCondition(state, r, c, { comparison: text(event) as Comparison }))}>
                    {COMPARISONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {takesValue ? (
                    <>
                      <input
                        type="text"
                        aria-label={`Value of condition ${m} of rule ${n}`}
                        list={listId}
                        value={condition.value ?? ''}
                        onInput={(event) => onEdit(updateCondition(state, r, c, { value: text(event) }))}
                      />
                      <datalist id={listId}>
                        {known?.values.map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                      <span class="muted value-hint">Any value; it is kept as you type it.</span>
                      {unfinished ? <span class="unfinished-note">{`Condition ${m}: type a value`}</span> : null}
                    </>
                  ) : null}
                  {rule.conditions.length > 1 ? (
                    <button type="button" aria-label={`Remove condition ${m} of rule ${n}`} onClick={() => onEdit(removeCondition(state, r, c))}>
                      {labels.remove}
                    </button>
                  ) : null}
                </div>
              );
            })}
            <button type="button" onClick={() => onEdit(addCondition(state, r))}>
              {labels.addCondition}
            </button>
          </fieldset>
        );
      })}
      <button type="button" onClick={() => onEdit(addRule(state))}>
        {labels.addRule}
      </button>
      <h3>Preview</h3>
      <RulePreview set={set} />
    </section>
  );
}
