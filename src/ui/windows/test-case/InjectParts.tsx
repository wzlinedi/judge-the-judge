import type { ComponentChildren } from 'preact';
import { addRow, baseCasesOf, injectPrompt, NEW_CATEGORY, removeRow, startFrom, updateRow, type ErrorRow, type InjectDraft } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { normalizeCategoryName } from '../../../core/cases/catalog';
import type { PreparedDifficulty } from '../../../core/generation/inject-errors-prompt';
import { labels } from '../../labels';
import { Part } from './CaseParts';
import { PromptEditor } from './PromptEditor';

export interface InjectPartsProps {
  state: AppState;
  draft: InjectDraft;
  onDraft: (draft: InjectDraft) => void;
  /** "Test case name", first in part 1 (T239). */
  nameField?: ComponentChildren;
}

const DIFFICULTIES: ReadonlyArray<{ value: PreparedDifficulty; label: string }> = [
  { value: 'llm', label: 'Left to the LLM' },
  { value: 'obvious', label: 'Obvious' },
  { value: 'subtle', label: 'Subtle' },
];

/** One row of the table "Errors to prepare" (T249): Category, Difficulty, Description, and Remove. */
function Row({ row, number, state, onChange, onRemove }: { row: ErrorRow; number: number; state: AppState; onChange: (patch: Partial<Omit<ErrorRow, 'id'>>) => void; onRemove: () => void }) {
  const catalog = state.evaluation.judge_set.error_catalog;
  const hint = row.isNew ? undefined : catalog.find((c) => c.name === row.category);
  return (
    <tr aria-label={`Error ${number}`}>
      <td>
        <select
          aria-label="Category"
          value={row.isNew ? NEW_CATEGORY : row.category}
          onChange={(event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            onChange(value === NEW_CATEGORY ? { category: '', isNew: true } : { category: value, isNew: false });
          }}
        >
          {catalog.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY}>New category…</option>
        </select>
        {hint?.description ? <p class="muted category-hint">{hint.description}</p> : null}
        {row.isNew ? (
          <div class="new-category">
            <input type="text" aria-label="New category name" placeholder="New category name" value={row.category} onInput={(event) => onChange({ category: (event.currentTarget as HTMLInputElement).value })} />
            {row.category.trim() !== '' && normalizeCategoryName(row.category) !== row.category ? <p class="muted category-hint">{`It is written in lower case with dashes: ${normalizeCategoryName(row.category)}.`}</p> : null}
            <p class="muted category-hint">The category joins the catalog when the case is saved; describe it in Error categories afterwards.</p>
          </div>
        ) : null}
      </td>
      <td>
        <select aria-label="Difficulty" value={row.difficulty} onChange={(event) => onChange({ difficulty: (event.currentTarget as HTMLSelectElement).value as PreparedDifficulty })}>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input type="text" aria-label="Description" placeholder="What should be wrong (optional)" value={row.description} onInput={(event) => onChange({ description: (event.currentTarget as HTMLInputElement).value })} />
      </td>
      <td>
        <button type="button" onClick={onRemove}>
          {labels.remove}
        </button>
      </td>
    </tr>
  );
}

const withoutPrompt = ({ prompt: _edit, ...rest }: InjectDraft): InjectDraft => rest;

/** Parts 1 to 3 of a case with injected errors (FR-040): the base, the errors to prepare, and the prompt for the user's LLM. */
export function InjectParts({ state, draft, onDraft, nameField }: InjectPartsProps) {
  const { clean, withErrors } = baseCasesOf(state);
  const cases = state.evaluation.dataset.cases;
  const base = draft.base === '' ? undefined : cases.find((c) => c.id === draft.base);
  const from = draft.from === '' ? undefined : cases.find((c) => c.id === draft.from);
  const nameOf = (c: { id: string; name: string }) => c.name || `Case ${c.id}`;

  return (
    <>
      <Part number={1} title="Base case">
        <div class="form-grid">
          {nameField}
          <label class="field-label" for="inject-base">
            Base case (optional)
          </label>
          <div>
            <select id="inject-base" value={draft.from} onChange={(event) => onDraft(startFrom(state, draft, (event.currentTarget as HTMLSelectElement).value))}>
              <option value="">None (the LLM writes the whole case)</option>
              {clean.length > 0 ? (
                <optgroup label="Clean cases">
                  {clean.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nameOf(c)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {withErrors.length > 0 ? (
                <optgroup label="Cases with errors (their errors are copied)">
                  {withErrors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nameOf(c)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>
        </div>
        {clean.length === 0 ? <p class="muted">There is no clean case yet, so without a base the LLM writes the whole case. A base is optional.</p> : null}
        {from && from.expected_errors.length > 0 ? (
          <p class="muted" role="status">{`The ${from.expected_errors.length} ${from.expected_errors.length === 1 ? 'error' : 'errors'} of ${nameOf(from)} ${from.expected_errors.length === 1 ? 'is' : 'are'} copied into Errors to prepare. ${base ? `The base text is ${nameOf(base)}.` : 'It has no clean base, so the LLM writes the whole case.'}`}</p>
        ) : null}
        {base ? (
          <div class="base-fields">
            {Object.entries(base.fields).map(([name, value]) => (
              <section key={name} class="field-block">
                <h4 class="field-name">{name}</h4>
                <p class="field-text">{value}</p>
              </section>
            ))}
          </div>
        ) : null}
      </Part>

      <Part number={2} title="Errors to prepare">
        {draft.rows.length > 0 ? (
          <div class="table-scroll">
            <table class="categories-table errors-to-prepare" aria-label="Errors to prepare">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Difficulty</th>
                  <th>Description</th>
                  <th>
                    <span class="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, i) => (
                  <Row key={row.id} row={row} number={i + 1} state={state} onChange={(patch) => onDraft(updateRow(draft, row.id, patch))} onRemove={() => onDraft(removeRow(draft, row.id))} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p class="muted">No error to prepare yet.</p>
        )}
        <button type="button" onClick={() => onDraft(addRow(state, draft))}>
          {labels.addError}
        </button>
      </Part>

      <Part number={3} title="Ask your LLM">
        <p class="muted">Copy this prompt into your LLM. What it returns is a proposal to review, not a guaranteed result.</p>
        <PromptEditor id="inject-prompt" rows={14} built={injectPrompt(state, draft)} edited={draft.prompt} onEdit={(text) => onDraft(text === undefined ? withoutPrompt(draft) : { ...draft, prompt: text })} />
      </Part>
    </>
  );
}
