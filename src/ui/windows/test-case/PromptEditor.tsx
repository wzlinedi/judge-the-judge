import { useState } from 'preact/hooks';
import { CopyButton } from '../../components/CopyButton';
import { Dialog } from '../../components/Dialog';
import { labels } from '../../labels';

export interface PromptEditorProps {
  id: string;
  /** The prompt built from the parts above. */
  built: string;
  /** The prompt as the user edited it; undefined while it follows the parts. */
  edited: string | undefined;
  onEdit: (text: string | undefined) => void;
  rows: number;
}

/**
 * "Prompt for your LLM" of Clean case and Case with errors (T262): the prompt can be edited before it is copied. An edited prompt no
 * longer follows the parts above; **Rebuild prompt** asks before it replaces the edit with the prompt built from the parts.
 */
export function PromptEditor({ id, built, edited, onEdit, rows }: PromptEditorProps) {
  const [asking, setAsking] = useState(false);
  const text = edited ?? built;
  return (
    <div class="form-grid">
      <label class="field-label" for={id}>
        Prompt for your LLM
      </label>
      <div>
        <textarea id={id} class="json grows" rows={rows} value={text} onInput={(event) => onEdit((event.currentTarget as HTMLTextAreaElement).value)} />
        {edited !== undefined ? <p class="muted">You changed the prompt, so changes in the parts above no longer change it.</p> : null}
        <div class="button-row">
          <CopyButton text={text} label={labels.copyPrompt} />
          {edited !== undefined ? (
            <button type="button" onClick={() => setAsking(true)}>
              {labels.rebuildPrompt}
            </button>
          ) : null}
        </div>
      </div>
      <Dialog
        open={asking}
        title="Rebuild the prompt?"
        onClose={() => setAsking(false)}
        actions={
          <>
            <button type="button" onClick={() => setAsking(false)}>
              {labels.cancel}
            </button>
            <button
              type="button"
              class="primary"
              onClick={() => {
                setAsking(false);
                onEdit(undefined);
              }}
            >
              {labels.rebuildPrompt}
            </button>
          </>
        }
      >
        <p>The prompt is built again from the parts above, and your changes to it are lost.</p>
      </Dialog>
    </div>
  );
}
