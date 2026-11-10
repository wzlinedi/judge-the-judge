# Feature Specification: Judge Evaluation Workflow

**Feature Branch**: `001-judge-evaluation-workflow`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "judge-the-judge high-level document (Polish): a tool that evaluates LLM-as-judge judges. Users supply a judge prompt package (from a file or typed/pasted in the app), prepare test cases with deliberately injected defects plus clean cases, run the composed prompt in an LLM outside the tool and paste back the JSON answer, then see how well the judge performs (detection rate, false alarms, with confidence intervals), compare two judge versions, and reproduce any past result. Runs without infrastructure, accounts or database; data stays on the user's device."

## Clarifications

### Session 2026-11-08

- Q: What is a test case, and what stays fixed? → A: A test case (also called a scenario) has a name, named input fields (its input data), zero or more expected errors (each with a description and optionally a field, label and fragment), and a final prompt. The prompt is the judge template with the case's input fields filled into its placeholders and nothing else added by the tool. The prompt input stays unchanged during testing; what the user adjusts is the expected output (the expected errors).
- Q: How is Pass or Fail decided for a test case? → A: Both ways. The user pastes the received output as free text of any format and decides the verdict by hand, which is authoritative. When the received output happens to follow the tool's optional JSON shape, the tool proposes a verdict (Pass when every expected error type is reported, or when nothing is reported for a case with no expected errors; otherwise Fail), which the user accepts or changes.
- Q: How are results shown while some cases still await manual review? → A: Results are computed from the already decided cases, clearly labeled provisional, with the number of pending cases shown.
- Q: How are inputs, expected errors and error kinds modelled so that any judge prompt and any metric fits? → A: A test case has a name and any number of named input fields (for example the prompt under review, its input, a context); the judge prompt refers to them with placeholders such as {{field-name}}. An expected error is universal: the field it is in, a label (free text), an optional fragment, and a description of what is wrong. Labels come from metric packs: Accuracy and Completeness are built in and ship with predefined labels, other packs are loaded from definition files, and a dataset may use several packs and add custom labels. Scenarios use one JSON format for files, saves and the LLM test-data round trip; a compact one-line convention (`field | label | "fragment" | description`) is accepted for typing and for CSV cells.
- Q: Are the initial label sets and the placeholder syntax acceptable? → A: Yes to the initial Accuracy and Completeness label sets (see the assumptions in the test-case authoring feature), and the placeholder syntax stays `{{field-name}}`.
- Q: Does each test case have its own full prompt? → A: No. One judge prompt serves the whole evaluation and each test case supplies its own input data; the final prompt for a case is composed from the two. Expected errors may still be adjusted for a case after the dataset is finalized, because they are the reference the received outputs are judged against; input data and the judge prompt stay fixed. Suggested verdicts are recomputed after such a change and verdicts set by hand are kept.
- Q: Does the tool require a fixed output format from the judge prompt? → A: No. The user's prompt is used as is and may return any format. The tool offers an optional ready-made JSON shape (a list of findings, each with a label and a short description, plus a yes/no confidence flag) and an example template that produces it, but only to enable automatic verdict suggestions.
- Q: Do exported reports and result files always contain the full prompts and received outputs? → A: Yes, always. Reports and result files contain the real, full data (final prompts with the actual input data, expected errors, received outputs, verdicts), with no option to leave it out, so that every result can be reproduced and verified. The Help states that exported files contain the user's data and should be handled accordingly.
- Q: How are results presented? → A: As two linked tables. The top table lists every test case with its name, kind, status (Pass, Fail, Awaiting verification, Not run), number of expected errors, whether output was received, whether a verdict was suggested or set by hand, and the reported error types, under a strip with the overall measures (detection rate and false-alarm rate with 95% intervals). The detailed table below shows, per test case: the full tested prompt, the expected errors, the received output with a place to paste it, and a place for manual verification. Selecting a row in the top table jumps to or filters the matching detail. The result can be saved to JSON and exported as an HTML report.
- Q: Where do saved results live for comparison? → A: Both. Results go on a session "shelf" in the tool's memory for the duration of the session, and each result can also be exported to a file and imported back later. Compare picks any two results from the shelf, whether they were saved in this session or imported.
- Q: What does "two data sets" mean? → A: Every scenario normally carries two pieces of data: the **input** (what the evaluated model was asked) and the **output** (what it answered). The judge considers both, for example to check accuracy and completeness of the output against the input, so the tool provides a place to enter both. Errors are injected into the output (the input stays unchanged) and expected errors point at the `output` field by default. These are two ordinary named fields (`input`, `output`), not a separate mechanism: more fields (for example a context) remain possible, and the judge prompt uses `{{input}}` and `{{output}}`. New scenarios and the built-in mock data start with these two fields; the LLM injection round trip rewrites the `output` field.
- Q: Is the input always required? → A: No. Which fields a scenario has is decided by the placeholders in the judge prompt. A judge that only examines the output (for example one checking for biased wording) uses just `{{output}}`; then scenarios have a single `output` field and no `input` is requested, shown or required in files. Input and output together are the common case, not a rule. Such a judge's error labels (for example `bias`) come from a custom label or a loaded metric pack.
- Q: Where do the sought error kinds go, and what happens to the JSON-output hint? → A: The judge-prompt screen carries an **error catalog**: the kinds of errors the judge looks for. The user picks built-in or loaded metric packs, adds single labels, or **pastes a plain-text list with one category per line** (optionally `name - description`, also accepted with `:` or `|`); names are normalized to lower-case with dashes, and names already in the catalog are skipped and reported. The catalog feeds the label choices for expected errors and the test-data generation prompt. The optional JSON output shape that enables suggested verdicts is not part of judge-prompt entry; it belongs to the results step, where outputs are received, as a collapsed optional hint.
- Q: Is the error catalog one list, and can it be filled automatically? → A: The error catalog is a **single flat list** of error kinds (name plus optional description), one per line, that the user can type, paste, load from a file or edit freely; there are no separately switched-on packs. Two buttons, **Populate for accuracy** and **Populate for completeness**, write a ready judge prompt (with `{{input}}` and `{{output}}`, the listed labels and the JSON reply shape) and fill the list with that metric's labels, asking before replacing existing content. Other metrics are loaded from a declarative file into the same list. Saved datasets store the one list; older files that name packs have those labels merged into it. This replaces the earlier wording about separately selected packs.
- Q: Can the judge prompt and the error catalog be saved and loaded together? → A: Yes. A **judge set** (the judge prompt plus its error catalog) is saved to and loaded from one JSON file (`format: "judge-the-judge-judge-set"`, with `prompt` and `error_catalog` entries of name, description and optional example). Loading asks before replacing existing content. A file that has only a prompt (an older judge file or plain text) replaces just the prompt and keeps the current catalog; an invalid file changes nothing and says so. The controls sit at the level of both sections, next to the Populate buttons, and are locked for loading once the dataset is finalized (saving stays available).
- Q: Are the Starter prompts and a separate "load error list from file" needed? → A: No. Two ready sets (Populate for accuracy, Populate for completeness) are the only built-in starting points, and they fill both the prompt and the catalog. A prompt for another kind of judge (for example output-only, such as a bias check) is typed or pasted by the user, with its error list pasted as text, or loaded as a whole **judge set** file. There is no separate load-from-file for the error list alone; metrics other than the two built-in ones arrive through a judge set file or a pasted list. This supersedes the earlier mention of loading a metric-pack definition file on its own.
- Q: Where does the error catalog get updated when a new kind of error is needed later? → A: Not on the judge-prompt screen, which is a one-time setup (there is no "update labels in prompt" action there). While writing expected errors on the test-case screen, the label stays free text; a label that is not yet in the catalog is normalized (lower-case, dashes) and **added to the catalog automatically**, with a short confirmation. The test-case screen shows the current catalog and a **Save judge set** action, so the saved judge set always contains the newest catalog. The judge prompt text itself stays fixed once the dataset is finalized, so a newly added label appears in the saved catalog but not inside the prompt text. This supersedes the earlier idea of an "update labels in prompt" action.
- Q: How detailed and pre-filled must the prompt for generating test data be, and should clean scenarios come first? → A: The generation prompts are detailed and **pre-filled** from what the user has already set: the judge prompt, the error catalog with each label's meaning and example, the scenario fields with their roles (input stays as written, output is where errors go), the rules for realistic and subtle errors, exact-fragment quoting and the JSON reply shape, and, for adding errors, the clean scenarios already in the dataset. The user can **add own changes** in an "own changes" box that is appended with priority, and can edit the prompt text directly; changing an option rebuilds the prompt. Generation is **two steps**: (1) a few **clean scenarios first** (count and optional topic), which are the base for errors and measure false alarms; (2) variants of those clean scenarios with errors (variants per scenario, errors per variant), spreading the catalog's categories evenly. The per-scenario "prompt for generating test data" uses the same detailed template and the same "own changes" box. Both steps return the same scenario JSON, pasted into the existing paste area.

