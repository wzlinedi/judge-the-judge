import { labels } from '../../labels';

export function AddingCases() {
  return (
    <section aria-labelledby="help-cases">
      <h3 id="help-cases">Adding test cases</h3>
      <p>
        A test case has a name, one text for each variable of the judge prompt and a list of expected errors. There are two kinds. A <strong>clean case</strong>{' '}
        has no expected errors: it shows what correct data looks like. A <strong>case with injected errors</strong> has at least one: you changed a clean text so
        that it holds errors you know, and you list them.
      </p>
      <p>
        <strong>{labels.addTestCase}</strong> opens a window with three choices. <strong>{labels.pasteJson}</strong> is for a case you already have as JSON.{' '}
        <strong>{labels.cleanCase}</strong> gives you a prompt to copy into your own LLM, and you paste its answer back; the answer is checked as you paste it.{' '}
        <strong>{labels.caseWithInjectedErrors}</strong> is described next. Each way is one page from top to bottom, with the test case name first.{' '}
        <strong>{labels.saveCase}</strong> is in the header, with the reason beside it while it is disabled, and <strong>{labels.closeWithoutSaving}</strong> asks
        first when you pasted or typed something.
      </p>
      <p>
        <strong>{labels.caseWithInjectedErrors}.</strong> The page has five parts. In part 1 you may pick a base case, a clean case or a case with errors (without
        one, your LLM writes the whole case). In part 2 you list the errors to prepare with <strong>{labels.addError}</strong>: a category from the catalog or a new
        name, a difficulty of obvious, subtle or left to the LLM, and what should be wrong. Part 3 builds one prompt from the judge prompt, the base and the list, and
        rebuilds it as you change them; copy it with <strong>{labels.copyPrompt}</strong> into your LLM. You may edit the prompt; it is then no longer rebuilt, and{' '}
        <strong>{labels.rebuildPrompt}</strong> asks before it replaces your edit. In part 4 you paste the answer into the JSON box; it is checked as you paste it. An
        answer with a different number of errors than you listed is accepted with a note, and a JSON with no expected errors is saved as a clean case. What your LLM
        returns is a proposal to review, not a guaranteed result. A new category in the answer joins the catalog when the case is saved.
      </p>
      <p>
        <strong>The expected errors.</strong> Part 5 shows the fields of the case and the expected errors under them, with their number, category, difficulty,
        fragment and description. <strong>{labels.showInText}</strong> on an error marks its passages in the fields and brings them into view; it is missing for an
        error whose passage is not in the case, and the line beside it says &ldquo;not found in the case&rdquo;. An expected error with no fragment or no category is
        only a note: it cannot be matched automatically, so you decide it by hand on Test run. To change anything, change the JSON in the box; while the JSON is
        invalid the list is replaced by a line that says so, and <strong>{labels.saveCase}</strong> is disabled.
      </p>
      <p>
        <strong>The case JSON.</strong> One case is an object with <code>name</code>, <code>fields</code> (the variable names with their texts) and{' '}
        <code>expected_errors</code>. Each expected error has a <code>description</code> and may have a <code>category</code>, a <code>fragment</code> (the exact words
        that were changed) and a <code>difficulty</code> of <code>obvious</code> or <code>subtle</code>. A missing fragment is allowed, but the error then cannot be
        matched automatically. The JSON may sit inside other text or a code fence. Names must be unique.
      </p>
      <p>
        <strong>The table.</strong> Every case is one row. <strong>{labels.open}</strong> shows it read-only, with <strong>{labels.previousTestCase}</strong> and{' '}
        <strong>{labels.nextTestCase}</strong> (or Alt + Left and Alt + Right) and, under <strong>{labels.showFullPrompt}</strong>, its complete judge prompt.{' '}
        <strong>{labels.rename}</strong> asks for a new name, and <strong>{labels.remove}</strong> asks for confirmation. A case that other cases were made from
        cannot be removed.
      </p>
      <p>
        <strong>Searching, filtering and sorting.</strong> Above the table the search box looks in the name and in the texts of every field. <strong>Kind</strong> shows
        only the clean cases or only the cases with injected errors, <strong>Reply</strong> only the cases with or without a reply, and <strong>With warnings</strong>{' '}
        only the cases that have a warning. The search and the filters work together, and a line under them says how many cases are shown out of all of them;{' '}
        <strong>{labels.clearFilters}</strong> shows every case again. A click on the heading of Id, Name, Kind or Expected errors sorts the table by that column, a second
        click reverses it and a third returns to the order of the test project. Nothing here changes a case or the test project; it only changes what you see, which is
        how you check a large file after loading it. A test project may hold up to 500 cases.
      </p>
      <p>The text of a saved case is never edited. To change it, make a similar case with <strong>{labels.caseWithInjectedErrors}</strong>, which can start from a case with errors, and remove the original.</p>
      <p>
        <strong>{labels.correctExpectedErrors}.</strong> The read-only view of every case offers this button. It opens a dialog with the JSON of the expected errors
        only; the name and the fields of the case cannot change here. Saving gives a new test cases version, and after the first reply the result and the report name
        the case as corrected after the first reply. When the case has a reply, the tool asks first: the marks of the changed and removed errors are dropped and the
        case is marked again from the reply. To keep an error out of the numbers without changing the list, mark it <strong>{labels.ignore}</strong> on Test run.
      </p>
    </section>
  );
}
