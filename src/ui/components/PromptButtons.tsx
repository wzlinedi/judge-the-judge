import { useState } from 'preact/hooks';
import { labels } from '../labels';
import { CopyButton } from './CopyButton';
import { Dialog } from './Dialog';

export interface PromptButtonsProps {
  /** The complete prompt that goes to the judge for the case. */
  prompt: string;
  /** "Copy prompt" is the primary action of the window until it is pressed. */
  primary?: boolean;
  onCopied?: () => void;
}

/** "Show the full prompt" (a dialog with the whole prompt and only Close) and "Copy prompt", for the case windows (T234, T235). */
export function PromptButtons({ prompt, primary, onCopied }: PromptButtonsProps) {
  const [open, setOpen] = useState(false);
  return (
    <div class="button-row prompt-buttons">
      <button type="button" onClick={() => setOpen(true)}>
        {labels.showFullPrompt}
      </button>
      <CopyButton text={prompt} label={labels.copyPrompt} primary={primary} {...(onCopied ? { onPress: onCopied } : {})} />
      <Dialog
        open={open}
        title="Complete judge prompt"
        onClose={() => setOpen(false)}
        actions={
          <button type="button" onClick={() => setOpen(false)}>
            {labels.close}
          </button>
        }
      >
        <textarea class="json prompt-full" rows={20} readOnly value={prompt} aria-label="Complete judge prompt" />
      </Dialog>
    </div>
  );
}
