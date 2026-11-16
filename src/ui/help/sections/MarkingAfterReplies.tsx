import opinions from '../../../../examples/demo/opinions.json';
import { labels } from '../../labels';

/** An opinion of the demo: the files the tests validate are the examples of the Help (Principle VIII). */
const exampleOpinion = JSON.stringify(opinions['17' as keyof typeof opinions], null, 2);

export function MarkingAfterReplies() {
  return (
    <section aria-labelledby="help-marking">
      <h3 id="help-marking">Marking after each reply: Add finding, Remove, the second opinion and Ignored</h3>
      <p>
        Right after a reply is saved, the case window lists every expected error and every additional finding (a finding that points at no expected error). What the rules and
        the reply settle is already marked, with the source <em>Automatic</em>; everything else shows why it waits. Mark an expected error <strong>{labels.found}</strong>,{' '}
        <strong>{labels.issueMissed}</strong> or <strong>{labels.ignore}</strong>, and an additional finding <strong>{labels.issueFalsePositive}</strong>,{' '}
        <strong>{labels.realError}</strong> or <strong>{labels.ignore}</strong>. <strong>{labels.issueMissed}</strong> and <strong>{labels.issueFalsePositive}</strong> count against the judge. <strong>{labels.ignore}</strong> leaves the item
        out of every count and lists it as ignored. A genuine error does not fail a case. A mark you press has the source <em>Set by hand</em>, and a case waits for you while any
        item is undecided.
      </p>
      <p>
        <strong>{labels.addFinding}</strong> adds a finding the tool could not read from the reply, with its text, an optional category (from the catalog, or a new name that joins
        it) and an optional difficulty. It starts as a real error; press the mark that fits. A finding you added has <strong>{labels.remove}</strong>; a finding read from the
        reply has none, because you can only mark it, <strong>{labels.ignore}</strong> included. When a reply cannot be read, nothing is marked automatically, and once you have added the findings the case needs{' '}
        <strong>{labels.noMoreFindings}</strong>.
      </p>
      <p>
        <strong>The mark in Judge reply.</strong> In a saved JSON reply, each finding is marked as the whole JSON object that holds it, with a light background and a thin
        line at its left. <strong>{labels.showInText}</strong> on an error brings its passage in the fields into view and marks it for about two seconds. The object of
        that finding in the reply gets a stronger mark that stays until you point at another one, move to another case or close the window. Pressing an object in the
        reply marks its line on the right the same way. A reply kept as text has no marks.
      </p>
      <p>
        <strong>{labels.secondOpinion}</strong> asks your own LLM for another view of one case. Copy the prompt, run it in your LLM and paste the answer into the box. The tool
        never calls an LLM. Before anything changes, the window previews each change, with the reason and the fragment of your LLM: &ldquo;E2 undecided → Not found&rdquo;,
        &ldquo;+ new finding&rdquo; for a finding the reply holds that was not in the list, &ldquo;no change&rdquo; for an answer that agrees, and a note on every change that replaces a mark set by hand. <strong>{labels.applyOpinion}</strong> is your approval: it sets every item the opinion answers, marks set by hand included, with the source <em>LLM
        opinion, approved by the user</em>, adds the new findings and approves the case. Items it does not answer keep their marks. An opinion for another case, a list of several
        opinions or text that is not JSON is refused with the reason and where it is, and an opinion that classifies none of the items cannot be applied. The answer looks like
        this (an opinion is asked for one case at a time):
      </p>
      <pre class="example">{exampleOpinion}</pre>
      <p>
        When you correct a rule or the reply mapping after replies are in, the automatic marks are computed again and the marks you set are kept; a mark that no longer matches any
        item is named in one sentence, and the result says that the rules were corrected after the replies were received.
      </p>
    </section>
  );
}
