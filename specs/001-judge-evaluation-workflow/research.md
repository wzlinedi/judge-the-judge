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

**Note (2026-11-15)**: section 32 (T288, T289) supersedes the two files of sections 12, 19 and 25,
the evaluation file as the demo of section 23, finalizing and "Reopen test cases", and "Run
again with a new judge…". There is one file, the test project, which holds the test run once it
has started; the step "Run" is named "Test run".

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

- **Removed (T286, 2026-11-15)**: the text is no longer checked against the list of expected errors (FR-080), so jsdiff is no longer a dependency. The decision below is kept as history.
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

- **Nesting limit** (security review 2026-11-16, S3): the reader stops at 100 levels of nesting and reports the place, so a crafted text gives a message instead of a stack overflow; real files have about 6 levels.
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
  2. **Clear match** when one normalized text contains the other **as whole words** (the shorter
     text, with a space on each side, occurs in the longer one with a space on each side) and the
     shorter text has at least two words. A one-word text never matches clearly by containment; it
     goes to step 3 (code review 2026-11-16, R4: "Paris" matched "comparison" and "he" matched "the hero").
     The two-word rule holds only when the finding is the shorter text: a finding that holds a
     one-word fragment as a whole word ("Paris" in "the capital is Paris") is a clear match
     (Clarifications 2026-11-17, finding 7, T457).
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
  - A reply that lacks a field a rule needs is not guessed (T413, 2026-11-17): no expected error
    is marked automatically, not even one a finding clearly matches or a per-case flag covers.
    Each waits with the reason that names the field, and a clean case waits for **No more
    findings** with the same reason. The rules below apply only when every rule could be checked.
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
    resembled it, and also the ones that clearly matched it (T417, 2026-11-17), become additional
    findings and need their own decision. When the user decides it
    was found, they count as correct findings.
  - A reply that cannot be read gives no findings; the user (or an LLM opinion) marks each expected
    error and adds findings by hand, and the case awaits verification until the user approves it.
- **Counting findings** for the false-positive rate: correct findings plus additional findings
  confirmed as real errors plus false positives. **Correct findings** are the distinct findings
  attached to found expected errors (a clear match, or a partial match once the error is found),
  each counted once even when it points at several errors, plus one for each found expected error
  that has no finding (code review 2026-11-16, R5 and R6; it replaced "for each found expected
  error, the number of findings attached to it, at least one", which counted a finding twice and
  dropped a partly matching finding when another finding had found the error). Ignored items are left out of everything.
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
  endings normalized), plus the list of the rules that the sample reply turns off, only when that
  list is not empty. The sample reply text, the error catalog and the clean base cases are not part
  of it. The text of the sample does not change how a reply is read; the rules it turns off do, and
  they decide the counting mode (code review 2026-11-16, R3). A judge set in which every rule works
  keeps the version it had before this change. A **dataset version** is computed the same
  way from the cases in order (identifier, name, base, fields, expected errors). The dataset name
  is not part of the version. Hashing uses the Web Crypto API, which exists in browsers and in
  Node, so no library is needed.
- **Rules corrected after replies** (FR-053, FR-075): the evaluation keeps the judge version that
  was in force when the first reply was saved. When the current judge version differs and the
  prompt is the same, the Results step, the evaluation file and the report say that the rules,
  the mapping, or the sample reply (when it turned a rule on or off, R3) were corrected after
  replies were received and name both versions. A file saved before R3 stored the version worked
  out without the list of rules turned off; on load such a stored version still agrees with the
  current judge set and is replaced by the current version, so no correction is reported
  (Clarifications 2026-11-17, finding 8, T459).
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
  reason, and so is an opinion that repeats the code of another list of items (code review
  2026-11-16, R8: the list of a case changes when its marks change, so its numbers A1… can shift);
  an opinion without the code is read as before. Formats are in [contracts/file-formats.md](./contracts/file-formats.md).
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

*The colors and the look of this section were replaced on 2026-11-16 by section 33.*

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

## 32. One file and the start of the test run (T288, T289)

- **Decision**: (1) The tool works with one file, the **test project**. It holds the judge set,
  the error catalog, the test cases, the metric and the thresholds and, once the test run has
  started, a `test_run` section with the replies, decisions, model details, versions and results
  (file-formats.md, sections 1 and 5). The evaluation file, "Load evaluation…", "Save evaluation"
  and "Save evaluation as…" go; "New evaluation" becomes "New test project"; the step "Run" is
  named "Test run". (2) "Finalize test cases…" becomes **Start test run**, the primary action at
  the top of the Test cases step. Before the start the Test run step shows its actions disabled
  with the reason "Start the test run first". After the start the judge prompt and the judged text
  are fixed with no way back; the reply mapping, the error rules and the categories stay
  editable. "Reopen test cases" goes. (3) "Load test project…" asks, for a file with a test run,
  **Load with the test run** or **Load the test project only**. The second drops the test run
  (decisions, "Ignored" marks and added findings included) and the `changed_after_first_reply`
  marks, and does not remember the file, so the first save asks for a new one. This is how a
  changed judge is tested on the same cases; "Run again with a new judge…" goes. (4) The schema
  version of the test project file becomes 2. A version 1 file is upgraded on load (its
  `dataset.finalized` is dropped). An evaluation file is not read: it gets the message for an
  unknown `format`. (5) In the code, `Evaluation` and the evaluation file reader, writer and save
  target are removed or renamed; the folder `core/evaluation/` keeps its name, because it holds
  the scoring logic, not a file.
- **Rationale**: In the owner trial of 2026-11-15 the owner found that saving the test run apart
  from the test project caused problems: "Save test project" left the indicator on once replies
  existed, and two save buttons kept two remembered files. One file needs one save button, one
  remembered file and one indicator rule. The start is kept because it is what makes the replies comparable: every reply
  was produced by the same prompt and judged text. A lock that is visible, with its reason and the
  way to test another prompt beside it, is clearer than a state that can be reopened. Loading the
  test project without its test run gives a clean start for a changed judge and never overwrites
  the earlier run. The tool is not released, so no user holds evaluation files.
- **Alternatives considered**: Keeping two files (rejected by the owner); keeping "Run again with a
  new judge…" next to the load question (rejected by the owner: loading the test project only does
  the same); removing "Finalize test cases…" altogether (the owner kept it as "Start test run" with
  a visible lock); reading old evaluation files (not needed: the tool is not released); refusing
  version 1 test project files (added here: the upgrade is one dropped key, and the owner's trial
  files keep working).

## 33. UI redesign: calm look, wider layout, whole-object mark (2026-11-16)

Section 35 (Editorial redesign, 2026-11-17) replaces 33.1 to 33.4 and the width of 33.5.

This section replaces section 30 (the black-and-red scheme) for colors and look. The rest of
section 30 stays: one "what next" line per step, one primary action, a word or sign with every
status. The spec sets the rules (FR-007, FR-055, FR-091 to FR-094, SC-033, SC-040 to SC-047). This
section sets the values the spec left to the plan. The redesign changes no action, label, check,
confirmation, file format or result (SC-040, SC-046). All values live in `src/ui/styles/tokens.css`;
no other file holds a color, a radius or a shadow.

Contrast ratios are WCAG 2.x, computed from the hex values (relative luminance, (L1 + 0.05) /
(L2 + 0.05)). A unit test (a task of the redesign phase) computes them again from the CSS file, so these
numbers cannot drift.

### 33.1 Colors, light scheme: Stone and forest green (FR-007)

