import type { ComponentChildren } from 'preact';

export interface EmptyStateProps {
  title: string;
  children?: ComponentChildren;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div class="empty-state">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? (
        <button type="button" class="primary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
