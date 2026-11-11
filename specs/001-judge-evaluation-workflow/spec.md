# Feature Specification: Judge the Judge

**Feature Branch**: `001-judge-evaluation-workflow`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User descriptions (translated from Polish):
- "judge-the-judge high-level document: a tool that evaluates LLM-as-judge judges. Users supply a judge prompt package (from a file or typed/pasted in the app), prepare test cases with deliberately injected defects plus clean cases, run the composed prompt in an LLM outside the tool and paste back the JSON answer, then see how well the judge performs (detection rate, false alarms, with confidence intervals), compare two judge versions, and reproduce any past result. Runs without infrastructure, accounts or database; data stays on the user's device."
- "How will we handle a dataset so that data is not added one item at a time?" (formerly spec 002, bulk dataset handling)
- "I want to be able to add test cases by hand, with help and with generation of error injection." (formerly spec 003, manual case authoring)

## Clarifications

This one specification replaces the former specs 001, 002 (bulk dataset handling) and 003 (manual
case authoring). Every answer below is current; answers that were later replaced were removed on
2026-11-11 (the full history is in git).

### Session 2026-11-08

- Q: What is a test case, and what stays fixed? → A: A test case (also called a scenario) has a name, named input fields (its input data), zero or more expected errors (each with a description and optionally a field, label and fragment), and a final prompt. The prompt is the judge template with the case's input fields filled into its placeholders and nothing else added by the tool. The prompt input stays unchanged during testing; what the user adjusts is the expected output (the expected errors).
- Q: How are results shown while some cases still await manual review? → A: Results are computed from the already decided cases, clearly labeled provisional, with the number of pending cases shown.
- Q: How are inputs, expected errors and error kinds modelled so that any judge prompt and any metric fits? → A: A test case has a name and any number of named input fields (for example the prompt under review, its input, a context); the judge prompt refers to them with placeholders such as {{field-name}}. An expected error is universal: the field it is in, a label (free text), an optional fragment, and a description of what is wrong. Labels come from the dataset's error catalog. Scenarios use one JSON format for files, saves and the LLM test-data round trip; a compact one-line convention (`field | label | "fragment" | description`) is accepted for typing and for CSV cells.
- Q: Are the initial label sets and the placeholder syntax acceptable? → A: Yes to the initial Accuracy and Completeness label sets (see Assumptions), and the placeholder syntax stays `{{field-name}}`.
- Q: Does each test case have its own full prompt? → A: No. One judge prompt serves the whole evaluation and each test case supplies its own input data; the final prompt for a case is composed from the two. Expected errors may still be adjusted for a case after the dataset is finalized, because they are the reference the received outputs are judged against; input data and the judge prompt stay fixed. Automatic verdicts are recomputed after such a change and verdicts set by hand are kept.
- Q: Do exported reports and result files always contain the full prompts and received outputs? → A: Yes, always. Reports and result files contain the real, full data (final prompts with the actual input data, expected errors, received outputs, verdicts), with no option to leave it out, so that every result can be reproduced and verified. The Help states that exported files contain the user's data and should be handled accordingly.
- Q: How are results presented? → A: As two linked tables. The top table lists every test case with its name, kind, status (Pass, Fail, Awaiting verification, Not run), number of expected errors, whether output was received, the source of the verdict, and the reported error types, under a strip with the overall measures (detection rate and false-alarm rate with 95% intervals). The detailed table below shows, per test case: the full tested prompt, the expected errors, the received output with a place to paste it, and a place for manual verification. Selecting a row in the top table jumps to or filters the matching detail. The result can be saved to JSON and exported as an HTML report.
- Q: Where do saved results live for comparison? → A: Both. Results go on a session "shelf" in the tool's memory for the duration of the session, and each result can also be exported to a file and imported back later. Compare picks any two results from the shelf, whether they were saved in this session or imported.
- Q: What file formats are used for bulk datasets and judge answers? → A: Test cases load from CSV or JSON; judge answers load from JSON; datasets always export as JSON.
- Q: Should the tool remember the loaded dataset and answers after the page is closed? → A: No; work exists only for the current page session and is saved only by exporting to a file.
- Q: How is each case identified so answers match the right case? → A: Use the identifier from the file when present; otherwise assign numbers by row order and tell the user.
- Q: When can the user see the full prompt that goes to the LLM? → A: Whenever a dataset and a judge are present, including while the dataset is still being built. The complete composed prompt for any chosen case is shown ready to copy, both when building the dataset and on the Run page. Only export of the whole prompt batch and answer entry wait for finalizing.
- Q: What does the user see for each case when working with prompts? → A: Each case has a name (optional in files; shown as "Case <id>" when empty). Where the dataset is built, two collapsible prompt areas are shown for a chosen case: a ready-made prompt for generating test data from that case, and the complete final prompt for the judge. On the Run page the user sees, for the chosen case, its name, its data, the complete prompt to copy, and a place to enter the result.
- Q: Can the judge prompt and test cases change after they are loaded? → A: Not once the dataset is finalized. A dataset stays open until the user finalizes it, whether it came from a file, was built by hand, or both; prompt export and answer entry are available only after finalizing, and from then on the judge and cases stay fixed for the evaluation, and the user supplies judge answers either one by one or all at once from a file. Changing the judge or cases means starting a new evaluation.
- Q: For which cases is the test-data generation prompt available, and how accurate can it be? → A: It is available for every case, with a goal chosen by the user (add a defect to this text, another variant with the same defect, or write the corrected clean version). Because a prompt alone cannot guarantee an exact result, it carries context (the judge's prompt, the list of labels, and the chosen label's definition and example), and every proposal is reviewed and editable by the user before it becomes a case.
- Q: Can the user paste LLM-injected scenarios directly? → A: Yes. The dataset view always shows an area for pasting what the LLM returned (the scenario JSON format or the one-line convention); it is processed exactly like a file import (validation, summary, user review of every scenario) before anything is added.
- Q: What does "two data sets" mean? → A: Every scenario normally carries two pieces of data: the **input** (what the evaluated model was asked) and the **output** (what it answered). The judge considers both, for example to check accuracy and completeness of the output against the input, so the tool provides a place to enter both. Errors are injected into the output (the input stays unchanged) and expected errors point at the `output` field by default. These are two ordinary named fields (`input`, `output`), not a separate mechanism: more fields (for example a context) remain possible, and the judge prompt uses `{{input}}` and `{{output}}`. New scenarios and the built-in mock data start with these two fields; the LLM injection round trip rewrites the `output` field.
- Q: Is the input always required? → A: No. Which fields a scenario has is decided by the placeholders in the judge prompt. A judge that only examines the output (for example one checking for biased wording) uses just `{{output}}`; then scenarios have a single `output` field and no `input` is requested, shown or required in files. Input and output together are the common case, not a rule. Such a judge's error labels (for example `bias`) come from a custom label or a pasted list.
- Q: What is the error catalog and how is it filled? → A: A **single flat list** of error kinds (name plus optional description) that belongs to the dataset. The user types or edits it, or **pastes a plain-text list with one category per line** (optionally `name - description`, also accepted with `:` or `|`); names are normalized to lower-case with dashes, and names already in the list are skipped and reported. Two built-in starters, **Populate for accuracy** and **Populate for completeness**, fill a ready judge prompt (with `{{input}}`, `{{output}}` and a JSON reply block) with its reply mapping and a matching catalog, asking before replacing existing content; they are the only built-in starting points. A prompt for another kind of judge is typed or pasted, with its error list pasted as text.
- Q: How is the error catalog updated when a new kind of error is needed later? → A: While writing expected errors, the label stays free text; a label that is not yet in the catalog is normalized (lower-case, dashes) and **added to the catalog automatically**, with a short confirmation. The judge prompt is not changed by this.
- Q: How detailed and pre-filled must the prompt for generating test data be, and should clean scenarios come first? → A: The generation prompts are detailed and **pre-filled** from what the user has already set: the judge prompt, the error catalog with each label's meaning and example, the scenario fields with their roles (input stays as written, output is where errors go), the rules for realistic and subtle errors, exact-fragment quoting and the JSON reply shape, and, for adding errors, the clean scenarios already in the dataset. The user can **add own changes** in an "own changes" box that is appended with priority, and can edit the prompt text directly; changing an option rebuilds the prompt. Generation is **two steps**: (1) a few **clean scenarios first** (count and optional topic), which are the base for errors and measure false alarms; (2) variants of those clean scenarios with errors (variants per scenario, errors per variant), spreading the catalog's categories evenly. The per-scenario "prompt for generating test data" uses the same detailed template and the same "own changes" box. Both steps return the same scenario JSON, pasted into the existing paste area.

