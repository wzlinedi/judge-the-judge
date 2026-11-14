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
        <strong>{labels.caseWithInjectedErrors}</strong> comes in a later version of the tool: for now, prepare such a case with your LLM and paste its JSON.
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
    </section>
  );
}
