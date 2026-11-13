import { MINIMUM_SAMPLE } from '../../../core/evaluation/results';

export function TestSize() {
  return (
    <section aria-labelledby="help-size">
      <h3 id="help-size">How big a test needs to be</h3>
      <p>
        A small test can look good by luck. For a final answer the tool needs at least {MINIMUM_SAMPLE.expected_errors} injected errors and{' '}
        {MINIMUM_SAMPLE.clean_cases} clean cases. Until then the overall result is <strong>Inconclusive</strong>, and the Summary says how many are missing.
      </p>
      <p>
        <strong>Worked example.</strong> Ten cases with three injected errors each give 30 errors; ten clean cases give the 10 clean cases. That is exactly
        the minimum, and it is the size of the demo.
      </p>
      <p>
        Two or three errors per case is a good size. The errors of one case are judged together in one run of the judge, so they are not fully independent;
        the more errors you put in one case, the more optimistic the 95% interval is.
      </p>
    </section>
  );
}