### Session 2026-11-10

- Q: Does one evaluation test one metric (one judge prompt with its error catalog) or several at once? → A: One evaluation tests one metric. A metric is a **judge set** (the judge prompt plus its error catalog). Accuracy and Completeness are the two built-in judge sets (the Populate buttons); each is tested in its own evaluation, with its own test cases and its own report. Further metrics are added by loading another judge set file. This replaces the remaining "metric pack" wording.
- Q: When does an injected error count as found automatically, and when does a case go to manual review? → A: Label and place. An expected error is **found** when the judge reports the same label and its quoted fragment overlaps the expected fragment (the label alone decides when the expected error has no fragment, as with omissions). A clear result is an **automatic verdict** that counts at once: Pass when every expected error is found and nothing else is reported, Fail when an expected error is not reported at all. A case goes to **Awaiting verification**, with the reason shown, when the output cannot be read, an error is reported under a different label, the quote points at a different place than the injected fragment, or the judge reports something that was not injected. The user can change any verdict. The optional JSON reply shape therefore includes a quoted fragment for each finding. This supersedes the label-only rule and the wording about verdicts being only "suggested".
- Q: Is detection counted per injected error or per test case? → A: Per error. The detection rate is the expected errors found divided by all expected errors, with a breakdown per error label (expected, found, missed, rate). The judge must also not report more than was expected: an **unexpected finding** (one that matches no expected error) counts against the judge in any case, clean or not. The false-alarm rate is the share of cases with at least one unexpected finding, with the figure for clean cases alone shown beside it, and the total number of unexpected findings is shown. A case passes only when every expected error is found and nothing unexpected is reported. In manual verification the user marks each expected error as found or not found, and for an unexpected finding either confirms it as a false alarm or adds it to the expected errors as a real error.
- Q: On what basis does the tool give the final answer "the judge works / does not work"? → A: Thresholds and a minimum sample. Defaults: detection rate at least 80% and false-alarm rate at most 10%, editable on the results screen. The final answer is **Works** when both thresholds are met, **Does not work** when either is not, and **Inconclusive** when cases are not run or still await verification, or the sample is too small (by default fewer than 30 expected errors or fewer than 10 clean cases). Confidence intervals are shown beside it, with a "borderline" note when an interval includes its threshold. The values used are stored with the result and shown in the report. Because the user tests narrative texts in which exact errors are hard to pin down, the tool also prepares a **verification prompt** for the user's own LLM (case data, expected errors, received output); the LLM returns a JSON opinion that the user pastes back into the manual verification of the case.
- Q: Does the external LLM's verification opinion count at once as a verdict, or only after the user approves it? → A: Only after approval. The opinion fills the manual verification marks (each expected error found or not, unexpected findings) with its reasons as a proposal; the case stays Awaiting verification until the user approves it, one case at a time or all proposals in one action, and the user may edit it first. An approved verdict records its source as "LLM opinion, approved by the user", and the report shows the source of every verdict.
- Q: What does the judge prompt return: a list of specific errors or only an overall rating? → A: An itemized list in the judge's own JSON. The user's judges are claim-based: the judge splits the output (for some metrics the input) into smaller parts and returns them as JSON with an assessment of each part. For accuracy each claim of the output is checked against the input; for completeness each element of the input is checked for presence in the output; further metrics follow the same pattern (for example an inference in the output that the input does not justify). The tool therefore reads the judge's own reply through a **reply mapping** (where the list of parts is, which entry holds a part's text, which holds its assessment, and which assessment values mean a problem) instead of requiring a shape of its own. A part assessed as a problem is a **finding**, and its text is the place it points at. Because such a judge names no error categories, an expected error counts as found when a finding points at its fragment; a matching label is not required. The error catalog describes the errors injected into the test data and groups the results; the judge does not have to use it. This supersedes the "label and place" rule above. A judge that returns only an overall rating is out of scope for this version.
- Q: Is the judge one prompt whose single reply holds the parts together with their assessment, or a chain of several prompts? → A: One prompt and one reply per test case; splitting the text and assessing the parts happen together. A judge built as a chain of prompts, where one reply feeds the next prompt, is out of scope for this version.
- Q: Should every injected error carry a difficulty mark, so that results show whether the judge misses only subtle errors? → A: Yes, two levels. An expected error may be marked **obvious** or **subtle**. The prompts that generate errors ask for a mix (half of each by default) and explain both levels; the user can change the mark. Results show the detection rate separately for obvious and for subtle errors, and finalizing warns when the dataset has no subtle errors.
- Q: In which unit are false alarms counted for the final answer? → A: Per finding. The false-alarm rate is the findings that match no expected error (confirmed as false alarms) divided by all findings the judge reported, in clean and defective cases alike, for example "6 of 40 findings were wrong (15%)". The 10% threshold applies to this figure. The share of cases with at least one false alarm, and the same share for clean cases alone, stay beside it as information. This replaces the per-case false-alarm rate.
- Q: Should the results show one combined score besides the two measures? → A: Yes, as an addition. A combined score from 0% to 100% (the harmonic mean of the detection rate and the share of correct findings, which is 100% minus the false-alarm rate) is shown beside the two measures, in the report and when comparing judge versions. It falls both when errors are missed and when false alarms are raised. The final answer still rests on the two thresholds, not on the combined score.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate one judge end to end (Priority: P1)

