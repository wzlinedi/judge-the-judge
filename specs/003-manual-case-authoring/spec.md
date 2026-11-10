# Feature Specification: Manual Test Case Authoring

**Feature Branch**: `003-manual-case-authoring`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "I want to be able to add test cases by hand, with help and with generation of error injection." (translated from Polish)

## Clarifications

### Session 2026-11-08

- Q: How does the tool produce injected-defect suggestions, given it does not call an LLM itself? → A: Both. Built-in rules handle simple labels, and a ready-made prompt for the user's own LLM handles the rest. That prompt must make the LLM return data in a fixed, paste-ready format that the user pastes straight into the tool.
- Q: For which cases is the test-data generation prompt available, and how accurate can it be? → A: It is available for every case, with a goal chosen by the user (add a defect to this text, another variant with the same defect, or write the corrected clean version). Because a prompt alone cannot guarantee an exact result, it carries context (the judge's prompt, the list of labels, and the chosen label's definition and example), and every proposal is reviewed and editable by the user before it becomes a case.
- Q: How are inputs, expected errors and error kinds modelled so that any judge prompt and any metric fits? → A: A test case has a name and any number of named input fields (for example the prompt under review, its input, a context); the judge prompt refers to them with placeholders such as {{field-name}}. An expected error is universal: the field it is in, a label (free text), an optional fragment, and a description of what is wrong. Labels come from metric packs: Accuracy and Completeness are built in and ship with predefined labels, other packs are loaded from definition files, and a dataset may use several packs and add custom labels. Scenarios use one JSON format for files, saves and the LLM test-data round trip; a compact one-line convention (`field | label | "fragment" | description`) is accepted for typing and for CSV cells.
- Q: Can the user paste LLM-injected scenarios directly? → A: Yes. The dataset view always shows an area for pasting what the LLM returned (the scenario JSON format or the one-line convention); it is processed exactly like a file import (validation, summary, user review of every scenario) before anything is added.
- Q: Is a dataset loaded from a file locked immediately or only when the user finalizes it? → A: It stays open until the user finalizes it, whether it came from a file, was built by hand, or both. Prompt export and answer entry are available only after finalizing.
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

### User Story 1 - Add a test case by hand (Priority: P1)

A user creates a test case directly in the tool: they enter a name and the named input fields (for example the
prompt under review and its input) and add zero or more expected errors, each with a field, a label,
an optional fragment and a description. No expected errors means a clean scenario. The case joins the working dataset, where it can still be corrected or removed until the
dataset is finalized.

**Why this priority**: Not every user has a ready file. Writing a handful of cases by hand is the
fastest way to start and the only way to build a first set from nothing.

**Independent Test**: With no data loaded, add one clean and one defective case by hand and see
both in the dataset list with correct type labels.

**Acceptance Scenarios**:

1. **Given** the user opens the case editor, **When** they fill the input fields, add no expected
   errors and save, **Then** the case appears in the dataset marked clean.
2. **Given** the user adds an expected error, **When** they try to save it without a description,
   **Then** the tool explains that a description is required and does not save.
3. **Given** the user saves a case without giving an identifier, **When** it is saved, **Then**
   the tool assigns a unique identifier automatically.
4. **Given** a saved case in a dataset that is not finalized, **When** the user edits or deletes
   it, **Then** the change is applied and the dataset version changes.

---

### User Story 2 - Create a defective case by injecting an error into a clean text (Priority: P1)

A user starts from a correct, clean text and asks the tool to help introduce a specific kind of
defect (for example a contradiction, a wrong number, or a missing step). The tool shows the
original and the modified text side by side, the user can adjust the modified text, and then
saves it as a defective case. The tool records the label and what was changed, so the
expected finding is known without extra typing. The user can also keep the original as a clean
case.

**Why this priority**: Building test cases with deliberately injected defects is the core of
the whole product, and doing it by hand is slow and error-prone.

**Independent Test**: Paste a clean paragraph, choose the label "number mismatch", accept
a suggested change, and save; confirm the new defective case records the type and the change,
and that the original can be saved as a clean case too.

**Acceptance Scenarios**:

