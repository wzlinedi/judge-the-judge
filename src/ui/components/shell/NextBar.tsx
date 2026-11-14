export interface NextBarProps {
  sentence: string;
  detail?: string;
  /** A reminder that goes with the step, shown beneath the detail. */
  note?: string;
  action: { label: string; onClick: () => void; disabled?: boolean };
  /** Quieter buttons beside the primary action. */
  others?: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
}

/** The "what next" line (FR-001): one sentence, an optional second line and exactly one primary action. */
export function NextBar({ sentence, detail, note, action, others = [] }: NextBarProps) {
  return (
    <section class="next-bar" role="region" aria-label="What next">
      <div class="next-text">
        <p class="next-sentence">{sentence}</p>
        {detail ? <p class="next-detail muted">{detail}</p> : null}
        {note ? <p class="next-note muted">{note}</p> : null}
      </div>
      <div class="button-row next-actions">
        <button type="button" class="primary" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </button>
        {others.map((o) => (
          <button key={o.label} type="button" onClick={o.onClick} disabled={o.disabled}>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );
}