A judge author loads a judge prompt and a set of test cases, lets the tool compose the final
prompt for each case, runs each prompt in an LLM of their choice outside the tool, pastes the
received output back (any format), verifies it, and then sees the outcome: for every test case
Pass or Fail, and overall how often the judge found the expected errors and how often it raised
problems that were not there, each with a confidence interval.

**Why this priority**: This is the core value of the product: knowing how much a judge can be
trusted. Everything else builds on it.

**Independent Test**: Using the provided mock data, complete the whole flow in one session and
see a results screen with a detection rate and a false-alarm rate, each with a confidence
interval.

**Acceptance Scenarios**:

1. **Given** a loaded judge package and a loaded test case set, **When** the user opens a case,
   **Then** the tool shows the fully composed prompt ready to copy.
2. **Given** a composed prompt was run externally, **When** the user pastes the received output
   for that case (any text), **Then** the tool accepts it, shows it next to the expected errors, and
   marks the case as awaiting verification unless an automatic verdict can be made (scenario 4).
3. **Given** all cases have a verdict, **When** the user opens the results, **Then** they see every
   case with its status, plus the detection rate and false-alarm rate with confidence intervals.
4. **Given** the received output can be read through the judge set's reply mapping, **When** it is
   pasted, **Then** the tool matches the findings to the expected errors by the place they point at: a
   clear result becomes an automatic Pass or Fail that counts at once, an unclear one is marked
   awaiting verification with the reason shown, and the user can change any verdict.
