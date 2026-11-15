# Research: Judge the Judge

**Date**: 2026-11-12 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Each entry records a decision, why it was made, and what else was considered. The spec left the
technology stack, the confidence-interval method, the matching rule, the way a field path is
written and the exact file layouts to planning; they are settled here. No open questions remain.

**Note (2026-11-13)**: this log records decisions in the order they were made, so older entries
keep the words of their time. After the reviews of prototypes v13 to v17 these names and decisions
are superseded, and the spec, contracts/ui-flow.md, contracts/file-formats.md, data-model.md and
section 22 win: "test set" is now the **test project** and "dataset" its **test cases**; there
are no clean base cases on the Judge step and no catalog file (the catalog is the "Error
categories" section of the Test cases step); "Load demo data" is the demo of **Load demo…**;
"Read sample reply", "Read clean base cases", "Modify" and "More actions" are gone; "Save
evaluation" is only on the Run step; every test case is made from one case JSON and never edited
after saving; the second opinion is its own window with a preview and **Apply opinion**, with no
stored proposals.

Sections 1 to 5, 7 and 13 are unchanged in substance from the first plan. Sections 8 to 11 and
14 to 20 were rewritten for the revised spec (free variables, error rules, judge set, deciding on Run,
no Compare, no batch files). The review of prototype v10 (2026-11-12) changed sections 6, 12, 18,
20, 22 and 24 and added sections 25 to 28: saving to one chosen file and the clipboard, Chrome and
Edge only, a read-only Results step with no closing step, and the Run step summary.

## 1. Language and build

- **Decision**: TypeScript in strict mode, built with Vite into static files, with relative asset
  paths so the site works from any folder of any static host.
- **Rationale**: The constitution requires a static site with core logic that is testable without
  a browser. TypeScript catches data-shape mistakes at build time, which matters in a tool whose
  work is reading and writing file formats. Vite gives a fast local server and a plain static build
  with no configuration to maintain.
- **Alternatives considered**: Plain JavaScript in a single HTML file, as in the prototypes (hard
  to test, no type checks, cannot separate core from interface); a full framework with a server
  part such as Next.js (breaks Static-First, far more than needed).

## 2. Interface library

- **Decision**: Preact with function components. Application state lives in one store in
  `src/app`; components only show state and send actions.
- **Rationale**: The tool has five screens, two large windows, tables with filters, a rule editor
  with live preview and forms with live validation. Hand-written DOM updates at this size are where
  the prototypes became hard to change. Preact is about 4 KB, uses the most widely known component
  model, and escapes all text by default, which matters because the tool displays text pasted from
  an LLM.
- **Alternatives considered**: No library (cheapest at first, most expensive to maintain);
  React (same model, ten times the size, no benefit here); Svelte or Lit (fine technically, less
  common, so harder for a non-developer owner to get help with).

## 3. Schemas and validation

- **Decision**: Every file format is defined once as a Zod schema in `src/core/schemas`. The same
  schema validates loaded files, gives the TypeScript type, and is exported to JSON Schema files in
  `docs/schemas/` during the build. Validation errors are translated into plain sentences that name
  the place (row or case, field) and say what to fix.
- **Rationale**: Principle IV requires documented, versioned schemas and validating loaders. One
  source for type, validator and documentation removes the risk that they drift apart.
- **Alternatives considered**: Hand-written JSON Schema validated with Ajv (two sources of truth
  with the TypeScript types, and raw messages that still need translation); hand-written
  validation functions only (no machine-readable schema to publish).

## 4. CSV reading

- **Decision**: Papa Parse for reading CSV. Files are decoded as UTF-8 (with or without a byte
  order mark); if the bytes are not valid UTF-8 the tool retries as Windows-1250, tells the user
  which encoding was used, and shows the first rows so they can confirm Polish letters look right.
  Line endings of any convention are accepted. The example file is written as UTF-8 with a byte
  order mark so spreadsheet programs open it correctly.
- **Rationale**: Quotes, commas and line breaks inside cells are the classic sources of silent data
  damage (FR-027). A mature parser is safer than a custom one. Windows-1250 is the usual encoding of
  Polish spreadsheets saved without choosing UTF-8.
- **Alternatives considered**: A custom parser (small, but the edge cases are exactly what the spec
  lists as risks); accepting UTF-8 only (simplest, but fails on the most likely real-world file).

## 5. Clean-versus-injected differences

- **Decision**: jsdiff, comparing word by word, for the side-by-side view in the test case
  window, and for the check that every changed place is covered by an
  expected error (FR-042).
- **Rationale**: Fields may hold up to 100,000 characters. A naive comparison is too slow at that
  size (prototype v8 falls back to a crude prefix and suffix comparison for long texts); jsdiff
  implements the standard efficient algorithm.
- **Alternatives considered**: Sentence-set comparison (fast, but cannot highlight the changed
  words and misses changes inside long sentences).

## 6. Testing

- **Decision**: Vitest for unit, contract and integration tests, all running in Node without a
  browser. Component tests use Vitest with a simulated DOM. Playwright runs the quickstart scenarios
  against the built site in Chromium and Microsoft Edge (section 26) and checks accessibility with
  axe-core in light and dark schemes and at phone and desktop widths. The two browser features the
  tool needs, a chosen save file and the clipboard, sit behind small ports (section 25), so every
  test can replace them: component and integration tests pass a fake port, and end-to-end tests
  grant clipboard permission to the browser context and install an in-memory save picker with an
  init script, because native file dialogs cannot be driven by Playwright.
- **Rationale**: Principle I (tests first) and Principle III (core testable without a browser).
  Vitest shares Vite's configuration, so there is one toolchain. The demo data files are the
  fixtures, as Principle IV asks.
- **Alternatives considered**: Jest (separate configuration for TypeScript and modules); browser
  tests only (slow, and would not prove the core is independent of the interface).

## 7. Confidence intervals

- **Decision**: The Wilson score interval at 95% for the two overall rates (detection rate and
  false-positive rate). It is shown only in the collapsed "Details" section (FR-069). No interval
  is shown when the denominator is zero. Breakdowns per category and per difficulty show counts and
  a rate, without intervals (FR-070).
- **Rationale**: The spec fixes 95% and leaves the method to planning. Wilson behaves well for the
  small samples this tool works with (30 to 100 errors) and near 0% and 100%, where the simple
  textbook formula gives impossible ranges. It needs no library.
- **Limitation to document in Help (Principle V)**: errors inside the same test case are not fully
  independent, because one judge run covers all of them. The interval is therefore somewhat
  optimistic when cases carry many errors each; this is one more reason for the guidance of two or
  three errors per case.
- **Alternatives considered**: Normal approximation (wrong at small samples); Clopper-Pearson
  (very conservative, needs special functions); bootstrap by case (handles the dependence, but is
  not deterministic without a fixed seed and is hard to explain in plain language).

## 8. Variables in the judge prompt

- **Decision**: A variable is any text between `{{` and `}}` that contains no brace. Spaces around
  the name are ignored; everything else is kept as written, so `{{prompt_input}}`,
  `{{Source text}}` and `{{kontekst-źródłowy}}` are all valid, and names differ by letter case. An
  empty `{{ }}` is not a variable and stays in the prompt as written. The tool has no built-in
  names and no aliases (FR-010). The list of variables is shown under the prompt so the user sees
  at once what was detected.
- **Composition**: every occurrence of a variable is replaced by the case's field of exactly that
  name; a variable with no field becomes empty text and the case is flagged (FR-047). The text of
  a field is inserted literally and is never scanned again, so a field that itself contains
  `{{…}}` cannot inject another field.
- **Judged text** (FR-010, review of prototype v9): one variable is marked as the output the judge
  evaluates. Errors are always injected into it, and expected errors have no field of their own.
  The last variable is proposed, because prompts usually end with the text to be judged. This
  removes one choice from every expected error and from the injection prompt; matching never used
  the field anyway (section 10).
- **Known limit**: a prompt that shows example JSON containing a literal `{{` followed later by
  `}}` would have that stretch detected as a variable. The detected list makes this visible; Help
  tells the user to put a space between the two braces in such an example.
- **Alternatives considered**: Limiting names to letters, digits, `-` and `_` (rejects natural
  names with spaces or Polish letters for no gain); an escape syntax for literal braces (one more
  rule to learn for a case that is rare).

## 9. Reading the judge's reply: fields, paths and error rules

The spec separates recognizing the structure of a reply (the reply mapping) from saying what an
error is (the user's error rules), and leaves the notation of a field path to planning.

- **Getting the JSON**: the reply is read as the first complete JSON object or list found in it:
  the whole text, or the content of a Markdown code fence, or the first balanced `{…}` or `[…]`
  that parses, in that order. If none parses, the reply "cannot be read".
- **Path notation**: keys joined by dots; `[]` after a key means "each item of this list". Examples:
  `overall.ok`, `claims[].verdict`, `[].text` (the reply itself is a list). A key that itself
  contains a dot or brackets is not supported in this version and is reported when the sample is
  read.
- **Recognizing fields**: walk the sample reply; every value that is text, a number, true/false or
  null gives one field with its path, its kind, and up to eight distinct values seen. Every list
  whose items are objects gives one **list** (`claims[]`). Nested lists are recognized with their
  full path (`sections[].claims[]`).
- **Finding text**: for each list the tool proposes one text field as the text a finding points at:
  a well-known name (`text`, `claim`, `statement`, `element`, `sentence`, `part`, `quote`) or else
  the text field with the longest average value. The user confirms or changes it per list (FR-012).
- **Rules**: a rule has a name, a mode (`all` or `any`) and conditions. A condition has a field
  path, a comparison and, where needed, a value. Comparisons: `equals`, `not_equals`,
  `greater_than`, `less_than`, `is_empty`, `is_not_empty`.
  - Text is compared ignoring letter case and surrounding spaces. `true` and `false` typed as a
    value match the JSON values true and false. Two values that both read as numbers are compared
    as numbers.
  - `greater_than` and `less_than` need numbers on both sides; otherwise the condition is
    **unknown**.
  - `is_empty` holds for null, empty text and an empty list.
  - A field that is absent from the reply makes the condition **unknown** (FR-014: the tool does
    not guess).
  - A rule in mode `any` holds when any condition holds; it is unknown when none holds and at
    least one is unknown. A rule in mode `all` fails when any condition fails; it is unknown when
    none fails and at least one is unknown.
- **Scope of a rule**: all list fields of one rule must belong to the same list; fields outside
  any list may be added and are read once from the reply (FR-014). A field of an enclosing list
  (`sections[].title` in a rule over `sections[].claims[]`) counts as another list and is not
  allowed in this version.
- **Findings**: a rule over a list is checked for each item; an item for which at least one rule
  holds is one finding, whatever the number of rules that hold (all their names are shown). A rule
  with no list field gives at most one finding for the whole reply, with no text. A finding is
  identified by its list path and item position (for example `claims[]#2`, or `reply`), so
  decisions about it stay attached when rules are corrected later.
- **Unknown results**: when any rule is unknown for a reply, the names of the missing or
  uncomparable fields are kept as the reason, and nothing in that case is decided as "missed"
  automatically.
- **Rationale**: This is the notation prototype v8 used and the owner reviewed. It covers every
  claim-based judge in the examples, needs no library, and can be explained in three sentences.
  Three-valued evaluation is what makes "do not guess" precise.
- **Alternatives considered**: JSONPath or JMESPath (more power than any claim-based judge needs,
  a dependency, and harder to explain in Help); nested rule groups (rejected in the spec: several
  flat rules already express "(A and B) or (C and D)"); proposing rules automatically from the
  sample (rejected in the spec: the user alone writes the rules).

## 10. Matching a finding to an expected error

The spec says a finding "points at" an expected fragment when the two share their key content after
ignoring letter case, spacing and rephrasing, and leaves the exact rule to planning.

- **Decision**: Compare the finding's text with the expected fragment and give one of three
  levels.
  1. Normalize both texts: Unicode normalization, lower case, punctuation replaced by spaces,
     runs of spaces collapsed.
  2. **Clear match** when one normalized text contains the other.
  3. Otherwise compare words longer than three characters: let *hits* be the number of such words
     of the fragment that also occur in the finding, and *share* be hits divided by the fragment's
     word count. **Clear match** when hits ≥ 2 and share ≥ 0.6. **Partial match** when hits ≥ 1 and
     share ≥ 0.3. Otherwise **no match**.
  4. A number in the fragment (digits) must also occur in the finding for a clear match; if the
     words match but the number does not, the level is partial.

  Expected errors have no field; the fragment's own words decide. For an omission the fragment
  comes from another field, which matching handles the same way.
  The two thresholds (0.6 and 0.3) and the minimum word length are parameters of the metric
  definition, with these defaults.
- **Rationale**: This is the rule the prototypes used on the book-summary demo, plus the number
  check, which closes its one known weakness (a "wrong number" error matched by a finding about the
  same sentence with a different number). It is deterministic, explainable in two sentences, and
  works for Polish text without language-specific resources. Unclear cases go to the user, so a
  cautious rule costs a little manual work, never a wrong score.
- **Alternatives considered**: Exact quote only (fails for claim-based judges, which rephrase);
  edit distance (penalizes reordering, slow on long texts); word stemming or embeddings (need
  language resources or a model, which a static tool without an LLM cannot have).

## 11. Automatic decisions, status and counting

- **Decision** (FR-061, FR-064), per case with a reply:
  - An expected error with at least one clear-match finding is **found** (automatic).
  - An expected error with no fragment, or whose best match is partial, stays **undecided**, with
    the reason shown.
  - An expected error that no finding points at is **missed** (automatic) only when the reply was
    read, no rule was unknown, and the case has no additional finding; otherwise it stays
    undecided, because an additional finding could be the same error in other words.
  - A finding with a clear match is a **correct finding**. A finding with only partial matches is
    attached to those expected errors and waits with them. A finding with no match at all, or with
    no text, is an **additional finding** and is never decided automatically.
  - When the user decides that an expected error was missed, the findings that only partly
    resembled it become additional findings and need their own decision. When the user decides it
    was found, they count as correct findings.
  - A reply that cannot be read gives no findings; the user (or an LLM opinion) marks each expected
    error and adds findings by hand, and the case awaits verification until the user approves it.
- **Counting findings** for the false-positive rate: correct findings (for each found expected
  error, the number of findings attached to it, at least one) plus additional findings confirmed
  as real errors plus false positives. Ignored items are left out of everything.
- **False-positive rate with no findings**: when the judge reported nothing in any decided case,
  the rate is shown as "not available" and its threshold counts as met (there are no false
  positives); the detection threshold then decides the overall result.
- **Minimum sample**: counted from decided cases: expected errors that are not ignored, and clean
  cases that are decided (FR-068). The forecast on the Test cases step counts the same things from
  the dataset (FR-046).
- **Rationale**: Keeps the per-finding definition of FR-067 usable for hand-verified cases without
  asking the user to count parts of a reply, and makes every automatic decision one the user would
  agree with at a glance.

## 12. State and saving

- **Decision**: One in-memory state object per page session. No `localStorage`, `sessionStorage`,
  IndexedDB or cookies. One "unsaved changes" flag, shown in the header, covers the judge set, the
  test cases, replies and decisions; while it is set, leaving or reloading the page triggers the
  browser's standard warning. The tool works with two files, each saved the same way (section 25,
  FR-076), with every file action in the header: the **test set** ("Save test set": the judge set,
  the test cases, the active metric and the thresholds, the same for every run) and the
  **evaluation** ("Save evaluation": the whole progress of one run). "Save evaluation" clears the
  flag; "Save test set" clears it only while no reply exists, because only then does the test set
  hold all the work (FR-051). The first save of each asks for a name and folder, later saves
  overwrite that file, "Save … as" picks a new one, and after a load through the picker saving
  goes to the loaded file. The two file handles are kept in memory only, so after a reload the
  first save of each asks again. After a load the tool opens the first step with unfinished work
  and offers "Continue" (FR-073). There is no results file: Results shows what the
  evaluation holds and generates the HTML report, which is a download, as is the catalog export.
  Loads use the file picker or drag and drop. The state also counts the replies saved since the last "Save
  evaluation"; the Run step and the case window show the number, and every 25 replies a reminder
  asks the user to save (FR-059).
- **Rationale**: FR-004 and the privacy constraint: user scenarios may be sensitive, and "nothing is
  remembered" is easy to explain and to verify. With dozens of manual runs per evaluation, one
  always-available save is what makes that rule safe to live with (FR-073). The owner raised the
  risk of losing hundreds of replies when the page stops responding; a visible count and a regular
  reminder cap the loss at about 25 replies without storing anything in the browser.
- **Alternatives considered**: Three files, a judge set, a test-case file and the evaluation
  (the plan after the review of v10; dropped in the review of v11: three save buttons in three
  places, three remembered files and one indicator that did not say which file was saved, and a
  remembered judge set file could be overwritten silently with another judge after "Load
  evaluation"); one project file holding everything (simplest, but the owner wants to load the same
  test quickly and run it with another LLM or other settings, which the test set gives in one
  load); a separate "Export JSON" of the result (removed in the review of
  v10: it wrote the same content as "Save evaluation"); a separate results file (not needed: the
  evaluation file holds the results, and the report is generated from it); automatic local saving (convenient, but contradicts FR-004 and makes
  hidden state, against Principle IV); a new download on every save (works in every browser, but
  fills the Downloads folder with numbered copies and makes loading an old one easy, which the
  owner rejected in the review of v10); automatic saving to the chosen file after every reply
  (rejected by the owner: they want to decide when the file changes); keeping the file handle in
  IndexedDB across sessions (browser storage, against FR-004).

## 13. Privacy and safety of displayed text

- **Decision**: A Content Security Policy in the page: scripts, styles, fonts and images only from
  the site itself, and `connect-src 'none'`, so the page cannot send data anywhere even by mistake.
  System fonts only; no analytics; no third-party requests. All user and LLM text is rendered as
  text, never as HTML; the HTML report builder escapes every value and contains no scripts.
- **Rationale**: The tool displays text pasted from an LLM and files received from others. Treating
  it as untrusted prevents script injection through a test-case file or report. The policy turns
  the privacy promise (SC-006) into something the browser enforces.

## 14. Versions and identity

- **Decision**: A **judge version** is the first 12 hexadecimal characters of the SHA-256 hash of
  the canonical judge prompt, the finding-text choices and the error rules (keys sorted, line
  endings normalized). The sample reply text, the error catalog and the clean base cases are not
  part of it: they do not change how a reply is read. A **dataset version** is computed the same
  way from the cases in order (identifier, name, base, fields, expected errors). The dataset name
  is not part of the version. Hashing uses the Web Crypto API, which exists in browsers and in
  Node, so no library is needed.
- **Rules corrected after replies** (FR-053, FR-075): the evaluation keeps the judge version that
  was in force when the first reply was saved. When the current judge version differs and the
  prompt is the same, the Results step, the evaluation file and the report say that the rules or
  the mapping were corrected after replies were received and name both versions.
- **Consequence**: Editing expected errors after finalizing (allowed by FR-053) changes the dataset
  version. A result always records the version at the moment it was saved.
- **Rationale**: Principle V and FR-034: identical content always gives the same version, on any
  machine, and a correction made after seeing the replies is visible instead of silent.
- **Alternatives considered**: A counter or timestamp (not reproducible from the file); the short
  non-cryptographic hash of the prototype (collisions are plausible at six characters); a version
  from the prompt alone (rejected by the owner: two results with the same version could differ).

## 15. One list of clean cases

- **Decision**: There is one list of test cases in the state. A clean base case is simply a case
  with no expected errors; the Judge step and the top of the Test cases table show the same
  objects (FR-023). The test set file and the evaluation file contain all cases once, in
  `dataset.cases`; their `judge_set` has no list of its own. A metric definition carries
  `clean_base_cases`, which become the first cases when its example fills the Judge step.
- **Filling the Judge step from an example while cases exist** (FR-019): a clean case of the
  example that is identical in name and fields to an existing clean case is skipped; one whose
  identifier is taken by a different case gets the next free identifier and the user is told.
- **Loading test cases** (FR-027, FR-049): adds the valid cases of a CSV or JSON file to the open
  dataset, after the import summary. **Loading a test set** replaces the whole work after the usual
  warning.
- **Rationale**: The owner chose "one list". One store removes any question of which copy is
  current and makes "a change to one is visible in both places" true by construction.

## 16. Decisions that survive corrections

- **Decision**: Decisions are stored per case, separately from the automatic results, which are
  always recomputed. A decision about an expected error is keyed by that error's identifier (each
  expected error gets a short identifier inside its case, written to files); a decision about an
  additional finding is keyed by the finding's identity (section 9); findings added by hand have
  their own list. After the user corrects expected errors, the mapping or the rules, automatic
  results are recomputed and stored decisions are applied on top; a decision whose target no
  longer exists is not counted and is listed once in a note, so nothing disappears silently.