| Token | Value | Use | Ratio |
|---|---|---|---|
| `--bg` | `#F2F3ED` | page background | – |
| `--surface` | `#FBFCF8` | cards, header, dialogs, inputs | – |
| `--surface-2` | `#E7EAE0` | hover, selected row, quiet buttons | – |
| `--border` | `#D5DBD1` | thin rules around cards and between rows (decoration) | 1.26 on `--bg` |
| `--border-strong` | `#7C8A7B` | the edge of an input, a select and a secondary button | 3.26 on `--bg` |
| `--text` | `#202720` | body text | 13.71 on `--bg`, 14.85 on `--surface`, 12.56 on `--surface-2` |
| `--text-muted` | `#5F6A5E` | secondary text, labels, help text | 5.07 on `--bg`, 5.49 on `--surface`, 4.65 on `--surface-2` |
| `--accent` | `#315D48` | primary button, current step, links, focus ring | 6.75 on `--bg`, 7.31 on `--surface` |
| `--accent-hover` | `#264A39` | hover of the primary button | 9.90 with `--on-accent` |
| `--on-accent` | `#FFFFFF` | text on the accent | 7.53 on `--accent` |
| `--focus` | `#315D48` | the focus ring (3 px, offset 2 px) | 6.75 on `--bg` (needs 3:1, FR-094) |
| `--success` / `--success-bg` | `#1F6B3F` / `#E1EEE4` | Pass | 5.43 on its background, 5.82 on `--bg` |
| `--warning` / `--warning-bg` | `#8A5A00` / `#F6ECD0` | Awaiting verification, "Unsaved changes" | 5.03, 5.31 |
| `--error` / `--error-bg` | `#A61B2B` / `#F7E1E1` | Fail, refusals | 5.98, 6.69 |
| `--mark-warning` | `#F1DC8E` | a passage of an expected error not yet decided | 11.20 with `--text` |
| `--mark-success` | `#BFE0C8` | a passage found | 10.72 with `--text` |
| `--mark-error` | `#F0B9BC` | a passage missed | 9.01 with `--text` |
| `--reply-bg` | `#E9EFE6` | the marked object in Judge reply (light) | 13.08 with `--text` |
| `--reply-line` | `#5F7F6C` | its thin vertical line | 3.97 on `--bg`, 3.79 on `--reply-bg` |
| `--reply-strong-bg` | `#CFE3D6` | the same object once pointed at | 11.37 with `--text`, 5.60 with `--accent` |
| `--overlay` | `rgb(32 39 32 / 0.45)` | behind a dialog | – |

- **Decision**: the palette of FR-007 is used as it is. `--text-muted` is `#5F6A5E`, not
  `#687267` from the brief.
- **Rationale**: `#687267` on `#F2F3ED` is 4.49:1, which is below the 4.5:1 that FR-091 asks of
  secondary text. `#5F6A5E` is the nearest value that passes on the background, the surface and the
  quiet-button surface. The owner accepted both values on 2026-11-16 (Clarifications), and FR-007 now names them.
- **Decision**: a second edge token, `--border-strong`, is used for inputs, selects and secondary
  buttons. `--border` stays for decoration.
- **Rationale**: a form control needs its edge at 3:1 to be found (WCAG 1.4.11); the soft border
  of the palette is 1.26:1. Cards and rules keep the soft border, so the page stays calm.
- **Decision**: Pass is `#1F6B3F` (a green close to the accent), always with "✓ Pass". Awaiting
  verification is amber with "… Awaiting verification". Fail is red with "✕ Fail". Not run is muted
  with "– Not run".
- **Rationale**: the accent is green, so green alone cannot say "Pass"; the word and sign do.
  Amber and red keep their own colors, as FR-007 asks.
- **Alternatives considered**: keeping `--text-muted` at `#687267` and relying on the surface (4.86
  there, but 4.49 on the page background, where most text sits; rejected); one border token at
  3:1 (every card would look boxed, against FR-091; rejected).

### 33.2 Colors, dark scheme (follows the system; no switch)

| Token | Value | Ratio |
|---|---|---|
| `--bg` / `--surface` / `--surface-2` | `#121713` / `#1A211C` / `#242C26` | – |
| `--border` / `--border-strong` | `#34403A` / `#5F6D62` | – / 3.33 on `--bg` |
| `--text` | `#E6EBE3` | 14.99 on `--bg`, 13.58 on `--surface`, 11.86 on `--surface-2` |
| `--text-muted` | `#A3AEA2` | 7.89, 7.15, 6.24 |
| `--accent` / `--accent-hover` | `#7DBE9C` / `#98D0B2` | 8.39 on `--bg`, 7.60 on `--surface` |
| `--on-accent` | `#0E1A13` | 8.26 on `--accent`, 10.21 on `--accent-hover` |
| `--focus` | `#7DBE9C` | 8.39 on `--bg` |
| `--success` / `--success-bg` | `#6FD09A` / `#14281B` | 8.28 on its background |
| `--warning` / `--warning-bg` | `#E5B94E` / `#2B2410` | 8.35 |
| `--error` / `--error-bg` | `#F2878F` / `#33191C` | 6.66 |
| `--mark-warning` / `--mark-success` / `--mark-error` | `#5A4710` / `#1F5A38` / `#6E2A31` | 7.41 / 6.73 / 8.51 with `--text` |
| `--reply-bg` / `--reply-line` / `--reply-strong-bg` | `#1F2B24` / `#6FA487` / `#2C4638` | 12.14 with `--text`; line 5.13 on `--reply-bg`; 4.76 for `--accent` on strong |
| `--overlay` | `rgb(0 0 0 / 0.65)` | – |

- **Decision**: the dark tokens are derived from the same forest-green hue (Clarifications, Session
  2026-11-16): a near-black green background, light green accent, and each status color lightened
  until it passes 4.5:1 on all three surfaces. The scheme switches with `prefers-color-scheme` and
  the existing `data-theme` attribute, which the tool never sets; it is a hook for tests.
- **Rationale**: a dark accent (`#315D48`) fails on a dark background (about 2.3:1), so the accent
  must become light in the dark scheme; the on-accent text becomes dark in the same step.
- **Alternatives considered**: neutral grey dark scheme (the owner chose the green one); pure black
  background (glare and halation with light text; rejected).

### 33.3 Porcelain and navy, the accepted alternative

- **Decision**: a block `:root[data-palette="navy"]` in `tokens.css` holds the light navy tokens:
  `--bg #F2F5F8`, `--surface #FCFDFF`, `--text #202832`, `--accent #345D86`, `--on-accent #FFFFFF`,
  `--border #D6DFE8`, `--border-strong #7D8A98`, and `--text-muted #5E6B7A`. Nothing in the tool sets
  `data-palette`; there is no switch. A unit test checks that the block passes the same contrast
  pairs as the main palette.
- **Rationale**: the owner accepted it as an alternative kept only as tokens. `#667381` from the
  brief is 4.43:1 on `#F2F5F8`, so `#5E6B7A` (4.97:1) is used, for the same reason as in 33.1. The text
  is 13.60:1, the white on the accent 6.87:1 and the strong border 3.22:1. Three more navy values
  are derived so the set passes alone (T319): `--surface-2 #E6EBF1` (the muted text is 4.54:1 on it; on
  the green `#E7EAE0` it would be 4.47:1), `--accent-hover #284A6B` (9.20:1 with white) and `--focus
  #345D86` (the accent). A dark navy set is not
  defined until the owner picks navy; then it is derived as in 33.2.
- **Alternatives considered**: no navy block (loses the tested fallback); a switch (refused in FR-007).

### 33.4 Space, shape, type, controls

