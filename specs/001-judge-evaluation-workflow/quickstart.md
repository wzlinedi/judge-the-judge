# Quickstart: Judge the Judge

**Date**: 2026-11-13 | **Plan**: [plan.md](./plan.md)

How to run the tool locally and the scenarios that prove it works end to end. Formats are in
[contracts/file-formats.md](./contracts/file-formats.md); screens are in
[contracts/ui-flow.md](./contracts/ui-flow.md). Prototype v17 (`prototypes/ui-prototype-v17`)
shows these flows.

## Prerequisites

- Node.js 22 or newer with npm (installed on the development machine).
- Current Google Chrome or Microsoft Edge (the only supported browsers, FR-003). For `npm run e2e`:
  `npx playwright install chromium msedge`.
- For scenarios that use a real judge: any LLM chat tool. The demo data needs none.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies (first time only). |
| `npm test` | Runs unit, contract and integration tests. No browser needed. |
| `npm run dev` | Starts the tool locally with live reload. |
| `npm run build` | Produces the static site in `dist/`. |
| `npm run preview` | Serves `dist/` locally, as a static host would. |
| `npm run e2e` | Runs the end-to-end and accessibility checks against the built site, in Chromium and Edge. |

Opening `dist/` from any static file server, in any subfolder, must work without configuration.

## Validation scenarios

Each scenario is also an end-to-end test. Expected numbers for the demo data are stored in
`examples/demo/expected-results.json` and asserted by the tests. In the tests, "copy the answer"
means writing it to the clipboard of the browser context (clipboard permission is granted), and
the save dialogs of "Save evaluation" and "Save test project" are replaced by an in-memory file
installed with an init script (research.md, sections 6 and 25). By hand, both are the real browser
features.

### V1. First run with demo data (SC-001, SC-009, SC-010, User Stories 1 and 9)

1. Open the tool; in the File menu choose "Load example…", then the demo.
2. On Results choose "Export HTML report". Then press "Continue" in the "what next" line and
   decide each case it opens. Open Results and export again.

**Expected**: the Judge step shows no welcome section; the demo opens on Run as a finalized
evaluation with 20 cases and 20 replies, the "what next" line says "15 of 20 cases decided" and
"Continue" opens the first case awaiting verification. The Summary shows the counts of expected
errors (found, missed), additional findings (real errors, false positives) and subtle errors
before anything else, then the two rates and one line of overall result with its reason. While
cases await verification the results are marked provisional and the overall result is
Inconclusive; afterwards the numbers match the expected results file. The test size shows 30 of 30
errors and 10 of 10 clean cases. The first report is marked provisional and names the 5 undecided
cases; the second has no such mark. (The times of SC-001 and SC-010 are checked by hand with a
first-time user, not by the automated test.)

### V2. Judge from scratch (SC-011 to SC-014, SC-037, SC-038, User Story 2)

1. Type a prompt with `{{prompt_input}}`, `{{prompt_output}}` and `{{context}}`; mark
   `prompt_output` as the judged text.
2. Paste a broken sample reply, then fix it; then paste one wrapped in a code fence.
3. Add a rule with two conditions joined by "any of", then a second rule with "all of".
4. Replace the sample with one that lacks a field used by a rule.
5. "Save test project" (File menu), reload the page, "Load test project".

**Expected**: the step shows no buttons of its own besides "Add rule", "Add condition" and
"Remove"; exactly the three variables are listed and `context` (the last) was proposed as the
judged text before the change; the broken sample shows its line and column under the box and the
text is kept; the fixed one is read at once, with no read button, and its fields appear with
their paths and values; the preview marks the right parts as findings and names the rule; the
rule that lost its field is marked broken; the reloaded judge set is identical, with the same
version, and the tool opens the Test cases step (the first step with unfinished work).

### V3. Clean cases (SC-021, SC-034, User Story 3)

1. On Test cases choose "Add test case", then "Clean case"; type a name and a comment, pick a
   "Like case" when one exists, "Copy prompt", run it in an LLM, paste the answer into the box and
   "Approve and close".
2. Paste an answer with expected errors into a new clean case view.
3. "Clone" a clean case, "Save case"; "Rename" the copy to a name another case has, then to a free
   name; "Remove" the copy.