- **New reply for a case**: its decisions and proposals are removed, after the question that says
  how many (FR-056).
- **Rationale**: FR-053 requires that decisions made by hand are kept; positional keys would attach
  them to the wrong item after an edit.

## 17. Metrics as data (Principle VI)

- **Decision**: A **metric definition** is a declarative JSON file describing one kind of judge
  evaluation: its name, description and limitations, a complete starter judge set (prompt, sample
  reply, finding text, error rules, error catalog, a few clean base cases), matching parameters,
  and a list of **measures** built from operations the tool provides (ratio of two counters,
  complement, each ratio optionally with an interval). Accuracy and Completeness are two such
  files bundled with the tool and registered at start; they are the two ready examples of "Fill
  the whole screen with an example". A user-loaded definition is validated, registered, and
  appears as a further example in the same list. **Checks** (thresholds on measures) live in a
  separate check configuration file; the bundled default holds detection ≥ 80% and false positives
  ≤ 10% plus the fixed minimum test size.
- **Scope note**: Measures can only combine counters the tool already produces (expected errors,
  found, findings, false positives, confirmed real errors, cases, clean cases). Further measures
  from a loaded definition are shown in the "Details" section, never above the counts. Measures
  that need other inputs, such as agreement with human ratings or stability across repeated runs,
  are not expressible in this version; the guide says so. This satisfies SC-005 for measures over
  existing counters and keeps arbitrary code out of definition files.