1. **Given** a clean text and a chosen label, **When** the user requests an injection,
   **Then** the tool shows the original and a modified version side by side with the changed part
   highlighted.
2. **Given** a suggested modification, **When** the user edits it by hand, **Then** the tool
   keeps the edit and updates the recorded change.
3. **Given** the user is happy with the result, **When** they save, **Then** a defective case is
   created with the label and a record of what was changed, and the user may also save the
   original text as a clean case.
4. **Given** the modified text is identical to the original, **When** the user tries to save,
   **Then** the tool refuses and explains that no defect was introduced.
5. **Given** the chosen label is one the built-in rules can handle, **When** the user
   requests an injection, **Then** the tool proposes a modification immediately.
6. **Given** the chosen label needs an LLM (or the user wants a more natural result),
   **When** the user asks for the ready-made prompt, **Then** the tool composes a prompt from the
   clean text and the label, which the user copies into their own LLM.
7. **Given** the LLM answered in the requested format, **When** the user pastes the answer into
   the tool, **Then** the tool reads it, shows the proposed injected case(s) for review, and the
   user accepts, edits, or discards each one.
8. **Given** the pasted answer is not in the expected format, **When** the user submits it,
   **Then** the tool explains what is wrong and keeps the user's text so nothing is lost.
9. **Given** the tool cannot produce a suggestion by either route, **When** the user requests it,
   **Then** the tool says so and lets the user write the modification by hand.

---

### User Story 3 - Get guidance while building the dataset (Priority: P2)

While authoring, the user sees help: a short description and an example for each label,
and live feedback on the dataset being built, such as how many cases are clean and defective,
whether the balance is poor, whether any text is duplicated, and how far it is from the size limit.

**Why this priority**: The user is not a specialist in test design; guidance prevents weak
datasets (for example, only defective cases) that would make the results meaningless.

**Independent Test**: Build a dataset of only defective cases and see a warning that clean cases
are needed; add a duplicate text and see it flagged.

**Acceptance Scenarios**:

1. **Given** the user selects a label, **When** they view its help, **Then** they see a
   plain-language description and a short example.
2. **Given** the dataset has only defective or only clean cases, **When** the user views it,
   **Then** a warning explains why both kinds are needed.
3. **Given** two cases have identical text, **When** the user views the dataset, **Then** the
   duplicates are flagged.
4. **Given** the dataset is near 500 cases, **When** the user adds cases, **Then** the remaining
   capacity is shown and adding beyond the limit is refused with a clear message.

---

### User Story 4 - Mix hand-made and loaded cases, then finalize (Priority: P2)

A user can combine cases loaded from a file with cases written by hand in one dataset. When
satisfied, they finalize the dataset: they see a summary, confirm, and from that moment the
judge and cases are fixed for the evaluation, as described in the bulk dataset handling
feature. To change them afterwards they start a new evaluation.

**Why this priority**: Real work mixes both routes, and the finalize step keeps results
trustworthy.

**Independent Test**: Load a 10-case file, add 2 cases by hand, finalize, and confirm the dataset
holds 12 cases and can no longer be edited.

**Acceptance Scenarios**:

1. **Given** a dataset loaded from a file that is not yet finalized, **When** the user adds cases
   by hand, **Then** they join the same dataset.
2. **Given** a dataset ready to use, **When** the user chooses to finalize, **Then** a summary
   (counts, balance, warnings) is shown and the dataset becomes fixed only after confirmation.
3. **Given** a finalized dataset, **When** the user looks for editing options, **Then** none are
   offered and a "start new evaluation" action is offered instead.
4. **Given** the user has unexported hand-made cases, **When** they try to leave the page,
   **Then** the tool warns them.

---

### User Story 5 - Define my own labels and test other metrics (Priority: P3)

A user adds their own labels, each with a name and a short description, or loads a judge set file
for another metric in place of the built-in Accuracy and Completeness judge sets, and uses those
labels when authoring and injecting. One evaluation tests one metric.

**Why this priority**: Different judges check different things; built-in types may not fit, but
the product works without custom types.

**Independent Test**: Add a custom label "tone violation", use it on a hand-made case, and
export the dataset; confirm the type is stored with the dataset.

