import { fileTooLargeMessage, isFileTooLarge } from '../../core/schemas/limits';

export interface FilePickerProps {
  label: string;
  /** Opens the browser's picker (the file stays the current one for later saves). */
  onPick: () => void;
  /** A file dropped onto the zone is read but never remembered. */
  onFile: (file: File, source: 'drop') => void;
  /** A dropped file above the size limit is not passed on; this says why (code review S4). */
  onRefuse?: (message: string) => void;
}

export function FilePicker({ label, onPick, onFile, onRefuse }: FilePickerProps) {
  return (
    <div
      class="drop-zone"
      data-testid="drop-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        if (isFileTooLarge(file.size)) onRefuse?.(fileTooLargeMessage(file.size));
        else onFile(file, 'drop');
      }}
    >
      <button type="button" onClick={onPick}>
        {label}
      </button>
      <span class="muted"> or drop a file here</span>
    </div>
  );
}