4. Try to remove a clean case that another case uses as its base.

**Expected**: the prompt contains the judge prompt, its variables and judged text, the catalog,
the comment and the fields of the picked case; the answer is checked as it is pasted, its fields
are shown read-only and the case is saved under the typed name; the answer with expected errors is
a problem that points to "Paste JSON"; the table shows Kind "Clean" and the buttons Open, Clone,
Rename and Remove on every row; the clone is a new case named "… (copy)" with no link to the
original, the taken name is refused; the removal of the base is refused with the list of cases
made from it.

### V4. A case with injected errors (SC-022 to SC-024, SC-031, SC-033, SC-035, SC-036, User Story 4)

1. On Test cases choose "Add test case", then "Case with injected errors"; pick a base case; list
   two errors to prepare (one with a new category name typed in); "Copy prompt".
2. Run it, paste the answer into the box, "Next".
3. In the case view press "Show in text" on each error; change a fragment in the source JSON so it
   no longer occurs; fix it; "Save case".
4. "Add test case", "Paste JSON", paste a JSON identical to its base but with one expected error.
5. "Open" a case with five expected errors at 1280 x 720; "Show JSON", "Copy JSON"; paste it into
   a new case with "Paste JSON"; use "Next test case".
6. Finalize; "Open" a case without a reply, "Correct expected errors", change one difficulty and
   save; try to change a field.

**Expected**: the prompt contains the judge prompt, the base case, the judged text and each error
with its category's description and example; the JSON box shows problems with their line and
column or field path and "Next" is enabled only when valid; the case view shows the judged text
with E1 and E2 highlighted and the check line "Text and list agree"; "Show in text" scrolls to and
highlights the fragment; the broken fragment turns the line into "not in the text" at once; the new
category is added to "Error categories"; the saved case records its base; the unchanged version is
refused with the reason; the five expected errors are visible without scrolling; the pasted JSON
gives the same fields and expected errors; after finalizing only the expected errors change, the
field change is a problem, and the test cases version changes.

### V5. Import and export test cases (SC-015 to SC-020, User Story 5)

1. "Import test cases" (File menu), "Download example file", add rows in a spreadsheet, including
   one invalid row and Polish characters.
2. Choose the file and read the summary; import the valid rows. Then import a JSON file of cases
   with a category that is not in the catalog and an identifier already used.
3. "Export test cases"; start a new evaluation and import the exported file.
4. "Save test project", reload the page, "Load test project".
5. Finalize, change a threshold in "Details" on Results, "Save test project", reload, "Load test
   project"; then "Edit test cases" in the "what next" line.
6. After entering one reply, import one more case.

**Expected**: the example has `name` and one `field:` column per variable of the current prompt,
and every CSV row becomes a clean case; the invalid row is listed with its position and reason;
the imported cases are added to those already there; the unknown category is named and added only
after consent; the used identifier gets a new one and the summary says so; the export holds every
case and imports back with identical content and version; the reloaded cases are identical and
open. The finalized test project comes back finalized on the Run step, with the changed threshold
and the same metric; "Edit test cases" opens it again and nothing is lost. The case imported after
the first reply starts as Not run, is marked "added after first reply", and the replies of the
other cases are kept.

### V6. Run by hand (SC-002, SC-030, SC-032, SC-037, User Story 7)

1. Finalize the test cases. On Run write two lines of model details. Choose "Open" at the first
   case.
2. "Copy prompt", copy a reply into the clipboard, "Paste reply from clipboard", "Next test case".
   Repeat with Alt + Right.
3. Change the text of a saved reply in its box and "Save reply" for a case that has only automatic
   decisions, then for a case with a decision set by hand.
4. With an empty clipboard press "Paste reply from clipboard"; then deny clipboard permission and
   press it again; paste a reply that is not JSON into the box with Ctrl+V and "Save reply".
5. Save 25 replies without "Save evaluation".