- **Rationale**: Satisfies Principle VI without building a general formula engine, and fits the
  judge set: an example is a judge set plus measures, and filling the screen from it reads the same
  `judge_set` layout as a test set file. The harmonic-mean operation of the first plan is dropped
  with the combined score.
- **Alternatives considered**: Hard-coding the two metrics (violates Principle VI); a general
  expression language in definition files (powerful, but a parser and evaluator to maintain, and
  much harder for a non-developer to write correctly).

## 18. Pasted answers from the user's LLM

- **Decision**: Three places accept a pasted answer, each next to the prompt that asks for it:
  clean base cases on the Judge step ("Read clean base cases"), cases with injected errors in the
  test case window ("Read LLM answer"), and the verification opinion for one case in the case
  window of Run ("Paste LLM opinion from clipboard", or "Read LLM opinion" for the box when the
  clipboard cannot be read). All three find the JSON in the same way as a judge reply (section 9),
  validate it, and show proposals for review; nothing is added or decided before the user accepts
  it, and rejected text stays in its box. An opinion that names another case is refused with the
  reason. Formats are in [contracts/file-formats.md](./contracts/file-formats.md).
- **Rationale**: FR-018, FR-041, FR-063. One reader for "JSON somewhere in pasted text" means one
  set of rules and one set of tests. The always-visible paste area of the first plan is gone,
  because the owner found a paste box next to its prompt clearer. In the review of v10 the owner
  asked for the second opinion per case, next to the reply it is about, instead of one prompt for
  all awaiting cases.
