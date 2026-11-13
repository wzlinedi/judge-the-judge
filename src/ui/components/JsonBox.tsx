import { useId } from 'preact/hooks';
import type { Problem } from '../../core/model';

export interface JsonBoxProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** Called as the text changes; returns the problems to show under the box. */
  check: (text: string) => Problem[];
  rows?: number;
  placeholder?: string;
}

export function problemText(problem: Problem): string {
  if (problem.line !== undefined) return `Line ${problem.line}, column ${problem.column ?? 1}: ${problem.message}`;
  if (problem.path) return `${problem.path}: ${problem.message}`;
  return problem.message;
}

/** A box checked as it changes; the text is always kept and problems say where they are (FR-084). */
export function JsonBox({ label, value, onChange, check, rows = 10, placeholder }: JsonBoxProps) {
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
        spellcheck={false}
        aria-invalid={problems.length > 0}
        aria-describedby={`${id}-problems`}
        onInput={(event) => onChange((event.currentTarget as HTMLTextAreaElement).value)}
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
