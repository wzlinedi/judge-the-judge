import accuracy from '../../../core/metrics/builtin/accuracy.json';
import { labels } from '../../labels';

/** The reply the example judge gives is the sample reply of the Accuracy metric: the file the tests validate (Principle VIII). */
const exampleReply = JSON.stringify(JSON.parse(accuracy.judge_set.sample_reply), null, 2);

export function WorkingByHand() {
  return (
    <>
      <section aria-labelledby="help-by-hand">
        <h3 id="help-by-hand">Working by hand: copy, run, paste</h3>
        <p>
          The Run step lists every test case. <strong>{labels.open}</strong> a case, and its window has the case on the left and <strong>Judge&rsquo;s reply</strong> on the right
          with four steps: press <strong>{labels.copyPrompt}</strong>; run the prompt in a <strong>new conversation</strong> of your LLM, so that one case cannot influence
          another; copy the answer; press <strong>{labels.pasteReplyFromClipboard}</strong>. The reply is saved by the paste itself and the marks appear under it. Then press{' '}
          <strong>{labels.nextTestCase}</strong>, or Alt + Right on the keyboard. One case takes three actions.
        </p>
        <p>
          Above the list the Run step shows one line about the judge being run: its version, the name and version of the test project and the judged text. The prompt and the
          rules are on the Judge step. Under <strong>Model details</strong> write what you ran the prompts with, for example the model name and the temperature, in any form
          and over several lines; the tool does not read it and saves it with the result.
        </p>
        <p>
          Nothing is saved to a file by itself. The Run step and the header of the case window show how many replies are not saved to a file, and after every 25 of them a reminder
          asks you to press <strong>{labels.saveEvaluation}</strong>. Every reply is saved with the prompt that produced it.
        </p>
      </section>

      <section aria-labelledby="help-paste">
        <h3 id="help-paste">Pasting replies from the clipboard, and replacing a reply</h3>
        <p>
          A judge is expected to answer in JSON, like this:
        </p>
        <pre class="example">{exampleReply}</pre>
        <p>
          The box under the steps is always visible. If your browser does not let the page read the clipboard, or the clipboard is empty, the window says so and nothing changes; then
          paste the reply into the box with Ctrl + V and press <strong>{labels.saveReply}</strong>. The box is checked as the text changes: it says <em>Readable JSON</em>, or the line and
          column where the JSON breaks. A reply may be wrapped in other text or a code fence.
        </p>
        <p>
          Any text is kept. A reply that is not JSON, or that lacks a field a rule needs, is saved with the problem shown under the box; nothing is marked automatically and the case waits
          for you to mark its items or to press <strong>{labels.approve}</strong>.
        </p>
        <p>
          To change a reply, edit the text in its box and press <strong>{labels.saveReply}</strong>. The case is then marked again from the new reply and its decisions are removed. The tool
          asks before replacing only when you set decisions by hand or approved them from an LLM opinion, and it says how many it will remove. Moving to another case or closing the window with
          a reply that you typed and did not save asks first as well.
        </p>
      </section>
    </>
  );
}