- **Alternatives considered**: One verification prompt and one opinion for all awaiting cases
  (prototypes v8 to v10; removed in the review of v10 because it was unclear what it did and it
  left the case window).

## 19. Reports and the evaluation file

- **Decision**: One JSON format, the **evaluation file**, serves "Save evaluation", "Save
  evaluation as", "Load evaluation" and the demo of "Load demo…", and is the result as JSON. It holds the judge set, all cases, every prompt
  and reply, every decision and proposal, the model details, the active metric with its matching
  parameters, thresholds, versions and, once anything is decided, the computed results. Loading
  recomputes with the stored parameters, so the same file always gives the same numbers. The HTML report is one self-contained file: inline styles, no
  scripts, no external resources, in the order of the three views (Summary, Error analysis, Test
  case list), followed by the judge set; details per case are collapsible on screen and expanded
  in print.
- **Rationale**: FR-072 and FR-073 ask for the same content twice; one format means the saved work
  and the exported result can never disagree, and "reproduce a result" is simply "load the file".
- **Alternatives considered**: A separate, smaller result file (two formats to keep in step, and
  the smaller one could not restore the work).

## 20. The windows: the case window of Run, the test case window and the read-only case view

- **Decision**: One window component built on the native `<dialog>` element shown as a modal that
  fills the viewport, used three times:
  - **Case window of Run**, opened by "Open". The header holds "Previous case", "Next test
    case", the position ("case 7 of 20"), the checkbox "only cases awaiting verification", the case
    name and status, the number of unsaved replies with "Save evaluation", and "Close". Left column:
    the data and the prompt; right column, headed "Judge's reply": the four steps in one line,
    "Copy prompt" and "Paste reply" with the one needed next as the primary button,
    a collapsed box with "Save reply" for when the clipboard cannot be read, and, once the reply is
    saved, the reply, the differences and the decisions with "Approve"; adding a finding, the note,
    the second opinion for this case and replacing the reply sit under a collapsed "More actions"
    (FR-008, FR-055, FR-056, FR-060, FR-063). Leaving a case with a typed but unsaved
    reply in the box asks first.
  - **Read-only case view of Results**, opened by "Open" in the Test case list (FR-071): the same
    frame and Previous / Next, showing the case, its prompt, its reply and its decisions with no
    action that changes them.
  - **Test case window**, opened by "Add test case" or "Modify" (FR-038). Left column: the judged
    text first (other fields collapsed), the comparison with the base and "Use selected text as
    fragment"; right column: the expected errors, three short lines each, so up to five fit at
    1280 x 720 without scrolling (FR-042, SC-031).
  Alt + Left and Alt + Right move between cases. Below 760 px the columns stack.
