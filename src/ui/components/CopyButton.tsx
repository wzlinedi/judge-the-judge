import { useEffect, useState } from 'preact/hooks';

export interface CopyButtonProps {
  text: string;
  label: string;
  /** Replaceable in tests; the default writes to the clipboard. */
  copy?: (text: string) => Promise<void>;
}

export function CopyButton({ text, label, copy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const onClick = async () => {
    try {
      await (copy ?? ((t: string) => navigator.clipboard.writeText(t)))(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span class="copy-button">
      <button type="button" onClick={onClick}>
        {label}
      </button>
      <span class="copy-status" role="status">
        {copied ? 'Copied' : ''}
      </span>
    </span>
  );
}
