import { MINIMUM_SAMPLE } from '../../../core/evaluation/results';
import { labels } from '../../labels';

export function FinalizingHelp() {
  return (
    <section aria-labelledby="help-finalizing">
      <h3 id="help-finalizing">Finalizing, and editing before the first reply</h3>
      <p>
        Test cases made in the tool and test cases loaded from a file join one test project, and it stays open until you press{' '}
        <strong>{labels.finalizeTestCases}</strong> on the Test cases step. For example, 10 cases imported from a file and 2 cases you add by hand make one
        test project of 12 cases.
      </p>
      <p>
        <strong>The summary.</strong> Before anything is fixed the tool shows the counts, the balance and the test size, and it warns when something would
        make the result say less than you expect: the test cases are of one kind only (no clean cases, or none with injected errors), the sample reply
        cannot be read, so every case will need verification by hand, an error rule is broken, a case has no field for a variable of the prompt, no expected
        error is marked subtle, or the test is smaller than the {MINIMUM_SAMPLE.expected_errors} injected errors and {MINIMUM_SAMPLE.clean_cases} clean cases
        a final answer needs. A warning never stops you; you decide. Only an empty test project or an empty judge prompt does.
      </p>
      <p>
        <strong>What is fixed.</strong> After you confirm, the judge prompt, the judged text and the fields and identifiers of every case are fixed, so that
        every reply is judged by the same prompt. Replies can be entered only now. To change the prompt or a field later, use{' '}
        <strong>{labels.startNewEvaluation}</strong> in the File menu.
      </p>
      <p>
        <strong>What can still change.</strong> You can still add cases (<strong>{labels.addTestCase}</strong>, <strong>{labels.clone}</strong>,{' '}
        <strong>{labels.importTestCases}</strong>); a new case starts as Not run and the replies and decisions of the other cases are kept. A case without a
        reply can be renamed and removed, and its expected errors corrected with <strong>{labels.correctExpectedErrors}</strong>; a case with a reply cannot.
        The reply mapping and the error rules can be corrected too, because they decide how replies are read, not what was sent to the judge.
      </p>
      <p>
        <strong>{labels.editTestCases}.</strong> While no reply has been entered, the &ldquo;what next&rdquo; line of the Judge, Test cases and Run steps
        offers <strong>{labels.editTestCases}</strong>. It opens the test cases and the prompt again; nothing is lost and both remembered files are kept,
        because you are correcting the same test. Finalize again before entering replies. After the first reply it is no longer offered; use{' '}
        <strong>{labels.editJudgeAndRunAgain}</strong> on the Results step to test another version of the judge on the same cases.
      </p>
      <p>
        <strong>Leaving the page.</strong> Nothing is saved in the browser. While there are unsaved changes the browser warns you before the page is closed or
        reloaded.
      </p>
    </section>
  );
}
