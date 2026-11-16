import { MINIMUM_SAMPLE } from '../../../core/evaluation/results';
import { labels } from '../../labels';

export function StartingTheRun() {
  return (
    <section aria-labelledby="help-start">
      <h3 id="help-start">Starting the test run</h3>
      <p>
        Test cases made in the tool and test cases loaded from a file join one test project. For example, 10 cases imported from a file and 2 cases you add by
        hand make one test project of 12 cases. You can change the judge and the test cases freely until you press <strong>{labels.startTestRun}</strong> on the Test
        cases step.
      </p>
      <p>
        <strong>The summary.</strong> Before anything is fixed the tool shows the counts, the balance and the test size, and it warns when something would
        make the result say less than you expect: the test cases are of one kind only (no clean cases, or none with injected errors), the sample reply
        cannot be read, so every case will need verification by hand, an error rule is broken, a case has no field for a variable of the prompt, no expected
        error is marked subtle, or the test is smaller than the {MINIMUM_SAMPLE.expected_errors} injected errors and {MINIMUM_SAMPLE.clean_cases} clean cases
        a reliable answer needs. A warning never stops you; you decide. Only an empty test project or an empty judge prompt does.
      </p>
      <p>
        <strong>What is fixed.</strong> After you confirm, the judge prompt, the judged text and the fields and identifiers of every case are fixed, with no way
        back, so that every reply is judged by the same prompt. Replies can be entered only now. To change the prompt or a field later, save the test project and
        open it again with <strong>{labels.loadTestProject}</strong>, then choose <strong>{labels.loadTestProjectOnly}</strong>.
      </p>
      <p>
        <strong>What can still change.</strong> You can still add cases (<strong>{labels.addTestCase}</strong>, <strong>{labels.importTestCases}</strong>); a new
        case starts as Not run and the replies and decisions of the other cases are kept. A case can be renamed and removed; removing a case that has a reply
        takes its reply and its decisions with it, and the tool says so first. The expected errors of any case can be corrected with{' '}
        <strong>{labels.correctExpectedErrors}</strong>; when the case has a reply, the marks of the changed errors are dropped and the case is marked again from
        the reply. The reply mapping and the error rules can be corrected too, because they decide how replies are read, not what was sent to the judge.
      </p>
      <p>
        <strong>Leaving the page.</strong> Nothing is saved in the browser. While there are unsaved changes the browser warns you before the page is closed or
        reloaded.
      </p>
    </section>
  );
}
