import { useId, useState } from 'preact/hooks';
import { addCategoriesFromText, removeCategory, renameCategoryAction, setCategoryDetails, type CatalogEdit } from '../../../app/actions/catalog';
import type { AppState } from '../../../app/store';
import { canRemoveCategory, categoryUses } from '../../../core/cases/catalog';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export interface ErrorCategoriesSectionProps {
  state: AppState;
  open: boolean;
  onToggle: () => void;
  onEdit: (edit: CatalogEdit) => void;
}

/** The one place where the error catalog is shown and managed (FR-015, FR-024, FR-087). */
export function ErrorCategoriesSection({ state, open, onToggle, onEdit }: ErrorCategoriesSectionProps) {
  const id = useId();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [toAdd, setToAdd] = useState('');
  const { judge_set, dataset, replies } = state.evaluation;
  const catalog = judge_set.error_catalog;
  const count = `${catalog.length} ${catalog.length === 1 ? 'category' : 'categories'}`;

  const submitRename = () => {
    if (renaming === null) return;
    const result = renameCategoryAction(state, renaming, newName);
    onEdit(result);
    if (result.state !== state) setRenaming(null);
  };

  return (
    <section class="card" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>
        <button type="button" class="fold" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span aria-hidden="true">{open ? '▾ ' : '▸ '}</span>
          Error categories
          {open ? null : <span class="muted">{` — ${count}`}</span>}
        </button>
      </h2>
      {open ? (
        <div id={`${id}-body`}>
          {catalog.length === 0 ? <p class="muted">There are no categories yet.</p> : null}
          <ul class="plain-list" aria-label="Categories">
            {catalog.map((category) => {
              const uses = categoryUses(dataset.cases, category.name);
              const removal = canRemoveCategory(catalog, dataset.cases, replies, dataset.finalized, category.name);
              return (
                <li key={category.name} class="category" aria-label={category.name}>
                  <strong>{category.name}</strong>
                  <label>
                    {`Description of ${category.name}`}
                    <input type="text" value={category.description ?? ''} onInput={(event) => onEdit(setCategoryDetails(state, category.name, { description: (event.currentTarget as HTMLInputElement).value }))} />
                  </label>
                  <label>
                    {`Example of ${category.name}`}
                    <input type="text" value={category.example ?? ''} onInput={(event) => onEdit(setCategoryDetails(state, category.name, { example: (event.currentTarget as HTMLInputElement).value }))} />
                  </label>
                  <span class="muted">{`Used by ${uses} test ${uses === 1 ? 'case' : 'cases'}`}</span>
                  <div class="button-row">
                    <button
                      type="button"
                      onClick={() => {
                        setNewName(category.name);
                        setRenaming(category.name);
                      }}
                    >
                      {labels.rename}
                    </button>
                    <button type="button" disabled={!removal.allowed} onClick={() => onEdit(removeCategory(state, category.name))}>
                      {labels.remove}
                    </button>
                  </div>
                  {removal.allowed ? null : <span class="muted">{removal.reason}</span>}
                </li>
              );
            })}
          </ul>
          <label class="field-label" for={`${id}-add`}>
            Categories to add
          </label>
          <textarea id={`${id}-add`} rows={3} placeholder="One per line, or name - description" value={toAdd} onInput={(event) => setToAdd((event.currentTarget as HTMLTextAreaElement).value)} />
          <button
            type="button"
            onClick={() => {
              const result = addCategoriesFromText(state, toAdd);
              onEdit(result);
              if (result.state !== state) setToAdd('');
            }}
          >
            {labels.addCategory}
          </button>
        </div>
      ) : null}
      <Dialog
        open={renaming !== null}
        title="Rename category"
        onClose={() => setRenaming(null)}
        actions={
          <>
            <button type="button" onClick={() => setRenaming(null)}>
              {labels.cancel}
            </button>
            <button type="button" class="primary" onClick={submitRename}>
              {labels.rename}
            </button>
          </>
        }
      >
        <label class="field-label" for={`${id}-rename`}>
          New name
        </label>
        <input id={`${id}-rename`} type="text" value={newName} onInput={(event) => setNewName((event.currentTarget as HTMLInputElement).value)} />
      </Dialog>
    </section>
  );
}
