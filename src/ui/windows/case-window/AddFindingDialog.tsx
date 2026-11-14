import { useState } from 'preact/hooks';
import type { NewFinding } from '../../../app/actions/decide';
import type { Category, Difficulty } from '../../../core/model';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export interface AddFindingDialogProps {
  catalog: readonly Category[];
  onAdd: (finding: NewFinding) => void;
  onClose: () => void;
}

/** "Add finding" (FR-062): the text, an optional category from the catalog or a new name that joins it, an optional difficulty. */
export function AddFindingDialog({ catalog, onAdd, onClose }: AddFindingDialogProps) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'' | Difficulty>('');
  const listId = 'add-finding-categories';
  const submit = () => {
    onAdd({ text, ...(category.trim() !== '' ? { category } : {}), ...(difficulty !== '' ? { difficulty } : {}) });
  };
  return (
    <Dialog
      open
      title={labels.addFinding}
      onClose={onClose}
      actions={
        <>
          <button type="button" onClick={onClose}>
            {labels.cancel}
          </button>
          <button type="button" class="primary" disabled={text.trim() === ''} onClick={submit}>
            Add
          </button>
        </>
      }
    >
      <label class="field-label" for="finding-text">
        Text of the finding
      </label>
      <textarea id="finding-text" rows={3} value={text} onInput={(event) => setText((event.currentTarget as HTMLTextAreaElement).value)} />
      <label class="field-label" for="finding-category">
        Category (optional)
      </label>
      <input id="finding-category" type="text" list={listId} value={category} onInput={(event) => setCategory((event.currentTarget as HTMLInputElement).value)} />
      <datalist id={listId}>
        {catalog.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <p class="muted">A name that is not in the catalog joins it.</p>
      <label class="field-label" for="finding-difficulty">
        Difficulty (optional)
      </label>
      <select id="finding-difficulty" value={difficulty} onChange={(event) => setDifficulty((event.currentTarget as HTMLSelectElement).value as '' | Difficulty)}>
        <option value="">Not set</option>
        <option value="obvious">obvious</option>
        <option value="subtle">subtle</option>
      </select>
      <p class="muted">The finding starts as a real error. Press the mark that fits after adding it.</p>
    </Dialog>
  );
}
