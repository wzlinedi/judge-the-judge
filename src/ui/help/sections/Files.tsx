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
        <strong>Reproducing and auditing a result.</strong> Loading an evaluation recalculates the numbers from the judge, the cases, the replies and your
        decisions in the file, with the metric settings and thresholds it holds, and compares them with the numbers it stored. They should be identical, and
        so should the judge version and the test cases version. If they are not, for example because the file was changed by hand, the tool says so on load,
        on the Results step and in the report, names what was stored and what the recomputation gives, and shows the recomputed numbers. When the error
        rules or the reply mapping were corrected after the replies were received, the Results step and the report name both judge versions, and they list
        the cases that were added or whose expected errors were corrected after the first reply.
      </p>
      <p>
        <strong>Testing another version of the judge.</strong> When the result shows that the judge needs a change, use{' '}
        <strong>{labels.editJudgeAndRunAgain}</strong> on the Results step. The test cases are kept exactly as they were, so the two judges meet the same
        test. The replies and decisions are cleared, and the judge prompt is open for changes until you enter the first reply of the new run. If there are
        unsaved changes the tool asks first (<strong>{labels.saveEvaluationFirst}</strong>, <strong>{labels.discard}</strong> or{' '}
        <strong>{labels.cancel}</strong>); export the report of the first run before you go on if you want to keep it. The changed judge is a new test,
        so the tool forgets both remembered files: the first <strong>{labels.saveTestProject}</strong> and the first <strong>{labels.saveEvaluation}</strong>{' '}
        of the new run each ask for a file again, and the files of the earlier run are never overwritten. The report of the new run names the same test
        cases version and a different judge version.
      </p>
      <p>
        <strong>Running the same test with another LLM.</strong> Keep the judge as it is. Save the test project once, then for each LLM use{' '}
        <strong>{labels.loadTestProject}</strong>, write the model details, enter that LLM&rsquo;s replies and save a separate evaluation with{' '}
        <strong>{labels.saveEvaluationAs}</strong>. Every run then has the same judge version and the same test cases version, the same metric and the same
        thresholds, so the reports differ only in the model details, the replies, your decisions and the results.
      </p>
    </section>
  );
}
