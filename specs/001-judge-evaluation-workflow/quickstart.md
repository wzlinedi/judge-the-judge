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
- To look at the app by hand, use `npm run build` and then `npm run preview` (http://localhost:4173). Do not use `npm run dev`: the page sets `style-src 'self'` (Principle II), which blocks the styles the dev server adds, so the layout is missing.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies (first time only). |
| `npm test` | Runs unit, contract and integration tests. No browser needed. |
| `npm run dev` | Starts the dev server with live reload. Its styles are blocked by the page policy, so the layout is missing; to look at the app, use `build` and `preview`. |
| `npm run build` | Produces the static site in `dist/`. |
| `npm run preview` | Serves `dist/` locally, as a static host would. |
| `npm run e2e` | Runs the end-to-end and accessibility checks against the built site, in Chromium and Edge. |

Opening `dist/` from any static file server, in any subfolder, must work without configuration.

## Validation scenarios

Each scenario is also an end-to-end test. Expected numbers for the demo data are stored in
`examples/demo/expected-results.json` and asserted by the tests. In the tests, "copy the answer"
means writing it to the clipboard of the browser context (clipboard permission is granted), and
the save dialog of "Save test project" is replaced by an in-memory file
installed with an init script (research.md, sections 6 and 25). By hand, both are the real browser
features.

### V1. First run with demo data (SC-001, SC-009, SC-010, User Stories 1 and 9)

1. Open the tool; in the More menu choose "Load demo…". The demo is loaded at once, with its test run and no load question, and the Judge step opens; go on to Test run.
2. On Results choose "Export HTML report". Then press "Continue" in the "what next" line and
   decide each case it opens. Open Results and export again.

**Expected**: the Judge step shows no welcome section, and its prompt is locked with the reason
and "Load test project…" beside it; Test run shows the demo's started test run with 20 cases and 20 replies, the "what next" line says "15 of 20 cases decided" and
"Continue" opens the first case awaiting verification. The Summary shows the counts of expected
errors (found, not found), additional findings (genuine errors, false positives) and subtle errors
before anything else, then the two rates and one line of overall result with its reason. While
cases await verification the Summary says how many are not decided yet and the overall result is
Inconclusive; afterwards the numbers match the expected results file: 27 of 30 expected errors found
(90%), 2 false positives and 1 genuine error (case 19), which Summary lists under "Genuine errors the test cases missed"
with Open. The test size shows 30 of 30 errors and 10 of 10 clean cases. The first report says that 5 cases are not decided yet;
the second has no such line, and neither is called provisional. The Results bar offers **Export
HTML report** as its main action both times. **Details** is at the top of the Summary, closed;
Error analysis shows a rate in every group (`misattribution` 4 of 4, 100%). On Test run the table
shows Expected errors, Additional findings, Added by hand and Items to decide, and a case without
a reply already lists its expected errors with no marks. (The times of SC-001 and SC-010 are checked by hand with a
first-time user, not by the automated test.)

### V2. Judge from scratch (SC-011 to SC-014, SC-037, SC-038, User Story 2)

1. Type a prompt with `{{prompt_input}}`, `{{prompt_output}}` and `{{context}}`; mark
   `prompt_output` as the judged text.
2. Paste a broken sample reply, then fix it; then paste one wrapped in a code fence.
3. Add a rule with two conditions joined by "any of", then a second rule with "all of".
4. Replace the sample with one that lacks a field used by a rule.
5. "Save test project" (More menu), reload the page, "Load test project".

**Expected**: the step shows no buttons of its own besides "Add rule", "Add condition" and
"Remove"; exactly the three variables are listed and `context` (the last) was proposed as the
judged text before the change; the broken sample shows its line and column under the box and the
text is kept; the fixed one is read at once, with no read button, and its fields appear with
their paths and values; the preview marks the right parts as findings and names the rule; the
rule that lost its field is marked broken; the reloaded judge set is identical, with the same
version, and the tool opens the Test cases step (the first step with unfinished work).

### V3. Clean cases (SC-021, SC-034, User Story 3)

1. On Test cases choose "Add test case", then "Clean case"; type a name, pick a
   "Like case" when one exists, "Copy prompt", run it in an LLM, paste the answer into the box and
   "Save case".
2. Paste an answer with expected errors into a new clean case window.
3. Make a copy of a case by hand ("Export test cases", then "From JSON" in a new case with a new name; a similar case
   with "Case with errors" started from a case with errors, T262), "Save case"; "Rename" the copy to a name another case has, then to a free name;
   "Remove" the copy. There is no "Clone" button.
4. Remove a clean case that another case uses as its base.

**Expected**: the prompt contains the judge prompt, its variables and judged text, the catalog,
the fields of the picked case; the answer is checked as it is pasted, its fields
are shown read-only and the case is saved under the typed name; the answer with expected errors is
a problem that points to "From JSON"; the table shows Kind "Clean" and the buttons Open,
Rename and Remove on every row; the copy is a new case with no link to the original, the taken name is refused; the removal of the base asks as for any case and then succeeds; the cases made from it stay and
have an empty Base column.

### V4. A case with injected errors (SC-022 to SC-024, SC-031, SC-033, SC-035, SC-036, User Story 4)

1. On Test cases choose "Add test case", then "Case with errors"; pick a base case; list
   two errors to prepare (one with a new category name typed in); "Copy prompt".
2. Run it, paste the answer into the box on the same page (there is no "Next").
3. Read the list of expected errors under the box; change a fragment in the JSON so it
   no longer occurs; fix it; press "Show the issue" on E1; "Save case" (in the header of the window).
4. "Add test case", "From JSON", paste a JSON identical to its base but with one expected error; "Save case".
5. "Open" a case with five expected errors at 1280 x 720; there is no "Show JSON"; use
   "Next case".
6. "Start test run"; "Open" a case, with or without a reply, "Edit expected errors", change one difficulty and
   save (a case with a reply asks first); break the JSON and see the place.

**Expected**: the prompt contains the judge prompt, the base case, the judged text and each error
with its category's description; the JSON box shows problems with their line and
column or field path and "Save case" is enabled only when valid, with the reason beside it; the list
under the box shows E1 and E2 and no check line of text against list; the broken fragment says only "not found in the case" and has no "Show the issue"; "Show the issue" on E1 marks its passage in the fields shown above the list (an error whose passage is not in the case has no button); the new
category is added to "Error categories"; the saved case records its base; the unchanged version is
saved like any other case, with no question; the five expected errors are visible without scrolling; the pasted JSON
gives the same fields and expected errors; after the start only the expected errors change, the
field change is a problem, and the test cases version changes.

### V5. Import and export test cases (SC-015 to SC-020, User Story 5)

1. "Import test cases" (More menu), "Download example file", add rows in a spreadsheet, including
   one invalid row and Polish characters.
2. Choose the file and read the summary; import the valid rows. Then import a JSON file of cases
   with a category that is not in the catalog and an identifier already used.
3. "Export test cases"; "New test project" and import the exported file.
4. "Save test project", reload the page, "Load test project…".
5. "Start test run", change a threshold in "Details" on Results, "Save test project", reload,
   "Load test project…".
6. After entering one reply, import one more case.

**Expected**: the example has `name` and one `field:` column per variable of the current prompt,
and every CSV row becomes a clean case; the invalid row is listed with its position and reason;
the imported cases are added to those already there; the unknown category is named and added only
after consent; the used identifier gets a new one and the summary says so; the export holds every
case and imports back with identical content and version; the reloaded cases are identical and
open, and the file without a test run loads with no question. The started test project asks the
load question; "Load with the test run" brings it back started on the Test run step, with the
changed threshold and the same metric, and the prompt locked. The case imported after
the first reply starts as Not run, is marked "added after first reply", and the replies of the
other cases are kept.

### V6. Run by hand (SC-002, SC-030, SC-032, SC-037, User Story 7)

1. Open Test run before the start: every action is disabled with "Start the test run first".
   On Test cases press "Start test run". On Test run write two lines of model details. Choose
   "Open" at the first case.
2. "Copy prompt", copy a reply into the clipboard, "Paste reply", "Next case".
   Repeat with Alt + Right.
3. Paste a reply written on one line into the box of a case without a reply: it is saved at once and shown read-only, with new lines, an indent of 2 spaces and the findings highlighted ("F1 · rule name"); press a finding on the right, then a highlighted block. "Change reply", edit the text, "Save reply" (asks first) for a case that
   has only automatic decisions, then for a case with a decision set by hand; "Cancel" drops the edits.
4. With an empty clipboard press "Paste reply"; then deny clipboard permission and
   press it again; paste a reply that is not JSON into the box with Ctrl+V: it says "This is not JSON", and "Keep as
   text" keeps it.
5. Empty the box of a saved reply: it asks "Remove the judge’s reply?"; Cancel keeps it, "Remove reply" makes the case Not run again.
6. Save 25 replies without "Save test project".

**Expected**: the Test run step shows one summary line (judge version, test project name, test cases
version, judged text) with no prompt or rules, a multi-line "Model details" box whose lines are
kept, and no save button of its own: "Save test project" is in the page header, with its file name under it. The window fills the screen at 1280 x 720 as one page of three parts (the case with its
highlights; a row with "Add finding", "Second opinion…", "Marked N of M" and the status; then "Judge
reply" with the box (or, once a reply is saved, the reply read-only with its findings marked) and "Paste reply" below it on the left and the errors on the right), which scrolls as a whole; "Copy prompt" (part 1) is the primary
button until it is pressed, then "Paste reply"; the reply box of a case without a reply is always visible and
never behind a collapsed section, a saved reply is read-only and "Change reply" opens the box with "Save reply" and "Cancel", and the complete prompt opens from "Show prompt" in a dialog with only "Close";
the reply is saved by the paste itself and the marks appear on the right, with no "Approve" and
"Add finding" and "Second opinion…" as visible buttons; the position ("case 2 of 20") is always visible; one case takes no more than three
actions; every change of a saved reply asks, naming the marks set by hand; an emptied box asks and removes the reply; both reset the case and recompute the automatic marks; an empty clipboard is explained
and changes nothing; a refused clipboard points to the box; the non-JSON reply is kept, its line
and column are shown and nothing is marked automatically; each reply is stored with the prompt that
produced it; the number of unsaved replies is shown and a reminder to save appears at 25.

### V7. Marking, with an LLM opinion (SC-027, SC-028, SC-039, User Story 8)

1. "Open" a case that awaits verification; "Second opinion…"; in the window "Copy prompt", run
   it, paste the answer into the box.
2. Read the preview; "Apply opinion". Change one of the marks it set; "Ignored" one item.
3. Open "Second opinion…" again and paste an opinion meant for another case; then one that answers
   no item; "Cancel".
4. Tick "only cases awaiting verification" in the case window and use "Next case".
5. For a reply that could not be read, "Add finding" with a category and difficulty; mark it;
   remove another added finding; "Second opinion…" with an opinion that adds a new finding;
   "No more findings".

**Expected**: the Test run step has no second-opinion card; clear items are already marked, with
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
version changes, and the Results step, the test project file and the report note that the rules
were corrected after the replies were received.

### V9. Save, continue, reproduce (SC-003, SC-008, SC-029, User Stories 6, 9 and 13)

1. Part-way through Test run, "Save test project" (choose a file), enter two more replies, "Save
   test project" again, then "Save test project as…" to a second file. Reload the page. "Load
   test project…" with the first file, choose "Load with the test run", enter a reply, "Save test
   project".
2. Finish; on Results "Open" a case from the Test case list and use "Next case"; change a
   threshold in "Details". "Export HTML report" and "Save test project". Reload and load the file
   with "Load with the test run".
3. Open the HTML report in a browser without the tool and print it to PDF.
4. Remove the saved file on disk and press "Save test project".
5. With replies entered and the indicator showing unsaved changes, choose "Load demo…" and then
   "Save test project first".
6. Drop the saved file onto the page and choose "Load with the test run"; press "Save test project".
7. In the test case window paste a case JSON and press "Close without saving".

**Expected**: the second "Save test project" overwrites the chosen file without asking for a file;
"Save test project as…" asks for a file; after "Load with the test run" through the picker, saving
goes to the loaded file (by hand the browser asks once for permission to write; the automated
test's in-memory file does not). After the load the tool opens Test run and "Continue" opens the
first undecided case, so the work resumes exactly where it stopped. The header shows one save
button and one indicator, which says "All changes saved" with the file name after each "Save test
project", also while replies exist. There is no "Save evaluation", "Load evaluation…" or "Export
JSON". On Results the case opens read-only with Previous and Next, and only the threshold can be
changed. The loaded file shows identical numbers, judge version and test cases version, and the
report can be generated from it. The warning before "Load demo…" offers "Save test project first",
"Discard" and "Cancel", and the first saves before continuing. The dropped file loads but does not
become the save file: "Save test project" asks for a file. "Close without saving" asks first; no
file save action is reachable while the window is open. The report follows the three views,
contains every prompt, expected error, reply and decision with its source, the added findings
with category and difficulty, and prints cleanly. With the file removed, the tool says it cannot
write and asks for a file; nothing on the page is lost.

### V10. Another version of the judge (User Stories 11 and 12, FR-053, FR-074)

1. With the test run started, open the Judge step and try to change the prompt.
2. Save the test project. "Load test project…" with that file and choose "Load the test project
   only". Change the prompt, "Start test run", run and verify again, "Save test project", export.
3. Load the first file again with "Load the test project only", write other model details, enter
   the replies of another LLM, "Save test project" to a new file, export.
4. Load the first file with "Load with the test run".

**Expected**: the prompt and the judged text are locked, with the reason and "Load test project…"
beside them; the rules, the reply mapping and the categories stay editable. "Load the test project
only" asks first when there are unsaved changes, keeps the test cases, rules, categories, metric and
thresholds, has no replies, decisions, model details or "added after first reply" marks, and opens
Test cases with the test run not started. The header says "no file yet", and the first "Save test
project" asks for a new file, so the first file is never overwritten. The two exported reports name
the same test cases version and different judge versions. The third report (another LLM) names the
same judge version, test cases version, metric and thresholds as the first and differs only in the
model details, replies, decisions and results. The first file still holds its own test run. There
is no "Run again with a new judge…" and no "Reopen test cases".

### V11. Invalid and unsupported files (SC-004, SC-016, SC-017)

Load in turn: a broken JSON file, a test-case file that would make 501 cases, a file with a newer
`schema_version`, a case with a 100,001-character field, a test project without a prompt, a
metric definition with an unknown operation, a file of an unknown `format`, an evaluation file of
an earlier build (`judge-the-judge-evaluation`), a retired error catalog file, a test project whose
`test_run` section is invalid, and a version 1 test project file with `dataset.finalized`.

**Expected**: each invalid or unsupported file is rejected with a message that says what to fix,
and the data already loaded is unchanged every time. The evaluation file gets the message for an
unknown `format`, which names the supported ones. The test project with an invalid `test_run` is
refused before the load question. The version 1 file loads, with the test run not started and a
note that it was upgraded.

### V12. Another metric and my own catalog (SC-005, User Story 14)

1. Load a test project that carries the metric of `examples/metrics/bias-example.json` in
   `metric.definition` ("Load test project…"); no other step is needed.
2. On Test cases expand "Error categories"; type a new category name for an error to prepare in a
   case with injected errors and save the case; open **Example** of a used category and move with Next case; rename a used category (the window says what changes); try to remove it; remove an
   unused one.
3. In Results › Details change the detection-rate threshold.
4. Load a test project that carries the metric of `examples/metrics/bias-verdict-example.json`,
   add cases with expected errors, "Start test run", and paste replies
   `{"biased": true}` and `{"biased": false}` for cases with errors and for clean cases. Then change
   a rule so that it uses a list field.

**Expected**: a new example appears without any other change and its cases have a single field;
the "Error categories" section starts collapsed with "N categories" in its heading once the
project has cases; the new category is in it with "Used by 1 test case"; the rename applies to
every expected error; "Remove" of the used category asks first (the expected errors keep their text and lose the
category), and the unused one is removed at once; the threshold changes and the overall result updates; there is
no **Load check settings**. With the verdict example, the Judge step says
the judge is evaluated per case; a flagged case with errors passes with every expected error found
(also one without a fragment), an unflagged one fails; a flagged clean case awaits the user's
decision; the Summary counts cases and shows the case detection rate and the clean-case
false-positive rate; Error analysis counts cases with counts only; the report and the test
project file say the judge was evaluated per case. After the rule change the result, Results and the report
say which way was counted before and after.

### V13. Privacy, accessibility, layout (SC-006, Principle VII)

1. Run the tool in Chrome and in Edge with the network inspector open and complete V1.
2. Repeat key screens, the three windows and the two dialogs (Load demo…, Second opinion) at
   360 px width, in dark scheme, and with the keyboard only.
3. Open the tool in another browser (for example Firefox).

**Expected**: no network request carries user data (the Content Security Policy blocks all
connections); nothing remains after the page is closed; automated accessibility checks pass in
light and dark schemes; every action is reachable by keyboard; the case window stacks its columns
on a narrow screen; the action row of the second-opinion dialog stays visible; in an unsupported
browser a notice says the tool supports Chrome and Edge. The accent is red on a black background
(dark) or near-white one (light); every text pair meets 4.5:1; every error and "Fail" carries a
word or a sign besides its color; each step has exactly one primary action in its "what next"
line.

## Performance checks

- A generated 500-case test project loads, lists, filters and sorts without the interface freezing
  for more than 2 seconds (SC-018).
- A 100-case file shows its import summary within 5 seconds of being chosen (SC-015).
