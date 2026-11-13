import type { Problem } from '../../core/model';
import { problemText } from './JsonBox';

/** Problems in plain sentences with where they are; nothing is changed by an invalid file. */
export function ErrorMessage({ problems, title }: { problems: Problem[]; title?: string }) {
  if (problems.length === 0) return null;
  return (
    <div class="error-message" role="alert">
      {title ? <strong>{title}</strong> : null}
      <ul>
        {problems.map((problem, i) => (
          <li key={i}>{problemText(problem)}</li>
        ))}
      </ul>
    </div>
  );
}