### Session 2026-11-10

- Q: Does one evaluation test one judge or several at once? → A: One judge. Accuracy and Completeness judges are each tested in their own evaluation, with their own test cases and their own report.
- Q: Is detection counted per injected error or per test case? → A: Per error. The detection rate is the expected errors found divided by all expected errors, with a breakdown per error label (expected, found, missed, rate). The judge must also not report more than was expected: an **unexpected finding** (one that matches no expected error) counts against the judge in any case, clean or not. A case passes only when every expected error is found and nothing unexpected is reported. In manual verification the user marks each expected error as found or not found, and for an unexpected finding either confirms it as a false alarm or adds it to the expected errors as a real error.
- Q: On what basis does the tool give the final answer "the judge works / does not work"? → A: Thresholds and a minimum sample. Defaults: detection rate at least 80% and false-alarm rate at most 10%, editable in the collapsed "Evaluation settings" section of the results screen. The final answer is **Works** when both thresholds are met, **Does not work** when either is not, and **Inconclusive** when cases are not run or still await verification, or the sample is too small (fewer than 30 expected errors or fewer than 10 clean cases, fixed in the tool). Confidence intervals are shown beside it, with a "borderline" note when an interval includes its threshold. The values used are stored with the result and shown in the report. Because the user tests narrative texts in which exact errors are hard to pin down, the tool also prepares a **verification prompt** for the user's own LLM (case data, expected errors, received output); the LLM returns a JSON opinion that the user pastes back into the manual verification of the case.
- Q: Does the external LLM's verification opinion count at once as a verdict, or only after the user approves it? → A: Only after approval. The opinion fills the manual verification marks (each expected error found or not, unexpected findings) with its reasons as a proposal; the case stays Awaiting verification until the user approves it, one case at a time or all proposals in one action, and the user may edit it first. An approved verdict records its source as "LLM opinion, approved by the user", and the report shows the source of every verdict.
- Q: What does the judge prompt return: a list of specific errors or only an overall rating? → A: An itemized list in the judge's own JSON. The user's judges are claim-based: the judge splits the output (for some metrics the input) into smaller parts and returns them as JSON with an assessment of each part. For accuracy each claim of the output is checked against the input; for completeness each element of the input is checked for presence in the output; further metrics follow the same pattern (for example an inference in the output that the input does not justify). The tool therefore reads the judge's own reply through a **reply mapping** (where the list of parts is, which entry holds a part's text, which holds its assessment, and which assessment values mean a problem) instead of requiring a shape of its own. A part assessed as a problem is a **finding**, and its text is the place it points at. Because such a judge names no error categories, an expected error counts as found when a finding points at its fragment; a matching label is not required. The error catalog describes the errors injected into the test data and groups the results; the judge does not have to use it. A judge that returns only an overall rating is out of scope for this version.
- Q: Is the judge one prompt whose single reply holds the parts together with their assessment, or a chain of several prompts? → A: One prompt and one reply per test case; splitting the text and assessing the parts happen together. A judge built as a chain of prompts, where one reply feeds the next prompt, is out of scope for this version.
- Q: Should every injected error carry a difficulty mark, so that results show whether the judge misses only subtle errors? → A: Yes, two levels. An expected error may be marked **obvious** or **subtle**. The prompts that generate errors ask for a mix (half of each by default) and explain both levels; the user can change the mark. Results show the detection rate separately for obvious and for subtle errors, and finalizing warns when the dataset has no subtle errors.
- Q: In which unit are false alarms counted for the final answer? → A: Per finding. The false-alarm rate is the findings that match no expected error (confirmed as false alarms) divided by all findings the judge reported, in clean and defective cases alike, for example "6 of 40 findings were wrong (15%)". The 10% threshold applies to this figure. The share of cases with at least one false alarm, and the same share for clean cases alone, stay beside it as information.
- Q: Should the results show one combined score besides the two measures? → A: Yes, as an addition. A combined score from 0% to 100% (the harmonic mean of the detection rate and the share of correct findings, which is 100% minus the false-alarm rate) is shown beside the two measures, in the report and when comparing judge versions. It falls both when errors are missed and when false alarms are raised. The final answer still rests on the two thresholds, not on the combined score.

### Session 2026-11-11

- Q: How should the results screen show the thresholds and the minimum sample? → A: Simply. The final answer (with its one-line reason) and the two measures (detection rate, false-alarm rate) are on top. The two thresholds move to a collapsed "Evaluation settings" section, closed by default, where each field has a one-sentence plain-language explanation. The logic of the final answer is unchanged.
- Q: How does the user see whether the dataset is big enough for a final answer? → A: The counts are computed automatically from the test cases and shown with the results as a "Test size" summary: total cases (judge runs), clean cases, cases grouped by number of injected errors (for example "10 cases with 2 errors"), total injected errors, and each total against its minimum (met / missing N). The user never enters or calculates these numbers.
- Q: Where does the minimum test size come from, if the user does not enter it? → A: It is fixed in the tool: 30 injected errors and 10 clean scenarios, not editable. The results state plainly that the system needs at least 30 injected errors and 10 clean scenarios to give a final answer. All Help is written in plain, everyday language.
- Q: Should the three specifications (001 evaluation workflow, 002 bulk dataset handling, 003 manual case authoring) stay separate? → A: No. They are merged into this one specification, with duplicates removed and requirements, user stories and success criteria renumbered in one sequence, followed by one plan and one task list.
- Q: Is the judge one concept, and where does the list of error kinds live? → A: The judge is only the prompt (with placeholders for the case fields) plus the reply mapping that tells the tool how to read its answers; the "judge package" with "additional resources" is dropped. Only the prompt is supplied from outside; all test data (inputs, outputs, injected errors) is built by the user. The error catalog belongs to the dataset, not to the judge. A test case holds the data given to the judge and the list of injected errors.
- Q: Should the tool have its own built-in rules for injecting errors, or is the generation prompt for the user's LLM enough? → A: The prompt is enough, plus editing by hand. There are no built-in rules that change text; they would give artificial, easy-to-spot errors in narrative texts and overstate the detection rate.
- Q: How long may one text in a test case be? → A: Up to 100,000 characters per field, with a warning above 30,000 characters that the prompt may not fit the model's context window; longer fields are refused with the limit stated.
- Q: Should answers that were later replaced be removed from this section? → A: Yes. Superseded answers were removed and the remaining ones trimmed to what still holds; the full history is in git.

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

