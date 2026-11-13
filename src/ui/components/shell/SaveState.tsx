import type { AppState } from '../../../app/store';
import { saveIndicator } from '../../../app/selectors';

/** The one indicator of unsaved changes (FR-051). It never relies on color alone. */
export function SaveState({ state }: { state: AppState }) {
  const { text, kind } = saveIndicator(state);
  return (
    <span class={`save-state save-${kind}`} role="status">
      {text}
    </span>
  );
}
