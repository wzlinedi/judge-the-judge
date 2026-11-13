export interface FilePickerProps {
  label: string;
  /** Opens the browser's picker (the file stays the current one for later saves). */
  onPick: () => void;
  /** A file dropped onto the zone is read but never remembered. */
  onFile: (file: File, source: 'drop') => void;
}

export function FilePicker({ label, onPick, onFile }: FilePickerProps) {
  return (
    <div
      class="drop-zone"
      data-testid="drop-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        if (file) onFile(file, 'drop');
      }}
    >
      <button type="button" onClick={onPick}>
        {label}
      </button>
      <span class="muted"> or drop a file here</span>
    </div>
  );
}
