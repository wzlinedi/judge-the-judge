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
          The Test run step lists every test case. <strong>{labels.open}</strong> a case, and its window is one page in three parts: the case, the marking, and{' '}
          <strong>Verify the judge reply</strong>, with <strong>Judge reply</strong> on the left and the errors on the right. In part 3 press <strong>{labels.copyPrompt}</strong>;
          run the prompt in a <strong>new conversation</strong> of your LLM, so that one case cannot influence another; copy the answer; press{' '}
          <strong>{labels.pasteReplyFromClipboard}</strong>. The reply is saved by the paste itself and the marks appear on the right. Then press{' '}
          <strong>{labels.nextTestCase}</strong>, or Alt + Right on the keyboard; Escape closes the window, and Tab stays inside it. One case takes three actions. The title of the window says where the case is in the list, for example case 3 of 20.{' '}
          <strong>{labels.nextTestCase}</strong>, <strong>{labels.previousTestCase}</strong> and <strong>{labels.close}</strong> wait for the save of a reply you just pasted, so nothing asks about it.
        </p>
        <p>
          Above the list the Test run step shows one line about the judge being run: its version, the name and version of the test project and the judged text. The prompt and the
          rules are on the Judge step. Under <strong>Model details</strong> write what you ran the prompts with, for example the model name and the temperature, in any form
          and over several lines; the tool does not read it and saves it with the result.
        </p>
        <p>
          Nothing is saved to a file by itself. The Test run step and the header of the case window show how many replies are not saved to a file, and after every 25 of them
          a reminder asks you to press <strong>{labels.saveTestProject}</strong>. Every reply is saved with the prompt that produced it.
        </p>
      </section>

      <section aria-labelledby="help-paste">
        <h3 id="help-paste">Pasting replies from the clipboard, and replacing a reply</h3>
        <p>
          A judge is expected to answer in JSON, like this:
        </p>
        <pre class="example">{exampleReply}</pre>
        <p>
          A case without a reply shows the box for the reply. If your browser does not let the page read the clipboard, or the clipboard is empty, the window says so
          and nothing changes; then paste the reply into the box with Ctrl + V. A reply that is readable JSON is saved at once, with no button. The box is checked as the
          text changes: it shows the line and column where the JSON breaks. A reply may be wrapped in other text or a code fence.
        </p>
        <p>
          Any text up to 200,000 characters is kept. A longer reply is not saved, and the box says how long it is: &ldquo;The reply is 200,001 characters; the tool keeps replies up to 200,000 characters.&rdquo; Text that is not JSON shows &ldquo;This is not JSON&rdquo; with the line and column, and <strong>{labels.saveAsTextAnyway}</strong> keeps it. A reply
          that is not JSON, or that lacks a field a rule needs, is saved with the problem shown; nothing is marked automatically and the case waits for you to mark its items
          or to press <strong>{labels.noMoreFindings}</strong>.
        </p>
        <p>
          To change a saved reply, press <strong>{labels.changeReply}</strong>: the reply opens in a box, with <strong>{labels.saveReply}</strong> and{' '}
          <strong>{labels.cancel}</strong>. <strong>{labels.saveReply}</strong> asks before replacing the saved reply, and says how many marks you set by hand or from an
          opinion will be removed; the case is then marked again from the new reply. An emptied box asks &ldquo;Remove the judge&rsquo;s reply?&rdquo; and takes the case
          back to Not run. Moving to another case or closing the window with a reply that you typed and did not save asks first as well.
        </p>
      </section>
    </>
  );
}
