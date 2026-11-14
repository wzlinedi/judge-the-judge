export interface JudgeSummaryProps {
  judgeVersion: string;
  testProjectName: string;
  testCasesVersion: string;
  judgedText: string | undefined;
}

/** One line about the judge being run (FR-054). The prompt and the error rules are on the Judge step, not here. */
export function JudgeSummary({ judgeVersion, testProjectName, testCasesVersion, judgedText }: JudgeSummaryProps) {
  return (
    <section class="card judge-summary" aria-label="Judge being run">
      <p>
        <span class="muted">Judge version </span>
        <code>{judgeVersion || '…'}</code>
        <span class="muted"> · Test project </span>
        {testProjectName}
        <span class="muted"> · Test cases version </span>
        <code>{testCasesVersion || '…'}</code>
        <span class="muted"> · Judged text </span>
        {judgedText ?? 'not chosen'}
      </p>
    </section>
  );
}
