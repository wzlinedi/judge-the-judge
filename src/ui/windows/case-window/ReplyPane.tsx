import { extractJson } from '../../../core/judge/extract-json';
import type { Finding } from '../../../core/judge/findings';
import { unreadableToProblem } from '../../../core/judge/fields';
import type { Problem } from '../../../core/model';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';
import { ReplyView } from './ReplyView';

export interface ReplyPaneProps {
  /** The reply saved for the case, if any. */
  saved: string | undefined;
  /** The text in the box. */
  text: string;
  onText: (text: string) => void;
  /** "Copy prompt" was pressed for this case: "Paste reply from clipboard" is then the primary action. */
  copied: boolean;
  /** "Keep as text": keeps a text that is not JSON as the reply of a case that has none. */
  onSaveAsText: () => void;
  onPaste: () => void;
  /** What the last action said, for example that the clipboard was empty. */
  message: string;
  /** The saved reply is being changed: the box holds a draft, with "Save reply" and "Cancel" (T293). */
  editing: boolean;
  onChangeReply: () => void;
  onSaveReply: () => void;
  onCancel: () => void;
  /** The findings of the saved reply, marked in its read-only view. */
  findings: readonly Finding[];
  pointed: string | null;
  onPoint: (key: string) => void;
}

/** The reply box is checked as the text changes (FR-084): readable JSON, or where it breaks. Any text can still be saved. */
function checkReply(text: string): Problem[] {
  const read = extractJson(text);
  if (read.ok) return [];
  const problem = unreadableToProblem(read);
  return [{ ...problem, message: `This is not JSON. ${problem.message}` }];
}

/**
 * "Judge reply" (FR-055), the left column of part 3. A case without a reply has the box, and a readable JSON is saved as soon as it is in it (FR-056).
 * A saved reply is shown read-only, formatted, with the findings marked (T293); "Change reply" turns the view into the box with "Save reply" and "Cancel".
 */
export function ReplyPane({ saved, text, onText, copied, onSaveAsText, onPaste, message, editing, onChangeReply, onSaveReply, onCancel, findings, pointed, onPoint }: ReplyPaneProps) {
  const dirty = text !== (saved ?? '');
  const readable = text.trim() !== '' && extractJson(text).ok;
  const notJson = dirty && text.trim() !== '' && !readable;
  const reading = saved !== undefined && !editing;
  const pastePrimary = !notJson && saved === undefined && copied;

  return (
    <section class="reply-pane">
      <h4>Judge reply</h4>
      {reading ? <ReplyView reply={saved} findings={findings} pointed={pointed} onPoint={onPoint} /> : <JsonBox label="Judge reply" value={text} onChange={onText} check={checkReply} rows={8} />}
      {notJson && !editing ? (
        <div class="button-row">
          <p class="muted">This text is not saved yet. Fix it, or keep it as it is.</p>
          <button type="button" class="primary" onClick={onSaveAsText}>
            {labels.saveAsTextAnyway}
          </button>
        </div>
      ) : null}
      <div class="button-row">
        {editing ? (
          <>
            <button type="button" class="primary" onClick={onSaveReply}>
              {labels.saveReply}
            </button>
            <button type="button" onClick={onCancel}>
              {labels.cancel}
            </button>
          </>
        ) : (
          <>
            {reading ? (
              <button type="button" onClick={onChangeReply}>
                {labels.changeReply}
              </button>
            ) : null}
            <button type="button" class={pastePrimary ? 'primary' : ''} onClick={onPaste}>
              {labels.pasteReplyFromClipboard}
            </button>
          </>
        )}
      </div>
      <p class="reply-message" role="status">
        {message}
      </p>
    </section>
  );
}