- **Space**: the scale stays at six values, all multiples of 4 px: `--space-1` 4, `--space-2` 8,
  `--space-3` 12, `--space-4` 16, `--space-5` 24, `--space-6` 32. A margin, padding or gap uses
  only these. *Why*: the scale already exists and fits FR-091; a test finds literal values.
- **Radius**: two values: `--radius` 6 px for controls and small boxes, `--radius-lg` 10 px for
  cards and dialogs. The round step number, the 4 px and 2 px radii of old rules go. *Why*: FR-091
  asks for two radii, the same for every element of a kind.
- **Type**: one family (the system sans-serif), one monospace for JSON and prompts. Sizes:
  `--text-sm` 14 px (status, help, labels), `--text-md` 16 px (body), `--text-lg` 20 px, `--text-xl`
  24 px, and `--text-2xl` 32 px used only for the overall result. Weights: 400 for text, 600 for
  headings, the primary button and a status word; 700 and 800 go. Line height 1.5 for text, 1.3 for
  headings. *Why*: three heading levels (FR-091) need three clear steps (24, 20, 16), and a single
  larger size gives the overall result the most visible line (FR-093).
- **Headings**: h1 is the name of the view (24 px, 600); h2 is a section or a part (20 px, 600); h3
  is a group inside it (16 px, 600). An h4 or h5 stays in the HTML, so screen readers and tests
  keep the structure, but it looks like an h3 (16 px, 600) or like a small label (14 px, 600,
  `--text-muted`); there is no fourth size. *Why*: FR-091 counts the looks of a heading, not the
  HTML levels (Clarifications 2026-11-16).
- **Alternative to heading looks**: turning h4 and h5 into h3 or plain text (it breaks the e2e tests
  that find "Judge reply" as a heading, against SC-040; rejected).
- **Buttons**: every button is `--control-height` 2.25 rem (36 px) high, with a gap of `--space-2`
  between buttons. The primary button is the accent with `--on-accent` text; a secondary button has
  `--surface` and `--border-strong`. A disabled primary stays quiet (as today). *Why*: one height
  and one gap (FR-091); 36 px is above the 24 px minimum target of WCAG 2.2.
- **Shadow**: one token, `--shadow: 0 4px 16px rgb(32 39 32 / 0.12)` (dark: `0 4px 16px rgb(0 0 0 /
  0.5)`). It is used only by `.dialog` and `.menu`. The banner of a message (`.notice-line.has-message`)
  and the case window header lose their shadow and keep a border. *Why*: FR-091 allows a light
  shadow only on dialogs and menus.
- **Flat surfaces**: the "what next" line loses its colored left edge and the tabs and steps use a
  2 px accent underline only for the current one. *Why*: FR-091 wants few colored frames, so prompts,
  JSON and decisions get the attention.
- **Motion**: `--motion` 150 ms for hover and focus. Scrolling to a passage and the fade of a mark are
  instant under `prefers-reduced-motion` (already forced in `base.css`, FR-094).

### 33.5 Widths, breakpoints, columns

- **Widths**: `--content-max: 100rem` (1600 px) for `.app-main`, `.case-window` content and the test
  case window; `--prose-max: 72ch` for paragraphs of text (descriptions, messages, "what next"
  sentence). Tables, JSON boxes and the prompt use the full width. Side gutter `--space-4` below 760
  px and `--space-5` from 760 px. *Why*: FR-092 and the Clarifications of 2026-11-16.
  The old limits (80 rem, 64 rem) go.
- **Breakpoints**: one, 760 px. From 760 px up the two-column layouts apply (`min-width: 760px`);
  below it every layout is one column. The four sizes of FR-092 fall on it as: 1440 and 1280 (wide),
  768 (still two columns, tight) and 360 to 430 (one column). *Why*: the spec fixes 760 px, and a
  media query cannot read a custom property, so the value is written once as a literal and a test
  checks that no other width appears in a media query. 768 px keeps two columns because the spec
  says "below 760"; its columns are `minmax(0, 1fr)` so they shrink and wrap, never push the page.
- **Header**: one row: tool name, then the name of the test project (`dataset.name`), then the save
  indicator with the file name ("All changes saved · books.json", or "no file yet"), then the buttons
  **Save test project**, **More**, **Help** (the order of the shell test is kept). The file name moves
  from under the button into the indicator (Clarifications 2026-11-16). The four steps are a second
  row of the header; they stay visible on a wide screen and scroll sideways below 760 px (`overflow-x:
  auto`, no wrap, the current step scrolled into view). *Why*: FR-092 asks for a compact row; one row
  with a stacked button is two lines high. Each name is shown once.
- **Two columns of case fields** (Part 1 of the case window, FR-055): a wrapper `.case-fields` holds
  two children, `.case-fields-others` (every field except the judged one, stacked) and
  `.case-fields-judged` (the judged field), in this DOM order. From 760 px the wrapper is a grid of
  two equal columns, others on the left and judged on the right; below it the grid is one column and
  the judged field comes last, which is the DOM order. A case with one field only gets the class
  `single` and the judged field takes the full width. *Why*: it needs no inline style (the Content
  Security Policy forbids them) and no CSS ordering trick, so the reading order and the visual
  order are the same for a screen reader.
- **Case window frame**: the window stays a full-screen layer with a flex column: a header that does
  not move, then one scroll area (`.case-window-body`) for the whole page, then the footer when the
  window has one. The two inner scroll areas of today (`.case-pane`) go; the two columns of Part 3
  scroll together. SC-030 and SC-031 were reworded for this on 2026-11-16 (Clarifications).
  *Why*: FR-092 asks for one page scroll and a header that stays; a header that is
  outside the scroll area never covers the passage that **Show the issue** scrolls to. The header holds
  the items of FR-092 in this order: the case name and number, **Previous case**, the position, **Next
  case**, the box "Only cases awaiting verification", the count of replies not saved, **Close**. Below
  760 px it wraps naturally in this order, with **Close** last. No item has a CSS `order`, so the
  order of Tab is the order on screen (WCAG 2.4.3; Clarifications 2026-11-16).
- **No scroll inside the reply or the base**: `.reply-read` (the saved reply, today at most 24 rem
  high) and `.base-fields` (the base case of "Case with errors", today at most 12 rem) lose their
  `max-height` and `overflow`. They grow with their text, and the page scrolls. *Why*: FR-092
  allows no scroll area of its own here, and **Show the issue** must scroll the page so the header
  stays above the passage (SC-031; Clarifications 2026-11-16).
- **Alternative to the fixed frame**: a `position: sticky` header in a scrolling window (same look,
  but anchored scrolling needs `scroll-padding-top` for a header whose height changes when it wraps;
  rejected).
- **Editors grow**: a JSON box or prompt box uses `field-sizing: content` with a `min-height` of 8 rem,
  so the user does not scroll a small box inside the page (FR-092, FR-093). *Why*: the tool supports
  current Chrome and Edge only (FR-003), which support it. A dialog keeps one scroll area for its
  content, which is the allowed exception.
- **Judge step**: the rules and the preview of findings sit in two columns from 760 px; the preview
  column is `position: sticky; top: var(--space-4)`, so a change of a rule shows in the preview without
  scrolling at 1280 × 720 (FR-093). Below 760 px the preview follows the rules. *Why*: the preview must stay
  in view while the user moves down the rules.
- **Tables**: the table of Test run uses the full content width; a table that does not fit scrolls in
  `.table-scroll`. Numbers use the class `num` (right-aligned, `font-variant-numeric: tabular-nums`).
  The overall result in Results is the only text at `--text-2xl`.
