# Feature Specification: Bulk Dataset Handling

**Feature Branch**: `002-bulk-dataset-handling`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "How will we handle a dataset so that data is not added one item at a time?" (translated from Polish)

## Clarifications

### Session 2026-11-08

- Q: What file formats are used for bulk datasets and judge answers? → A: Test cases load from CSV or JSON; judge answers load from JSON; datasets always export as JSON.
- Q: Should the tool remember the loaded dataset and answers after the page is closed? → A: No; work exists only for the current page session and is saved only by exporting to a file.
- Q: How is each case identified so answers match the right case? → A: Use the identifier from the file when present; otherwise assign numbers by row order and tell the user.
- Q: When can the user see the full prompt that goes to the LLM? → A: Whenever a dataset and a judge are present, including while the dataset is still being built. The complete composed prompt for any chosen case is shown ready to copy, both when building the dataset and on the Run page. Only export of the whole prompt batch and answer entry wait for finalizing.
- Q: What does the user see for each case when working with prompts? → A: Each case has a name (optional in files; shown as "Case <id>" when empty). Where the dataset is built, two collapsible prompt areas are shown for a chosen case: a ready-made prompt for generating test data from that case, and the complete final prompt for the judge. On the Run page the user sees, for the chosen case, its name, its data, the complete prompt to copy, and a place to enter the result.
- Q: Can the judge prompt and test cases change after they are loaded? → A: Not once the dataset is finalized. A dataset loaded from a file stays open (it can still receive hand-made cases, see feature 003) until the user finalizes it; from then on the judge and cases stay fixed for the evaluation, and the user supplies judge answers either one by one or all at once from a file. Changing the judge or cases means starting a new evaluation.
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

### User Story 1 - Import a whole dataset of test cases at once (Priority: P1)

A user loads one file containing many test cases (up to 500) and gets a named dataset
ready for evaluation, instead of entering cases one by one. The tool checks the whole file and
shows a summary before anything is accepted: how many cases were found, how many are defective
and how many clean, and which rows have problems.

**Why this priority**: Without bulk import the tool is unusable for realistic sample sizes, and
small samples make the results unreliable.

**Independent Test**: Load a file with 100 cases (some deliberately invalid) and verify the
summary shows correct counts and lists every invalid row with the reason.

**Acceptance Scenarios**:

1. **Given** a valid dataset file, **When** the user loads it, **Then** a summary shows the
   number of cases, the split between defective and clean, and the dataset is loaded. It stays open until the user finalizes it (see User Story 6).
2. **Given** a file where some rows are invalid, **When** the user loads it, **Then** the
   summary lists each invalid row with its position and reason, and the user chooses to import
   only the valid rows or to cancel.
3. **Given** a file in an unsupported or newer format version, **When** the user loads it,
   **Then** the tool explains what is not supported and changes nothing.
4. **Given** the user is unsure of the format, **When** they ask for a template, **Then** they
   can download an example dataset file with instructions.

---

### User Story 2 - Export all prompts in one go (Priority: P1)

A user exports the composed prompts for the whole dataset as a single file, runs them in their
LLM tool in bulk outside this tool, and does not have to copy prompts one by one.

**Why this priority**: Copying hundreds of prompts one at a time defeats the purpose of bulk
loading.

**Independent Test**: Export prompts for a 50-case dataset and verify the file contains exactly
50 prompts, each identifiable by its case identifier.

**Acceptance Scenarios**:

1. **Given** a loaded dataset and judge, **When** the user exports prompts, **Then** one file
   contains a prompt for every case, each labeled with its case identifier.
2. **Given** some cases already have answers, **When** the user exports prompts, **Then** they
   can choose to export all cases or only those still unanswered.

---

### User Story 3 - Import all judge answers in one go (Priority: P1)

A user loads one file (or pastes one block) holding many judge answers, each tied to its case
identifier. The tool matches them to the dataset, validates each answer, and reports what was
accepted and what was not.

**Why this priority**: Completes the bulk loop: dataset in, prompts out, answers in, results.

**Independent Test**: Import a file with answers for 50 cases, 3 of which are malformed and 2
of which refer to unknown cases, and verify 45 are accepted and 5 are reported with reasons.

**Acceptance Scenarios**:

1. **Given** a loaded dataset, **When** the user imports an answers file, **Then** valid
   answers are attached to the right cases and a summary shows accepted, rejected, and
   still-missing counts.
2. **Given** an answer refers to a case identifier that does not exist, **When** imported,
   **Then** it is listed as unmatched and ignored.
3. **Given** a case already has an answer, **When** a new answer for it is imported, **Then**
   the user is asked whether to keep the old answers or replace them, with one choice for all.
4. **Given** several answers for the same case in one file, **When** imported, **Then** the
   tool reports the conflict and does not silently pick one.

---

### User Story 4 - Manage datasets as reusable, named sets (Priority: P2)

A user keeps datasets as files, each with a name and a version, and loads the same dataset file
again to evaluate different judges or judge versions. A dataset can be exported back to a file and
is identifiable by its content so results can be tied to the exact dataset.

**Why this priority**: Fair comparison of judge versions depends on identical datasets.

**Independent Test**: Load one dataset, evaluate two judge versions on it, and confirm both
results reference the same dataset name and version; load a file in which one case differs
and confirm it is recognized as a different version.

**Acceptance Scenarios**:

1. **Given** a loaded dataset, **When** the user views it, **Then** its name, version, case
   count, and defective/clean split are visible.
2. **Given** a dataset is exported and re-imported, **When** compared, **Then** it is
   recognized as identical.
3. **Given** the user loads a dataset file whose content differs from the one used for
   existing results, **When** loading, **Then** it is treated as a different dataset version
   and a new evaluation is started (see User Story 6).

---

### User Story 5 - Browse a large dataset (Priority: P3)

A user can search, filter (defective, clean, answered, unanswered, flagged), sort, and page
through a large dataset to check what was loaded. Once the dataset is fixed, cases cannot be changed.

**Why this priority**: Useful for inspection, but the product works without it.

**Independent Test**: Load 500 cases, filter to "defective and unanswered", and confirm the list and count are correct.

**Acceptance Scenarios**:

1. **Given** a large dataset, **When** the user applies filters or search, **Then** the list
   shows only matching cases with a count.
2. **Given** the user looks at a case, **When** they open it, **Then** they see its full text,
   type, expected findings, and its answer if one exists, without any option to change it.

---

### User Story 6 - Supply answers one by one or all at once (Priority: P1)

A loaded dataset stays open (see feature 003 for adding cases by hand) until the user finalizes it. After that the judge and test cases stay fixed, and the user can provide judge
answers one case at a time, or load all of them from a file, or combine both (for example load
most from a file and paste a few missing ones). To use a different judge or different cases, the
user loads them again, which starts a new evaluation.

**Why this priority**: This is the exact working flow the user described; the rest of the
feature depends on it.

**Independent Test**: Load a judge and cases, load answers for 40 of 50 cases from a file, add
the remaining 10 one by one, and see complete results.

**Acceptance Scenarios**:

1. **Given** the dataset is finalized, **When** the user supplies an answer for one case,
   **Then** it is attached to that case and the progress count increases.
2. **Given** the dataset is finalized, **When** the user loads an answers file, **Then**
   answers are attached to their cases as described in User Story 3.
3. **Given** some answers exist, **When** the user adds more by either route, **Then** the
   earlier answers are kept unless the user explicitly chooses to replace them.
4. **Given** the user loads a different judge or different cases, **When** a finalized evaluation
   already has answers, **Then** the tool warns that answers will be discarded, offers to
   export the current work first, and starts a new evaluation only after the user confirms.
5. **Given** a loaded dataset that is not finalized, **When** the user looks for prompt export or
   answer entry, **Then** the tool asks them to finalize the dataset first.

---

### Edge Cases

- Empty file, file with only a header, or file with a single case.
- A file with more than 500 cases: the tool rejects it with a clear message stating the limit and how many cases were found, and suggests splitting it.
- Duplicate case identifiers within one file: the file is reported as invalid for those rows and the user chooses to import only the valid rows or cancel.
- A file where only some cases have identifiers: the tool rejects the mix and asks the user to supply identifiers for all cases or for none.
- Text containing quotes, commas, line breaks, or non-English characters.
- Different line-ending or text-encoding conventions.
- Dataset with only defective cases or only clean cases (some measures cannot be computed;
  the tool must say so clearly).
