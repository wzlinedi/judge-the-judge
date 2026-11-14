import { useMemo, useState } from 'preact/hooks';
import { removeCase, renameCase, type CaseEdit } from '../../../app/actions/cases';
import {
  caseRows,
  countText,
  DEFAULT_VIEW,
  filterCases,
  isDefaultView,
  nextSort,
  type CaseView,
  type KindFilter,
  type ReplyFilter,
  type SortKey,
} from '../../../app/case-filter';
import type { AppState } from '../../../app/store';
import type { TestCase } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';
import { TableScroll } from '../../components/TableScroll';

export interface CasesTableProps {
  state: AppState;
  onOpen: (id: string) => void;
  onClone: (id: string) => void;
  onEdit: (edit: CaseEdit) => void;
}

/** One table of all test cases, clean and with injected errors, with four visible buttons on each row (FR-025). */
export function CasesTable({ state, onOpen, onClone, onEdit }: CasesTableProps) {
  const [renaming, setRenaming] = useState<TestCase | null>(null);
  const [newName, setNewName] = useState('');
  /** A refused rename is said inside the window, where the user is looking. */
  const [renameRefusal, setRenameRefusal] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TestCase | null>(null);
  const [view, setView] = useState<CaseView>(DEFAULT_VIEW);
  const { dataset } = state.evaluation;
  // The warnings of all the cases are worked out once per change of the test project, not on every key typed in the search.
  const rows = useMemo(() => caseRows(state), [state.evaluation]);
  const shown = useMemo(() => filterCases(rows, view), [rows, view]);
  const byId = useMemo(() => new Map(dataset.cases.map((c) => [c.id, c])), [dataset.cases]);
  const change = (over: Partial<CaseView>) => setView((current) => ({ ...current, ...over }));
  const sortable = (key: SortKey, title: string) => {
    const direction = view.sort?.key === key ? view.sort.direction : null;
    return (
      <th aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}>
        <button type="button" class="sort-button" onClick={() => change({ sort: nextSort(view.sort, key) })}>
          {title}
          <span aria-hidden="true">{direction === 'asc' ? ' ▲' : direction === 'desc' ? ' ▼' : ''}</span>
        </button>
      </th>
    );
  };

  /** A case that cannot be removed (a base in use) is refused at once, with the reason; others ask first. */
  const askRemove = (c: TestCase) => {
    const result = removeCase(state, c.id);
    if (result.state === state) onEdit(result);
    else setRemoving(c);
  };

  const submitRename = () => {
    if (!renaming) return;
    const result = renameCase(state, renaming.id, newName);
    if (result.state === state) {
      setRenameRefusal(`${result.note ?? 'The name was not accepted.'} The name was not changed.`);
      return;
    }
    onEdit(result);
    setRenaming(null);
  };

  return (
    <>
      <div class="cases-toolbar">
        <input
          type="search"
          aria-label="Search test cases"
          placeholder="Search name or text…"
          value={view.search}
          onInput={(event) => change({ search: (event.currentTarget as HTMLInputElement).value })}
        />
        <label>
          Kind{' '}
          <select value={view.kind} onChange={(event) => change({ kind: (event.currentTarget as HTMLSelectElement).value as KindFilter })}>
            <option value="all">All kinds</option>
            <option value="clean">Clean</option>
            <option value="injected">Injected errors</option>
          </select>
        </label>
        <label>
          Reply{' '}
          <select value={view.reply} onChange={(event) => change({ reply: (event.currentTarget as HTMLSelectElement).value as ReplyFilter })}>
            <option value="all">With or without a reply</option>
            <option value="with">With a reply</option>
            <option value="without">Without a reply</option>
          </select>
        </label>
        <label class="inline-check">
          <input type="checkbox" checked={view.warnings} onChange={(event) => change({ warnings: (event.currentTarget as HTMLInputElement).checked })} /> With warnings
        </label>
        <button type="button" disabled={isDefaultView(view)} onClick={() => change({ search: '', kind: 'all', reply: 'all', warnings: false })}>
          {labels.clearFilters}
        </button>
      </div>
      <p class="muted" role="status" aria-label="Shown test cases">
        {countText(shown.length, rows.length)}
      </p>
      <TableScroll label="Table of test cases">
        <table aria-label="Test cases">
          <thead>
            <tr>
              {sortable('id', 'Id')}
              {sortable('name', 'Name')}
              {sortable('kind', 'Kind')}
              <th>Base</th>
              {sortable('errors', 'Expected errors')}
              <th>Categories</th>
              <th>Warnings</th>
              <th>
                <span class="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ testCase: c, hasReply, warnings }) => {
              const base = c.base ? byId.get(c.base) : undefined;
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
                  <td>{warnings.join('; ')}</td>
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
                          setRenameRefusal(null);
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
      </TableScroll>
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
        <input
          id="rename-input"
          type="text"
          value={newName}
          onInput={(event) => {
            setNewName((event.currentTarget as HTMLInputElement).value);
            setRenameRefusal(null);
          }}
        />
        {renameRefusal ? (
          <p role="alert" class="error-message">
            <span aria-hidden="true">✕ </span>
            {renameRefusal}
          </p>
        ) : null}
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