- **Dialogs**: unchanged structure (title, body that scrolls, bar of buttons that stays). The buttons
  are ordered **Cancel** first and the main action last (FR-093); the task list audits each dialog.
  In the load question the main action is **Load with the test run**, after **Load the test project
  only** (Clarifications 2026-11-16; already so in `App.tsx`).

### 33.6 Judge reply: the whole object, marked until the next pointing

- **Decision**: the reply has no scroll area of its own (33.5), so pointing at an item scrolls the
  page (`.case-window-body`) to the object, not a frame inside it.
- **Decision**: in the read-only reply, every JSON object that an error rule turned into a finding
  carries the light background `--reply-bg` and a 2 px vertical line `--reply-line` at its left, from
  its opening brace to its closing brace. There is no label, rule name, category or description (the
  work of T311). When the user presses **Show the issue** or the block itself, the object of that finding
  gets `--reply-strong-bg`, a 4 px `--accent` line and is scrolled into view; it stays so until
  the user points at another item, closes the window or moves to another case. The timer of
  2500 ms in `CaseWindow.tsx` (T311) goes. The passage in the case fields (Part 1) keeps its mark for about 2
  seconds, as before (`useShowIssue.ts`).
- **Rationale**: the owner trial found that a block that fades after 2.5 s is gone when the eye gets
  to it. A mark that stays until the next pointing answers "which block is this finding?" at any time.
  The strong state differs from the light one by the background (11.37 with text), the line width and
  the accent, not by color alone (WCAG 1.4.1).
- **Alternatives considered**: keeping the timer and making it longer (still disappears); marking all
  objects strongly at once (loses the answer to "which one"); a label on each object (refused in the
  brief and in FR-055).
- **Text replies and unrelated JSON**: no mark of either kind (SC-044). The marked objects never
  overlap: when a finding sits inside another marked object the outer object is used, as in T311.

### 33.7 What does not change

- Labels, actions, order of actions, checks, confirmations, Second opinion, statuses, results, file
  formats and the data model (SC-040, SC-046). `data-model.md` and `contracts/file-formats.md` are not
  touched.
- The Help texts that describe the old look (for example "red") are rewritten in the one pass of T225
  and T269. No file under `src/ui/help/` is changed by the redesign.
- Everything that follows the old rules stays valid as history: section 30 is not rewritten; it gets one pointer to this section.

## 34. Hardening after the reviews of 2026-11-16

The security review (S1–S10) and the code review (R1–R10) of 2026-11-16 found no critical issue.
The decisions that change behaviour are in the Clarifications of 2026-11-16 and in sections 9, 10,
11 and 14. This section holds only the technical decisions that the plan needs (plan.md, slice 11).

- **State after an await (R1, R2)**: an action that awaits a port (a file, the clipboard, a hash)
  MUST NOT return a whole new state built from the state it started with. It returns a change, and
  the shell applies it with `setState((current) => change(current))`. The change touches only the
  fields the action owns (for example `unsaved`, `repliesSinceSave`, `testProjectFile` for a save;
  the reply and decisions of one case for a reply). A save marks the work saved only when the
  project is still the one that was written; otherwise `unsaved` stays true.
  *Rationale*: the user can act while the file or the clipboard is busy; a snapshot written back
  erases that work. *Alternatives*: a lock that blocks the interface during a save (slow on a
  network drive, and a clipboard prompt can wait for minutes); comparing whole states after the
  await (costly and still loses one of two changes).
- **A failed "Save as…" (R9)**: `write()` forgets the remembered file only when the write to that
  same file failed. A failed write to a newly chosen file keeps the remembered file and its name.
  *Rationale*: the old file is still good. *Alternative*: always forget (today), which sends the
  next plain save to a new file.
- **Typed or pasted (R10)**: the box compares the new text with the text before the change. More
  than one character added in one change counts as a paste or a drop and is saved at once when it
  is readable JSON; anything else waits for the box to lose the focus. *Rationale*: the browser's
  `inputType` is not set by every way of pasting and by the test tools; the length rule is
  deterministic and keeps the existing tests valid. *Alternative*: `inputType === 'insertFromPaste'`
  (missed by drag and drop and by `fireEvent.input`).
- **Lookups by id (S1)**: `repliesOf`, `decisionsOf` and every other lookup by a case id or an error
  id read only the object's own keys (`Object.hasOwn`), in one helper of `src/core/cases/test-run.ts`.
  The stored objects keep their shape, so the file format does not change. *Alternative*: `Map`
  everywhere (a larger change to the state and the writer for the same result).
- **Error panel (S3)**: one boundary inside `App`, below the state, built with `useErrorBoundary`
  from `preact/hooks` (no new dependency). The state lives above the boundary, so "Save test
  project as…" still writes the work. The panel shows the message of the error, and nothing is
  sent anywhere. The loaders (`loadTestProject`, `prepareImport`, the drop zone) also catch an
  error of a reader and show it like an invalid file, so an error while loading never reaches the
  panel. *Alternative*: a class component with `componentDidCatch` (the same, with more code).
- **Size before reading (S4)**: the picker and the drop zone read `file.size` before `text()` or
  `arrayBuffer()`, so a large file is refused without being read. The reply and prompt limits are
  `max` rules in the Zod schemas, so the message names the field path like any other. The pasted
  reply is checked in the reply action before it is saved. Limits: 50 MB (`MAX_FILE_BYTES`),
  200,000 characters (`MAX_REPLY_LENGTH`), 1,000,000 characters (`MAX_PROMPT_LENGTH`), next to
  `MAX_CASES` and `MAX_FIELD_LENGTH` in `src/core/schemas/`.
- **Code of the list of items (R8)**: six hexadecimal characters of the FNV-1a hash of the keys of
  the items in prompt order (`E:e1`, …, `A:claims[]#3`, `A:added#1`, …), computed at once without
  Web Crypto, because the prompt is built while the window draws. It is not a security measure:
  it only tells that the list changed. The opinion carries it as `opinion.list`; a missing `list`
  is read as before (contracts/file-formats.md, section 7). *Alternative*: the SHA-256 of
  section 14 (asynchronous, and nothing is gained for a change check).
- **Finding a card from a block (S9)**: each card keeps `data-finding-line` for the tests and the
  styles, and gets `data-finding-keys` with a JSON list of its keys. The case window finds the card
  in code (`JSON.parse` and `includes`) instead of a CSS selector, so a key with a space or a quote
  works. *Alternative*: `CSS.escape` with `~=` (still fails for a key with a space).
- **Report CSP (S5)**: the report gets `<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'">`. The report has no
  script and one inline style block, so nothing it shows today is blocked. *Rationale*: a missed
  escape in a later change cannot run a script in an opened report.
- **Publishing workflow (S2, S6, S7)**: the workflow keeps `contents: read` at the top; the
  `deploy` job alone gets `pages: write` and `id-token: write`. Every action is pinned to the full
  commit SHA of its current major version, with the version in a comment. `actions/checkout` gets
  `persist-credentials: false`. The existing contract test `tests/contract/deploy-workflow.test.ts`
  keeps passing: its permission check matches the block of the `deploy` job. *Rationale*: `npm ci`
  and the tests run third-party code in the `build` job, which then cannot obtain a Pages token.
  *Alternative considered and left to the owner*: Dependabot for the actions (it opens pull
  requests, an outward action this plan does not take).
- **Development tools (step 1 of the reviews)**: `eslint` 10.15.0, `typescript-eslint` 8.73.0 and
  `@playwright/test` 1.65.1, minor versions only; they remove the moderate `minimatch` finding of
  `npm audit`. TypeScript 7 is a major version and is not part of this slice.

