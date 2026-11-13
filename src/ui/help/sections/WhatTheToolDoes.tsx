export function WhatTheToolDoes() {
  return (
    <section aria-labelledby="help-what">
      <h3 id="help-what">What the tool does</h3>
      <p>
        An LLM-as-judge is a prompt that asks a language model to check a text, for example whether a summary is true to its source. Judge the Judge
        tells you whether that judge can be trusted.
      </p>
      <p>
        You bring only the judge prompt. You prepare <strong>test cases</strong>: some are <strong>clean</strong> (they contain no error), and some have
        errors that you injected on purpose and wrote down. You run every test case through your own LLM by hand, paste the reply back, and the tool counts
        how many of the injected errors the judge found, how many errors it missed, and how many of its findings were not errors at all (false positives).
      </p>
      <p>Nothing leaves your device: the tool never calls an LLM and never sends your data anywhere.</p>
    </section>
  );
}
