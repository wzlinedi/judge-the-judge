import { useEffect, useRef, useState } from 'preact/hooks';
import { labels } from '../../labels';

export type FileAction =
  | 'load-evaluation'
  | 'load-test-project'
  | 'save-test-project'
  | 'save-test-project-as'
  | 'save-evaluation'
  | 'save-evaluation-as'
  | 'import-test-cases'
  | 'export-test-cases'
  | 'load-example'
  | 'start-new-evaluation';

export const FILE_ITEMS: ReadonlyArray<{ action: FileAction; label: string }> = [
  { action: 'load-evaluation', label: labels.loadEvaluation },
  { action: 'load-test-project', label: labels.loadTestProject },
  { action: 'save-test-project-as', label: labels.saveTestProjectAs },
  { action: 'save-evaluation-as', label: labels.saveEvaluationAs },
  { action: 'import-test-cases', label: labels.importTestCases },
  { action: 'export-test-cases', label: labels.exportTestCases },
  { action: 'load-example', label: labels.loadExample },
  { action: 'start-new-evaluation', label: labels.startNewEvaluation },
];

export interface FileMenuProps {
  onAction: (action: FileAction) => void;
}

export function FileMenu({ onAction }: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (open) items.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex(0);
      setOpen(true);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex(FILE_ITEMS.length - 1);
      setOpen(true);
    }
  };

  const onItemKey = (event: KeyboardEvent, index: number) => {
    const last = FILE_ITEMS.length - 1;
    const move = (to: number) => {
      event.preventDefault();
      setFocusIndex(to);
      items.current[to]?.focus();
    };
    if (event.key === 'ArrowDown') move(index === last ? 0 : index + 1);
    else if (event.key === 'ArrowUp') move(index === 0 ? last : index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(last);
    else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <div class="file-menu" ref={root}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setFocusIndex(0);
          setOpen(!open);
        }}
        onKeyDown={onButtonKey}
      >
        {labels.file}
      </button>
      {open ? (
        <div class="menu" role="menu" aria-label={labels.file}>
          {FILE_ITEMS.map((item, index) => (
            <button
              key={item.action}
              ref={(el) => {
                items.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onKeyDown={(event) => onItemKey(event, index)}
              onClick={() => {
                close(false);
                onAction(item.action);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
