import { labels } from '../../labels';

export function ResultsHelp() {
  return (
    <>
      <section aria-labelledby="help-overall">
        <h3 id="help-overall">Overall result and thresholds</h3>
        <p>
          The Summary ends in one line: <strong>Works</strong> when the detection rate and the false-positive rate both meet their thresholds, <strong>Does not work</strong> when
          either does not, and <strong>Inconclusive</strong> while any case is not run or awaits verification, or while the test is below the minimum size. The thresholds start at
          a detection rate of at least 80% and a false-positive rate of at most 10%. The minimum test size is fixed at 30 injected errors and 10 clean cases, and a value for it in a
          file is ignored and reported.
        </p>
        <p>
          The thresholds do not draw attention from the counts: they are in <strong>Details</strong>, closed by default. There you can change each one and see the result
          update at once. They are the check rules, and they are saved with the test project, so every run of one test counts the same way.
        </p>
        <p>
          Every measure has a threshold from the start, so a new test project needs no setup. When a judge is evaluated per case, its two rates, the case detection rate and the
          clean-case false-positive rate, start at 80% and 10% (at least 80%, at most 10%), like the two rates per expected error. Details shows the same thresholds that decide the
          overall result, for the way your judge is counted, and a change there is saved with the test project.
        </p>
        <p>
          Details also shows the 95% interval of each rate. The errors of one case are judged together, so they are not fully independent, and the interval is somewhat optimistic when each case carries many errors. A rate is <em>borderline</em> when its interval contains its threshold: with this many cases the judge could be on either side, so add
          cases before you decide. It shows, as information, how many cases had at least one false positive and how many of the clean cases did.
        </p>
      </section>

      <section aria-labelledby="help-export">
        <h3 id="help-export">Exporting the report</h3>
        <p>
          Results has three views. <strong>{labels.summary}</strong> shows the counts first. <strong>{labels.errorAnalysis}</strong> splits the expected errors by category and by difficulty; the table shows the detection rate of every group, whatever its size. A
          rate of a group with fewer than 10 expected errors says little, and the sentence under the table says so. It also counts the additional findings per rule, per
          category and per difficulty (&ldquo;(no category)&rdquo; and &ldquo;(not set)&rdquo; for those without), apart from the rates. <strong>{labels.testCaseList}</strong> lists every case with
          what the judge reported, its status and the sources of its decisions. <strong>{labels.open}</strong> shows a case read-only, with its complete prompt, the reply and every mark; it offers no
          action that changes the case, and <strong>Open on Test run</strong> leads to the case window where you can. Results changes nothing but the thresholds.
        </p>
        <p>
          <strong>{labels.exportHtmlReport}</strong> works at any time and saves one page that needs no tool to be read and prints cleanly to PDF from the browser. It holds the same three views, the
          full prompts, the replies, every decision with its source, the ignored items, the cases added or corrected after the first reply, the judge set and the model details. While a case is not run or
          awaits verification the report says at the top how many cases are not decided. The result as JSON is in the test project file of{' '}
          <strong>{labels.saveTestProject}</strong>; there is no separate JSON export. Exported files contain your data: the prompts, the cases and the replies. Check them before you share them.
        </p>
      </section>
    </>
  );
}
