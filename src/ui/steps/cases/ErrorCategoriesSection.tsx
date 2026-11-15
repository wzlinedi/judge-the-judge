import { useId, useState } from 'preact/hooks';
import { addCategory, removeCategory, renameCategoryAction, setCategoryDetails, type CatalogEdit } from '../../../app/actions/catalog';
import type { AppState } from '../../../app/store';
import { categoryErrorCount, categoryUses, normalizeCategoryName } from '../../../core/cases/catalog';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

const usedBy = (uses: number) => `${uses} test ${uses === 1 ? 'case' : 'cases'}`;

/** What a rename changes, said before it is done (T237, T294): how many expected errors in how many test cases get the new name. */
function renameEffect(uses: number, errors: number): string {
  if (uses === 0) return 'No test case uses this category. The test cases version changes, and the error analysis of Results uses the new name.';
  return `${errors} expected ${errors === 1 ? 'error' : 'errors'} in ${usedBy(uses)} ${errors === 1 ? 'gets' : 'get'} the new name. The test cases version changes. The error analysis of Results uses the new name.`;
}

export interface ErrorCategoriesSectionProps {
  state: AppState;
  open: boolean;
  onToggle: () => void;
  onEdit: (edit: CatalogEdit) => void;
}

/** The one place where the error catalog is shown and managed (FR-015, FR-024, FR-087): a table, one row per category (T237, T248). */
export function ErrorCategoriesSection({ state, open, onToggle, onEdit }: ErrorCategoriesSectionProps) {
  const id = useId();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  /** The new row that "Add category" appends; it joins the catalog with "Add". */
  const [draft, setDraft] = useState<{ name: string; description: string; problem: string } | null>(null);
  const { judge_set, dataset } = state.evaluation;
  const catalog = judge_set.error_catalog;
  const count = `${catalog.length} ${catalog.length === 1 ? 'category' : 'categories'}`;

  const submitRename = () => {
    if (renaming === null) return;
    const result = renameCategoryAction(state, renaming, newName);
    onEdit(result);
    if (result.state !== state) setRenaming(null);
  };
  const remove = (name: string) => {
    setRemoving(null);
    onEdit(removeCategory(state, name));
  };
  const submitDraft = () => {
    if (!draft) return;
    const result = addCategory(state, draft.name, draft.description);
    if (result.state === state) setDraft({ ...draft, problem: result.note ?? '' });
    else {
      onEdit(result);
      setDraft(null);
    }
  };
  const normal = draft ? normalizeCategoryName(draft.name) : '';

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
          {catalog.length === 0 && !draft ? <p class="muted">There are no categories yet.</p> : null}
          {catalog.length > 0 || draft ? (
            <div class="table-scroll">
              <table class="categories-table" aria-label="Categories">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description &amp; examples</th>
                    <th>Used by</th>
                    <th>
                      <span class="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((category) => {
                    const uses = categoryUses(dataset.cases, category.name);
                    return (
                      <tr key={category.name} aria-label={category.name}>
                        <td>
                          <strong>{category.name}</strong>
                        </td>
                        <td>
                          <textarea
                            rows={2}
                            aria-label={`Description and examples of ${category.name}`}
                            placeholder="What this kind of error is, with an example (optional)"
                            value={category.description ?? ''}
                            onInput={(event) => onEdit(setCategoryDetails(state, category.name, { description: (event.currentTarget as HTMLTextAreaElement).value }))}
                          />
                        </td>
                        <td>{`Used by ${usedBy(uses)}`}</td>
                        <td>
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
                            <button type="button" onClick={() => (uses === 0 ? remove(category.name) : setRemoving(category.name))}>
                              {labels.remove}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {draft ? (
                    <tr aria-label="New category">
                      <td>
                        <input type="text" id={`${id}-new-name`} aria-label="Name of the new category" placeholder="for example wrong-date" value={draft.name} onInput={(event) => setDraft({ ...draft, name: (event.currentTarget as HTMLInputElement).value, problem: '' })} />
                        {draft.name.trim() !== '' && normal !== draft.name ? <p class="muted category-hint">{`It is written in lower case with dashes: ${normal}.`}</p> : null}
                        {draft.problem !== '' ? (
                          <p role="alert" class="error-note">
                            {draft.problem}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <textarea rows={2} aria-label="Description and examples of the new category" placeholder="What this kind of error is, with an example (optional)" value={draft.description} onInput={(event) => setDraft({ ...draft, description: (event.currentTarget as HTMLTextAreaElement).value })} />
                      </td>
                      <td class="muted">Not used yet</td>
                      <td>
                        <div class="button-row">
                          <button type="button" onClick={submitDraft}>
                            Add
                          </button>
                          <button type="button" onClick={() => setDraft(null)}>
                            {labels.cancel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
          <button type="button" disabled={draft !== null} onClick={() => setDraft({ name: '', description: '', problem: '' })}>
            {labels.addOneCategory}
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
        <p>{renameEffect(renaming === null ? 0 : categoryUses(dataset.cases, renaming), renaming === null ? 0 : categoryErrorCount(dataset.cases, renaming))}</p>
      </Dialog>
      <Dialog
        open={removing !== null}
        title="Remove category"
        onClose={() => setRemoving(null)}
        actions={
          <>
            <button type="button" onClick={() => setRemoving(null)}>
              {labels.cancel}
            </button>
            <button type="button" class="primary" onClick={() => removing !== null && remove(removing)}>
              {labels.remove}
            </button>
          </>
        }
      >
        <p>{`Remove the category "${removing ?? ''}"?`}</p>
        <p>{`${usedBy(removing === null ? 0 : categoryUses(dataset.cases, removing))} use it. Their expected errors stay and lose the category. The test cases version changes.`}</p>
      </Dialog>
    </section>
  );
}
