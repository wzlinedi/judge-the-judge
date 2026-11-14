import { useId, useState } from 'preact/hooks';
import { addCategoriesFromText, removeCategory, renameCategoryAction, setCategoryDetails, type CatalogEdit } from '../../../app/actions/catalog';
import type { AppState } from '../../../app/store';
import type { Category } from '../../../core/model';
import { canRemoveCategory, categoryUses } from '../../../core/cases/catalog';
import { CategoryExample } from './CategoryExample';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

/** What a rename changes, said before it is done (T237). */
function renameEffect(uses: number): string {
  const cases = uses === 0 ? 'No test case uses this category.' : `The ${uses} test ${uses === 1 ? 'case' : 'cases'} using it ${uses === 1 ? 'is' : 'are'} renamed too.`;
  return `${cases} The test cases version changes, and the error analysis of Results uses the new name.`;
}

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
  const [example, setExample] = useState<string | null>(null);
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
          {catalog.length > 0 ? (
            <div class="table-scroll">
              <table class="categories-table" aria-label="Categories">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Used by</th>
                    <th>
                      <span class="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((category) => {
                    const uses = categoryUses(dataset.cases, category.name);
                    const removal = canRemoveCategory(catalog, dataset.cases, replies, dataset.finalized, category.name);
                    return (
                      <tr key={category.name} aria-label={category.name}>
                        <td>
                          <strong>{category.name}</strong>
                        </td>
                        <td>
                          <input type="text" aria-label={`Description of ${category.name}`} placeholder="What this kind of error is (optional)" value={category.description ?? ''} onInput={(event) => onEdit(setCategoryDetails(state, category.name, { description: (event.currentTarget as HTMLInputElement).value }))} />
                        </td>
                        <td>{`Used by ${uses} test ${uses === 1 ? 'case' : 'cases'}`}</td>
                        <td>
                          <div class="button-row">
                            <button type="button" disabled={uses === 0} onClick={() => setExample(category.name)}>
                              {labels.example}
                            </button>
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
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
        <p class="muted">{renameEffect(renaming === null ? 0 : categoryUses(dataset.cases, renaming))}</p>
      </Dialog>
      {example !== null && catalog.find((c) => c.name === example) ? (
        <CategoryExample
          category={catalog.find((c) => c.name === example) as Category}
          cases={dataset.cases.filter((c) => c.expected_errors.some((e) => e.category === example))}
          judged={judge_set.judged_text}
          onExample={(value) => onEdit(setCategoryDetails(state, example, { example: value }))}
          onClose={() => setExample(null)}
        />
      ) : null}
    </section>
  );
}
