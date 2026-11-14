import { extractJson } from '../../../core/judge/extract-json';
import { unreadableToProblem } from '../../../core/judge/fields';
import type { Problem } from '../../../core/model';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';

export interface ReplyPaneProps {
  /** The reply saved for the case, if any. */
  saved: string | undefined;
  /** The text in the box. */
  text: string;
  onText: (text: string) => void;
  /** "Copy prompt" was pressed for this case: "Paste reply from clipboard" is then the primary action. */
  copied: boolean;
  /** "Save as text anyway": keeps a text that is not JSON as the reply of the case. */
  onSaveAsText: () => void;
  onPaste: () => void;
  /** What the last action said, for example that the clipboard was empty. */
  message: string;
}

/** The reply box is checked as the text changes (FR-084): readable JSON, or where it breaks. Any text can still be saved. */
function checkReply(text: string): Problem[] {
  const read = extractJson(text);
  if (read.ok) return [];
  const problem = unreadableToProblem(read);
  return [{ ...problem, message: `This is not JSON. ${problem.message}` }];
}

/** "Judge reply" (FR-055), the left column of part 3: "Paste reply from clipboard" above the always visible box. A reply that is readable JSON is saved as soon as it is in the box (FR-056). */
export function ReplyPane({ saved, text, onText, copied, onSaveAsText, onPaste, message }: ReplyPaneProps) {
  const dirty = text !== (saved ?? '');
  const readable = text.trim() !== '' && extractJson(text).ok;
  const notJson = dirty && text.trim() !== '' && !readable;
  const pastePrimary = !notJson && saved === undefined && copied;

  return (
    <section class="reply-pane">
      <h4>Judge reply</h4>
      <div class="button-row">
        <button type="button" class={pastePrimary ? 'primary' : ''} onClick={onPaste}>
          {labels.pasteReplyFromClipboard}
        </button>
      </div>
      <p class="reply-message" role="status">
        {message}
      </p>
      <JsonBox label="Judge reply" value={text} onChange={onText} check={checkReply} rows={8} />
      {notJson ? (
        <div class="button-row">
          <p class="muted">This text is not saved yet. Fix it, or keep it as it is.</p>
          <button type="button" class="primary" onClick={onSaveAsText}>
            {labels.saveAsTextAnyway}
          </button>
        </div>
      ) : null}
    </section>
  );
}
