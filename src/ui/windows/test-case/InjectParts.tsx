import type { ComponentChildren } from 'preact';
import { addRow, cleanCasesOf, injectPrompt, NEW_CATEGORY, removeRow, updateRow, type ErrorRow, type InjectDraft } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import { normalizeCategoryName } from '../../../core/cases/catalog';
import type { PreparedDifficulty } from '../../../core/generation/inject-errors-prompt';
import { CopyButton } from '../../components/CopyButton';
import { labels } from '../../labels';
import { Part } from './CaseParts';

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

function Row({ row, number, state, onChange, onRemove }: { row: ErrorRow; number: number; state: AppState; onChange: (patch: Partial<Omit<ErrorRow, 'id'>>) => void; onRemove: () => void }) {
  const catalog = state.evaluation.judge_set.error_catalog;
  const id = `inject-row-${row.id}`;
  const hint = row.isNew ? undefined : catalog.find((c) => c.name === row.category);
  return (
    <div role="group" aria-label={`Error ${number}`} class="error-row">
      <h4>{`Error ${number}`}</h4>
      <div class="row-fields">
        <div>
          <label class="field-label" for={`${id}-category`}>
            Category
          </label>
          <select id={`${id}-category`} value={row.isNew ? NEW_CATEGORY : row.category} onChange={(event) => {
            const value = (event.currentTarget as HTMLSelectElement).value;
            onChange(value === NEW_CATEGORY ? { category: '', isNew: true } : { category: value, isNew: false });
          }}>
            {catalog.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>New category…</option>
          </select>
        </div>
        <div>
          <label class="field-label" for={`${id}-difficulty`}>
            Difficulty
          </label>
          <select id={`${id}-difficulty`} value={row.difficulty} onChange={(event) => onChange({ difficulty: (event.currentTarget as HTMLSelectElement).value as PreparedDifficulty })}>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div class="row-what">
          <label class="field-label" for={`${id}-what`}>
            What should be wrong
          </label>
          <input id={`${id}-what`} type="text" value={row.description} onInput={(event) => onChange({ description: (event.currentTarget as HTMLInputElement).value })} />
        </div>
        <div class="row-remove">
          <span class="field-label" aria-hidden="true">
            {'\u00a0'}
          </span>
          <button type="button" onClick={onRemove}>
            {labels.remove}
          </button>
        </div>
      </div>
      {hint?.description ? <p class="muted category-hint">{hint.description}</p> : null}
      {row.isNew ? (
        <div class="form-grid new-category">
          <label class="field-label" for={`${id}-new`}>
            New category name
          </label>
          <div>
            <input id={`${id}-new`} type="text" value={row.category} onInput={(event) => onChange({ category: (event.currentTarget as HTMLInputElement).value })} />
            {row.category.trim() !== '' && normalizeCategoryName(row.category) !== row.category ? <p class="muted category-hint">{`It is written in lower case with dashes: ${normalizeCategoryName(row.category)}.`}</p> : null}
            <p class="muted category-hint">The category joins the catalog when the case is saved; describe it in Error categories afterwards.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Parts 1 to 3 of a case with injected errors (FR-040): the base, the errors to prepare, and the prompt for the user's LLM. */
export function InjectParts({ state, draft, onDraft, nameField }: InjectPartsProps) {
  const clean = cleanCasesOf(state);
  const base = draft.base === '' ? undefined : state.evaluation.dataset.cases.find((c) => c.id === draft.base);
  const prompt = injectPrompt(state, draft);

  return (
    <>
      <Part number={1} title="Base case">
        <div class="form-grid">
          {nameField}
          <label class="field-label" for="inject-base">
            Base case (optional)
          </label>
          <div>
            <select id="inject-base" value={draft.base} onChange={(event) => onDraft({ ...draft, base: (event.currentTarget as HTMLSelectElement).value })}>
              <option value="">None (the LLM writes the whole case)</option>
              {clean.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `Case ${c.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {clean.length === 0 ? <p class="muted">There is no clean case yet, so the LLM writes the whole case. A base is optional.</p> : null}
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
        {draft.rows.map((row, i) => (
          <Row key={row.id} row={row} number={i + 1} state={state} onChange={(patch) => onDraft(updateRow(draft, row.id, patch))} onRemove={() => onDraft(removeRow(draft, row.id))} />
        ))}
        <button type="button" onClick={() => onDraft(addRow(state, draft))}>
          {labels.addError}
        </button>
        <div class="form-grid">
          <label class="field-label" for="inject-instructions">
            Your own instructions (optional)
          </label>
          <div>
            <textarea id="inject-instructions" rows={3} value={draft.instructions} onInput={(event) => onDraft({ ...draft, instructions: (event.currentTarget as HTMLTextAreaElement).value })} />
          </div>
        </div>
      </Part>

      <Part number={3} title="Ask your LLM">
        <p class="muted">Copy this prompt into your LLM. What it returns is a proposal to review, not a guaranteed result.</p>
        <div class="form-grid">
          <label class="field-label" for="inject-prompt">
            Prompt for your LLM
          </label>
          <div>
            <textarea id="inject-prompt" class="json" rows={14} readOnly value={prompt} />
            <CopyButton text={prompt} label={labels.copyPrompt} />
          </div>
        </div>
      </Part>
    </>
  );
}