- **Rationale**: The owner reviewed the case window in prototypes v8 and v9, and in the review of
  v9 asked for the same window for modifying test cases and for deciding right after each reply,
  which removes the separate Verify step and a second pass through all cases. The native dialog
  gives focus trapping, Escape to close and correct announcement to screen readers without a
  library. "Use selected text as fragment" reads the browser's text selection inside the left
  column, so the fragment is exact without retyping.
- **Alternatives considered**: A separate Verify step with its own list (prototype v8 and v9; the
  owner found it one pass too many); a details panel under the test-case table (rejected in the
  review of v9: too far from the table and cramped); a separate route per case (loses the list
  position).

## 21. Hosting and tool version

- **Decision**: GitHub Pages, deployed by a GitHub Actions workflow that runs all tests (installing
  the Playwright browsers `chromium` and `msedge` first), builds, and publishes the `dist` folder. The tool version comes from `package.json`, is shown in the
  footer and Help, and is written into every evaluation file and report.
- **Rationale**: Principle II (deployable from the first release) and Principle V (each result
  records the tool version). The repository already has a GitHub remote.
- **Alternatives considered**: Other static hosts (equally possible later, since the build is plain
  files with relative paths).

## 22. Prototypes

- **Decision**: `prototypes/ui-prototype-v17` is the visual and behavioral reference during
  implementation and is deleted when the production tool covers its flows. The earlier prototypes
  (the first one and v6 to v16) have answered their questions and are deleted in the setup tasks
  (Principle I). No code is copied from any prototype; behavior taken from v17 (path notation, rule
  evaluation, matching, the case JSON check with line and column, the test case window, the
  read-only case view, the "Error categories" section, the case window of Run with the
  always-visible reply box, Add finding and Remove, the second-opinion window, the two files, the
  "what next" line, evaluation per case) is first written as tests.