1. **Given** a loaded judge and a loaded test case set, **When** the user opens a case,
   **Then** the tool shows the fully composed prompt ready to copy.
2. **Given** a composed prompt was run externally, **When** the user pastes the received output
   for that case (any text), **Then** the tool accepts it, shows it next to the expected errors, and
   marks the case as awaiting verification unless an automatic verdict can be made (scenario 4).
3. **Given** all cases have a verdict, **When** the user opens the results, **Then** they see every
   case with its status, plus the detection rate and false-alarm rate with confidence intervals.
4. **Given** the received output can be read through the judge's reply mapping, **When** it is
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
directly in the app. Both routes produce the same judge: the prompt, with placeholders for the
test data (such as {{input}} and {{output}}), and the reply mapping that tells the tool how to read
the judge's answers. Only the prompt is given from outside; all test data is built by the user in
the tool. The tool uses the prompt exactly as written and adds nothing to it. A judge
typed in the app can be saved to a file so it is not lost.

**Why this priority**: Without a judge there is nothing to evaluate; two entry routes keep the
barrier to entry low.

**Independent Test**: Create a judge by typing it in the app, save it to a file, reload it from
that file, and confirm it behaves identically to the typed version.

**Acceptance Scenarios**:

1. **Given** a valid judge file, **When** the user loads it, **Then** the judge appears
   with its prompt and reply mapping.
2. **Given** the user typed a judge in the app, **When** they save it, **Then** a file is
   produced that reloads into an identical judge.
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

### User Story 4 - Add a test case by hand (Priority: P1)

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

### User Story 5 - Create a defective case by injecting an error into a clean text (Priority: P1)

A user starts from a correct, clean text and asks the tool to help introduce a specific kind of
defect (for example a contradiction, a wrong number, or a missing step). The tool shows the
original and the modified text side by side, the user can adjust the modified text, and then
saves it as a defective case. The tool records the label and what was changed, so the
expected finding is known without extra typing. The user can also keep the original as a clean
case.

**Why this priority**: Building test cases with deliberately injected defects is the core of
the whole product, and doing it by hand is slow and error-prone.

**Independent Test**: Paste a clean paragraph, choose the label "wrong-number", copy the ready-made
prompt into an LLM, paste its answer back, accept a proposed change, and save; confirm the new defective case records the type and the change,
and that the original can be saved as a clean case too.

**Acceptance Scenarios**:

1. **Given** a clean text and a proposed modification (pasted from the LLM or written by hand),
   **When** the user reviews it, **Then** the tool shows the original and a modified version side by side with the changed part
   highlighted.
2. **Given** a suggested modification, **When** the user edits it by hand, **Then** the tool
   keeps the edit and updates the recorded change.
3. **Given** the user is happy with the result, **When** they save, **Then** a defective case is
   created with the label and a record of what was changed, and the user may also save the
   original text as a clean case.
4. **Given** the modified text is identical to the original, **When** the user tries to save,
   **Then** the tool refuses and explains that no defect was introduced.
5. **Given** a clean text and a chosen label, **When** the user asks for the ready-made prompt, **Then** the tool composes a prompt from the
   clean text and the label, which the user copies into their own LLM.
6. **Given** the LLM answered in the requested format, **When** the user pastes the answer into
   the tool, **Then** the tool reads it, shows the proposed injected case(s) for review, and the
   user accepts, edits, or discards each one.
7. **Given** the pasted answer is not in the expected format, **When** the user submits it,
   **Then** the tool explains what is wrong and keeps the user's text so nothing is lost.
8. **Given** the user does not want to use an LLM, **When** they choose to edit by hand, **Then**
   the tool gives them a copy of the clean text to change and records what was changed.

---

### User Story 6 - Import a whole dataset of test cases at once (Priority: P1)

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
   number of cases, the split between defective and clean, and the dataset is loaded. It stays
   open until the user finalizes it (see User Story 13).
2. **Given** a file where some rows are invalid, **When** the user loads it, **Then** the
   summary lists each invalid row with its position and reason, and the user chooses to import
   only the valid rows or to cancel.
3. **Given** a file in an unsupported or newer format version, **When** the user loads it,
   **Then** the tool explains what is not supported and changes nothing.
4. **Given** the user is unsure of the format, **When** they ask for a template, **Then** they
   can download an example dataset file with instructions.

---

### User Story 7 - Save the dataset and continue later (Priority: P1)

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
   the tool reports every problem as for any dataset file (see User Story 6) and does not replace
   the current dataset.

---

### User Story 8 - Export all prompts in one go (Priority: P1)

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

### User Story 9 - Import all judge answers in one go (Priority: P1)

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

### User Story 10 - Supply answers one by one or all at once (Priority: P1)

A dataset stays open (cases can still be loaded or added by hand, see User Stories 4 and 6) until
the user finalizes it. After that the judge and test cases stay fixed, and the user can provide judge
answers one case at a time, or load all of them from a file, or combine both (for example load
most from a file and paste a few missing ones). To use a different judge or different cases, the
user loads them again, which starts a new evaluation.

**Why this priority**: This is the exact working flow the user described; the rest of the
workflow depends on it.

**Independent Test**: Load a judge and cases, load answers for 40 of 50 cases from a file, add
the remaining 10 one by one, and see complete results.

**Acceptance Scenarios**:

1. **Given** the dataset is finalized, **When** the user supplies an answer for one case,
   **Then** it is attached to that case and the progress count increases.
2. **Given** the dataset is finalized, **When** the user loads an answers file, **Then**
   answers are attached to their cases as described in User Story 9.
3. **Given** some answers exist, **When** the user adds more by either route, **Then** the
   earlier answers are kept unless the user explicitly chooses to replace them.
4. **Given** the user loads a different judge or different cases, **When** a finalized evaluation
   already has answers, **Then** the tool warns that answers will be discarded, offers to
   export the current work first, and starts a new evaluation only after the user confirms.
5. **Given** a loaded dataset that is not finalized, **When** the user looks for prompt export or
   answer entry, **Then** the tool asks them to finalize the dataset first.

---

### User Story 11 - Verify every result by hand, helped by suggestions (Priority: P1)

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

### User Story 12 - Get guidance while building the dataset (Priority: P2)

