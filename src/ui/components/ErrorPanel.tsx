import type { ComponentChildren } from 'preact';
import { useEffect, useErrorBoundary, useState } from 'preact/hooks';

export interface ErrorBoundaryProps {
  /**
   * Opens "Save test project as…" for the work held in the state; the page below it is gone, the work is not.
   * What it returns is said in the panel, for example that the file would be too large (T416).
   */
  onSave: () => Promise<string | void> | string | void;
  onReload?: () => void;
  children?: ComponentChildren;
}

/** What the user sees instead of a white page when something throws while the page is drawn (code review S3). */
export function ErrorPanel({ error, onSave, onReload }: { error: unknown } & Pick<ErrorBoundaryProps, 'onSave' | 'onReload'>) {
  const text = error instanceof Error ? error.message : String(error);
  const [said, setSaid] = useState('');
  return (
    <div class="error-panel" role="alert">
      <h1>Something went wrong</h1>
      <p>{text}</p>
      <p>Your work is still in the page. Save it to a file before you reload.</p>
      <div class="error-panel-actions">
        <button type="button" class="primary" onClick={() => void Promise.resolve(onSave()).then((message) => setSaid(message ?? ''))}>
          Save test project as…
        </button>
        <button type="button" onClick={onReload ?? (() => globalThis.location.reload())}>
          Reload
        </button>
      </div>
      {said ? <p role="status">{said}</p> : null}
    </div>
  );
}

/**
 * Shows the panel for an error while drawing, and also for one that Preact does not catch: an error thrown in an event handler
 * or a promise of an action that is rejected and caught by nobody (Constitution IX, FR-084, T391).
 */
export function ErrorBoundary({ onSave, onReload, children }: ErrorBoundaryProps) {
  const [drawError] = useErrorBoundary();
  const [outsideError, setOutsideError] = useState<{ error: unknown } | null>(null);
  useEffect(() => {
    // An event with no error object is not ours: a foreign "Script error." or a browser note such as the ResizeObserver loop.
    const onError = (event: ErrorEvent) => {
      if (event.error !== undefined && event.error !== null) setOutsideError({ error: event.error });
    };
    const onRejection = (event: PromiseRejectionEvent) => setOutsideError({ error: event.reason });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  const error = drawError !== undefined ? drawError : outsideError?.error;
  if (drawError !== undefined || outsideError !== null) return <ErrorPanel error={error} onSave={onSave} {...(onReload ? { onReload } : {})} />;
  return <>{children}</>;
}