**Acceptance Scenarios**:

1. **Given** the user adds a label with a name and description, **When** they author a
   case, **Then** the new type is selectable.
2. **Given** a label is used by existing cases, **When** the user tries to delete it,
   **Then** the tool refuses and says which cases use it.
3. **Given** a dataset with custom types is exported and reloaded, **When** it is opened,
   **Then** the custom types are present.

---

### User Story 6 - Save the dataset and continue later (Priority: P1)

At any point while building a dataset, the user can save it to a file and later load that file
again to carry on. The saved file holds everything entered so far: the cases, their labels,
the records of injected changes, any custom labels, and the dataset name. Loading it brings
the dataset back as an open dataset, so the user can keep adding and editing cases and finalize it
when ready. The tool shows clearly whether there are changes not yet saved.

**Why this priority**: Building a dataset takes time and nothing is remembered between sessions,
so without a simple save the work would be lost when the page is closed.

**Independent Test**: Add 5 cases (two by injection), save, close and reopen the tool, load the
file, and confirm all 5 cases, their labels and injection records are back and can still be
edited.

**Acceptance Scenarios**:

1. **Given** a dataset with at least one case, **When** the user chooses to save, **Then** a file
   is produced containing all cases, labels, injection records, custom labels, and the
   dataset name.
2. **Given** a saved file, **When** the user loads it later, **Then** the dataset returns as open
   with identical content, even if it was finalized when saved.
3. **Given** the dataset has changes since the last save, **When** the user looks at the dataset,
   **Then** the tool shows that there are unsaved changes, and the indicator clears after saving.
4. **Given** the user already has a dataset with unsaved changes, **When** they load a saved file,
   **Then** the tool warns that the current work will be replaced and offers to save it first.
5. **Given** a saved file that was damaged or edited by hand, **When** the user loads it, **Then**
   the tool reports every problem as described in the bulk dataset feature and does not replace the
   current dataset.

---

### Edge Cases

- Empty text or text consisting only of spaces.
- Very long text; the tool states the maximum allowed length.
- Reaching the 500-case limit while authoring.
- Identifier collision between a hand-made case and a loaded case.
- A pasted LLM answer that is in the wrong format, partly valid, or contains modified texts identical to the original.
- Injection that produces no change, or that changes so much that the original is not
  recognizable.
- Several expected errors in one scenario: allowed; each has its own field, label and fragment.
- A pasted variant that changes more places than its expected errors list, or whose fragment is not
  in the text: flagged during review (FR-005d).
- Deleting a label that is in use.
- The user closes the page with unexported hand-made cases.
- Finalizing an empty dataset or a dataset with only one kind of case.
- Non-English characters in the text.
- Saving an empty dataset: the tool explains there is nothing to save.
- Loading a saved file while the current dataset has unsaved changes.
- A saved file made by a newer version of the tool: reported as unsupported, nothing is changed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create a test case by hand by entering an optional name and the
  text, adding named input fields and zero or more expected errors (field, label, optional fragment,
  description, optional difficulty: obvious or subtle); a scenario with no expected errors is clean.
- **FR-002**: The system MUST refuse to save an expected error without a description, and any case
  with no non-empty input field, and MUST explain why.
- **FR-003**: The system MUST assign a unique identifier to each hand-made case that has none and
  MUST prevent identifier collisions with loaded cases.
- **FR-004**: Until the dataset is finalized, users MUST be able to edit and delete cases; each
  change MUST update the dataset version.
- **FR-005**: Users MUST be able to start from a clean text and request help introducing a chosen
  kind of defect; the system MUST show the original and the modified text side by side with the
  change highlighted. Suggestions MUST come from
  two routes: built-in rules for simple labels, and a ready-made prompt for the user's own
  LLM for the others (see FR-005a).