## 35. Editorial redesign (2026-11-17)

This section replaces the colors, the second palette, the type and the radii of section 33 (33.1 to
33.4). The rest of section 33 stays: the space scale, the 760 px breakpoint, the case window frame,
the marks of Judge reply and the list of what does not change (33.5 to 33.7). The one value of 33.5
that changes is the content width: 1560 px instead of 1600 px (FR-092).

The spec sets the rules (FR-007, FR-091, FR-092, SC-048, SC-049; Clarifications, Session
2026-11-17). The owner accepted the look on the before and after preview of 2026-11-17 (scope B:
tokens, styles, and markup where a section label needs it). This section sets the values the spec
left to the plan. The redesign changes no action, label, order of actions, check, confirmation,
file format or result (SC-040, SC-046, SC-049).

Contrast ratios are computed as in section 33 (WCAG 2.x relative luminance). Every ratio below was
computed from the hex value on 2026-11-17; `tests/unit/ui/tokens.test.ts` computes them again from
`tokens.css`.

### 35.1 Colors, light scheme (FR-007)

| Token | Value | Editorial name | Use | Ratio |
|---|---|---|---|---|
| `--bg` | `#FAF8F5` | canvas | page, header, footer, case window | – |
| `--surface` | `#FFFFFF` | raised surface | inputs, dialogs, the More menu | – |
| `--surface-2` | `#F3EFEA` | surface | quiet buttons, hover, selected row, "what next" line, table head, saved reply | – |
| `--border` | `#E6E4E1` | hairline, `rgba(28,25,23,0.09)` blended on the canvas | rules between sections and rows (decoration) | 1.20 on `--bg` |
| `--border-strong` | `#8A847D` | – (the old muted text of the brief) | the edge of an input, a select and a secondary button | 3.49 on `--bg` |
| `--text` | `#1C1917` | text | body text | 16.50 on `--bg`, 17.49 on `--surface`, 15.28 on `--surface-2` |
| `--text-secondary` | `#57534E` | secondary text | descriptions, table cells, the details of "what next" | 7.20, 7.63, 6.66 |
| `--text-muted` | `#6F6A64` | muted text | labels, metadata, section labels | 5.05, 5.36, 4.68 |
| `--accent` | `#1C1917` | accent | primary button, current step, focus ring, links | 16.50 on `--bg`, 17.49 on `--surface` |
| `--accent-hover` | `#3A3531` | – | hover of the primary button | 11.43 with `--on-accent` |
| `--on-accent` | `#FAF8F5` | text on the accent | text of the primary button | 16.50 on `--accent` |
| `--focus` | `#1C1917` | – | the focus ring | 16.50 on `--bg` (needs 3:1) |
| `--success` / `--success-bg` | `#0F766E` / `#E0EDE9` | truth | Pass, Found, a clear match | 4.55 on its background, 5.16 on `--bg`, 4.78 on `--surface-2` |
| `--warning` / `--warning-bg` | `#9A4A08` / `#F6E7D6` | warning | Awaiting verification, partial match, "Unsaved changes" | 5.16, 5.90, 5.46 |
| `--error` / `--error-bg` | `#BE123C` / `#F7E0E2` | error | Fail, Not found, refusals | 5.00, 5.93, 5.49 |
| `--mark-warning` / `--mark-success` / `--mark-error` | `#F5E3CF` / `#D9EAE6` / `#F7DCDF` | state backgrounds of a passage | a passage not decided, found, missed | 13.97 / 14.04 / 13.54 with `--text` |
| `--mark-warning-line` / `--mark-success-line` / `--mark-error-line` | `#D97706` / `#0D9488` / `#E11D48` | state borders | the 2 px line under a marked passage; the dot before the tool name uses `--mark-success-line` | 3.01 / 3.53 / 4.43 on `--bg` (decoration; the number and the word carry the meaning) |
| `--reply-bg` / `--reply-line` / `--reply-strong-bg` | `#F3EFEA` / `#0D9488` / `#D9EAE6` | – | the marked object in Judge reply, its line, the object pointed at | 15.28 / line 3.53 on `--bg` and 3.27 on `--reply-bg` / 14.04 with `--text` and `--accent` |
| `--overlay` | `rgb(28 25 23 / 0.45)` | – | behind a dialog | – |

- **Decision**: every color token is an opaque six-digit hex value. A state background of FR-007
  (for example `rgba(13, 148, 136, 0.11)`) is stored as its blend on the canvas.
- **Rationale**: `tokens.test.ts` reads six-digit hex values to compute the ratios, and the e2e
  contrast helper blends a transparent background with what lies beneath. An opaque value gives the
  same ratio on every surface the test meets. On the canvas the look is the same.
- **Decision (owner, 2026-11-17)**: the truth background is the blend at 0.11, `#E0EDE9` (4.55:1
  with `#0F766E`), not at 0.12, `#DEECE8` (4.5009:1). FR-007 is updated to match.
- **Rationale**: 4.5009 passes by 0.0009. A rounding of one channel by a browser or a later small
  change would fail it. The difference of 0.01 in opacity is not visible.
- **Decision**: `--surface` is the raised surface (`#FFFFFF`) and `--surface-2` is the Editorial
  surface (`#F3EFEA`). A new token `--text-secondary` holds the secondary text.
- **Rationale**: the existing tokens keep their meaning: `--surface` is what inputs and dialogs sit
  on, `--surface-2` is hover, a selected row and a quiet button. The muted text is 4.68 on
  `--surface-2`. A darker hover (`#EAE4DC` in the preview draft) gives 4.24 and is not used.
- **Decision**: `--border-strong` is `#8A847D`, the muted text of the brief. It is the edge of a
  form control only. **Rationale**: a control needs a 3:1 edge (WCAG 1.4.11); the hairline is 1.20.
- **Alternatives considered**: tokens in `rgba()` (the unit test cannot compute them, and the ratio
  depends on the surface; rejected); keeping 0.12 for the truth background (no margin; rejected
  by the owner on 2026-11-17).

### 35.2 Colors, dark scheme (follows the system; no switch)

| Token | Value | Ratio |
|---|---|---|
| `--bg` / `--surface` / `--surface-2` | `#1A1816` / `#2C2824` / `#24211E` | – |
| `--border` / `--border-strong` | `#33312F` / `#7A736B` | 1.37 / 3.79 on `--bg` |
| `--text` | `#EEE9E3` | 14.67 on `--bg`, 12.12 on `--surface`, 13.27 on `--surface-2` |
| `--text-secondary` | `#C9C2BA` | 10.04, 8.29, 9.08 |
| `--text-muted` | `#A39C94` | 6.53, 5.39, 5.90 |
| `--accent` / `--accent-hover` / `--on-accent` / `--focus` | `#EEE9E3` / `#D6CFC7` / `#1A1816` / `#EEE9E3` | accent 14.67 on `--bg`, 12.12 on `--surface`; on-accent 14.67 and 11.47 on hover |
| `--success` / `--success-bg` | `#5EC4B6` / `#24302C` | 6.55 on its background, 8.47 on `--bg` |
| `--warning` / `--warning-bg` | `#E8A75A` / `#372C20` | 6.55, 8.52 |
| `--error` / `--error-bg` | `#F38BA0` / `#382829` | 5.99, 7.60 |
| `--mark-warning` / `--mark-success` / `--mark-error` | `#533411` / `#163D38` / `#561925` | 9.32 / 9.89 / 11.14 with `--text` |
| `--mark-*-line` | `#E8A75A` / `#5EC4B6` / `#F38BA0` | 8.52 / 8.47 / 7.60 on `--bg` |
| `--reply-bg` / `--reply-line` / `--reply-strong-bg` | `#24211E` / `#5EC4B6` / `#293E39` | 13.27 with `--text`; line 8.47 on `--bg`, 7.66 on `--reply-bg`; 9.44 for `--accent` on strong |
| `--overlay` | `rgb(0 0 0 / 0.65)` | – |

