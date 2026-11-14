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
  onSave: () => void;
  onPaste: () => void;
  /** What the last action said, for example that the clipboard was empty. */
  message: string;
}

/** The reply box is checked as the text changes (FR-084): readable JSON, or where it breaks. Any text can still be saved. */
function checkReply(text: string): Problem[] {
  const read = extractJson(text);
  return read.ok ? [] : [unreadableToProblem(read)];
}

/** "Judge’s reply" (FR-055): the four steps, the always visible box and Save reply. */
export function ReplyPane({ prompt, saved, text, onText, copied, onCopied, onSave, onPaste, message }: ReplyPaneProps) {
  const dirty = text !== (saved ?? '');
  const savePrimary = dirty && text.trim() !== '';
  const hasReply = saved !== undefined;
  const copyPrimary = !savePrimary && !hasReply && !copied;
  const pastePrimary = !savePrimary && !hasReply && copied;
  const readable = text.trim() !== '' && extractJson(text).ok;

  return (
    <div class="reply-pane">
      <h3>Judge’s reply</h3>
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
      <p class="reply-message" role="status">
        {message}
      </p>
      <JsonBox label="Judge reply" value={text} onChange={onText} check={checkReply} rows={8} />
      {readable ? <p class="reply-readable">Readable JSON</p> : null}
      <div class="button-row">
        <button type="button" class={savePrimary ? 'primary' : ''} onClick={onSave}>
          {labels.saveReply}
        </button>
      </div>
    </div>
  );
}
