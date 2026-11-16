import { labels } from '../../labels';

export function MetricsAndChecks() {
  return (
    <section aria-labelledby="help-metrics">
      <h3 id="help-metrics">Metrics and check rules</h3>
      <p>
        A <strong>metric</strong> is one kind of judge evaluation. The tool has one ready metric, Accuracy, which asks whether every claim of a summary is supported by
        its source; <strong>{labels.loadExample}</strong> in the More menu opens a finished example of it. A <strong>measure</strong> is a number computed from the
        results, such as the detection rate, and a <strong>check</strong> is a pass-or-fail rule on a measure, such as &ldquo;at least 80%&rdquo;.
      </p>
      <p>
        To add your own metric, put its definition in your test project file, under <code>metric.definition</code>, and open the file with{' '}
        <strong>{labels.loadTestProject}</strong>. It is data only: it cannot run code. Your metric is then used for that test project, and nothing else in the tool
        changes. The guide <code>docs/how-to-add-a-metric.md</code> is written so that you can make such a file with an AI assistant.
      </p>
      <p>
        The check rules that decide <strong>Works</strong> or <strong>Does not work</strong> are saved with the test project, so every run of one test counts the same
        way. The minimum test size, 30 expected errors and 10 clean cases, is fixed and cannot be changed in a file.
      </p>
      <p>
        This version computes only shares of counts. It cannot express graded ratings, agreement with human ratings or stability across repeated runs.
      </p>
    </section>
  );
}
