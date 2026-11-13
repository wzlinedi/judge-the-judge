export type Status = 'pass' | 'fail' | 'awaiting' | 'not_run';

const MARKS: Record<Status, { sign: string; word: string; className: string }> = {
  pass: { sign: '✓', word: 'Pass', className: 'pass' },
  fail: { sign: '✕', word: 'Fail', className: 'fail' },
  awaiting: { sign: '…', word: 'Awaiting verification', className: 'warn' },
  not_run: { sign: '–', word: 'Not run', className: 'muted' },
};

/** A status always carries a word and a sign, never only a color (Principle VII). */
export function StatusMark({ status }: { status: Status }) {
  const mark = MARKS[status];
  return (
    <span class={`status-mark ${mark.className}`}>
      <span aria-hidden="true">{mark.sign}</span> {mark.word}
    </span>
  );
}