**Expected**: the Run step shows one summary line (judge version, test project name, test cases
version, judged text) with no prompt or rules, a multi-line "Model details" box whose lines are
kept, and the evaluation file with "Save evaluation" and "Save evaluation as"; the page header has
no save button. The window fills the screen at 1280 x 720 with data on the left and "Judge's
reply" with the four steps on the right, without scrolling the page; "Copy prompt" is the primary
button until it is pressed, then "Paste reply from clipboard"; the reply box is always visible and
never behind a collapsed section; the reply is saved by the paste itself and the marks appear under
it, with "Approve" as the primary action and "Add finding", "Note" and "Second opinion…" as
visible buttons; the position ("case 2 of 20") is always visible; one case takes no more than three
actions; the first replacement happens without a question and the second asks, naming one
decision; both reset the case and recompute the automatic marks; an empty clipboard is explained
and changes nothing; a refused clipboard points to the box; the non-JSON reply is kept, its line
and column are shown and nothing is marked automatically; each reply is stored with the prompt that
produced it; the number of unsaved replies is shown and a reminder to save appears at 25.

### V7. Marking, with an LLM opinion (SC-027, SC-028, SC-039, User Story 8)

1. "Open" a case that awaits verification; "Second opinion…"; in the window "Copy prompt", run
   it, paste the answer into the box.
2. Read the preview; "Apply opinion". Change one of the marks it set; "Ignore" one item.
3. Open "Second opinion…" again and paste an opinion meant for another case; then one that answers
   no item; "Cancel".
4. Tick "only cases awaiting verification" in the case window and use "Next test case".
5. For a reply that could not be read, "Add finding" with a category and difficulty; mark it;
   remove another added finding; "Second opinion…" with an opinion that adds a new finding;
   "Approve".

**Expected**: the Run step has no second-opinion card; clear items are already marked, with
source "automatic"; every expected error has a mark or a reason; the verification prompt covers
only this case; the preview shows each change ("E1 undecided → Found") with its reason and
fragment and names changes that replace a mark set by hand; nothing changes before "Apply
opinion"; applied items read "LLM opinion, approved by the user" and the changed one "set by
hand"; the opinion for another case and the one that answers nothing cannot be applied, the second
saying "The opinion classifies none of the N items of this case. Nothing will change." with the
reason per item, and nothing changes; the ignored item leaves every count and is listed as ignored;
only added findings have "Remove"; the finding added by the opinion appears with its category; the
unreadable case stays awaiting until approved.

### V8. Correct the rules after replies (User Stories 8 and 13, FR-053, FR-075)

1. With replies entered, change a rule on the Judge step.

**Expected**: automatic decisions are recomputed, decisions made by hand are kept, the judge
version changes, and the Results step, the evaluation file and the report note that the rules
were corrected after the replies were received.

### V9. Save, continue, reproduce (SC-003, SC-008, SC-029, User Stories 6, 9 and 13)

1. Part-way through Run, "Save evaluation" (choose a file), enter two more replies, "Save
   evaluation" again, then "Save evaluation as" to a second file. Reload the page. "Load
   evaluation" with the first file, enter a reply, "Save evaluation".
2. Finish; on Results "Open" a case from the Test case list and use "Next test case"; change a
   threshold in "Details". "Export HTML report" and "Save evaluation" on Run. Reload, load the
   evaluation file only (no test project).
3. Open the HTML report in a browser without the tool and print it to PDF.
4. Remove the saved file on disk and press "Save evaluation".
5. "Save test project" twice; then "Edit the judge and run again", "Save test project" and "Save
   evaluation".
6. With replies entered and the indicator showing unsaved changes, "Save test project"; then
   "Load example…" and choose "Save evaluation first".
7. In the test case window paste a case JSON and press "Close without saving".

**Expected**: the second "Save evaluation" overwrites the chosen file without asking for a file;
"Save evaluation as" asks for a file; after loading through the picker, saving goes to the loaded
file (by hand the browser asks once for permission to write; the automated test's in-memory file
does not); a file dropped onto the page does not become the save file; after the load the tool
opens Run and "Continue" opens the first undecided case, so the work resumes exactly where it
stopped. The header indicator says "All changes saved" with the file name after each "Save
evaluation". On Results the case opens read-only with Previous and Next, and only the threshold
can be changed. The loaded JSON shows identical numbers, judge version and test cases version, and
the report can be generated from it. There is no "Export JSON". The test project asks for a file
once and then overwrites it, its name shown in the File menu; after "Edit the judge and run again"
the next "Save test project" and "Save evaluation" each ask for a new file, so the earlier run's
files are untouched. "Save test project" with replies entered leaves the indicator on and says that
replies are kept only by "Save evaluation"; the warning before "Load example…" offers "Save
evaluation first", "Discard" and "Cancel", and the first saves before continuing. "Close without
saving" asks first; no file save action is reachable while the window is open. The report follows
the three views, contains every prompt, expected error, reply and decision with its source, the
added findings with category and difficulty, and prints cleanly. With the file removed, the tool
says it cannot write and asks for a file; nothing on the page is lost.