While authoring, the user sees help: a short description and an example for each label,
and live feedback on the dataset being built, such as how many cases are clean and defective,
whether the balance is poor, whether any text is duplicated, whether the test is big enough for a
final answer, and how far it is from the size limit.

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
5. **Given** the dataset has fewer than 30 injected errors or fewer than 10 clean cases, **When**
   the user views it, **Then** the test-size summary shows what is missing and says that the final
   answer will be Inconclusive until it is added.

---

### User Story 13 - Mix hand-made and loaded cases, then finalize (Priority: P2)

A user can combine cases loaded from a file with cases written by hand in one dataset. When
satisfied, they finalize the dataset: they see a summary, confirm, and from that moment the
judge and cases are fixed for the evaluation (see User Story 10). To change them afterwards they
start a new evaluation.

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

### User Story 14 - Manage datasets as reusable, named sets (Priority: P2)

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
   and a new evaluation is started (see User Story 10).

---

### User Story 15 - Compare two versions of a judge (Priority: P2)

A judge author finishes an evaluation, saves its result, changes the judge prompt
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
   keeps the dataset, clears the answers, and lets the user edit the prompt, giving
   the new judge a new version identity.
6. **Given** results on the shelf, **When** the user opens Compare, **Then** they can pick any two
   of them, including results imported from files.
7. **Given** the user has unsaved results on the shelf or an unsaved current result, **When** they
   try to leave the page, **Then** the tool warns them and offers to export.

---

### User Story 16 - Reproduce and audit past results (Priority: P2)

A user opens any saved result and can see exactly which judge version (prompt and reply mapping) and
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

### User Story 17 - Define my own labels for other kinds of judges (Priority: P3)

A user adds their own labels, each with a name and a short description, or pastes a label list for
another kind of judge in place of the built-in Accuracy and Completeness starters, and uses those
labels when authoring and injecting. The labels are saved with the dataset. One evaluation tests
one judge.

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

### User Story 18 - Browse a large dataset (Priority: P3)

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

### Edge Cases

**General**

- No data loaded yet: every screen shows a helpful empty state with the next step.
- The page is closed or reloaded with unexported work (dataset, hand-made cases, answers or
  results): the work is lost, so the tool warns before leaving the page whenever there are
  unexported changes.
- Loaded files are from an older or newer format version than the tool understands: reported as
  unsupported, nothing is changed.
- Text containing quotes, commas, line breaks, or Polish and other non-English characters.
- Different line-ending or text-encoding conventions.

**Building the dataset**

- Empty file, file with only a header, or file with a single case.
- A file with more than 500 cases: the tool rejects it with a clear message stating the limit and how many cases were found, and suggests splitting it.
- Reaching the 500-case limit while authoring.
- Duplicate case identifiers within one file: the file is reported as invalid for those rows and the user chooses to import only the valid rows or cancel.
- A file where only some cases have identifiers: the tool rejects the mix and asks the user to supply identifiers for all cases or for none.
- Identifier collision between a hand-made case and a loaded case.
- Import is interrupted halfway: the previously loaded dataset must remain intact.
- Empty text or text consisting only of spaces.
- Very long text: a field longer than 30,000 characters shows a warning that it may not fit the
  model's context window; a field longer than 100,000 characters is refused, stating the limit
  (FR-028).
- A pasted LLM answer that is in the wrong format, partly valid, or contains modified texts identical to the original.
- Injection that produces no change, or that changes so much that the original is not
  recognizable.
- Several expected errors in one scenario: allowed; each has its own field, label and fragment.
- A pasted variant that changes more places than its expected errors list, or whose fragment is not
  in the text: flagged during review (FR-035).
- Deleting a label that is in use.
- Dataset with only defective cases or only clean cases: some measures cannot be computed, and
  the tool says so clearly.
- Finalizing an empty dataset or a dataset with only one kind of case.
- Saving an empty dataset: the tool explains there is nothing to save.
- Loading a saved file while the current dataset has unsaved changes.

**Running and results**

- Some cases unanswered: results can be viewed as partial and are clearly labeled as such, or
  the tool states how many cases are still missing.
- Very small case sets: confidence intervals are shown and the tool states that the sample is
  too small for a reliable conclusion.
- Received output is free text, partly JSON, or in an unexpected format: it is accepted, no suggestion is made, and the user decides.
- The same case answered twice: the user chooses whether to replace the earlier answer.
- A very large pasted answer or file.
- Answers file produced from a different dataset version than the one loaded.

## Requirements *(mandatory)*

### Functional Requirements

**Workflow and general rules**

- **FR-001**: The workflow MUST be presented as four steps in a fixed order, each on its own screen
  with one primary next action: (1) Judge: the judge prompt with its placeholders and its reply
  mapping; (2) Test cases: the error catalog and the scenarios with their composed prompts and expected errors, built by
  hand, by injection or from files, ending with finalizing; (3) Run: every case with its complete
  prompt to copy and a place to paste the received output; (4) Results: verdicts, manual
  verification, overall measures, the final answer and export. The user MUST be able to go back to
  an earlier step to look, and the current step and progress MUST always be visible.
- **FR-002**: The system MUST NOT call any LLM itself; the judge, and any prompt the tool prepares
  for generating test data or verifying results, is run by the user outside the tool.
- **FR-003**: The system MUST work without accounts, servers or databases. All authoring, bulk
  operations and evaluation MUST work on the user's device, and user data MUST stay there unless
  the user exports it.
- **FR-004**: The system MUST NOT retain datasets, hand-made cases, answers, or results after the
  page is closed; it MUST warn the user before they leave or reload the page with unexported
  changes, and MUST make exporting the current work one clear action.
- **FR-005**: All data (judges, cases, answers, results, metric definitions, check
  configuration) MUST be loadable from and exportable to files, with clear errors for invalid
  or unsupported-version files.
- **FR-006**: The tool MUST include built-in Help explaining how to use each part of the
  workflow, kept current with the features. Help MUST be written in plain, everyday language for a
  user without a statistics background: short sentences, a worked example for each measure and for
  the test size, and any technical term explained where it first appears. It MUST explain what one
  test case is and how many cases and errors a test needs; manual authoring, error injection,
  labels and finalizing, with examples; and the bulk workflow (template, import, prompt export,
  answer import) with examples that are valid for the current file formats.
- **FR-007**: The interface MUST be modern, clear, responsive, accessible, and present helpful
  empty and error states.

**Step 1: Judge**

- **FR-008**: Users MUST be able to provide a judge by loading a file or by typing/pasting the
  prompt in the app, and both routes MUST produce the same judge: the prompt (with placeholders for
  the case fields) and its reply mapping (FR-011). The judge holds nothing else: there are no
  additional resources, and all test data comes from the test cases.
- **FR-009**: Users MUST be able to save a judge entered in the app to a file and reload it
  with identical content.
- **FR-010**: One evaluation MUST test one judge. The error catalog (the kinds of errors injected
  into the test data, each with a name, a description and an optional example) MUST belong to the
  dataset, not to the judge: it is shown and edited on the Test cases step, saved in the dataset
  file, and used for generating errors and grouping results; the judge does not have to use it. Two
  built-in starters, Accuracy and Completeness, MUST each fill a ready judge prompt with its reply
  mapping and a matching error catalog, asking before replacing existing content. Other kinds of
  judges MUST be usable by typing or loading their prompt and typing or pasting their error list,
  without changing the rest of the tool, and check thresholds MUST be configurable from files. Users MUST be able to add custom
  labels with a name and description, and the system MUST prevent deleting a label that existing
  cases use.