- Import is interrupted halfway: the previously loaded dataset must remain intact.
- The page is closed or reloaded with unsaved work: the work is lost, so the tool warns before
  leaving the page whenever there are unexported changes.
- Answers file produced from a different dataset version than the one loaded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to load many test cases from a single file in one action.
- **FR-002**: The system MUST validate the entire file before accepting it and present a
  summary: total cases, defective count, clean count, and a list of invalid rows with position
  and reason.
- **FR-003**: Users MUST be able to choose to import only valid rows or cancel when invalid
  rows exist; a cancelled or failed import MUST NOT change the currently loaded dataset.
- **FR-004**: The system MUST provide downloadable template dataset files (CSV and JSON) with
  instructions and an example.
- **FR-004a**: The system MUST accept test cases from CSV or JSON files, judge answers from JSON,
  and MUST export datasets as JSON. For CSV, it MUST handle text containing commas, quotes, line
  breaks, and Polish and other non-English characters, and report unreadable files clearly.
- **FR-004b**: In CSV, each input field MUST be a column named `field:<name>` (a plain `text` column
  is accepted as a single field), and expected errors MUST be one cell using the one-line convention
  `field | label | "fragment" | description` (optionally ending with `| obvious` or `| subtle`), with
  several errors separated by ` ;; `. In JSON, a
  scenario has `name`, `fields` (name to text) and `expected_errors` (list of objects with `field`,
  `label`, `fragment`, `description` and optionally `difficulty`), and optionally `base` (the scenario it was made from, see
  feature 003). The template files MUST show both.
- **FR-005**: Users MUST be able to export the composed prompts for all cases (or only
  unanswered cases) as one file, with each prompt labeled by its case identifier.
- **FR-006**: Users MUST be able to import many judge answers at once, from a file or a pasted
  block, each linked to a case identifier.
- **FR-007**: The system MUST accept each imported received output as text of any format and
  attach it to its case by identifier, and MUST report accepted, rejected (empty output or
  unreadable file entry), unmatched, duplicate, and still-missing counts, with the reason for each
  rejected item. It MUST NOT reject an output because of its format.
- **FR-008**: When imported answers overlap with existing ones, the system MUST ask the user to
  keep or replace them, and MUST NOT overwrite silently.
- **FR-009**: Each dataset MUST have a name and a version derived from its content, so loading
  different content gives a different version.
- **FR-010**: Users MUST be able to export a dataset to a file and re-import it with identical
  content.
- **FR-011**: Every evaluation result MUST record the dataset name and version it was based
  on.
- **FR-012**: Users MUST be able to search, filter, sort, and page a dataset, and to view
  individual cases. Cases cannot be edited in this view; hand-authored datasets are edited only before they are finalized (feature 003).
- **FR-013**: The system MUST remain responsive when handling datasets of up to 500 cases.
- **FR-014**: When an answers file states the dataset version it was produced for, the system
  MUST warn if it differs from the loaded dataset version. Exported prompt batches MUST include
  the dataset version so it can be carried into the answers.
- **FR-015**: The system MUST state clearly when a dataset lacks defective or clean cases and
  therefore some measures cannot be computed.
- **FR-016**: All bulk operations MUST work on files held on the user's device, without
  sending data elsewhere.
- **FR-017**: The built-in Help MUST describe the bulk workflow (template, import, prompt
  export, answer import) with examples that are valid for the current file formats.
- **FR-018**: The system MUST reject a dataset file with more than 500 cases, state the limit and the number found, and leave the currently loaded dataset unchanged.
- **FR-019**: A loaded dataset MUST stay open until the user finalizes it. Once the dataset is
  finalized, the system MUST keep the judge prompt and the cases' input data fixed for the
  evaluation; the expected errors of a case MAY still be edited, because they are the reference the
  received outputs are judged against (automatic verdicts are then recomputed and verdicts set by
  hand are kept). Export of the
  whole prompt batch and answer entry MUST be available only after finalizing. Viewing and copying
  the composed prompt for a single case MUST be available at any time (see FR-023). Loading a different judge or
  different cases MUST start a new evaluation. Changing only the judge MAY keep the finalized
  dataset (see feature 001, "change the judge, keep the cases"). If
  answers exist, the system MUST warn that they will be discarded, offer to export first, and
  proceed only after confirmation.