5. **Given** the received output is free text or in any other format, **When** it is pasted,
   **Then** it is accepted without complaint, no automatic proposal is made, and the user decides
   the verdict by hand.
6. **Given** every case has a verdict and the sample meets the minimum, **When** the user opens the
   results, **Then** a final answer (Works or Does not work) is shown at the top with the thresholds
   it was based on and the reason.
7. **Given** some cases are not run or await verification, or the sample is below the minimum,
   **When** the user opens the results, **Then** the final answer is Inconclusive and says what is
   missing.
8. **Given** a case awaits verification, **When** the user copies its verification prompt into
   their own LLM and pastes the JSON opinion back, **Then** the opinion appears in the manual
   verification of that case as a proposal marked as coming from an LLM, and the case stays awaiting
   verification until the user approves it.

---

### User Story 2 - Provide the judge in two ways (Priority: P1)

A judge author supplies the judge either by loading a file or by typing or pasting the prompt
directly in the app. Both routes produce the same judge package: prompt template, additional
resources (optional). The tool uses the prompt exactly as written and adds nothing to it. A judge
typed in the app can be saved to a file so it is not lost.

**Why this priority**: Without a judge there is nothing to evaluate; two entry routes keep the
barrier to entry low.

**Independent Test**: Create a judge by typing it in the app, save it to a file, reload it from
that file, and confirm it behaves identically to the typed version.

**Acceptance Scenarios**:

1. **Given** a valid judge file, **When** the user loads it, **Then** the judge package appears
   with its template and resources.
2. **Given** the user typed a judge in the app, **When** they save it, **Then** a file is
   produced that reloads into an identical package.
3. **Given** an invalid or incomplete judge file, **When** the user loads it, **Then** the tool
   explains what is missing or wrong and does not replace the currently loaded judge.

---

### User Story 3 - Prepare test cases with injected defects (Priority: P1)

A user prepares test cases: some contain deliberately injected defects or omissions with one or more
recorded expected errors (each with a description and optionally a field, label and fragment) that the judge should find, and others are clean cases where the judge
should find nothing. Test cases can be loaded from a file, and the tool can generate a fixed
set of mock cases so the product can be tried without real data.

**Why this priority**: Known right answers are what make it possible to judge the judge.

**Independent Test**: Load the mock case set and confirm it contains both defective and clean
cases, each with a recorded expectation.

**Acceptance Scenarios**:

1. **Given** a valid case file, **When** it is loaded, **Then** every case shows whether it is
   defective or clean and what the judge is expected to find.
2. **Given** no real data, **When** the user chooses to generate mock data, **Then** a ready
   set of defective and clean cases is available immediately.
3. **Given** a case file with a case missing its expectation, **When** it is loaded, **Then**
   the tool names the problematic case and rejects only the invalid part or the whole file with
   a clear message.

---

### User Story 4 - Compare two versions of a judge (Priority: P2)

A judge author finishes an evaluation, saves its result, changes the judge prompt or resources
while keeping the same finalized test cases, runs a new evaluation, and saves that result too.
They then choose any two saved results and the tool shows them side by side and highlights any
worsening. Saved results are kept on a session shelf, and each can be exported to a file and
imported again, so a result from an earlier session can be compared with a new one.

**Why this priority**: Safe iteration on judges is a main goal, but it requires a working
single-judge evaluation first.

**Independent Test**: Evaluate a judge, save the result, change the prompt keeping the same
cases, evaluate again, save, and open the comparison: both results appear side by side with
worsening clearly marked. Then export one result, reload the page, import it, and compare it with
a new result.

**Acceptance Scenarios**:

1. **Given** two evaluated judge versions on the same case set, **When** the user opens the
   comparison, **Then** detection rate, false-alarm rate and the combined score are shown for both
   side by side.
2. **Given** the newer version performs worse on a measure beyond its uncertainty, **When** the
   comparison is shown, **Then** the worsening is clearly highlighted.
3. **Given** the two versions were evaluated on different case sets, **When** the user tries to
   compare them, **Then** the tool warns that the comparison is not like-for-like.
4. **Given** a completed evaluation, **When** the user saves its result, **Then** it is added to
   the shelf under a name the user can edit (for example "prompt v2, shorter") together with the
   judge version, dataset version and date.
5. **Given** a completed evaluation with a finalized dataset, **When** the user chooses "change the
   judge, keep the cases", **Then** the tool offers to save the current result to the shelf first,
   keeps the dataset, clears the answers, and lets the user edit the prompt and resources, giving
   the new judge a new version identity.
6. **Given** results on the shelf, **When** the user opens Compare, **Then** they can pick any two
   of them, including results imported from files.
7. **Given** the user has unsaved results on the shelf or an unsaved current result, **When** they
   try to leave the page, **Then** the tool warns them and offers to export.

---

### User Story 5 - Reproduce and audit past results (Priority: P2)

A user opens any saved result and can see exactly which judge version (prompt, resources) and
which test cases produced it, and can export and re-import the result so it can be reproduced
or audited later.

**Why this priority**: Traceability underpins trust in the results and in comparisons.

**Independent Test**: Export a result, clear the session, re-import it, and confirm the same
numbers, judge version and case set are shown.

**Acceptance Scenarios**:

1. **Given** a completed evaluation, **When** the user exports it, **Then** the file contains
   the results together with the judge version and the cases used.
2. **Given** an exported result file, **When** it is imported in a fresh session, **Then** the
   identical results and judge version are displayed.
3. **Given** the same judge, cases and answers, **When** results are recalculated, **Then** the
   numbers are identical.

---

### User Story 6 - Verify every result by hand, helped by suggestions (Priority: P1)

For every test case the user sees the expected errors beside the received output and records the
verdict (Pass, Fail, or leaves it awaiting). The user's verdict is always authoritative. When the
tool can read the output it sets an automatic verdict when the result is clear and flags cases where the output is unclear or
disagrees with the expectation, so the user can concentrate on those first.

**Why this priority**: The user judges the judge; their verdict is the ground truth, and
suggestions only save effort.

**Independent Test**: Paste outputs for several cases, set verdicts by hand, and confirm the
statuses and overall measures update; paste a JSON-shaped output and confirm an automatic verdict appears.

**Acceptance Scenarios**:

1. **Given** a received output, **When** the user sets the verdict, **Then** the status changes and
   the overall measures update.
2. **Given** an automatic verdict was set, **When** the user changes the verdict, **Then** the user's verdict
   replaces it and is shown as set by hand.
3. **Given** unclear or disagreeing outputs, **When** the user opens the results, **Then** those
   cases are marked so they can be reviewed first.

---

### Edge Cases

- No data loaded yet: every screen shows a helpful empty state with the next step.
- Some cases unanswered: results can be viewed as partial and are clearly labeled as such, or
  the tool states how many cases are still missing.
- Very small case sets: confidence intervals are shown and the tool states that the sample is
  too small for a reliable conclusion.
- Received output is free text, partly JSON, or in an unexpected format: it is accepted, no suggestion is made, and the user decides.
- The same case answered twice: the user chooses whether to replace the earlier answer.
- A very large pasted answer or file.
- Loaded files are from an older or newer format version than the tool understands.
- Browser session closed before the user exported their work.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to provide a judge by loading a file or by typing/pasting the
  prompt in the app, and both routes MUST produce the same judge package (prompt template,
  additional resources).
- **FR-002**: Users MUST be able to save a judge entered in the app to a file and reload it
  with identical content.
- **FR-003**: Users MUST be able to load test cases from a file; each case MUST have a name, one or
  more named input fields, and zero or more expected errors (none for a clean case). Each expected
  error MUST have a description and MAY have a field, a label, a fragment, and a difficulty (obvious or subtle).
- **FR-004**: The system MUST offer generation of mock judge, case and answer data as a fixed
  sample that is usable without regeneration.
- **FR-005**: The system MUST compose the final prompt for each case from the judge prompt with the
  case's named input fields filled into the matching placeholders (such as {{field-name}}), show it in full, and let the user copy it. The system MUST NOT add any
  text of its own to that prompt (no appended resources, instructions, or format requirements); the
  prompt is used exactly as the user wrote it.
- **FR-006**: Users MUST be able to paste the received output for each case as text of any format.
  The system MUST accept it, show it next to the expected errors, and MUST NOT reject it for its
  format.