- **Known differences between v17 and this plan**, so nobody copies them by mistake: versions use
  a short non-cryptographic hash; an expected error is identified by its position in the case; CSV
  is read as UTF-8 only; further measures of a loaded metric definition are not shown; the reason
  "The LLM opinion gave no answer for this item" is not written to the evaluation file; the
  evaluation file still carries an empty `proposals` key; dead code for a catalog file remains; the
  two ports of section 25 are a plain object in the same file, which its own tests replace; and for
  a browser without the save dialog it falls back to a download, which the production tool replaces
  with the notice of section 26. In each of these the spec and this plan win.

## 23. Demo data

- **Decision**: A fixed, committed set in `examples/demo/`: one evaluation file that the demo of "Load
  example…" loads as a finalized evaluation with replies (FR-026), plus the same judge set and test
  cases as separate files, and the expected results. The judge is the Accuracy example with the
  variables `{{source_text}}` and `{{summary}}`. The dataset has 20 cases: 10 clean book-summary
  cases and 10 made from them with 3 injected errors each, half obvious and half subtle. The set
  meets the fixed minimum test size, so the demo can end in a real overall result, and its replies
  include at least one missed error, one false positive, one additional finding that is a real
  error, one rephrased finding (partial match), one reply wrapped in a code fence and one reply
  that cannot be read, so every status, reason and message appears.
