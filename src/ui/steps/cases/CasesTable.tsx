import { useState } from 'preact/hooks';
import { removeCase, renameCase, type CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { normalizeName } from '../../../core/cases/validate';
import { composePrompt } from '../../../core/judge/compose';
import type { TestCase } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export interface CasesTableProps {
  state: AppState;
  onOpen: (id: string) => void;
  onClone: (id: string) => void;
  onEdit: (edit: CaseEdit) => void;
}

function warningsOf(testCase: TestCase, all: readonly TestCase[], prompt: string): string[] {
  const warnings: string[] = [];
  const missing = composePrompt(prompt, testCase).missing;
  if (missing.length > 0) warnings.push(`No field for ${missing.join(', ')}`);
  const same = all.find((c) => c.id !== testCase.id && normalizeName(c.name) !== '' && normalizeName(c.name) === normalizeName(testCase.name));
  if (same) warnings.push(`The name “${testCase.name}” is also used by case ${same.id}`);
  return warnings;
}

/** One table of all test cases, clean and with injected errors, with four visible buttons on each row (FR-025). */
export function CasesTable({ state, onOpen, onClone, onEdit }: CasesTableProps) {
  const [renaming, setRenaming] = useState<TestCase | null>(null);
  const [newName, setNewName] = useState('');
  const [removing, setRemoving] = useState<TestCase | null>(null);
  const { dataset, replies, judge_set } = state.evaluation;

  /** A case that cannot be removed (a base in use) is refused at once, with the reason; others ask first. */
  const askRemove = (c: TestCase) => {
    const result = removeCase(state, c.id);
    if (result.state === state) onEdit(result);
    else setRemoving(c);
  };

  const submitRename = () => {
    if (!renaming) return;
    const result = renameCase(state, renaming.id, newName);
    onEdit(result);
    if (result.state !== state) setRenaming(null);
  };

  return (
    <>
      <div class="table-scroll">
        <table aria-label="Test cases">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Kind</th>
              <th>Base</th>
              <th>Expected errors</th>
              <th>Categories</th>
              <th>Warnings</th>
              <th>
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dataset.cases.map((c) => {
              const hasReply = replies[c.id] !== undefined;
              const base = c.base ? dataset.cases.find((b) => b.id === c.base) : undefined;
              const categories = [...new Set(c.expected_errors.map((e) => e.category).filter((x): x is string => !!x))];
              return (
                <tr key={c.id} class="clickable" onClick={() => onOpen(c.id)}>
                  <td>{c.id}</td>
                  <td>{c.name || `Case ${c.id}`}</td>
                  <td>
                    {c.expected_errors.length === 0 ? 'Clean' : 'Injected errors'}
                    {c.changed_after_first_reply ? <span class="muted">{` (${c.changed_after_first_reply} after first reply)`}</span> : null}
                  </td>
                  <td>{c.base ? `${c.base}${base ? ` (${base.name})` : ''}` : ''}</td>
                  <td>{c.expected_errors.length}</td>
                  <td>{categories.join(', ')}</td>
                  <td>{warningsOf(c, dataset.cases, judge_set.prompt).join('; ')}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div class="button-row">
                      <button type="button" onClick={() => onOpen(c.id)}>
                        {labels.open}
                      </button>
                      <button type="button" onClick={() => onClone(c.id)}>
                        {labels.clone}
                      </button>
                      <button
                        type="button"
                        disabled={hasReply}
                        onClick={() => {
                          setNewName(c.name);
                          setRenaming(c);
                        }}
                      >
                        {labels.rename}
                      </button>
                      <button type="button" disabled={hasReply} onClick={() => askRemove(c)}>
                        {labels.remove}
                      </button>
                    </div>
                    {hasReply ? <span class="muted">This case has a reply</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog
        open={renaming !== null}
        title="Rename test case"
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
        <label class="field-label" for="rename-input">
          New name
        </label>
        <input id="rename-input" type="text" value={newName} onInput={(event) => setNewName((event.currentTarget as HTMLInputElement).value)} />
      </Dialog>
      <Dialog
        open={removing !== null}
        title="Remove test case"
        onClose={() => setRemoving(null)}
        actions={
          <>
            <button type="button" onClick={() => setRemoving(null)}>
              {labels.cancel}
            </button>
            <button
              type="button"
              class="primary"
              onClick={() => {
                if (removing) onEdit(removeCase(state, removing.id));
                setRemoving(null);
              }}
            >
              {labels.remove}
            </button>
          </>
        }
      >
        <p>{removing ? `Remove “${removing.name || `Case ${removing.id}`}”? This cannot be undone.` : ''}</p>
      </Dialog>
    </>
  );
}
