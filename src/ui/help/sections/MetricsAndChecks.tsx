import { labels } from '../../labels';

export function MetricsAndChecks() {
  return (
    <section aria-labelledby="help-metrics">
      <h3 id="help-metrics">Metrics and check settings</h3>
      <p>
        A <strong>metric</strong> is one kind of judge evaluation. The tool has two ready ones, Accuracy and Completeness, in <strong>{labels.loadExample}</strong>.
        A <strong>measure</strong> is a number computed from the results, such as the detection rate, and a <strong>check</strong> is a pass-or-fail rule on a
        measure, such as &ldquo;at least 80%&rdquo;.
      </p>
      <p>
        To add your own metric, choose <strong>{labels.loadMetricDefinition}</strong> in the same window and pick a definition file. It is data only: it cannot run
        code. Your metric then appears in the list next to the ready ones, and nothing else in the tool changes. The guide <code>docs/how-to-add-a-metric.md</code>{' '}
        is written so that you can make such a file with an AI assistant.
      </p>
      <p>
        The thresholds that decide <strong>Works</strong> or <strong>Does not work</strong> are saved with the test project and with every evaluation, so every
        run of one test counts the same way. The minimum test size, 30 expected errors and 10 clean cases, is fixed and cannot be changed in a file.
      </p>
      <p>
        This version computes only shares of counts. It cannot express graded ratings, agreement with human ratings or stability across repeated runs.
      </p>
    </section>
  );
}
