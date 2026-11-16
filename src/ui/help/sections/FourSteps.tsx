export function FourSteps() {
  return (
    <section aria-labelledby="help-steps">
      <h3 id="help-steps">The four steps</h3>
      <ol>
        <li>
          <strong>Judge</strong>: write the judge prompt, show a sample reply, and say what counts as an error.
        </li>
        <li>
          <strong>Test cases</strong>: keep clean cases and cases with injected errors, then press <strong>Start test run</strong>.
        </li>
        <li>
          <strong>Test run</strong>: for each case copy its prompt, run it in your LLM, paste the reply. Where the tool cannot decide, you mark the items of the
          case yourself; when the reply cannot be read, you add the findings and press <strong>No more findings</strong>.
        </li>
        <li>
          <strong>Results</strong>: read the counts, the two rates and the overall result. Results only shows, apart from the thresholds; to change anything else go back to Test run.
        </li>
      </ol>
      <p>
        The line under the steps always says what to do next and has one main button. After you load a file, <strong>Continue</strong> opens the case that
        needs you.
      </p>
    </section>
  );
}
