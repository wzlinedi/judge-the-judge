import { labels } from '../../labels';

export function ReadingResults() {
  return (
    <section aria-labelledby="help-results">
      <h3 id="help-results">Reading the results</h3>
      <p>
        <strong>Expected errors</strong> are the errors you injected: each is <em>found</em> or missed (<strong>{labels.issueMissed}</strong>).{' '}
        <strong>Additional findings</strong> are things the judge reported that you did not inject: each is either a <strong>{labels.realError}</strong> that you
        missed when injecting, or a <strong>false positive</strong> (<strong>{labels.issueFalsePositive}</strong>). Anything you mark <em>{labels.ignore}</em> is left out of
        the numbers and counted separately.
      </p>
      <p>
        The <strong>detection rate</strong> is the share of injected errors the judge found. The <strong>false-positive rate</strong> is the share of the
        judge’s findings that were not errors. By default the judge works when it finds at least 80% and at most 10% of its findings are false.
      </p>
      <p>
        A case that is not run or awaits verification is <strong>not decided yet</strong>. The line under the steps says how many cases are decided, for
        example &ldquo;27 of 30 cases decided · 3 not decided yet&rdquo;. The numbers can still change, and the overall result stays Inconclusive until every case
        is decided and the test is big enough.
      </p>
    </section>
  );
}
