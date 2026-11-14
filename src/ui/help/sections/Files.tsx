import { labels } from '../../labels';

export function Files() {
  return (
    <section aria-labelledby="help-files">
      <h3 id="help-files">Files: the test project and the evaluation</h3>
      <p>The tool works with two files of your own, and each one is remembered separately while the page is open.</p>
      <ul>
        <li>
          <strong>The test project</strong> holds what stays the same for every run: the judge prompt, how its reply is read, the error rules, the error
          catalog, the test cases, the metric and the thresholds. It never holds replies or decisions. Use <strong>{labels.saveTestProject}</strong> in the
          File menu, and <strong>{labels.loadTestProject}</strong> to open one. Loading it starts a new evaluation on the Run step.
        </li>
        <li>
          <strong>The evaluation</strong> holds the whole work of one run: everything in the test project plus the replies, your decisions, the model note and
          the results. Use <strong>{labels.saveEvaluation}</strong> on the Run step, and <strong>{labels.loadEvaluation}</strong> in the File menu. After
          loading, the tool opens the first step with unfinished work and <strong>{labels.continue}</strong> takes you to the case that needs you.
        </li>
      </ul>
      <p>
        The first save asks you for a file; the next saves overwrite it. <strong>{labels.saveEvaluationAs}</strong> and{' '}
        <strong>{labels.saveTestProjectAs}</strong> always ask, so an earlier file stays as it was.
      </p>
      <p>
        <strong>The indicator.</strong> The header says <strong>Unsaved changes</strong> from your first change until you save, then{' '}
        <strong>All changes saved</strong> with the file name. Saving the test project clears it only while there are no replies: replies are kept only by{' '}
        <strong>{labels.saveEvaluation}</strong>, and the tool says so.
      </p>
      <p>
        <strong>Replacing work.</strong> Before anything that would replace unsaved work, the tool asks: <strong>{labels.saveEvaluationFirst}</strong>,{' '}
        <strong>{labels.discard}</strong> or <strong>{labels.cancel}</strong>. A file that cannot be read changes nothing, and the message says what is wrong
        and where.
      </p>
      <p>
        <strong>The same test with another LLM.</strong> Save the test project once. For each LLM, load it, enter that LLM&rsquo;s replies and save a separate
        evaluation with <strong>{labels.saveEvaluationAs}</strong>. Every run then counts the same way.
      </p>
    </section>
  );
}
