import { labels } from '../../labels';
import expected from '../../../../examples/demo/expected-results.json';

export function DemoData() {
  const c = expected.after_deciding.counters;
  const awaiting = expected.awaiting_verification.length;
  return (
    <section aria-labelledby="help-demo">
      <h3 id="help-demo">Examples and demo data</h3>
      <p>
        Choose <strong>{labels.more}</strong>, then <strong>{labels.loadExample}</strong>. The demo is a finished run of a judge that checks book summaries: 20 test
        cases (10 clean, 10 with 3 injected errors each) with a reply for each one.
      </p>
      <p>
        It opens on the Judge step, with 15 cases decided. The other {awaiting} cases are waiting for you: one reply could not be read, one has a finding that only partly
        matches, and three have findings that match no injected error. Open the Test run step, press <strong>{labels.continue}</strong> and settle each one. When all 20 are decided the judge
        found {c.expected_found} of {c.expected_total} injected errors, and the overall result is {expected.after_deciding.overall.result}.
      </p>
    </section>
  );
}