- **Decision**: canvas, surface, the three text colors, the accent and the three state text colors
  are those of FR-007. The raised surface (`--surface`, `#2C2824`) is lighter than the Editorial
  surface (`--surface-2`, `#24211E`). The state backgrounds and marks are the light hues blended
  on the dark canvas (0.14 for a state background, 0.30 for a mark, 0.22 for the strong reply).
- **Rationale**: in a dark scheme a surface that floats (a dialog, a menu, an input) reads as raised
  when it is lighter. The values not named in FR-007 are derived, and each passes the pairs of the
  unit test.
- **Decision**: the scheme switches with `prefers-color-scheme` and the `data-theme` attribute, as
  in 33.2. The tool never sets `data-theme`.
- **Alternatives considered**: a raised surface darker than the canvas (dialogs would look sunken;
  rejected).

### 35.3 Fonts (FR-091, SC-048; Clarifications 2026-11-17, question 4)

| Family | Role (FR-091) | Weights | Files (latin + latin-ext) | Bytes |
|---|---|---|---|---|
| Inter | controls, forms, tables, the step bar, body text | 400, 600 | 4 | 23,664 + 35,000 + 24,452 + 36,260 |
| Instrument Serif | names of views and sections, title of the case window, the overall result | 400 | 2 | 21,032 + 11,604 |
| Newsreader | the texts of a case, the "what next" sentence | 400 | 2 | 22,480 + 14,212 |
| JetBrains Mono | JSON, prompts, ids, small labels, section labels | 400 | 2 | 21,168 + 7,336 |

- **Decision**: ten WOFF2 files, 217,208 bytes in all. A page whose text is only Latin loads the
  five `latin` files (112,796 bytes). A `latin-ext` file loads only when the page shows a character
  of its range (for example the Polish letters ą, ć, ę, ł, ń, ś, ź, ż; ó is in `latin`).
- **Source**: the Fontsource packages, version 5.3.0 (`@fontsource/inter`,
  `@fontsource/instrument-serif`, `@fontsource/newsreader`, `@fontsource/jetbrains-mono`), files
  `<family>-<subset>-<weight>-normal.woff2`. The files are copied once into the repository. No npm
  package is added.
- **License**: all four are SIL Open Font License 1.1 (Inter: The Inter Project Authors, 2016;
  Instrument Serif: The Instrument Serif Project Authors, 2022; Newsreader: The Newsreader Project
  Authors, 2020; JetBrains Mono: The JetBrains Mono Project Authors, 2020). The license text of each
  family ships next to its files as `OFL-<family>.txt`, as the OFL requires.
- **Path**: `public/fonts/`. The `@font-face` rules are at the top of `tokens.css` and name
  `url("/fonts/<file>.woff2")`. Vite rewrites such a URL relative to the built CSS file: checked on
  2026-11-17 with the Vite of the project and `base: './'`, `url("/fonts/a.woff2")` became
  `url(../fonts/a.woff2)` in `dist/assets/*.css`, and the file was copied to `dist/fonts/`. So the
  site still works from any folder of a static host (Constitution, Technology stack).
- **Loading**: `font-display: swap`; the `unicode-range` of each rule is copied from the Fontsource
  CSS that loads all subsets of a weight (for example `400.css`; the per-subset files such as
  `latin-400.css` have no range). No preload. Until a font arrives, the text shows in its fallback.
- **Fallbacks** (tokens): `--font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  `--font-display: "Instrument Serif", Georgia, serif`; `--font-body: "Newsreader", Georgia, serif`;
  `--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- **CSP**: unchanged. `font-src 'self'` allows the files; nothing loads from another site.
- **No italics and no other weights**: no text of the tool is set in italics. Instrument Serif has
  only the weight 400, so every heading in the display font sets `font-weight: 400`; `base.css`
  gives h1 to h3 the weight 600, which would make the browser draw a false bold. A passage pointed at
  (`.fragment-strong`) keeps the weight of its text and is told by its outline and background, so
  Newsreader needs no bold file.
- **Rule: weight 400 in the three single-weight fonts**: every element set in `--font-mono`,
  `--font-body` or `--font-display` has `font-weight: 400`, because the repository has no bold file
  of these fonts and the browser would draw a false bold. Elements that today get 600 and must be
  set to 400 when they move to one of these fonts: `th` (bold by browser default), the status marks
  in a table (`.pass`, `.fail`, `.error`, `.warn` are 600 in `base.css`), the number of the current
  step (`.step.current .step-number` inherits 600), and the number of a mark (`.fragment sup`, 600
  inside Newsreader text). The counts of Results (`.count dd`) stay in Inter at 600 (35.4), so the
  rule does not touch them.
- **The HTML report** keeps its system font. Its Content Security Policy (`default-src 'none'`) would
  block the files, and FR-091 does not cover it.
- **Alternatives considered**: Google Fonts (blocked by the CSP and sends the address of the user to
  a third party; refused in the Clarifications); the four `@fontsource` packages as dependencies (four
  new packages for ten static files; a runtime dependency needs a written reason, and copying is
  simpler); the weight 500 of the preview (two more Inter files, 60,296 bytes (24,272 + 36,024), and a change to
  `styles.test.ts`; see 35.7, option O1); variable fonts (one file per family, but larger than the
  two or four static files needed).

### 35.4 Type, shape, space

The rules of `tests/unit/ui/styles.test.ts` stay: weights 400 and 600 only, two radii, the space scale
of 4 px, one breakpoint, no literal color in `base.css` and `components.css`, h4 and h5 at
`--text-md` or `--text-sm`. The preview draft broke several of them. This plan keeps the rules and
rounds the look to them. The visible differences from the preview are listed in each point.

- **Sizes**: `--text-sm` 14 px, `--text-md` 16 px, `--text-lg` 20 px, `--text-xl` 24 px and
  `--text-2xl` 32 px keep their values. `--text-2xl` is now the size of the display headings (names of
  views and sections, title of the case window). Three tokens are added: `--text-xs` 0.6875rem (11
  px: section labels, mono labels of table heads and fields, status pills), `--text-body` 1.125rem
  (18 px: Newsreader texts of a case and the "what next" sentence) and `--text-3xl` 3rem (48 px: only
  the overall result). *Why*: the overall result must stay the largest text on Results
  (`redesign-layout.spec.ts`), so it moves up one size instead of the headings moving down.
  `tokens.test.ts` checks `--text-2xl` = `2rem`, which stays true. *Difference from the preview*:
  section headings 32 px instead of 30 px, the overall result 48 px instead of 54 px.
- **Body text**: the body stays at `--text-md` (16 px) in Inter. Buttons, inputs, tables and metadata
  use `--text-sm` (14 px). The message banner stays at `--text-md`
  (`refusals-are-seen.spec.ts` checks at least 16 px). *Difference*: the preview used 13 to 14 px for
  the banner and body.
- **Weights**: 400 for text, buttons and display headings; 600 for Inter headings, the primary button
  and a status word in Inter. A status word in a mono pill is 400 (35.3). *Difference*: the preview used 500 for buttons and section headings (option O1
  in 35.7).