- **FR-006a**: The system MUST read itemized judge replies in the judge's own JSON through a reply
  mapping stored in the judge set: where the list of parts is, which entry holds a part's text,
  optionally which entry holds its assessment together with the values that mean a problem (without
  an assessment entry every listed part is a problem), and optionally which entry holds a category.
  On the judge-prompt screen the user MUST be able to set the mapping by pasting one sample reply:
  the system proposes a mapping, shows which parts it would treat as findings, and the user
  confirms or corrects it. The built-in Accuracy and Completeness judge sets MUST ship with a
  matching mapping. For a prompt that asks for no JSON at all, the system MUST offer an action that
  inserts a ready JSON reply block (with its mapping) at the user's request. Before finalizing, the
  system MUST warn when no working mapping is set, explaining that every case will then need manual
  or LLM-assisted verification. The Help MUST explain the mapping. This replaces the earlier
  optional JSON output shape of the tool's own.
- **FR-007**: The system MUST NOT call any LLM itself; the judge is run by the user outside
  the tool.
- **FR-008**: The system MUST compute and display, as its two built-in measures, the detection rate
  and the false-alarm rate, each with a confidence interval. The detection rate MUST be counted per
  expected error: expected errors found divided by all expected errors in cases with a verdict. The
  false-alarm rate MUST be counted per finding: findings that match no expected error and are
  confirmed as false alarms, divided by all findings the judge reported in cases with a verdict,
  clean or not. Several findings that point at the same expected error each count as a correct
  finding. When the judge reported no findings at all, the false-alarm rate MUST be shown as not
  available. Beside it the system MUST show, as information, the share of cases with at least one
  false alarm, the same share for clean cases alone, and the total number of false alarms.
- **FR-008c**: The system MUST show one combined score from 0% to 100%: the harmonic mean of the
  detection rate and the share of correct findings (100% minus the false-alarm rate). It MUST be
  shown beside the two measures, in the report and in comparisons, and labeled as a summary: the
  final answer MUST still rest on the two thresholds (FR-021). When either part is not available,
  the combined score is not available.
- **FR-008b**: The system MUST show a breakdown per error label: expected errors, found, missed,
  and the detection rate with its interval. A label with fewer than 10 expected errors MUST show
  counts only, with no pass or fail assessment. When the judge reports categories, the number of
  unexpected findings per category MUST be shown as well. The system MUST also show the detection
  rate separately for obvious and for subtle expected errors (and for those with no difficulty
  set), under the same minimum-count rule.
- **FR-008a**: Every test case MUST have a status: Not run, Awaiting verification, Pass, or Fail.
  The user's verdict MUST be authoritative. When the received output can be read through the reply mapping
  (FR-006a), the system MUST match findings to expected errors by place: an expected error is found
  when at least one finding's text points at the expected fragment in the field the expected error
  names. Several findings may point at the same expected error, and none of them is unexpected. A
  category is not required for a match; when the judge reports one that differs from the expected
  label, it is shown as information only. Because claim-based judges often rephrase the text,
  matching MUST tolerate rephrasing, and a finding that only partly resembles an expected fragment
  MUST be treated as unclear. A clear result MUST become an automatic verdict that counts at once:
  Pass when every expected error is found and no other finding is reported (or no finding is
  reported for a case with no expected errors), Fail when no finding points at an expected error
  and nothing else in the case is unclear. The case MUST instead be Awaiting verification, with the
  reason shown, when the output cannot be read, an expected error has no fragment, a finding only
  partly resembles an expected fragment, or a finding matches no expected error. The user MUST be able to
  change any verdict, and each verdict MUST show its source: automatic, set by hand, or an LLM
  opinion approved by the user (see FR-022). Overall measures MUST be computed from cases with a verdict, labeled "provisional" while
  any case awaits verification, and show the number of such cases.
- **FR-009**: The system MUST state when a sample is too small for a reliable conclusion.
- **FR-010**: Users MUST be able to compare any two saved results side by side, with worsening
  highlighted, and MUST be warned when the dataset versions differ.
- **FR-010a**: The system MUST keep a shelf of saved results for the duration of the session, let
  the user name each saved result, and show for each its judge version, dataset version, date,
  and headline measures.
- **FR-010b**: The system MUST offer "change the judge, keep the cases", which keeps the finalized
  dataset, offers to save the current result to the shelf first, clears the answers, and gives the
  new judge a new version identity.
- **FR-010c**: The system MUST NOT keep the shelf after the page is closed; it MUST warn before
  leaving with results that have not been exported.
- **FR-011**: Every result MUST be stored together with the judge version (prompt and
  resources), the cases, and the received outputs and verdicts that produced it, and users MUST be able to export it to a file and
  import it back, including into the shelf.
- **FR-012**: Recalculating results from the same judge, cases and answers MUST give identical
  numbers.
