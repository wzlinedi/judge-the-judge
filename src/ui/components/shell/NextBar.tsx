export interface NextBarProps {
  sentence: string;
  detail?: string;
  action: { label: string; onClick: () => void; disabled?: boolean };
}

/** The "what next" line (FR-001): one sentence, an optional second line and exactly one primary action. */
export function NextBar({ sentence, detail, action }: NextBarProps) {
  return (
    <section class="next-bar" role="region" aria-label="What next">
      <div class="next-text">
        <p class="next-sentence">{sentence}</p>
        {detail ? <p class="next-detail muted">{detail}</p> : null}
      </div>
      <button type="button" class="primary" onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </button>
    </section>
  );
}