- **FR-005a**: The system MUST provide a ready-made prompt that, together with a clean text and a
  chosen label, makes an external LLM return one or more injected scenarios in the same JSON format as scenario
  files (each with its name, fields, and expected errors), or in the one-line convention, ready to
  paste. The prompt MUST state the target field, the number of errors, and the labels to use. The system MUST accept that answer pasted directly, validate it, show the proposed
  cases for review, and reject malformed input with a clear message without discarding the pasted
  text. The prompt MUST carry context to improve accuracy: the judge's prompt (so the LLM knows what the judge
  checks), the error catalog's labels with their definitions and examples, and the base scenario's fields. It MUST be
  available for any case with a user-selected goal (add a defect, another variant with the same
  defect, or a corrected clean version); a proposal for a clean version is saved as a clean case.
  The system MUST make clear that results are proposals to review, not guaranteed outputs.
- **FR-005b**: The dataset view MUST always show an area for pasting the LLM's answer. Its content MUST
  be processed exactly like a file import (validation, summary with problems and reasons, user
  review of each scenario) before anything is added, and malformed input MUST NOT discard the
  pasted text.
- **FR-005c**: The system MUST accept expected errors in the one-line convention
  `field | label | "fragment" | description` (optionally ending with `| obvious` or `| subtle`)
  wherever scenarios are typed, pasted or loaded.
- **FR-005d**: A scenario made from another scenario (a variant with injected errors) MUST keep a
  reference to its base scenario (`base` in the scenario JSON, which the generation prompts ask the
  LLM to return). During review the system MUST show the differences between the base and the
  variant, and MUST warn when a changed place is covered by no expected error or when an expected
  error's fragment does not occur word for word in the field it names. The user decides whether to
  fix, accept or discard the scenario.
- **FR-005e**: The prompts that generate errors MUST explain the two difficulty levels, ask the LLM
  to mark each error as obvious or subtle, and ask for a mix of both (half of each by default,
  adjustable). The user MUST be able to change the difficulty of any expected error.
- **FR-006**: Users MUST be able to edit the suggested modification by hand before saving.
- **FR-007**: When saving an injected case, the system MUST record the label and a
  description of what was changed, and MUST reject a modification identical to the original.
  The system MUST also record the exact fragment the error is at, because automatic matching of the
  judge's findings uses it: for an error present in the text, the changed fragment of that field;
  for an omission, the fragment of the input that the output no longer covers (the expected error
  then names the input field).
- **FR-008**: Users MUST be able to save the original clean text as a clean case together with
  the injected one.
- **FR-009**: The system MUST show, for each label, a plain-language description and an
  example.
- **FR-009a**: For any chosen case, the ready-made prompt for generating test data (see FR-005a) MUST be
  visible and copyable directly from the dataset view without opening a separate dialog, in a
  collapsible area (collapsed by default), next to the complete final judge prompt (see the bulk
  dataset feature).
- **FR-010**: The system MUST show live dataset feedback: counts of clean and defective cases,
  warnings for missing kinds, flagged duplicate texts, and remaining capacity up to 500 cases.
- **FR-011**: Users MUST be able to combine hand-made cases with cases loaded from a file in one
  dataset before finalizing.
- **FR-012**: Users MUST be able to finalize the dataset after seeing a summary; once finalized,
  the system MUST NOT offer editing of cases and MUST offer starting a new evaluation instead.
  A dataset loaded from a file MUST stay open until finalized, and prompt export and answer
  entry MUST be available only after finalizing. The summary MUST warn when the judge set has no
  working reply mapping, because every case will then need manual or LLM-assisted
  verification (see the judge evaluation feature, FR-006a). The summary MUST also warn when no
  expected error is marked subtle, because the result would then say nothing about subtle errors.
- **FR-013**: Users MUST be able to add custom labels with a name and description. One evaluation
  MUST test one metric, defined by a judge set (the judge prompt plus its error catalog). Accuracy
  and Completeness MUST be built in as ready judge sets; other metrics MUST be loadable as a judge
  set file or a pasted label list. The system MUST prevent deleting a label that existing cases use.
- **FR-014**: Hand-made cases and custom labels MUST be included when the dataset is
  exported and restored when it is loaded.
- **FR-014a**: Users MUST be able to save the working dataset to a file at any time, whether or
  not it is finalized. The file MUST contain the dataset name, all cases, their labels, the
  injection records, and the error catalog (including any custom labels).
- **FR-014b**: Loading a saved file MUST restore the dataset as open (editable, not finalized)
  with identical content, and MUST validate it using the same rules and reports as any dataset
  file (see the bulk dataset feature).