- **FR-013**: The system MUST give every test case a place for manual verification, in which the
  user marks each expected error as found or not found and states how many of the judge's findings
  were unexpected; the case is Pass only when every expected error is found and nothing
  unexpected is reported, otherwise Fail. For an unexpected finding the user MUST be able to confirm
  it as a false alarm or add it to the case's expected errors as a real error. The system MUST mark
  cases where the output is unclear or disagrees with the expectation so the user can review them first.
- **FR-014**: The system MUST work without accounts, servers or databases, and user data MUST
  stay on the user's device unless the user exports it.
- **FR-015**: One evaluation MUST test one metric, defined by a judge set (the judge prompt plus its
  error catalog). Accuracy and Completeness are built in as ready judge sets; additional metrics
  MUST be addable by loading a judge set file, without changing the rest of the tool, and
  check thresholds MUST be configurable from files.
- **FR-016**: All data (judges, cases, answers, results, metric definitions, check
  configuration) MUST be loadable from and exportable to files, with clear errors for invalid
  or unsupported-version files.
- **FR-017**: The tool MUST include built-in Help explaining how to use each part of the
  workflow, kept current with the features.
- **FR-018**: The interface MUST be modern, clear, responsive, accessible, and present helpful
  empty and error states.
- **FR-019**: The system MUST present results as two linked tables under a strip of overall
  measures. The top table MUST list every test case with its name, kind, status, number of expected
  errors and how many were found, the number of unexpected findings, whether output was received,
  the source of the verdict (automatic, set by hand, or LLM opinion approved by the user), and the
  reported error types. The detailed table below MUST show, for each test case, the full tested
  prompt, the expected errors, the received output (entered on the Run step; it can be replaced here), and a place for manual
  verification. Selecting a row in the top table MUST take the user to or filter the matching detail.
- **FR-020**: Users MUST be able to save a result to a JSON file and export it as an HTML report
  that contains the same tables, readable without the tool. Both MUST always contain the full
  final prompts (with the real input data filled in), the expected errors, the received outputs,
  the verdicts, the final answer with the values it was based on, and the per-label and per-difficulty breakdowns;
  there is no option to omit them. The HTML report MUST open with a summary (final answer,
  thresholds, overall measures, per-label breakdown) and MUST print cleanly to PDF from the browser. The Help MUST state that exported files
  contain the user's data.
- **FR-021**: The results MUST state, above the overall measures, a final answer for the evaluated
  judge: Works, Does not work, or Inconclusive. It is Works when the detection rate and the
  false-alarm rate both meet their thresholds, Does not work when either does not, and Inconclusive
  when any case is Not run or Awaiting verification or the sample is below the minimum. Defaults:
  detection rate at least 80%, false-alarm rate at most 10%, minimum sample 30 expected errors and
  10 clean cases. The user MUST be able to change these values on the results screen or load them
  from a check configuration file, and the answer MUST update at once. The system MUST show the
  reason for the answer and a "borderline" note when a confidence interval includes its threshold.
  The values used MUST be stored with the result and shown in the report.
- **FR-022**: For any case with a received output, and in one action for all cases awaiting
  verification, the system MUST offer a ready-made verification prompt for the user's own LLM. It
  MUST contain the case's fields, the expected errors and the received output, and ask for a fixed
  JSON opinion: for each expected error whether the judge found it (with the matching finding and a
  short reason), and a list of unexpected findings. The system MUST accept the pasted opinion,
  match it to its case by identifier, keep the pasted text and explain the problem when it is
  malformed, and show the opinion in the manual verification of that case, marked as coming from an
  LLM. The opinion MUST fill the verification marks as a proposal only: the case stays Awaiting
  verification until the user approves it, one case at a time or all proposals in one action, and
  the user MUST be able to edit it first. An approved verdict MUST record its source as "LLM
  opinion, approved by the user", and the report MUST show the source of every verdict.
- **FR-023**: The workflow MUST be presented as four steps in a fixed order, each on its own screen
  with one primary next action: (1) Judge: the judge prompt with its placeholders and the error
  catalog; (2) Test cases: the scenarios with their composed prompts and expected errors, built by
  hand, by injection or from files, ending with finalizing; (3) Run: every case with its complete
  prompt to copy and a place to paste the received output; (4) Results: verdicts, manual
  verification, overall measures, the final answer and export. The user MUST be able to go back to
  an earlier step to look, and the current step and progress MUST always be visible.
- **FR-024**: On the Run step the user MUST be able to record which model and settings ran the
  judge (free text, optional). It MUST be stored with the result and shown in the report, and the
  Run step MUST remind the user to run every prompt in a new conversation, so that one case cannot
  influence another.

### Key Entities

- **Judge Package**: A judge definition: prompt template and additional resources. Has a
  version identity.
