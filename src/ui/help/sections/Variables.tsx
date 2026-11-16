export function Variables() {
  return (
    <section aria-labelledby="help-variables">
      <h3 id="help-variables">Variables and the judged text</h3>
      <p>
        Write the judge prompt exactly as you would give it to your LLM. Wherever a part of a test case must go, write its name between double braces, like{' '}
        <code>{'{{name}}'}</code>. The tool lists every variable it finds as you type, and each variable becomes one field of every test case. Spaces around a
        name are ignored, and a name used twice is one variable.
      </p>
      <p>
        The tool uses no variable names of its own. If your prompt has none, nothing from the test cases will reach it, and the Judge step says so.
      </p>
      <p>
        Mark one variable as the <strong>judged text</strong>: the output your judge evaluates, for example the summary. Errors are injected into it. The last
        variable is proposed first, and when you remove the marked variable the last one is proposed again and you are told.
      </p>
      <p>
        <strong>Limit.</strong> The tool always reads <code>{'{{'}</code> as the start of a variable, so a literal <code>{'{{'}</code> in your prompt cannot be
        written. Rephrase it, for example with a space between the braces.
      </p>
      <p>
        Once the test run has started the prompt is fixed, so that every reply is judged by the same prompt. The judge version shown under the prompt
        changes whenever the prompt, the rules or the reading of the reply change.
      </p>
    </section>
  );
}