### V10. Another version of the judge (User Story 12)

1. On Results choose "Edit the judge and run again", change the prompt, run and verify again,
   export.
2. Load the first run's test project again, write other model details, enter the replies of
   another LLM, "Save evaluation" to a new file, export.

**Expected**: the tool asks first when there are unsaved changes, keeps the test cases, clears
replies and decisions; the two exported reports name the same test cases version and different
judge versions. The third report (another LLM) names the same judge version, test cases version,
metric and thresholds as the first and differs only in the model details, replies, decisions and
results.

### V11. Invalid and unsupported files (SC-004, SC-016, SC-017)

Load in turn: a broken JSON file, a test-case file that would make 501 cases, a file with a newer
`schema_version`, a case with a 100,001-character field, a test project without a prompt, a
metric definition with an unknown operation, an evaluation file of another `format`, a retired
error catalog file, a test project given to "Load evaluation", and an evaluation given to "Load
test project".

**Expected**: each is rejected with a message that says what to fix; the data already loaded is
unchanged every time.

### V12. Another metric and my own catalog (SC-005, User Story 14)

1. "Load example…", "Load metric definition…" with `examples/metrics/bias-example.json`, then load
   that example.
2. On Test cases expand "Error categories"; type a new category name for an error to prepare in a
   case with injected errors and save the case; rename a used category; try to remove it; remove an
   unused one.
3. "Load check settings" with `examples/metrics/checks-example.json`.
4. "Load example…", "Load metric definition…" with `examples/metrics/bias-verdict-example.json`,
   load that example, add cases with expected errors, finalize, and paste replies
   `{"biased": true}` and `{"biased": false}` for cases with errors and for clean cases. Then change
   a rule so that it uses a list field.

**Expected**: a new example appears without any other change and its cases have a single field;
the "Error categories" section starts collapsed with "N categories" in its heading once the
project has cases; the new category is in it with "Used by 1 test case"; the rename applies to
every expected error; "Remove" of the used category is disabled with the reason beside it, and
the unused one is removed at once; the thresholds change, the overall result updates, and a
`minimum_sample` in the file is reported as fixed. With the verdict example, the Judge step says
the judge is evaluated per case; a flagged case with errors passes with every expected error found
(also one without a fragment), an unflagged one fails; a flagged clean case awaits the user's
decision; the Summary counts cases and shows the case detection rate and the clean-case
false-positive rate; Error analysis counts cases with counts only; the report and the evaluation
file say the judge was evaluated per case. After the rule change the result, Results and the report
say which way was counted before and after.

### V13. Privacy, accessibility, layout (SC-006, Principle VII)

1. Run the tool in Chrome and in Edge with the network inspector open and complete V1.
2. Repeat key screens, the three windows and the two dialogs (Load example…, Second opinion) at
   360 px width, in dark scheme, and with the keyboard only.
3. Open the tool in another browser (for example Firefox).

**Expected**: no network request carries user data (the Content Security Policy blocks all
connections); nothing remains after the page is closed; automated accessibility checks pass in
light and dark schemes; every action is reachable by keyboard; the case window stacks its columns
on a narrow screen; the action row of the second-opinion dialog stays visible; in an unsupported
browser a notice says the tool supports Chrome and Edge. The accent is red on a black background
(dark) or near-white one (light); every text pair meets 4.5:1; every error and "Fail" carries a
word or a sign besides its color; each step has exactly one primary action in its "what next"
line, besides "Save evaluation" on the Run step.

## Performance checks

- A generated 500-case test project loads, lists, filters and sorts without the interface freezing
  for more than 2 seconds (SC-018).
- A 100-case file shows its import summary within 5 seconds of being chosen (SC-015).
