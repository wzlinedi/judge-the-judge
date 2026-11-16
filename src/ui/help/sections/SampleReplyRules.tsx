import { labels } from '../../labels';

export function SampleReplyRules() {
  return (
    <section aria-labelledby="help-rules">
      <h3 id="help-rules">Sample reply, fields and error rules</h3>
      <p>
        Paste one real reply of your judge into the sample reply box. It is read as soon as you paste or change it: there is no button to press. The JSON may be
        wrapped in other text or in a code fence. If it cannot be read, the line and column of the problem are shown under the box and your text is kept.
      </p>
      <p>
        The tool lists the fields it finds with their paths, such as <code>claims[].verdict</code> (a field of each item of the list <code>claims</code>), the
        kind of value and the values seen. In each rule, <strong>Where the error is</strong> names the field of a list item that holds the words of the judged text the judge points at. The
        tool proposes the most likely one and you can change it. It is shown only when the items have more than one text field, and a rule about the whole
        reply has none.
      </p>
      <p>
        An <strong>error rule</strong> says when the judge has reported an error. Press <strong>{labels.addRule}</strong>, name it, and use{' '}
        <strong>{labels.addCondition}</strong> for more conditions. A condition names a field of the sample reply, a comparison and, where needed, a value. Choose
        &ldquo;all of&rdquo; when every condition must hold and &ldquo;any of&rdquo; when one is enough; to combine both, write several rules. The judge has
        reported an error when at least one rule holds.
      </p>
      <p>
        The tool does not propose a rule, and a rule can only use fields the sample reply contains. A rule on a list is checked for each item, and each item
        for which it holds is one finding. If a new sample reply loses a field a rule needs, the rule is marked broken and does not count until you fix it.
      </p>
      <p>
        When replies cannot be read automatically (no sample, no rule, a broken rule, or no field marked as the text of a finding) the step warns you. Every
        case then needs verification by hand or with an LLM opinion.
      </p>
    </section>
  );
}