- **FR-020**: The system MUST let the user supply judge answers one case at a time, or all at
  once from a file, or a mix of both, within the same evaluation.
- **FR-021**: The system MUST NOT retain datasets, answers, or results after the page is closed; it MUST warn the user before they leave or reload the page with unexported changes, and MUST make exporting the current work one clear action.
- **FR-022**: The system MUST use the case identifier supplied in the file when present, otherwise assign identifiers by row order and tell the user, and MUST match imported answers to cases by identifier only.
- **FR-023**: Whenever a judge and at least one case are present, the system MUST show the
  complete prompt that would be sent to the LLM for a chosen case (the judge prompt with the case's
  named input fields filled into its placeholders and nothing else added by the tool), with a single action to copy it. This view MUST be
  available both where the dataset is built and on the Run page, so the user only has to copy and
  paste it into the LLM.
- **FR-024**: On the Run page, for the chosen case, the system MUST show together: the case name,
  the case data (all input fields and its expected errors), the complete prompt with a copy action, and a place
  to paste or type the judge's result with a clear accept action; the user MUST be able to move
  between cases without leaving the page.
- **FR-025**: Where the dataset is built, the system MUST show for the chosen case two prompt areas:
  a ready-made prompt for generating test data from that case, and the complete final prompt for
  the judge. Each MUST have a copy action and MUST be collapsible, with the data-generation prompt
  collapsed by default.

### Key Entities

- **Dataset**: A named, versioned collection of test cases; reusable across judges and judge
  versions.
- **Test Case**: One item in a dataset with a unique identifier, an optional name, named input
  fields, and zero or more expected errors (see the judge evaluation feature).
- **Import Summary**: The report shown after reading a file: counts, invalid rows with
  reasons, and the user's choice on how to proceed.
- **Prompt Batch**: A single file containing a composed prompt for each selected case,
  labeled by case identifier.
- **Answer Batch**: A single file or block containing many received outputs (text of any format),
  each tied to a case identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can load a 100-case dataset and see its summary in under 1 minute from
  choosing the file, with no per-case manual entry.
- **SC-002**: A user can complete the full bulk loop (import dataset, export prompts, import
  answers, view results) for 100 cases with a total of no more than 6 deliberate user actions
  inside this tool, not counting the work done in the external LLM tool.
- **SC-003**: 100% of invalid rows or answers in a bulk import are reported with their
  position and a reason the user can act on.
- **SC-004**: A failed or cancelled import leaves the previously loaded data unchanged in
  100% of cases.
- **SC-005**: Datasets of 500 cases load and can be browsed without the interface becoming
  unresponsive for more than 2 seconds.
- **SC-006**: A dataset exported and re-imported produces identical content and an identical
  version in 100% of cases.
- **SC-007**: First-time users can import a dataset using only the template and Help,
  successfully on the first attempt in at least 90% of trials.

## Assumptions

- This feature extends the evaluation workflow specified in
  `specs/001-judge-evaluation-workflow`; it replaces one-at-a-time entry as the primary way of
  getting test cases in. Test cases come mainly from files. Writing them by hand, including
  injecting defects into clean texts, is covered by `specs/003-manual-case-authoring`; both routes
  build the same dataset, which is fixed once finalized. Judge answers can still be supplied one at a time (User Story 6).
- Test cases can be loaded from CSV (editable in a spreadsheet) or JSON; received outputs are loaded
  from JSON (each entry holds a case identifier and the output text); datasets are always exported as JSON, so no information is lost. Exact field layouts
  are decided in planning.
- CSV is the easy route for preparing cases; several input fields and several expected errors per
  case are expressed through the documented convention in FR-004b.
- Each case has a unique identifier within its dataset. The identifier from the file is used when every case has one; if none have one, the system assigns numbers by row order and tells the user. Answers are matched by identifier, never by position.
- Prompts are run in bulk by the user in their own LLM tool; the product does not call an LLM
  in this version.
- The upper size is 500 cases per dataset (a deliberate simplification); larger sets are out of scope and are rejected with a clear message. The limit may be revisited in a later version.
- Dataset versions are derived from content, so identical content always gives the same
  version.
- Datasets are not stored on a server or remembered between sessions; users keep them as files
  and save work only by exporting.
- Combining or merging two datasets into one is out of scope for this feature.
