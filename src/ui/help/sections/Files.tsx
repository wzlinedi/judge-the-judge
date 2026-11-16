import { labels } from '../../labels';

export function Files() {
  return (
    <section aria-labelledby="help-files">
      <h3 id="help-files">Files: the test project</h3>
      <p>
        The tool works with one file of your own: the <strong>test project</strong>. It is remembered while the page is open. The test project holds what stays the
        same for every run: the judge prompt, how its reply is read, the error rules, the error catalog, the test cases, the metric and the thresholds. After you start
        the test run it also holds the test run: the replies, your decisions and the model details.
      </p>
      <p>
        Use <strong>{labels.saveTestProject}</strong> in the header. The first save asks you for a file; the next saves overwrite it.{' '}
        <strong>{labels.saveTestProjectAs}</strong> in the More menu always asks, so an earlier file stays as it was. <strong>{labels.loadTestProject}</strong> opens a
        file. When the file holds a test run, the tool asks whether to open it <strong>{labels.loadWithTestRun}</strong> or <strong>{labels.loadTestProjectOnly}</strong>.
        After loading, the tool opens the first step with unfinished work and <strong>{labels.continue}</strong> takes you to the case that needs you.
      </p>
      <p>
        <strong>The indicator.</strong> The header shows the name of the test project and, beside it, <strong>Unsaved changes</strong> from your first change until you
        save, then <strong>All changes saved</strong> with the file name.
      </p>
      <p>
        <strong>Replacing work.</strong> Before anything that would replace unsaved work, the tool asks: <strong>{labels.saveTestProjectFirst}</strong>,{' '}
        <strong>{labels.discard}</strong> or <strong>{labels.cancel}</strong>. When nothing is unsaved but the project holds work, <strong>{labels.loadExample}</strong>,{' '}
        <strong>{labels.loadTestProject}</strong> and <strong>{labels.startNewTestProject}</strong> ask <strong>Replace the current work?</strong> first: the judge,
        the test cases and the test run in the app will be reset. To keep them, choose <strong>{labels.cancel}</strong> and save the test project first. An empty
        project asks nothing. A file that cannot be read changes nothing, and the message says what is wrong and where.
      </p>
      <p>
        <strong>Reproducing and auditing a result.</strong> Loading a test project with its test run recalculates the numbers from the judge, the cases, the replies and
        your decisions in the file, with the metric settings and thresholds it holds, and compares them with the numbers it stored. They should be identical, and so
        should the judge version and the test cases version. If they are not, for example because the file was changed by hand, the tool says so on load, on the Results
        step and in the report, names what was stored and what the recomputation gives, and shows the recomputed numbers. When the error rules or the reply mapping were
        corrected after the replies were received, the Results step and the report name both judge versions, and they list the cases that were added or whose expected
        errors were corrected after the first reply.
      </p>
      <p>
        <strong>Testing another version of the judge.</strong> When the result shows that the judge needs a change, save the test project, open it again with{' '}
        <strong>{labels.loadTestProject}</strong> and choose <strong>{labels.loadTestProjectOnly}</strong>. The test cases stay exactly as they were, so the two judges
        meet the same test. The replies and decisions are left out, and the judge prompt is open for changes until you press <strong>{labels.startTestRun}</strong>.
        The changed judge is a new test, so the tool forgets the remembered file: the first <strong>{labels.saveTestProject}</strong> of the new run asks for a file,
        and the file of the earlier run is never overwritten. If there are unsaved changes the tool asks first (<strong>{labels.saveTestProjectFirst}</strong>,{' '}
        <strong>{labels.discard}</strong> or <strong>{labels.cancel}</strong>); export the report of the first run before you go on if you want to keep it. The report of
        the new run names the same test cases version and a different judge version.
      </p>
      <p>
        <strong>Running the same test with another LLM.</strong> Keep the judge as it is. Save the test project once. For each LLM open it with{' '}
        <strong>{labels.loadTestProject}</strong>, choose <strong>{labels.loadTestProjectOnly}</strong>, write the model details, enter that LLM&rsquo;s replies and save the
        result with <strong>{labels.saveTestProjectAs}</strong>. Every run then has the same judge version and the same test cases version, the same metric and the same
        thresholds, so the reports differ only in the model details, the replies, your decisions and the results.
      </p>
    </section>
  );
}