- **Radii**: `--radius` 8 px (controls, small boxes, marks of a passage, the number of a mark) and
  `--radius-lg` 12 px (cards, dialogs, the More menu, table frames, status pills). A status pill is
  under 24 px high, so 12 px draws a full pill. *Difference*: marks of a passage 8 px instead of 5 px,
  table frames 12 px instead of 10 px.
- **Space**: the six steps of 4 px stay. The values of the preview are rounded to them: 17/19 px →
  `--space-4`; 22 and 24 px → `--space-5`; 30 and 36 px → `--space-6`; a button 7 px 13 px →
  `--space-2` `--space-3`. The page gutter stays `--space-4` below 760 px and becomes `--space-6`
  from 760 px (the preview used `clamp(16px, 3vw, 42px)`, which the scale test refuses). The message
  banner (`.notice-line.has-message`) has the side margin of the content: `--space-4` below 760 px and
  `--space-6` from 760 px (owner, after M5, 2026-11-17).
- **Tool name**: `.app-name` (the h1 of the header) is in the display font, `--text-xl` (24 px),
  weight 400, as in the preview. It stays smaller than the names of views and sections (FR-091).
- **Dialog titles**: the h2 of a dialog (`.dialog h2`) is Inter, `--text-lg` (20 px), weight 600, as
  in the Editorial brief (7.1). Some dialogs open from a step and sit inside `.app-main`, so the rule
  for the display headings of a step excludes them (`.app-main h2:not(.dialog h2)`). All dialog
  titles then look the same.
- **Tables**: a table head (`th`) is a small label in JetBrains Mono (the next point). The cells stay
  in Inter, as FR-091 says for tables.
- **Labels of fields, table heads, part titles of the case window (h3)**: JetBrains Mono,
  `--text-xs`, uppercase, letter spacing 0.08em, `--text-muted`. An h4 or h5 keeps its look of
  section 33.4 (Inter, `--text-sm`, 600, `--text-muted`). *Difference*: the preview drew the h4 of the
  case window ("Judge reply", "Errors") in mono at 10.5 px (option O2 in 35.7).
- **Results numbers**: the counts (`.count dd`) are Inter, weight 600, `font-variant-numeric:
  tabular-nums`. The rates (`.rate dd`) are in the display font, weight 400, `--text-xl` (24 px),
  below the overall result at `--text-3xl`. *Difference*: the preview drew the counts in mono and
  the rates at about 26 px.
- **Shadow**: one token, `--shadow: 0 20px 40px -15px rgb(28 25 23 / 0.12), 0 0 0 1px rgb(28 25 23 /
  0.06)` (dark: `0 20px 40px -15px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(238 233 227 / 0.08)`), used only by
  `.dialog` and `.menu`.
- **Cards become flat sections**: a `.card` on a step has no fill, no side borders and no radius; a
  hairline at its top separates it from the one before. A case part (`.case-part`) keeps its 1 px
  hairline frame on all sides (`v4-test-case-window.spec.ts` checks a frame).
- **Step bar**: the number of a step is shown as "01" to "04" in JetBrains Mono. The leading zero is
  CSS generated content with empty alternative text (`content: "0" / ""`), so the name of the button
  stays "1 Judge" for a screen reader (SC-049). The current step has a 2 px accent underline.
- **Links**: the accent is the color of the text in both schemes, so color alone cannot mark a link.
  Every link and `.link-button` keeps an underline (WCAG 1.4.1; axe `link-in-text-block` runs in
  `v13-privacy-a11y.spec.ts`).
- **Literal colors in `components.css`** of the preview become tokens: `#fff` → `var(--surface)`;
  the half-white fill of rules and categories → `var(--surface)`; the three passage lines → the
  `--mark-*-line` tokens; the dot before the tool name → `var(--mark-success-line)`.
- **Alternatives considered**: relaxing `styles.test.ts` to match the preview pixel for pixel (it
  changes assertions the owner accepted in phase 23; offered only as O1 and O2); a third radius
  for pills (FR-091 names two radii; rejected).

### 35.5 Section labels (FR-091, SC-049; Clarifications 2026-11-17, question 5)

A section label is a small mono line in capitals above a section heading. It is markup, written as
`<p class="eyebrow" aria-hidden="true">` right before the heading, inside the same section. Two
cases differ: where the heading sits in a `.list-head` with buttons (Test cases, and Cases on Test
run), the label comes right before the `.list-head`; on Results, where the heading is visually
hidden, the label is the first child of the view (`.summary-view`, `.analysis-view`,
`.case-list-view`). One
component, `src/ui/components/Eyebrow.tsx`, renders it; the texts are one map in that file. The
texts are not action names, so they are not in `src/ui/labels.ts`.

| View | Component | Heading (unchanged) | Label |
|---|---|---|---|
| Judge | `PromptSection.tsx` | Prompt and variables | Step 01 / Instructions |
| Judge | `SampleReplySection.tsx` | Sample reply and fields | Step 01 / Sample output |
| Judge | `RulesSection.tsx` | Error rules | Step 01 / Detection logic |
| Judge | `JudgeStep.tsx` | Preview | Live preview |
| Test cases | `CasesStep.tsx` | Test cases | Step 02 / Dataset |
| Test run | `RunStep.tsx` | Progress | Step 03 / Run progress |
| Test run | `RunStep.tsx` | Cases | Step 03 / Case queue |
| Results, Summary | `SummaryView.tsx` | Summary (visually hidden) | Step 04 / Verdict |
| Results, Error analysis | `ErrorAnalysisView.tsx` | Error analysis (visually hidden) | Step 04 / Error analysis |
| Results, Test case list | `CaseListView.tsx` | Test case list (visually hidden) | Step 04 / Case list |

- **Decision (Results)**: the three views of Results have visually hidden headings, so the label is
  the first visible line of each view, above the overall result, the first table or the list.
- **Rationale**: one label per view gives Results the same rhythm as the other steps. "Verdict" names
  what the Summary shows first, the overall result.
- **Decision**: no label on "Model details", "Test project", "Error categories", the case window or a
  dialog. *Why*: the brief and the preview put labels on the main sections of a step only.
- **Accessibility**: `aria-hidden` keeps the label out of the accessibility tree. A section named
  with `aria-labelledby` or `aria-label` keeps its name, because the label is not part of it.
- **Risk to the tests**: the Testing Library queries `getByText`, `queryByText`, `getAllByText`,
  `findByText` and `toHaveTextContent`, and the Playwright `getByText`, `hasText` and `toContainText`,
  also find text that is `aria-hidden`. A search on 2026-11-17 of `tests/e2e` and `tests/unit` for
  `ByText(` and `toHaveTextContent(` found no query that one of the label texts matches, also as a
  substring (for example "Live preview" against `getByText('Preview')`; `/one verdict for the whole
  text/i` does not match "Step 04 / Verdict"). A test that fails on a label anyway is a regression
  of SC-049, not a test to adjust.

### 35.6 Components and files that change

- **Styles**: `src/ui/styles/tokens.css` (all values of 35.1 to 35.4, the `@font-face` rules; the navy
  block goes), `src/ui/styles/base.css` (fonts, type, buttons, inputs), `src/ui/styles/components.css`
  (every view).
- **New files**: `src/ui/components/Eyebrow.tsx`; `public/fonts/` with the ten WOFF2 files and four
  `OFL-<family>.txt` files.
- **Markup** (one `<Eyebrow>` each, nothing else): `src/ui/steps/judge/PromptSection.tsx`,
  `SampleReplySection.tsx`, `RulesSection.tsx`, `JudgeStep.tsx`; `src/ui/steps/cases/CasesStep.tsx`;
  `src/ui/steps/run/RunStep.tsx`; `src/ui/steps/results/SummaryView.tsx`, `ErrorAnalysisView.tsx`,
  `CaseListView.tsx`.
