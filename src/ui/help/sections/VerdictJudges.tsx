import verdict from '../../../../examples/metrics/bias-verdict-example.json';
import { labels } from '../../labels';

const sampleReply = JSON.stringify(JSON.parse(verdict.judge_set.sample_reply), null, 2);

export function VerdictJudges() {
  return (
    <section aria-labelledby="help-verdict">
      <h3 id="help-verdict">Judges that give only a verdict (for example bias: yes or no)</h3>
      <p>
        Some judges do not list findings. They answer once for the whole text, like this reply of the bias example in <strong>{labels.loadExample}</strong>:
      </p>
      <pre class="example">{sampleReply}</pre>
      <p>
        When every error rule uses only fields outside any list, the tool knows this and says on the Judge step that the judge is <strong>evaluated per case</strong>. There is no place
        in the reply to match, so a case is decided as a whole: when the reply is flagged (a rule holds), every expected error of the case is <strong>Found</strong>, also one without a
        fragment; when it is not flagged, every one is <strong>{labels.issueMissed}</strong>. Both marks have the source <em>Automatic</em> and you can still change them. On a clean case a flag is an
        additional finding, and you decide it as always: <strong>{labels.issueFalsePositive}</strong> or <strong>{labels.realError}</strong>.
      </p>
      <p>
        The Summary then counts cases, not errors, because the judge does not say which error it found. Its two rates are the <strong>Case detection rate</strong> (decided cases with errors
        that the judge flagged) and the <strong>Clean-case false-positive rate</strong> (decided clean cases that it flagged). Error analysis counts a case once in each category and difficulty
        its errors have, with counts only. The thresholds of these two rates are in <strong>Details</strong>, and a final answer needs at least 30 decided cases with errors and 10 clean cases.
      </p>
      <p>
        <strong>Worked example.</strong> 30 biased texts, 27 flagged: 90%. 10 neutral texts, 1 flagged: 10%. With the thresholds at least 80% and at most 10%, the judge works. If you correct a rule after
        the replies so that it uses a list field, the way of counting changes; the result and the report then say how it was counted before and after.
      </p>
      <p>
        Not covered in this version: graded answers (&ldquo;partly present&rdquo;), and checking a number the judge returns against an expected number.
      </p>
    </section>
  );
}
