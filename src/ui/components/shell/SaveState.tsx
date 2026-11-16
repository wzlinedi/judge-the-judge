import type { AppState } from '../../../app/store';
import { saveIndicator } from '../../../app/selectors';

/**
 * The one indicator of unsaved changes (FR-051) and the file it belongs to (FR-092). It never relies on color alone.
 * The file, or "no file yet", is an element of its own with the class `file-name`. When the indicator already names the file
 * ("All changes saved (run-1.json)") that element is hidden from sight and from screen readers, so the file is shown and read once.
 */
export function SaveState({ state }: { state: AppState }) {
  const { text, kind } = saveIndicator(state);
  const file = state.testProjectFile;
  const named = kind === 'saved' && file !== null;
  return (
    <div class="save-group">
      <span class={`save-state save-${kind}`} role="status">
        {text}
      </span>
      <span class={`file-name muted${named ? ' visually-hidden' : ''}`} aria-hidden={named ? 'true' : undefined}>
        {file ?? 'no file yet'}
      </span>
    </div>
  );
}