- **Test Case**: One scenario to be judged, with a name, named input fields, and zero or more expected errors. The final prompt is derived from the judge prompt and the input fields.
- **Expected Error**: What the judge should find in a scenario: the field it is in, a label (free text), an optional fragment, a description, and an optional difficulty (obvious or subtle).
- **Judge Set (Metric)**: The judge prompt, its reply mapping and its error catalog (labels, each with a description and an optional example) for one metric; one evaluation tests one judge set. Accuracy and Completeness are built in.
- **Case Set**: A named collection of test cases evaluated together.
- **Received Output**: The text the judge produced for one case, pasted by the user in any format.
- **Reply Mapping**: The part of a judge set that tells the tool how to read the judge's own JSON reply: the list of parts, the text of a part, its assessment with the values that mean a problem, and optionally its category.
- **Finding**: A part of the judge's reply assessed as a problem; its text is the place it points at.
- **Unexpected Finding**: Something the judge reported that matches no expected error of the case; it counts as a false alarm unless the user adds it to the expected errors as a real error.
- **Evaluation Result**: The measures computed for one judge version on one case set,
  including confidence intervals and the data needed to reproduce it.
- **Result Shelf**: The session's collection of saved, named evaluation results, from which any two can be compared. Not remembered after the page is closed.
- **Comparison**: Two saved evaluation results shown side by side.
- **Metric Definition**: A loadable description of an additional measure and its checks.
- **Verdict**: The Pass or Fail decision for a test case, set by the user or automatically by the tool, with its source.
- **Final Answer**: The conclusion for the evaluated judge (Works, Does not work, Inconclusive), with the thresholds, the minimum sample and the reason it was based on.
- **Verification Opinion**: An external LLM's JSON assessment of one case (which expected errors the judge found, which findings are unexpected), pasted back by the user to help manual verification. It is a proposal until the user approves it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from opening the tool with mock data to seeing
  detection rate and false-alarm rate with confidence intervals in a single session of under
  15 minutes.
- **SC-002**: Two versions of a judge can be compared on the same case set in under 2 minutes
  once both are evaluated.
- **SC-003**: 100% of exported results can be re-imported in a fresh session and show
  identical numbers, judge version and case set.
- **SC-004**: 100% of invalid files (judge files, case files, result files) are rejected
  with a message that tells the user what to fix.
- **SC-005**: Adding a new measure requires only loading one definition file, with no change
  to any other part of the tool.
- **SC-006**: The tool is fully usable with no account, server or database, and no user data
  leaves the device unless exported.
- **SC-007**: Every test case shows an unambiguous status (Pass, Fail, Awaiting verification, Not run) in the results table.
- **SC-008**: A result can be exported as an HTML report that a person without the tool can read, and as JSON that can be re-imported with identical content.
- **SC-009**: 100% of evaluations show exactly one final answer (Works, Does not work, or Inconclusive) together with the thresholds used and the reason, on the results screen and in the report.

## Assumptions

- The primary user is a judge author comfortable with prompts and JSON but not necessarily a
  developer; the secondary audience (people relying on judge results) only reads results.
- Version 1 handles one judge and one case set per evaluation; batch management of many judges
  is out of scope.
- The results always show two overall measures: detection rate and false-alarm rate, plus a combined score that only summarizes them and is not a third metric. The project's
  two built-in metrics are the Accuracy and Completeness judge sets, each tested in its own
  evaluation; further metrics are loaded as judge set files, and additional measures (agreement
  with human assessment, stability, rule compliance) are loaded from definition files.
- The 95% confidence level is the default for confidence intervals; the method may be refined
  in planning.
- The reply mapping is used only for automatic verdicts. A finding points at an expected fragment when the two share their key content after ignoring letter case, spacing and rephrasing; the exact rule, and the line between a clear and a partial match, are set in planning. A judge that returns only an overall rating, with no itemized parts, is out of scope for this version. A false alarm is a finding, in any case clean or not, that matches no expected error and that the user has not added as a real error; a case with output that cannot be read is left for the user.
- In comparisons, a measure is marked "worse" when its value is lower (for detection) or higher (for false alarms) than the previous version, and "clearly worse" when the two confidence intervals do not overlap.
- Compare always shows exactly two results at a time; viewing a trend across many versions is out of scope for this version.
- Exported reports and result files are plain files on the user's device and may contain sensitive
  data from the user's scenarios; protecting or sharing them is the user's responsibility.
- Evaluation sessions are saved by exporting to files; no automatic cloud or server storage.
- The detailed technical document named in the source (`judge-the-judge-specyfikacja.md`) was
  not available; details such as exact file formats are left to planning.
- Success thresholds for the measures (what counts as "good enough") ship with defaults (FR-021)
  and remain the user's choice: they are changed on the results screen or via check configuration.
- Calling an LLM from the tool, evaluating model answers themselves, and public sharing of
  results are out of scope for this version.
- A result describes one judge prompt run on one model. The tool measures only the kinds of errors
  present in the test data: a high detection rate says nothing about kinds of errors that were
  never injected, and the Help says so.
- The judge is a single prompt that gives one reply per test case. A judge built as a chain of
  prompts, where one reply feeds the next prompt, is out of scope for this version.