- **FR-011**: The system MUST read itemized judge replies in the judge's own JSON through a reply
  mapping stored with the judge: where the list of parts is, which entry holds a part's text,
  optionally which entry holds its assessment together with the values that mean a problem (without
  an assessment entry every listed part is a problem), and optionally which entry holds a category.
  On the judge-prompt screen the user MUST be able to set the mapping by pasting one sample reply:
  the system proposes a mapping, shows which parts it would treat as findings, and the user
  confirms or corrects it. The built-in Accuracy and Completeness starters MUST ship with a
  matching mapping. For a prompt that asks for no JSON at all, the system MUST offer an action that
  inserts a ready JSON reply block (with its mapping) at the user's request. Before finalizing, the
  system MUST warn when no working mapping is set, explaining that every case will then need manual
  or LLM-assisted verification. The Help MUST explain the mapping.
- **FR-012**: The system MUST show, for each label, a plain-language description and an
  example.

**Step 2: Test cases — data and files**

- **FR-013**: Each test case MUST have a name, one or more named input fields, and zero or more
  expected errors (none for a clean case). Each expected error MUST have a description and MAY have
  a field, a label, a fragment, and a difficulty (obvious or subtle). Users MUST be able to load
  test cases from a file.
- **FR-014**: The system MUST offer generation of mock judge, case and answer data as a fixed
  sample that is usable without regeneration.
- **FR-015**: Users MUST be able to load many test cases from a single file in one action.
- **FR-016**: The system MUST validate the entire file before accepting it and present a
  summary: total cases, defective count, clean count, and a list of invalid rows with position
  and reason.
- **FR-017**: Users MUST be able to choose to import only valid rows or cancel when invalid
  rows exist; a cancelled or failed import MUST NOT change the currently loaded dataset.
- **FR-018**: The system MUST provide downloadable template dataset files (CSV and JSON) with
  instructions and an example.
- **FR-019**: The system MUST accept test cases from CSV or JSON files, judge answers from JSON,
  and MUST export datasets as JSON. For CSV, it MUST handle text containing commas, quotes, line
  breaks, and Polish and other non-English characters, and report unreadable files clearly.
- **FR-020**: In CSV, each input field MUST be a column named `field:<name>` (a plain `text` column
  is accepted as a single field), and expected errors MUST be one cell using the one-line convention
  `field | label | "fragment" | description` (optionally ending with `| obvious` or `| subtle`), with
  several errors separated by ` ;; `. In JSON, a scenario has `name`, `fields` (name to text) and
  `expected_errors` (list of objects with `field`, `label`, `fragment`, `description` and optionally
  `difficulty`), and optionally `base` (the scenario it was made from, see FR-035). The template
  files MUST show both.
- **FR-021**: The system MUST reject a dataset file with more than 500 cases, state the limit and
  the number found, and leave the currently loaded dataset unchanged.
- **FR-022**: The system MUST use the case identifier supplied in the file when present, otherwise
  assign identifiers by row order and tell the user, and MUST match imported answers to cases by
  identifier only.
- **FR-023**: Each dataset MUST have a name and a version derived from its content, so loading
  different content gives a different version.
- **FR-024**: Users MUST be able to export a dataset to a file and re-import it with identical
  content.
- **FR-025**: Users MUST be able to search, filter, sort, and page a dataset, and to view
  individual cases. Cases cannot be edited in this view; cases are edited only before the dataset
  is finalized (FR-030).
- **FR-026**: The system MUST remain responsive when handling datasets of up to 500 cases.

**Step 2: Test cases — writing by hand**

- **FR-027**: Users MUST be able to create a test case by hand by entering an optional name and the
  text, adding named input fields and zero or more expected errors (field, label, optional fragment,
  description, optional difficulty: obvious or subtle); a scenario with no expected errors is clean.
- **FR-028**: The system MUST refuse to save an expected error without a description, and any case
  with no non-empty input field, and MUST explain why. Each input field MUST hold at most 100,000
  characters: above 30,000 the system MUST warn that the composed prompt may not fit the model's
  context window, and above 100,000 it MUST refuse the case (by hand, pasted or loaded from a file,
  where it is reported as an invalid row) and state the limit.
- **FR-029**: The system MUST assign a unique identifier to each hand-made case that has none and
  MUST prevent identifier collisions with loaded cases.
- **FR-030**: Until the dataset is finalized, users MUST be able to edit and delete cases; each
  change MUST update the dataset version.

**Step 2: Test cases — injecting and generating errors**

- **FR-031**: Users MUST be able to start from a clean text and request help introducing a chosen
  kind of defect; the system MUST show the original and the modified text side by side with the
  change highlighted. Suggestions MUST come from a ready-made prompt for the user's own LLM (FR-032);
  the user MAY instead write the modification by hand. The tool MUST NOT have built-in rules that
  modify text by themselves.
- **FR-032**: The system MUST provide a ready-made prompt that, together with a clean text and a
  chosen label, makes an external LLM return one or more injected scenarios in the same JSON format as scenario
  files (each with its name, fields, and expected errors), or in the one-line convention, ready to
  paste. The prompt MUST state the target field, the number of errors, and the labels to use. The system MUST accept that answer pasted directly, validate it, show the proposed
  cases for review, and reject malformed input with a clear message without discarding the pasted
  text. The prompt MUST carry context to improve accuracy: the judge's prompt (so the LLM knows what the judge
  checks), the error catalog's labels with their definitions and examples, and the base scenario's fields. It MUST be
  available for any case with a user-selected goal (add a defect, another variant with the same
  defect, or a corrected clean version); a proposal for a clean version is saved as a clean case.
  The system MUST make clear that results are proposals to review, not guaranteed outputs.
- **FR-033**: The dataset view MUST always show an area for pasting the LLM's answer. Its content MUST
  be processed exactly like a file import (validation, summary with problems and reasons, user
  review of each scenario) before anything is added, and malformed input MUST NOT discard the
  pasted text.
- **FR-034**: The system MUST accept expected errors in the one-line convention
  `field | label | "fragment" | description` (optionally ending with `| obvious` or `| subtle`)
  wherever scenarios are typed, pasted or loaded.
- **FR-035**: A scenario made from another scenario (a variant with injected errors) MUST keep a
  reference to its base scenario (`base` in the scenario JSON, which the generation prompts ask the
  LLM to return). During review the system MUST show the differences between the base and the
  variant, and MUST warn when a changed place is covered by no expected error or when an expected
  error's fragment does not occur word for word in the field it names. The user decides whether to
  fix, accept or discard the scenario.
- **FR-036**: The prompts that generate errors MUST explain the two difficulty levels, ask the LLM
  to mark each error as obvious or subtle, and ask for a mix of both (half of each by default,
  adjustable). The user MUST be able to change the difficulty of any expected error.
