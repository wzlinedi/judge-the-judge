export function FourSteps() {
  return (
    <section aria-labelledby="help-steps">
      <h3 id="help-steps">The four steps</h3>
      <ol>
        <li>
          <strong>Judge</strong>: write the judge prompt, show a sample reply, and say what counts as an error.
        </li>
        <li>
          <strong>Test cases</strong>: keep clean cases and cases with injected errors, then finalize them.
        </li>
        <li>
          <strong>Run</strong>: for each case copy its prompt, run it in your LLM, paste the reply. Where the tool cannot decide, you mark the case yourself
          and press <strong>Approve</strong>.
        </li>
        <li>
          <strong>Results</strong>: read the counts, the two rates and the overall result. Results only shows; to change anything go back to Run.
        </li>
      </ol>
      <p>
        The line under the steps always says what to do next and has one main button. After you load a file, <strong>Continue</strong> opens the case that
        needs you.
      </p>
    </section>
  );
}
