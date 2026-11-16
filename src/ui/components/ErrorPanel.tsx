import type { ComponentChildren } from 'preact';
import { useErrorBoundary } from 'preact/hooks';

export interface ErrorBoundaryProps {
  /** Opens "Save test project as…" for the work held in the state; the page below it is gone, the work is not. */
  onSave: () => Promise<void> | void;
  onReload?: () => void;
  children?: ComponentChildren;
}

/** What the user sees instead of a white page when something throws while the page is drawn (code review S3). */
export function ErrorPanel({ error, onSave, onReload }: { error: unknown } & Pick<ErrorBoundaryProps, 'onSave' | 'onReload'>) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    <div class="error-panel" role="alert">
      <h1>Something went wrong</h1>
      <p>{text}</p>
      <p>Your work is still in the page. Save it to a file before you reload.</p>
      <div class="error-panel-actions">
        <button type="button" class="primary" onClick={() => void onSave()}>
          Save test project as…
        </button>
        <button type="button" onClick={onReload ?? (() => globalThis.location.reload())}>
          Reload
        </button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ onSave, onReload, children }: ErrorBoundaryProps) {
  const [error] = useErrorBoundary();
  if (error !== undefined) return <ErrorPanel error={error} onSave={onSave} {...(onReload ? { onReload } : {})} />;
  return <>{children}</>;
}
