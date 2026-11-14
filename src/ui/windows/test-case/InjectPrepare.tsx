import type { CaseEdit } from '../../../app/actions/cases';
import { addRow, cleanCasesOf, injectPrompt, NEW_CATEGORY, removeRow, updateRow, type ErrorRow, type InjectDraft } from '../../../app/actions/test-case-window';
import type { AppState } from '../../../app/store';
import type { CaseJsonCheck } from '../../../core/model';
import type { PreparedDifficulty } from '../../../core/generation/inject-errors-prompt';
import { CopyButton } from '../../components/CopyButton';
import { labels } from '../../labels';
import { SaveCaseButton } from './SaveCaseButton';
import { TestCaseFrame } from './TestCaseFrame';

export interface InjectPrepareProps {
  state: AppState;
  draft: InjectDraft;
  onDraft: (draft: InjectDraft) => void;
  onNext: () => void;
  /** The JSON pasted in part 2, so that Save case works from every part. */
  text: string;
  check: CaseJsonCheck | undefined;
  dirty: boolean;
  onApply: (edit: CaseEdit) => void;
  onClose: () => void;
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
      <h3>{`Error ${number}`}</h3>
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
          {hint ? (
            <p class="muted category-hint">
              {hint.description ? hint.description : null}
              {hint.example ? ` Example: ${hint.example}` : null}
            </p>
          ) : null}
          {row.isNew ? (
            <>
              <label class="field-label" for={`${id}-new`}>
                New category name
              </label>
              <input id={`${id}-new`} type="text" value={row.category} onInput={(event) => onChange({ category: (event.currentTarget as HTMLInputElement).value })} />
            </>
          ) : null}
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
      </div>
      <label class="field-label" for={`${id}-what`}>
        What should be wrong
      </label>
      <input id={`${id}-what`} type="text" value={row.description} onInput={(event) => onChange({ description: (event.currentTarget as HTMLInputElement).value })} />
      <button type="button" onClick={onRemove}>
        {labels.remove}
      </button>
    </div>
  );
}

/** Part 1 of a case with injected errors (FR-040): the base, the errors to prepare, and the prompt for the user's LLM. */
export function InjectPrepare({ state, draft, onDraft, onNext, text, check, dirty, onApply, onClose }: InjectPrepareProps) {
  const clean = cleanCasesOf(state);
  const base = draft.base === '' ? undefined : state.evaluation.dataset.cases.find((c) => c.id === draft.base);
  const prompt = injectPrompt(state, draft);

  return (
    <TestCaseFrame
      title={labels.caseWithInjectedErrors}
      dirty={dirty}
      onClose={onClose}
      headerExtra={
        <>
          <button type="button" onClick={onNext}>
            {labels.next}
          </button>
          <SaveCaseButton state={state} text={text} mode="inject" {...(draft.base !== '' ? { base: draft.base } : {})} errorsToPrepare={draft.rows.length} check={check} onApply={onApply} onClose={onClose} />
        </>
      }
      left={
        <>
          <p class="muted">Part 1 of 3. Choose a base case and list the errors to prepare, then copy the prompt into your LLM. Press Next when you have its answer.</p>
          <label class="field-label" for="inject-base">
            Base case (optional)
          </label>
          <select id="inject-base" value={draft.base} onChange={(event) => onDraft({ ...draft, base: (event.currentTarget as HTMLSelectElement).value })}>
            <option value="">None (the LLM writes the whole case)</option>
            {clean.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || `Case ${c.id}`}
              </option>
            ))}
          </select>
          {clean.length === 0 ? <p class="muted">There is no clean case yet, so the LLM writes the whole case. A base is optional.</p> : null}
          {base ? (
            <div class="base-fields">
              {Object.entries(base.fields).map(([name, value]) => (
                <section key={name} class="field-block">
                  <h3 class="field-name">{name}</h3>
                  <p class="field-text">{value}</p>
                </section>
              ))}
            </div>
          ) : null}

          <h3>Errors to prepare</h3>
          {draft.rows.map((row, i) => (
            <Row key={row.id} row={row} number={i + 1} state={state} onChange={(patch) => onDraft(updateRow(draft, row.id, patch))} onRemove={() => onDraft(removeRow(draft, row.id))} />
          ))}
          <button type="button" onClick={() => onDraft(addRow(state, draft))}>
            {labels.addError}
          </button>

          <label class="field-label" for="inject-instructions">
            Your own instructions (optional)
          </label>
          <textarea id="inject-instructions" rows={3} value={draft.instructions} onInput={(event) => onDraft({ ...draft, instructions: (event.currentTarget as HTMLTextAreaElement).value })} />
        </>
      }
      right={
        <>
          <label class="field-label" for="inject-prompt">
            Prompt for your LLM
          </label>
          <textarea id="inject-prompt" class="json" rows={22} readOnly value={prompt} />
          <CopyButton text={prompt} label={labels.copyPrompt} />
          <p class="muted">What your LLM returns is a proposal to review, not a guaranteed result. Paste it in the next part.</p>
        </>
      }
    />
  );
}