- **FR-037**: Users MUST be able to edit the suggested modification by hand before saving.
- **FR-038**: When saving an injected case, the system MUST record the label and a
  description of what was changed, and MUST reject a modification identical to the original.
  The system MUST also record the exact fragment the error is at, because automatic matching of the
  judge's findings uses it: for an error present in the text, the changed fragment of that field;
  for an omission, the fragment of the input that the output no longer covers (the expected error
  then names the input field).
- **FR-039**: Users MUST be able to save the original clean text as a clean case together with
  the injected one.

**Step 2: Test cases — prompts, feedback, saving and finalizing**

- **FR-040**: The system MUST compose the final prompt for each case from the judge prompt with the
  case's named input fields filled into the matching placeholders (such as {{field-name}}). The
  system MUST NOT add any text of its own to that prompt (no appended material, instructions, or
  format requirements); the prompt is used exactly as the user wrote it.
- **FR-041**: Whenever a judge and at least one case are present, the system MUST show the
  complete prompt that would be sent to the LLM for a chosen case (FR-040), with a single action to
  copy it. This view MUST be available both where the dataset is built and on the Run step, so the
  user only has to copy and paste it into the LLM.
- **FR-042**: Where the dataset is built, the system MUST show for the chosen case two prompt areas
  side by side without opening a separate dialog: the ready-made prompt for generating test data
  from that case (FR-032), and the complete final prompt for the judge. Each MUST have a copy action
  and MUST be collapsible, with the data-generation prompt collapsed by default.
- **FR-043**: The system MUST show live dataset feedback: counts of clean and defective cases,
  warnings for missing kinds (stating clearly that some measures cannot be computed without both
  kinds), flagged duplicate texts, and remaining capacity up to 500 cases.
- **FR-044**: The system MUST compute and show a test-size summary from the dataset, updated on
  every change: total cases (one judge run each), clean cases, cases grouped by the number of
  injected errors (for example "10 cases with 2 errors"), and total injected errors. The totals of
  injected errors and clean cases MUST be shown against the fixed minimums (30 injected errors, 10
  clean cases) as met or missing N, with the plain statement that the system needs them to give a
  final answer (FR-067), so the user knows before running whether the answer can be other than
  Inconclusive. The user never enters or calculates these numbers.
- **FR-045**: Users MUST be able to combine hand-made cases with cases loaded from a file in one
  dataset before finalizing.
- **FR-046**: Users MUST be able to save the working dataset to a file at any time, whether or
  not it is finalized. The file MUST contain the dataset name, all cases (hand-made ones included),
  their labels, the injection records, and the error catalog (including any custom labels).
- **FR-047**: Loading a saved file MUST restore the dataset as open (editable, not finalized)
  with identical content, and MUST validate it using the same rules and reports as any dataset
  file (FR-016).
- **FR-048**: The system MUST show whether the dataset has unsaved changes, and MUST warn before
  a load or a new evaluation would replace a dataset that has unsaved changes, offering to save it
  first.
- **FR-049**: Users MUST be able to finalize the dataset after seeing a summary; once finalized,
  the system MUST NOT offer editing of cases and MUST offer starting a new evaluation instead.
  The summary MUST warn when the judge has no working reply mapping, because every case will
  then need manual or LLM-assisted verification (FR-011). The summary MUST also warn when no
  expected error is marked subtle, because the result would then say nothing about subtle errors.
- **FR-050**: A dataset MUST stay open until the user finalizes it, whether it came from a file,
  was built by hand, or both. Once the dataset is finalized, the system MUST keep the judge prompt
  and the cases' input data fixed for the evaluation; the expected errors of a case MAY still be
  edited, because they are the reference the received outputs are judged against (automatic
  verdicts are then recomputed and verdicts set by hand are kept). Export of the whole prompt batch
  and answer entry MUST be available only after finalizing. Viewing and copying the composed prompt
  for a single case MUST be available at any time (FR-041). Loading a different judge or different
  cases MUST start a new evaluation. Changing only the judge MAY keep the finalized dataset
  (FR-072). If answers exist, the system MUST warn that they will be discarded, offer to export
  first, and proceed only after confirmation.

**Step 3: Run**

- **FR-051**: On the Run step, for the chosen case, the system MUST show together: the case name,
  the case data (all input fields and its expected errors), the complete prompt with a copy action,
  and a place to paste or type the judge's result with a clear accept action; the user MUST be able
  to move between cases without leaving the page.
- **FR-052**: On the Run step the user MUST be able to record which model and settings ran the
  judge (free text, optional). It MUST be stored with the result and shown in the report, and the
  Run step MUST remind the user to run every prompt in a new conversation, so that one case cannot
  influence another.
- **FR-053**: Users MUST be able to paste the received output for each case as text of any format.
  The system MUST accept it, show it next to the expected errors, and MUST NOT reject it for its
  format.
- **FR-054**: The system MUST let the user supply judge answers one case at a time, or all at
  once from a file, or a mix of both, within the same evaluation.
- **FR-055**: Users MUST be able to export the composed prompts for all cases (or only
  unanswered cases) as one file, with each prompt labeled by its case identifier.
- **FR-056**: Users MUST be able to import many judge answers at once, from a file or a pasted
  block, each linked to a case identifier.
- **FR-057**: The system MUST accept each imported received output as text of any format and
  attach it to its case by identifier, and MUST report accepted, rejected (empty output or
  unreadable file entry), unmatched, duplicate, and still-missing counts, with the reason for each
  rejected item. It MUST NOT reject an output because of its format.
- **FR-058**: When imported answers overlap with existing ones, the system MUST ask the user to
  keep or replace them, and MUST NOT overwrite silently.
- **FR-059**: When an answers file states the dataset version it was produced for, the system
  MUST warn if it differs from the loaded dataset version. Exported prompt batches MUST include
  the dataset version so it can be carried into the answers.

**Step 4: Results**

- **FR-060**: Every test case MUST have a status: Not run, Awaiting verification, Pass, or Fail.
  The user's verdict MUST be authoritative. When the received output can be read through the reply mapping
  (FR-011), the system MUST match findings to expected errors by place: an expected error is found
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
  opinion approved by the user (FR-062). Overall measures MUST be computed from cases with a verdict, labeled "provisional" while
  any case awaits verification, and show the number of such cases.
- **FR-061**: The system MUST give every test case a place for manual verification, in which the
  user marks each expected error as found or not found and states how many of the judge's findings
  were unexpected; the case is Pass only when every expected error is found and nothing
  unexpected is reported, otherwise Fail. For an unexpected finding the user MUST be able to confirm
  it as a false alarm or add it to the case's expected errors as a real error. The system MUST mark
  cases where the output is unclear or disagrees with the expectation so the user can review them first.
- **FR-062**: For any case with a received output, and in one action for all cases awaiting
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
- **FR-063**: The system MUST compute and display, as its two built-in measures, the detection rate
  and the false-alarm rate, each with a confidence interval. The detection rate MUST be counted per
  expected error: expected errors found divided by all expected errors in cases with a verdict. The
  false-alarm rate MUST be counted per finding: findings that match no expected error and are
  confirmed as false alarms, divided by all findings the judge reported in cases with a verdict,
  clean or not. Several findings that point at the same expected error each count as a correct
  finding. When the judge reported no findings at all, the false-alarm rate MUST be shown as not
  available. Beside it the system MUST show, as information, the share of cases with at least one
  false alarm, the same share for clean cases alone, and the total number of false alarms.
