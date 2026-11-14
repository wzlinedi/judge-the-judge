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
        <strong>{labels.caseWithInjectedErrors}</strong> has three parts, described below.
      </p>
      <p>
        <strong>{labels.caseWithInjectedErrors}.</strong> In part 1 you may pick a clean case as the base (without one, your LLM writes the whole case), list the errors to
        prepare with <strong>{labels.addError}</strong> (a category from the catalog or a new name, a difficulty of obvious, subtle or left to the LLM, and what should be
        wrong) and, if you like, add your own instructions. The window builds one prompt from the judge prompt, the base and the list, and rebuilds it as you change
        them; copy it with <strong>{labels.copyPrompt}</strong> into your LLM. In part 2 you paste the answer into the JSON box; it is checked as you paste it and{' '}
        <strong>{labels.next}</strong> is enabled only while it is valid, and <strong>{labels.back}</strong> returns to part 1 without losing anything. An answer with a
        different number of errors than you listed is accepted with a note, and a JSON with no expected errors is saved as a clean case. What your LLM returns is a
        proposal to review, not a guaranteed result. A new category in the answer joins the catalog when the case is saved.
      </p>
      <p>
        <strong>The case view.</strong> Part 3 shows the case read-only. The fragments of the expected errors are highlighted in the text with their numbers (E1, E2 …),
        and <strong>{labels.showInText}</strong> gives one of them a stronger highlight and scrolls to it, also for an omission whose fragment is in another field.
        One line says whether the text and the list agree: &ldquo;Text and list agree&rdquo;, or the number of changed places against the base that no expected error
        covers (marked &ldquo;not in the list&rdquo;) and of expected errors whose fragment is not in the text. Saving with such a mismatch asks first, and a case
        identical to its base is refused. An expected error with no fragment or no category is only a note: it cannot be matched automatically, so you decide it by hand
        on Run. To change anything, change the JSON in the box on the right; the view follows every change, and while the JSON is invalid it keeps its last valid state
        marked &ldquo;Out of date&rdquo; and <strong>{labels.saveCase}</strong> is disabled.
      </p>
      <p>
        <strong>The case JSON.</strong> One case is an object with <code>name</code>, <code>fields</code> (the variable names with their texts) and{' '}
        <code>expected_errors</code>. Each expected error has a <code>description</code> and may have a <code>category</code>, a <code>fragment</code> (the exact words
        that were changed) and a <code>difficulty</code> of <code>obvious</code> or <code>subtle</code>. A missing fragment is allowed, but the error then cannot be
        matched automatically. The JSON may sit inside other text or a code fence. Names must be unique.
      </p>
      <p>
        <strong>The table.</strong> Every case is one row. <strong>{labels.open}</strong> shows it read-only, with its complete judge prompt and{' '}
        <strong>{labels.showJson}</strong>. <strong>{labels.clone}</strong> opens Paste JSON filled with the case and the name &ldquo;… (copy)&rdquo;; nothing is added
        until you save. <strong>{labels.rename}</strong> asks for a new name, and <strong>{labels.remove}</strong> asks for confirmation. A case that other cases were
        made from cannot be removed, and after the test cases are finalized a case with a reply can be neither renamed nor removed.
      </p>
      <p>The text of a saved case is never edited. To change it, clone the case, change the copy and remove the original.</p>
      <p>
        <strong>{labels.correctExpectedErrors}.</strong> After the test cases are finalized, the read-only view of a case that has no reply offers this button. It opens the
        case view with the case JSON; only the expected errors may change, and a change to the name or a field is shown as a problem. Saving gives a new test cases version
        and the result and the report name the case as corrected after the first reply. A case that has a reply cannot be corrected; mark an expected error that should
        not count as <strong>{labels.ignore}</strong> on Run.
      </p>
    </section>
  );
}