- **Rationale**: Principle IV and SC-001. The demo opens on Run with a handful of cases awaiting a
  decision, which is the fastest way to show what the tool is for.

## 24. Local prerequisites

- **Finding**: The development machine has Node.js 22 and npm 10, which is enough for Vite, Vitest
  and Playwright. Playwright downloads its own Chromium on first use, and `npx playwright install
  msedge` installs Microsoft Edge for the Edge project (section 26); Chrome is also installed.
  Nothing else needs to be set up before implementation.

## 25. Saving to one file and reading the clipboard

- **Decision**: Two small ports in `src/app/ports/`, each with a browser adapter and a fake for
  tests:
  - **SaveTarget**: one instance per kind of file (test set, evaluation; FR-076).
    `save(text)` writes to the current file, asking for one with the browser's
    save dialog (`showSaveFilePicker`, JSON type, suggested name from the dataset name) when there
    is none; `saveAs(text)` always asks; `useLoaded(handle)` makes the file opened by the matching
    load ("Load test set", "Load evaluation"; `showOpenFilePicker`) the current one; `forget()`
    drops it. "Load test set" forgets the evaluation target and "Load evaluation" the test set
    target, so that neither can overwrite the file of another test; "New evaluation", "Load
    demo data" and "Run again with a new judge…" forget both. Such a handle is readable only, so the
    first save to it asks the browser for write permission (`requestPermission` with
    `readwrite`), and Chrome or Edge shows its prompt once; a refusal is treated like a cancelled
    dialog. A file dropped onto the page is read as a plain file and does not become the current
    one, so the next save asks for a file. Writing uses a writable stream on the file
    handle. When writing fails because the file was moved or removed, or permission was withdrawn,
    the port reports it, the current file is forgotten and the user is asked for a file again;
    the state in the page is untouched (FR-073). Cancelling the dialog changes nothing and keeps
    the unsaved flag.
  - **ClipboardReader**: `readText()` calls `navigator.clipboard.readText()` inside the click
    handler. Empty text, a refused permission or a missing API are returned as distinct results,
    so the window can say what happened and open the box for Ctrl+V (FR-056, FR-063).
  The core never sees either port: the actions in `src/app` call them and pass plain text to the
  core.
- **Rationale**: The owner chose, in the review of v10, one evaluation file that later saves
  overwrite, and one-click pasting of replies and opinions. Both are browser features with
  permission prompts and native dialogs, which tests cannot drive directly; a port keeps the
  actions testable first (Principle I) and keeps the core free of the browser (Principle III).
  Both features need a secure context, which GitHub Pages (HTTPS) and the local preview
  (`localhost`) provide. Neither makes a network request, so the Content Security Policy is
  unchanged.
- **Alternatives considered**: Calling the browser APIs directly from components (untestable
  without a real dialog); a download fallback for other browsers (not needed: other browsers are
  out of scope, section 26).

## 26. Supported browsers

- **Decision**: Current Google Chrome and Microsoft Edge only (FR-003). On start the shell checks
  for `showSaveFilePicker` and `navigator.clipboard.readText`; when either is missing, a notice
  says that the tool supports Chrome and Edge and that saving or pasting may not work. Playwright
  runs two projects: `chromium` and `msedge`.
- **Rationale**: The owner's decision in the review of v10. Both browsers share one engine, so the
  file and clipboard features of section 25 behave the same, and the test matrix halves.
- **Alternatives considered**: The four major browsers (the first plan; it would need a download
  fallback for saving and a paste box as the only path in Firefox and Safari).

## 27. A read-only Results step, with no closing step

- **Decision**: Nothing on the Results step changes a reply, decision, expected error, rule or
  mapping; the only control that changes data there is the thresholds in "Details" (FR-065,
  FR-069). "Open" in the Test case list opens the read-only case view (section 20). There is no
  "closed" state: the exports are available at any time and, while any case is not run or awaits
  verification, the result and the HTML report say how many cases are not decided yet (FR-072;
  since 2026-11-15 without the word "provisional", section 31).
- **Rationale**: In the review of v10 the owner asked that the result be read without the risk of
  changing it by accident. A closing step was then specified and dropped the same day: the owner
  judged it changes little in practice, since the provisional mark already tells a reader when a
  result is not final, and each saved or exported file is a fixed record anyway.
- **Alternatives considered**: "Close evaluation" with locks, exports only after closing and
  "Reopen evaluation" (one more step and one more state, with little practical gain).