- **FR-064**: The system MUST show a breakdown per error label: expected errors, found, missed,
  and the detection rate with its interval. A label with fewer than 10 expected errors MUST show
  counts only, with no pass or fail assessment. When the judge reports categories, the number of
  unexpected findings per category MUST be shown as well. The system MUST also show the detection
  rate separately for obvious and for subtle expected errors (and for those with no difficulty
  set), under the same minimum-count rule.
- **FR-065**: The system MUST show one combined score from 0% to 100%: the harmonic mean of the
  detection rate and the share of correct findings (100% minus the false-alarm rate). It MUST be
  shown beside the two measures, in the report and in comparisons, and labeled as a summary: the
  final answer MUST still rest on the two thresholds (FR-067). When either part is not available,
  the combined score is not available.
- **FR-066**: The system MUST state when a sample is too small for a reliable conclusion.
- **FR-067**: The results MUST state, above the overall measures, a final answer for the evaluated
  judge: Works, Does not work, or Inconclusive. It is Works when the detection rate and the
  false-alarm rate both meet their thresholds, Does not work when either does not, and Inconclusive
  when any case is Not run or Awaiting verification or the sample is below the minimum. Threshold
  defaults: detection rate at least 80%, false-alarm rate at most 10%. The minimum sample is fixed in
  the tool and not editable: 30 expected errors and 10 clean cases. The final answer, its one-line
  reason and the two measures MUST be shown first. Below them the "Test size" summary (FR-044) MUST
  be shown, computed automatically from the test cases, with the plain statement that the system
  needs at least 30 injected errors and 10 clean scenarios to give a final answer. The two
  thresholds MUST sit in a collapsed "Evaluation settings" section, closed by default, each field
  with a one-sentence plain-language explanation; the user MUST be able to change them there or
  load them from a check configuration file, and the answer MUST update at once. The system MUST
  show a "borderline" note when a confidence interval includes its threshold. The values used MUST
  be stored with the result and shown in the report.
- **FR-068**: The system MUST present results as two linked tables under a strip of overall
  measures. The top table MUST list every test case with its name, kind, status, number of expected
  errors and how many were found, the number of unexpected findings, whether output was received,
  the source of the verdict (automatic, set by hand, or LLM opinion approved by the user), and the
  reported error types. The detailed table below MUST show, for each test case, the full tested
  prompt, the expected errors, the received output (entered on the Run step; it can be replaced here), and a place for manual
  verification. Selecting a row in the top table MUST take the user to or filter the matching detail.
- **FR-069**: Users MUST be able to save a result to a JSON file and export it as an HTML report
  that contains the same tables, readable without the tool. Both MUST always contain the full
  final prompts (with the real input data filled in), the expected errors, the received outputs,
  the verdicts, the final answer with the values it was based on, and the per-label and per-difficulty breakdowns;
  there is no option to omit them. The HTML report MUST open with a summary (final answer,
  thresholds, overall measures, per-label breakdown) and MUST print cleanly to PDF from the browser. The Help MUST state that exported files
  contain the user's data.

**Comparing and reproducing results**

- **FR-070**: Users MUST be able to compare any two saved results side by side, with worsening
  highlighted, and MUST be warned when the dataset versions differ.
- **FR-071**: The system MUST keep a shelf of saved results for the duration of the session, let
  the user name each saved result, and show for each its judge version, dataset version, date,
  and headline measures.
- **FR-072**: The system MUST offer "change the judge, keep the cases", which keeps the finalized
  dataset, offers to save the current result to the shelf first, clears the answers, and gives the
  new judge a new version identity.
- **FR-073**: The system MUST NOT keep the shelf after the page is closed; it MUST warn before
  leaving with results that have not been exported.
- **FR-074**: Every result MUST be stored together with the judge version (prompt and
  reply mapping), the dataset name and version, the cases, and the received outputs and verdicts that
  produced it, and users MUST be able to export it to a file and import it back, including into the
  shelf.
- **FR-075**: Recalculating results from the same judge, cases and answers MUST give identical
  numbers.

### Key Entities

- **Judge**: The thing under test: a prompt with placeholders for the case fields, plus its reply
  mapping. Only the prompt is supplied from outside; everything else is built in the tool. Has a
  version identity.
- **Error Catalog**: The kinds of errors injected into the test data (labels, each with a
  description and an optional example). Belongs to the dataset; used to generate errors and group
  results. The judge does not have to use it.
- **Label**: A named kind of issue with a description and an example, held in the error catalog,
  whether it came from a built-in starter or was defined by the user.
- **Reply Mapping**: The part of the judge that tells the tool how to read the judge's own JSON reply: the list of parts, the text of a part, its assessment with the values that mean a problem, and optionally its category.
- **Dataset (Case Set)**: A named, versioned collection of test cases, with its error catalog, evaluated together; reusable
  across judges and judge versions. Its version is derived from its content.
- **Working Dataset**: The dataset being built or loaded, editable until finalized.
- **Test Case**: One scenario to be judged, with a unique identifier, an optional name, named input
  fields, zero or more expected errors, and, for injected errors, a record of the injected change.
  It may be loaded from a file, written by hand, or created by injection. The final prompt is
  derived from the judge prompt and the input fields.
- **Expected Error**: What the judge should find in a scenario: the field it is in, a label (free text), an optional fragment, a description, and an optional difficulty (obvious or subtle).
- **Injection Suggestion**: A proposed defective case (modified text, label, description of the change) pasted from an external LLM or written by hand, awaiting the user's review.
- **Injection Record**: The description of what was changed in a clean text to create a
  defective case, linking the injected case to its original text.
- **Import Summary**: The report shown after reading a file or a pasted block: counts, invalid rows
  with reasons, and the user's choice on how to proceed.
- **Dataset Summary**: The overview shown while building and before finalizing: counts, balance,
  test size against its minimums, and warnings.
- **Prompt Batch**: A single file containing a composed prompt for each selected case,
  labeled by case identifier.
- **Answer Batch**: A single file or block containing many received outputs (text of any format),
  each tied to a case identifier.
- **Received Output**: The text the judge produced for one case, pasted by the user in any format.
- **Finding**: A part of the judge's reply assessed as a problem; its text is the place it points at.
- **Unexpected Finding**: Something the judge reported that matches no expected error of the case; it counts as a false alarm unless the user adds it to the expected errors as a real error.
- **Verdict**: The Pass or Fail decision for a test case, set by the user or automatically by the tool, with its source.
- **Verification Opinion**: An external LLM's JSON assessment of one case (which expected errors the judge found, which findings are unexpected), pasted back by the user to help manual verification. It is a proposal until the user approves it.
- **Evaluation Result**: The measures computed for one judge version on one dataset version,
  including confidence intervals and the data needed to reproduce it.