- **A class only where CSS needs a hook**: if a text of a case or the "what next" sentence has no class
  that CSS can select, a class is added to its element. No text, order, role or name changes.
- **Not changed**: anything under `src/ui/help/` (0 files; the Help takes the look from
  `components.css`), `src/ui/labels.ts`, `src/core/`, `src/app/`, `index.html` (the CSP), the
  file formats, the HTML report.

### 35.7 Tests: what changes and what stays

Each change to an existing assertion needs the owner's consent before it is made (SC-040; the owner's
instruction of 2026-11-17). The plan asks for each one by its number.

| # | Test | Assertion today | Change | Owner's consent |
|---|---|---|---|---|
| Z1 | `tests/unit/ui/tokens.test.ts`, "the light set is Stone and forest green" | the eleven light values of 33.1 | the title and the values of 35.1 | **Needed** |
| Z2 | `tokens.test.ts`, "the dark set follows the system …" | the seven dark values of 33.2 | the values of 35.2 (the check that the media block equals the `data-theme` block stays) | **Needed** |
| Z3 | `tokens.test.ts`, "the navy set is only a block of tokens …" and the navy entry of the contrast loop | the navy block exists and passes | removed with the block (FR-007 removes navy); the `find` of the navy block goes | **Needed** |
| Z4 | `tokens.test.ts`, "defines the tokens of the redesign …" | `--content-max` is `100rem` | `97.5rem` (1560 px, FR-092) | **Needed** |
| Z5 | `tests/e2e/v13-privacy-a11y.spec.ts`, "the accent is forest green …" | accent `[49, 93, 72]` light and `[125, 190, 156]` dark | title "the accent is near-black on a warm light background …"; accent `[28, 25, 23]` light and `[238, 233, 227]` dark. The luminance checks stay and pass: light background 0.94 (> 0.85), text 0.010 (< 0.03); dark background 0.0093 (< 0.02), text 0.82 (> 0.75) | **Needed** |
| O1 | `tests/unit/ui/styles.test.ts`, "uses only the weights 400 and 600" | 400, 600 | allow 500 (only if the owner wants the weight of the preview) | Needed only if chosen |
| O2 | `styles.test.ts`, "gives h4 and h5 the look of an h3 or of a small label …" | `--text-md` or `--text-sm` | allow `--text-xs` (only if the owner wants mono h4 labels) | Needed only if chosen |

**New checks** (added, no existing assertion changes):

- `tokens.test.ts`: `--text-secondary` in the text pairs on the three surfaces; each `--mark-*-line`
  at 3:1 on `--bg`; the `@font-face` rules name only files that exist under `public/fonts/`, each with
  `font-display: swap`.
- A new `tests/unit/ui/fonts.test.ts`: the ten files and four license files exist; each file starts
  with the WOFF2 signature `wOF2`; the CSP line of `index.html` is the same text as before.
- A new `tests/unit/ui/editorial-styles.test.ts`: reads `base.css` and `components.css` as text and
  checks the rules of 35.4 (fonts and weights of headings, the tool name, dialog titles, the body
  text of a case, table heads, the banner at 16 px, underlined links, the leading zero of a step,
  flat sections, status pills, passage marks, the overall result, dialogs and the menu). It is a new
  file, so `styles.test.ts` stays unchanged.
- A new `tests/unit/ui/eyebrow.test.tsx`: each of the ten labels of 35.5 renders with
  `aria-hidden="true"` right before its heading; the accessible name of each section is unchanged.
- A new `tests/e2e/editorial.spec.ts`: SC-048 (every request to another host is aborted and recorded,
  and none is made while the demo is loaded and each step, Help and the case window are opened; every
  `.woff2` response comes from the site; for each of the four families,
  `document.fonts.load('16px "<family>"')` resolves to at least one face whose status is `loaded`.
  `document.fonts.check` is not used: it is true when no face matches the family, and false for a face
  the page has not used yet); SC-049 (the ARIA snapshot of each step
  holds no label text, and each label is visible); the width of `.app-main` at 1440 × 900 is at most
  1560 px.
- Phase 33 (after M5, 2026-11-17), in `editorial-styles.test.ts`: the field labels (`.field-label`,
  `.rule-head label`, `.category label`) are small muted mono labels in capitals like `th`; the input
  rule of `base.css` sets Inter at `--text-sm` with `text-transform: none` and `letter-spacing: normal`
  (a label that holds its input must not pass on its capitals); `textarea.json` stays mono at
  `--text-sm`; `td` is at `--text-sm`; a `@media (min-width: 760px)` block sets the banner margin to
  `var(--space-2) var(--space-6)`, and outside it the banner keeps `var(--space-2) var(--space-4)` and
  `--text-md`. In `editorial.spec.ts`: at 1440 × 900 after **Load demo…** the banner's left and right
  edges match the content edges of `.app-main` within 1 px; at 390 × 844 it keeps its 16 px margins and
  the page does not scroll sideways.

**Pass unchanged** (checked against the values of this section):

- `redesign-layout.spec.ts`: "at most 1600 px" (1560 passes; it is not tightened, the new check is in
  `editorial.spec.ts`); "the overall result is the largest text" (48 px against 32 px headings).
- `refusals-are-seen.spec.ts`: the banner has a border and at least 16 px.
- `v4-test-case-window.spec.ts`: every case part has a top border.
- `layout-details.spec.ts`: the gap after the number of a mark stays at least 3 px (the number keeps
  `margin-right: var(--space-1)`); the disabled **Save case** is not the accent and has opacity 1.
- Unit tests that read the CSS text, whose rules the redesign keeps: `reply-view.test.tsx`
  (`.reply-block` has `background: var(--reply-bg)` and `border-left: 2px solid var(--reply-line)`;
  `.reply-block.fragment-strong` has `var(--reply-strong-bg)`, `border-left: 4px solid var(--accent)`,
  `outline: none` and weight `normal` or 400), `case-highlights.test.tsx` (`.reply-read` has no
  `max-height` or `overflow`), `run-step.test.tsx` (every sign rule of `base.css` excludes
  `.status-mark`), `results-views.test.tsx` (each `.result-*::before` in `components.css` has a sign
  ✓, ✕ or …). The Editorial changes to these selectors only add declarations or change token values.

**At risk** (expected to pass; checked first in the step that touches them):

- `layout-details.spec.ts`, "the table of test cases at 1280 px": every header cell on one line, the
  same height and under 50 px. Table heads in uppercase JetBrains Mono with letter spacing are wider
  than in Inter. If a head wraps, its letter spacing or the column widths change, not the test.
- `v13-privacy-a11y.spec.ts`: axe and the 4.5:1 check in both schemes; a word or a sign on every
  status.

Any other test that fails is a regression, not a test to adjust (SC-040).

### 35.8 What does not change

- Labels, actions, the order of actions, checks, confirmations, statuses, results, file formats, the
  data model and the HTML report (SC-040, SC-046, SC-049). `data-model.md` and
  `contracts/file-formats.md` are not touched.
- The 760 px breakpoint, the case window frame with one scroll and a header that stays, and the marks
  of Judge reply (33.5, 33.6).
- The Help: no file under `src/ui/help/` changes. It gets the new look only through the shared styles
  (Clarifications 2026-11-17, question 3). The Help names no color, so no text of it is out of date.
- Section 33 stays as history, with one pointer to this section.