- **FR-014c**: The system MUST show whether the dataset has unsaved changes, and MUST warn before
  a load or a new evaluation would replace a dataset that has unsaved changes, offering to save it
  first.
- **FR-015**: The system MUST warn the user before they leave or reload the page with unexported
  hand-made cases, and MUST NOT remember them afterwards.
- **FR-016**: All authoring MUST work on the user's device without sending data elsewhere.
- **FR-017**: The built-in Help MUST explain manual authoring, error injection, labels, and
  finalizing, with examples.

### Key Entities

- **Test Case**: As defined in the judge evaluation and bulk dataset features; may be created by
  hand or by injection. Has a name, named input fields, zero or more expected errors, a record of the
  injected change for injected errors, and a unique identifier.
- **Judge Set (Metric)**: The judge prompt, its reply mapping and its error catalog for one metric. One evaluation
  tests one judge set. Accuracy and Completeness are built in; others are loaded from a judge set file.
- **Label**: A named kind of issue with a description and an example, held in the error catalog,
  whether it came from a judge set or was defined by the user.
- **Injection Suggestion**: A proposed defective case (modified text, label, description of the change) produced by a built-in rule or pasted from an external LLM, awaiting the user's review.
- **Injection Record**: The description of what was changed in a clean text to create a
  defective case, linking the injected case to its original text.
- **Working Dataset**: The set of cases being built or loaded, editable until finalized.
- **Dataset Summary**: The overview shown before finalizing: counts, balance, warnings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can add a clean test case by hand in under 1 minute.
- **SC-002**: A user can create a defective case from a clean text with an injected error in under
  2 minutes.
- **SC-003**: 100% of injected cases carry a label and a record of what was changed.
- **SC-004**: 100% of attempts to save an invalid case (empty text, an expected error without a description, unchanged
  injection) are refused with a message the user can act on.
- **SC-005**: A user building a one-sided dataset (only clean or only defective) is warned in
  100% of cases before finalizing.
- **SC-006**: A dataset built partly by hand and partly from a file can be exported and reloaded
  with identical content in 100% of cases.
- **SC-007**: At least 90% of first-time users complete a small dataset (5 cases, mixed) using
  only the in-tool help.
- **SC-008**: A user can go from a clean text to reviewed injected cases using the ready-made prompt
  and a single paste, with no manual re-typing of the LLM's answer.
- **SC-009**: A dataset saved and reloaded in a later session has identical content in 100% of
  cases, and a user can resume editing within 1 minute of choosing the file.

## Assumptions

- This feature extends `specs/002-bulk-dataset-handling` and `specs/001-judge-evaluation-workflow`:
  hand-made cases are an additional way into the same dataset. Cases may be edited until the
  dataset is finalized; after that the rules of the bulk dataset feature apply (fixed for the
  evaluation, new evaluation to change).
- The 500-case dataset limit, case identifier rules, and no-persistence rule from the bulk
  dataset feature apply here too.
- The product does not call an LLM in this version. Error injection therefore works through
  built-in rules (simple labels such as number mismatch or missing step) and through a
  prompt the user runs in their own LLM; the exact set of rule-based types is decided in planning.
- The paste-ready format for injected cases is fixed by the tool, documented in Help, and the
  ready-made prompt asks the LLM for exactly that format.
- The built-in Accuracy judge set initially has the labels: factual-error, contradiction, wrong-number,
  unsupported-claim, and misattribution. The built-in Completeness judge set initially has: missing-information,
  missing-step, omitted-requirement, partial-answer, and missing-caveat. Each label has a description
  and an example; exact sets are refined in planning.
- A case can have any number of expected errors; an injected case starts with the errors returned by
  the injection, and further expected errors can be added by hand.
- The injection record is for the user's reference and for matching the judge's findings; it is
  not shown to the judge.
- Saving to a file is the only way to keep work between sessions; nothing is remembered
  automatically, in line with the no-persistence rule of the bulk dataset feature. The save file is
  the same JSON dataset file used for export.
- Dataset export (JSON) carries the cases, their labels, the injection records, and any
  custom labels.
