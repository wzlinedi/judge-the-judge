import { useId } from 'preact/hooks';
import { formatWholeJson } from '../../core/io/format-json';
import type { Problem } from '../../core/model';

export interface JsonBoxProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** Called as the text changes; returns the problems to show under the box. */
  check: (text: string) => Problem[];
  rows?: number;
  placeholder?: string;
  readOnly?: boolean;
}

export function problemText(problem: Problem): string {
  if (problem.line !== undefined) return `Line ${problem.line}, column ${problem.column ?? 1}: ${problem.message}`;
  if (problem.path) return `${problem.path}: ${problem.message}`;
  return problem.message;
}

/**
 * A JSON pasted into the box is formatted at once, when the whole text of the box then is valid JSON (T292). Anything else is pasted as it
 * is, by the browser, so that the line and column of a problem point at the user's text.
 */
function formatPasted(event: ClipboardEvent, onChange: (text: string) => void) {
  const area = event.currentTarget as HTMLTextAreaElement;
  const pasted = event.clipboardData?.getData('text') ?? '';
  if (pasted === '') return;
  const whole = area.value.slice(0, area.selectionStart) + pasted + area.value.slice(area.selectionEnd);
  const formatted = formatWholeJson(whole);
  if (formatted === undefined) return;
  event.preventDefault();
  onChange(formatted);
}

/** A box checked as it changes; the text is always kept and problems say where they are (FR-084). */
export function JsonBox({ label, value, onChange, check, rows = 10, placeholder, readOnly }: JsonBoxProps) {
  const id = useId();
  const problems = value.trim() === '' ? [] : check(value);
  return (
    <div class="json-box">
      <label for={id}>{label}</label>
      <textarea
        id={id}
        class="json"
        rows={rows}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        spellcheck={false}
        aria-invalid={problems.length > 0}
        aria-describedby={`${id}-problems`}
        onInput={(event) => onChange((event.currentTarget as HTMLTextAreaElement).value)}
        onPaste={readOnly ? undefined : (event) => formatPasted(event, onChange)}
      />
      <ul id={`${id}-problems`} class="problems" aria-live="polite">
        {problems.map((problem, i) => (
          <li key={i} class="error">
            {problemText(problem)}
          </li>
        ))}
      </ul>
    </div>
  );
}
