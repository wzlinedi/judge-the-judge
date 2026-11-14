import { extractJson } from '../../../core/judge/extract-json';
import { unreadableToProblem } from '../../../core/judge/fields';
import type { Problem } from '../../../core/model';
import { CopyButton } from '../../components/CopyButton';
import { JsonBox } from '../../components/JsonBox';
import { labels } from '../../labels';

export interface ReplyPaneProps {
  /** The prompt that goes to the judge: the one that produced the saved reply, else the one composed for the case. */
  prompt: string;
  /** The reply saved for the case, if any. */
  saved: string | undefined;
  /** The text in the box. */
  text: string;
  onText: (text: string) => void;
  copied: boolean;
  onCopied: () => void;
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

/** "Judge reply" (FR-055), the left column of part 3: the steps, the complete prompt collapsed and the always visible box. A reply that is readable JSON is saved as soon as it is in the box (FR-056). */
export function ReplyPane({ prompt, saved, text, onText, copied, onCopied, onSaveAsText, onPaste, message }: ReplyPaneProps) {
  const dirty = text !== (saved ?? '');
  const readable = text.trim() !== '' && extractJson(text).ok;
  const notJson = dirty && text.trim() !== '' && !readable;
  const hasReply = saved !== undefined;
  const copyPrimary = !notJson && !hasReply && !copied;
  const pastePrimary = !notJson && !hasReply && copied;

  return (
    <section class="reply-pane">
      <h4>Judge reply</h4>
      <ol class="steps" aria-label="Steps">
        <li>
          <CopyButton text={prompt} label={labels.copyPrompt} onPress={onCopied} primary={copyPrimary} />
        </li>
        <li>Run the prompt in a new conversation of your LLM.</li>
        <li>Copy the answer of the LLM.</li>
        <li>
          <button type="button" class={pastePrimary ? 'primary' : ''} onClick={onPaste}>
            {labels.pasteReplyFromClipboard}
          </button>
        </li>
      </ol>
      <details class="prompt-details">
        <summary>Show complete prompt</summary>
        <textarea class="json" rows={8} readOnly value={prompt} aria-label="Complete judge prompt" />
      </details>
      <p class="reply-message" role="status">
        {message}
      </p>
      <JsonBox label="Judge reply" value={text} onChange={onText} check={checkReply} rows={8} />
      {readable ? <p class="reply-readable">Readable JSON</p> : null}
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