- **Final Answer**: The conclusion for the evaluated judge (Works, Does not work, Inconclusive), with the thresholds, the minimum sample and the reason it was based on.
- **Result Shelf**: The session's collection of saved, named evaluation results, from which any two can be compared. Not remembered after the page is closed.
- **Comparison**: Two saved evaluation results shown side by side.
- **Metric Definition**: A loadable description of an additional measure and its checks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Evaluating and comparing judges**

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

**Working with whole datasets**

- **SC-010**: A user can load a 100-case dataset and see its summary in under 1 minute from
  choosing the file, with no per-case manual entry.
- **SC-011**: A user can complete the full bulk loop (import dataset, export prompts, import
  answers, view results) for 100 cases with a total of no more than 6 deliberate user actions
  inside this tool, not counting the work done in the external LLM tool.
- **SC-012**: 100% of invalid rows or answers in a bulk import are reported with their
  position and a reason the user can act on.
- **SC-013**: A failed or cancelled import leaves the previously loaded data unchanged in
  100% of cases.
- **SC-014**: Datasets of 500 cases load and can be browsed without the interface becoming
  unresponsive for more than 2 seconds.
- **SC-015**: A dataset exported and re-imported produces identical content and an identical
  version in 100% of cases.
- **SC-016**: First-time users can import a dataset using only the template and Help,
  successfully on the first attempt in at least 90% of trials.

**Writing test cases by hand**

- **SC-017**: A first-time user can add a clean test case by hand in under 1 minute.
- **SC-018**: A user can create a defective case from a clean text with an injected error in under
  2 minutes.
- **SC-019**: 100% of injected cases carry a label and a record of what was changed.
- **SC-020**: 100% of attempts to save an invalid case (empty text, an expected error without a description, unchanged
  injection) are refused with a message the user can act on.
- **SC-021**: A user building a one-sided dataset (only clean or only defective) is warned in
  100% of cases before finalizing.
- **SC-022**: A dataset built partly by hand and partly from a file can be exported and reloaded
  with identical content in 100% of cases.
- **SC-023**: At least 90% of first-time users complete a small dataset (5 cases, mixed) using
  only the in-tool help.
- **SC-024**: A user can go from a clean text to reviewed injected cases using the ready-made prompt
  and a single paste, with no manual re-typing of the LLM's answer.
- **SC-025**: A dataset saved and reloaded in a later session has identical content in 100% of
  cases, and a user can resume editing within 1 minute of choosing the file.

## Assumptions

**Users and scope**

- Only the judge prompt is supplied from outside. All test data (inputs, outputs and the injected
  errors) is built by the user in the tool: by hand, by generation with their own LLM, or from
  their own files.

- The primary user is a judge author comfortable with prompts and JSON but not necessarily a
  developer; the secondary audience (people relying on judge results) only reads results.
- Version 1 handles one judge and one dataset per evaluation; batch management of many judges
  is out of scope.
- Calling an LLM from the tool, evaluating model answers themselves, and public sharing of
  results are out of scope for this version. Prompts (for the judge, for generating test data and
  for verification) are run by the user in their own LLM tool.
- The judge is a single prompt that gives one reply per test case. A judge built as a chain of
  prompts, where one reply feeds the next prompt, is out of scope for this version.
- A judge that returns only an overall rating, with no itemized parts, is out of scope for this
  version.
- Compare always shows exactly two results at a time; viewing a trend across many versions is out of scope for this version.
- Combining or merging two datasets into one is out of scope for this version.
- The detailed technical document named in the source (`judge-the-judge-specyfikacja.md`) was
  not available; details such as exact file formats are left to planning.

**Metrics and measures**

- The results always show two overall measures: detection rate and false-alarm rate, plus a combined score that only summarizes them and is not a third metric. The project's
  two built-in metrics are Accuracy and Completeness, offered as starters (judge prompt, reply
  mapping and error catalog), each tested in its own evaluation; other kinds of judges are typed or
  loaded by the user, and additional measures (agreement
  with human assessment, stability, rule compliance) are loaded from definition files.
- The built-in Accuracy starter initially has the labels: factual-error, contradiction, wrong-number,
  unsupported-claim, and misattribution. The built-in Completeness starter initially has: missing-information,
  missing-step, omitted-requirement, partial-answer, and missing-caveat. Each label has a description
  and an example; exact sets are refined in planning.
- The 95% confidence level is the default for confidence intervals; the method may be refined
  in planning.
- Success thresholds for the measures (what counts as "good enough") ship with defaults (FR-067)
  and remain the user's choice: they are changed in the "Evaluation settings" section of the
  results screen or via check configuration. The minimum test size (30 injected errors, 10 clean
  cases) is fixed in the tool.
- The reply mapping is used only for automatic verdicts. A finding points at an expected fragment when the two share their key content after ignoring letter case, spacing and rephrasing; the exact rule, and the line between a clear and a partial match, are set in planning. A false alarm is a finding, in any case clean or not, that matches no expected error and that the user has not added as a real error; a case with output that cannot be read is left for the user.
- In comparisons, a measure is marked "worse" when its value is lower (for detection) or higher (for false alarms) than the previous version, and "clearly worse" when the two confidence intervals do not overlap.
- A result describes one judge prompt run on one model. The tool measures only the kinds of errors
  present in the test data: a high detection rate says nothing about kinds of errors that were
  never injected, and the Help says so.

**Datasets and files**

- Test cases reach the dataset from files, by hand, or by injection; all routes build the same
  dataset, which is editable until finalized and fixed afterwards.
- Test cases can be loaded from CSV (editable in a spreadsheet) or JSON; received outputs are loaded
  from JSON (each entry holds a case identifier and the output text); datasets are always exported
  as JSON, so no information is lost. Exact field layouts are decided in planning.
- CSV is the easy route for preparing cases; several input fields and several expected errors per
  case are expressed through the documented convention in FR-020.
- Each case has a unique identifier within its dataset. The identifier from the file is used when every case has one; if none have one, the system assigns numbers by row order and tells the user. Answers are matched by identifier, never by position.
- The upper size is 500 cases per dataset (a deliberate simplification); larger sets are out of scope and are rejected with a clear message. The limit may be revisited in a later version.
- Dataset versions are derived from content, so identical content always gives the same
  version.
- A case can have any number of expected errors; an injected case starts with the errors returned by
  the injection, and further expected errors can be added by hand.
- Error injection works through a prompt the user runs in their own LLM, or by hand; there are no
  built-in rules that change text, because they give artificial errors that are easy to detect in
  narrative texts and would overstate the judge's detection rate. The paste-ready format for injected cases is fixed by the tool, documented in
  Help, and the ready-made prompt asks the LLM for exactly that format.
- The injection record is for the user's reference and for matching the judge's findings; it is
  not shown to the judge.

**Saving and privacy**

- Nothing is stored on a server or remembered between sessions. Saving to a file is the only way to
  keep work; the dataset save file is the same JSON dataset file used for export, and it carries the
  cases, their labels, the injection records, and any custom labels.
- Exported reports and result files are plain files on the user's device and may contain sensitive
  data from the user's scenarios; protecting or sharing them is the user's responsibility.