## 28. The Run step summary and model details

- **Decision**: The Run step shows one summary line of the judge being run (judge version,
  dataset name and version, judged text) and a multi-line "Model details" text box stored as
  `model_note` (FR-054, FR-058). The prompt and the rules are not repeated; they are on the Judge
  step and in the report.
- **Rationale**: In the review of v10 the owner found the full judge card on Run too much and asked
  for a summary and a free text for the LLM-as-judge parameters.

## 29. Judges that give one verdict for the whole text

- **Decision**: The counting mode is derived from the shape of the error rules: when there is at
  least one usable rule and every rule uses only fields outside any list, the judge gives one
  verdict for the whole text and is evaluated **per case** (FR-061). A flagged reply makes every
  expected error of the case found, an unflagged one makes every expected error missed (source
  `automatic`); on a clean case a flag is an additional finding that the user decides as always.
  The Summary counts cases, the two measures are the case detection rate and the clean-case
  false-positive rate, Error analysis counts cases per category and difficulty with counts only,
  and the minimum test size is 30 cases with errors and 10 clean cases (FR-066 to FR-070). The
  check configuration holds rules for the two case-level rates as for any measure (defaults 80% and
  10%), and only the rules on the measures in use apply, so no rule is mapped onto another in code
  (Principle VI). The evaluation file
  records `evaluated_per`, and a correction of the rules after replies that switches the mode is
  named in the result and the report (FR-075). Help explains this with a worked example.
- **Rationale**: In the review of v11 the owner asked whether the model also covers completeness
  and bias. Completeness fits the existing model (an omitted piece of information is an expected
  error whose fragment lies in the source). Bias fits when the judge lists biased sentences, but a
  bias judge often answers only "biased: yes or no" for the whole text; without this mode such a
  judge could be tested only by deciding every case by hand, and its rates would be counted per
  error although the judge cannot say which error it found. Deriving the mode from the rules needs
  no new setting and no change to the file formats beyond two counters and the `evaluated_per` key.
- **Alternatives considered**: Leaving such judges to manual decisions (honest, but no automatic
  result); a mode switch the user sets (one more setting that can contradict the rules); graded
  ratings ("partly present") and checking a number the judge returns against an expected number
  (a larger change of the data model, the files and the report; out of scope for this version,
  recorded in the spec's assumptions).

## 30. A simpler, black-and-red interface

- **Decision** (review of v11; FR-001, FR-007, FR-008): the design tokens define a black-and-red
  scheme. Red is the one accent (primary action, current step, focus ring); the dark scheme has a
  black background, the light scheme a near-white one with black text; success, warning and error
  keep their own colors but always come with a word or a sign (✕, ✓, !), because red already means
  "act here". Each step has one "what next" line with one primary action; the step screens carry
  no explanation longer than one sentence (the rest sits behind "Explain" and in Help); a table
  row shows one button and a "More actions" menu (a `<details>` element or a menu button, usable
  with the keyboard); in the case window the action needed next is primary. The Judge step keeps
  its layout. The contrast of every text pair in both schemes is checked by the accessibility tests
  (WCAG AA, 4.5:1), as prototype v12 does.
- **Rationale**: The owner found v11 complicated, wordy and not modern, and asked for black and red
  while keeping it readable. Three of five proposed simplifications were chosen: the "what next"
  line, "Continue" after a load, and fewer buttons; reworking the Judge step into collapsible
  sections was not.
- **Alternatives considered**: Red for errors only and a neutral accent (less distinctive; the
  owner asked for black and red); a dark scheme only (against Principle VII, which asks for both).

## 31. Owner feedback of 2026-11-15, fifth look (T263–T268)

- **Decision**: (1) The Run table shows four counts per case: expected errors, additional findings
  of the judge, findings added by hand and items to decide (FR-054). (2) The case window of Run
  lists the expected errors before the reply, with no marks (FR-055). (3) "Details" moves to the
  top of the Summary, closed (FR-069). (4) "Load check settings" goes; the two thresholds stay
  editable with their defaults (FR-069). (5) There is no "provisional" or "final" result and no
  card "Report and next version"; Export HTML report is always the main action of Results, and the
  number of cases not decided is still said (FR-065, FR-072). (6) Error analysis shows the
  detection rate of every group; "Details" says how much data a rate needs (FR-069, FR-070).
- **Rationale**: On the demo the owner found the hand-added findings hidden among the judge's,
  the expected errors invisible until a reply, the thresholds file unneeded for two numbers, and
  "final" misleading, since the test cases can change at any time. The jump from "counts only" to
  100% (a group of 15 found 15) read as a fault, though it followed FR-070.
- **Alternatives considered**: one column for all additional findings (hides what was added by
  hand); thresholds read-only (the owner keeps them editable); "counts only" kept with clearer
  words, or no rate column (the owner wants the rate always); exporting only when every case is
  decided (there is no final state). The check configuration format is removed with the Help
  (T225), because the Help names it until then.
