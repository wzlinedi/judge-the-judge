# Feature Specification: Judge the Judge

**Feature Branch**: `001-judge-evaluation-workflow`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User descriptions (translated from Polish):
- "judge-the-judge high-level document: a tool that evaluates LLM-as-judge judges. Users supply a judge prompt package (from a file or typed/pasted in the app), prepare test cases with deliberately injected defects plus clean cases, run the composed prompt in an LLM outside the tool and paste back the JSON answer, then see how well the judge performs (detection rate, false alarms, with confidence intervals), compare two judge versions, and reproduce any past result. Runs without infrastructure, accounts or database; data stays on the user's device."
- "How will we handle a dataset so that data is not added one item at a time?" (formerly spec 002, bulk dataset handling)
- "I want to be able to add test cases by hand, with help and with generation of error injection." (formerly spec 003, manual case authoring)
- "Review of prototype v7: the judge prompt may use any variables; I paste a sample reply, the tool shows its fields and I write my own rules for what counts as an error; clean base cases are kept in the judge set; a case with an injected error is prepared in one window; verification is its own step; results are a simple summary in three views; no Compare for now. It must stay a simple system: I copy prompts into an LLM by hand and paste the replies back."
- "Review of prototype v15: fewer buttons on the Judge step, no welcome section, Save evaluation only on Run; a category in use cannot be removed and shows its number of test cases; Error categories and Clean cases can be collapsed; a test case has Rename, Remove and Open; a clean case is made from a name, a comment and an LLM answer whose structure is checked; a case with injected errors is made from JSON (prepared with an LLM or pasted), shown read-only and changed only through its JSON; Open is read-only and gives back the JSON; Run marks every item as found, missed, false positive or ignored." Names in the feedback were examples; the names used here are the tool's.

## Clarifications

This one specification replaces the former specs 001, 002 (bulk dataset handling) and 003 (manual
case authoring). Every answer below is current. Answers that were later replaced were removed on
2026-11-11, first when the specs were merged and again after the review of prototype v7, when the
requirements, user stories and success criteria were also renumbered (the full history is in git).
On 2026-11-13, after the review of prototype v15, the answers it superseded were rewritten in
place; requirement numbers were kept and retired requirements carry a note.

### Session 2026-11-08

- Q: What is a test case, and what stays fixed? → A: A test case has a name, named fields (its input data, one for each variable in the judge prompt), zero or more expected errors, and a final prompt. The prompt is the judge prompt with the case's fields filled into its variables and nothing else added by the tool. The prompt input stays unchanged during testing.
- Q: How are results shown while some cases still await verification? → A: Results are computed from the already decided cases, clearly labeled provisional, with the number of pending cases shown.
- Q: How are expected errors modelled so that any judge prompt fits? → A: An expected error is universal: a category from the error catalog, an optional fragment, a description of what is wrong and an optional difficulty; it always concerns the judged text. Test cases use one JSON format for files and for the LLM test-data round trip; a compact one-line convention (`category | "fragment" | description`) is accepted in CSV cells.
- Q: Are the initial category sets and the variable syntax acceptable? → A: Yes to the initial Accuracy and Completeness category sets (see Assumptions), and the variable syntax stays `{{name}}`.
- Q: Does each test case have its own full prompt? → A: No. One judge prompt serves the whole evaluation and each test case supplies its own input data; the final prompt for a case is composed from the two. Since the review of prototype v15 a saved test case, its expected errors included, is not changed at all (see Session 2026-11-13).
- Q: Do exported reports and result files always contain the full prompts and received replies? → A: Yes, always. Reports and result files contain the real, full data (final prompts with the actual input data, expected errors, received replies, decisions), with no option to leave it out, so that every result can be reproduced and verified. The Help states that exported files contain the user's data and should be handled accordingly.
- Q: Should the tool remember the loaded data and replies after the page is closed? → A: No; work exists only for the current page session and is kept only by saving it to a file on the user's device ("Save evaluation").
- Q: How is each case identified? → A: Use the identifier from the file when present; otherwise assign numbers by row order and tell the user.
- Q: When can the user see the full prompt that goes to the LLM? → A: Whenever a judge prompt and a case are present, including while the test cases are still being built: the complete composed prompt for the chosen case is shown ready to copy. Only entering the judge's replies waits for finalizing.
- Q: Can the judge prompt and test cases change after they are loaded? → A: Not once the dataset is finalized. A dataset stays open until the user finalizes it, whether it came from a file, was built by hand, or both; entering replies is available only after finalizing, and from then on the judge prompt and the cases stay fixed for the evaluation. Changing them means starting a new evaluation.

### Session 2026-11-10

- Q: Does one evaluation test one judge or several at once? → A: One judge. Accuracy and Completeness judges are each tested in their own evaluation, with their own test cases and their own report.
- Q: Is detection counted per injected error or per test case? → A: Per error. The detection rate is the expected errors found divided by all expected errors, with a breakdown per category (expected, found, missed, rate). The judge must also not report more than was expected: an **additional finding** (one that matches no expected error) is checked by the user, and when it is a false positive it counts against the judge in any case, clean or not. A case passes only when every expected error is found and no false positive is reported.
- Q: On what basis does the tool give the final answer "the judge works / does not work"? → A: Thresholds and a minimum sample. Defaults: detection rate at least 80% and false-positive rate at most 10%. The final answer is **Works** when both thresholds are met, **Does not work** when either is not, and **Inconclusive** when cases are not run or still await verification, or the sample is too small (fewer than 30 expected errors or fewer than 10 clean cases, fixed in the tool). The values used are stored with the result and shown in the report. Because the user tests narrative texts in which exact errors are hard to pin down, the tool also prepares a **verification prompt** for the user's own LLM (case data, expected errors, received reply); the LLM returns a JSON opinion that the user pastes back.
- Q: Does the external LLM's verification opinion count at once as a decision, or only after the user approves it? → A: Only after approval. Since the review of prototype v16 the approval is "Apply opinion" in the second-opinion window, pressed after the window has shown every change the opinion makes; there is no approval of several cases at once. A mark set this way records its source as "LLM opinion, approved by the user", the user can change it afterwards, and the report shows the source of every decision.
- Q: What does the judge prompt return: a list of specific errors or only an overall rating? → A: An itemized list in the judge's own JSON. The user's judges are claim-based: the judge splits the judged text into smaller parts and returns them as JSON with an assessment of each part. A part for which one of the user's error rules holds is a **finding**, and its text is the place it points at. Because such a judge names no error categories, an expected error counts as found when a finding points at its fragment; a matching category is not required. The error catalog describes the errors injected into the test data and groups the results; the judge does not have to use it. A judge that returns only an overall rating can be read by rules, but its findings point at no place, so every case is then verified by hand or with an LLM opinion.
- Q: Is the judge one prompt whose single reply holds the parts together with their assessment, or a chain of several prompts? → A: One prompt and one reply per test case; splitting the text and assessing the parts happen together. A judge built as a chain of prompts, where one reply feeds the next prompt, is out of scope for this version.
- Q: Should every injected error carry a difficulty mark, so that results show whether the judge misses only subtle errors? → A: Yes, two levels. An expected error may be marked **obvious** or **subtle**. The prompts that generate errors ask for a mix (half of each by default) and explain both levels; the user can change the mark. Results show the numbers separately for obvious and for subtle errors, and finalizing warns when the dataset has no subtle errors.
- Q: In which unit are false positives counted for the final answer? → A: Per finding. The false-positive rate is the additional findings confirmed as false positives divided by all findings the judge reported, in clean and defective cases alike, for example "6 of 40 findings were wrong (15%)". The 10% threshold applies to this figure.

### Session 2026-11-11

- Q: How does the user see whether the dataset is big enough for a final answer? → A: The counts are computed automatically from the test cases and shown with the results as a "Test size" summary: total cases (judge runs), clean cases, cases grouped by number of injected errors (for example "10 cases with 2 errors"), total injected errors, and each total against its minimum (met / missing N). The user never enters or calculates these numbers.
- Q: Where does the minimum test size come from, if the user does not enter it? → A: It is fixed in the tool: 30 injected errors and 10 clean cases, not editable. The results state plainly that the system needs at least 30 injected errors and 10 clean cases to give a final answer. All Help is written in plain, everyday language.
- Q: Should the three specifications (001 evaluation workflow, 002 bulk dataset handling, 003 manual case authoring) stay separate? → A: No. They are merged into this one specification, with duplicates removed and requirements, user stories and success criteria numbered in one sequence, followed by one plan and one task list.
- Q: Should the tool have its own built-in rules for injecting errors, or is the generation prompt for the user's LLM enough? → A: The prompt is enough, plus editing by hand. There are no built-in rules that change text; they would give artificial, easy-to-spot errors in narrative texts and overstate the detection rate.
- Q: How long may one text in a test case be? → A: Up to 100,000 characters per field, with a warning above 30,000 characters that the prompt may not fit the model's context window; longer fields are refused with the limit stated.
- Q: Should answers that were later replaced be removed from this section? → A: Yes. Superseded answers were removed and the remaining ones trimmed to what still holds; the full history is in git.
- Q: What does the tool do when the judge prompt uses a variable (such as `{{context}}`) that a test case has no field for? → A: The variable is filled with empty text and the case is flagged with a warning; finalizing is still allowed.
- Q: Should the tool look for the judge's JSON inside a reply that wraps it in other text or a code fence? → A: Yes. It uses the first complete JSON block it can read (inside a code fence or in plain text); if none can be read, the case waits for verification.
- Q: (Prototype v7 review) Which variables may the judge prompt use, and which fields does a test case have? → A: Any. The tool detects every variable written as `{{name}}` and assumes no names of its own (no built-in `input` or `output`, no aliases). The detected variables are the fields of every test case and every clean base case; the field an error is injected into is chosen by the user.
- Q: (Prototype v7 review) How does the tool read the judge's reply, and who decides what counts as an error? → A: Two separate things. The **reply mapping** only recognizes the structure of a pasted sample reply: its fields and their paths, and which field holds the text a finding points at. The user alone writes the **error rules**: each rule joins any number of conditions on those fields with "and" or "or" (for example "field A and field B are true", or "field A or field B is true"), and the judge has reported an error when at least one rule holds. Every field used in a rule must occur in the sample reply. The tool never proposes or changes rules.
- Q: (Prototype v7 review) What is a judge set? → A: Everything on the Judge step: the judge prompt, the sample reply with its reply mapping and the error rules. The error catalog and the clean base cases belong to the Test cases step (Sessions 2026-11-12 and 2026-11-13). Since 2026-11-12 the judge set is saved and loaded together with the test cases as one test project file.
- Q: (Prototype v7 review) How is the error catalog filled and updated? → A: It is a starting set of categories (name, optional description and example) that the user extends. Nothing is added to it automatically. The user adds a category by typing it in the "Error categories" section of the Test cases step, or by typing a new name where the category of an error to prepare is given; an expected error takes its category from the catalog. The catalog has no file of its own; it is saved inside the test project (Session 2026-11-12).
- Q: (Prototype v7 review) What are clean base cases? → A: Complete inputs for the judge (a value for every variable) with no injected errors. The user makes them one at a time with a prompt for their own LLM, or imports them (Session 2026-11-13). They are saved with the test cases of the test project, listed in the table of test cases as "Clean", and any of them can be the base that a case with injected errors is made from.
- Q: (Prototype v7 review) How is a test case with an injected error prepared? → A: Since the review of prototype v15: from the case's JSON, prepared with the user's LLM or pasted ready (see Session 2026-11-13). The category's description is not typed again.
- Q: (Prototype v7 review) How are test cases and the Run step laid out? → A: Test cases: see Session 2026-11-13 (prototype v15 review). Run: all cases in one list; a button at each case opens a window with the case, its expected errors, the judge prompt to copy and a place to paste the LLM's reply. Every judge prompt and reply is kept with its case.
- Q: (Prototype v7 review) Where are differences between expected and reported errors resolved? → A: In the case window of the Run step, right after the reply is saved (since the review of prototype v9 there is no separate Verify step). The tool decides what can be settled from valid JSON and the explicit rules. For the rest the user may ask their own LLM for a second opinion (was the expected error found; is an additional finding a real error or a false positive), shown with a short reason and the matching fragment of data. The user decides last: applies the opinion after seeing every change it makes, or sets the mark of an item ("Found", "Issue: missed", "Issue: false positive", "Real error", "Ignore"; see Session 2026-11-13). An additional finding marked as a real error is counted separately and is not added to the expected errors.
- Q: (Prototype v7 review) What do the results show? → A: Three views. Summary: the main numbers (expected errors with found and missed; additional findings with confirmed real errors and false positives; subtle errors with found and missed) and the overall result. Error analysis: results per category and per difficulty. Test case list: every case with its expected errors, the judge's result and its verification status. Results export to HTML and JSON.
- Q: (Prototype v7 review) What happens to Compare? → A: It is removed at this stage, together with the result shelf and every action and transition that led to it. Changing the judge prompt and running the same test cases again stays, as one action on the Results step.
- Q: (Prototype v7 review) Does Help change? → A: Not in this update. The Help requirements stay as they are; the Help content is brought in line with the new flow when the features are built.
- Q: What is the "overall result" on the Results step, and what happens to thresholds and advanced statistics? → A: The counts and the two rates come first, with one line of final answer (Works, Does not work, Inconclusive) and its reason below them. The thresholds and the confidence intervals move to a collapsed "Details" section. The combined score is removed.
- Q: Does loading test cases from CSV stay, and what happens to "CSV template" and "JSON template"? → A: CSV and JSON loading both stay. The two template actions are replaced by one "Download example file" action with a plain one-sentence explanation of what the file is for.
- Q: Do the export of all prompts to one file and the import of all judge replies from one file stay on the Run step? → A: No. They are deferred until the tool is connected to an LLM. For now replies are entered one case at a time.
- Q: Do clean cases added or loaded on the Test cases step also become clean base cases of the judge set? → A: Yes, one list. A clean case from any source is a clean base case and is saved with the test cases; it can be used as the base for errors.
- Q: May a single error rule combine fields of a list in the reply with fields outside it, and how is the finding text set? → A: Yes, one list at most: fields outside the list are read once and apply to every item. The field holding the text of a finding is marked per list.
- Q: (Run review of prototype v8) How is the window that opens from a case laid out? → A: In two columns that fill the whole screen. Data on the left, outcome on the right. The left column holds the case name, its fields and expected errors and the judge prompt with "Copy prompt"; the right column holds the place for the LLM's reply ("Paste reply from clipboard", see Session 2026-11-12) and, once the reply is saved, the received reply, the differences and the user's decisions. Each column scrolls on its own, so nothing is hidden.
- Q: (Run review of prototype v8) How does the user move between cases without going back to the list? → A: "Previous test case" and "Next test case" buttons at the top of the window, always visible, also usable from the keyboard, with the position shown (for example "case 7 of 20"). Moving may be limited to cases that await verification.
- Q: Does the judge version change when the error rules or the reply mapping are corrected after the test cases are finalized? → A: Yes. The judge version covers the prompt, the reply mapping and the error rules, so any correction gives a new version. Replies and decisions are kept, and the result and the report note that the rules or mapping were corrected after the replies were received, naming the version in force when they were received.
- Q: What happens to the decisions of a case when a new reply replaces its old one? → A: They are removed, because they described the old reply, and the automatic decisions are computed again. When decisions set by hand or approved from an LLM opinion would be removed, the tool asks first and says how many (see Session 2026-11-12).
- Q: Should the Judge step have a separate place for an example of correct data for which no error should be reported? → A: No separate kind of data. One place holds the clean base cases, and they are that example: the clean cases in the table of the Test cases step, where each has a name and can be added, opened, renamed or removed. They show the expected behavior and never replace the explicit rules.

### Session 2026-11-12

- Q: (Prototype v9 review) Is there a details panel below the list of test cases? → A: No. A case is shown by opening it; the layout of the Test cases step is set in Session 2026-11-13.
- Q: (Prototype v9 review) What does "Add test case" do? → A: It opens the test case window with a choice: a clean case or a case with injected errors (Session 2026-11-13). It replaces "Prepare a case with an error". A clean case added here is also a clean base case.
- Q: (Prototype v9 review) Where are errors injected, and does an expected error still name a field? → A: Errors are always injected into the judged text: on the Judge step the user marks one variable as the **judged text** (the output the judge evaluates; the last variable is proposed). An expected error no longer has a field. Its fragment is looked for in the judged text and, for an omission, in the other fields.
- Q: (Prototype v9 and v10 review) What does the Run step show besides the cases? → A: A short summary of the judge being run (judge version, test project name and version, judged text), without the text of the prompt or the rules, and a multi-line free-text "Model details" box where the user writes the model and its settings for the judge run.
- Q: (Prototype v9 review) Is Verify still a separate step? → A: No. There are four steps: Judge, Test cases, Run, Results. In the case window of Run the differences and the decisions appear right after the reply is saved.
- Q: (Prototype v9 review) How is long manual work protected if the page stops responding? → A: "Save evaluation" is on the Run step and in the header of the case window of Run, the number of replies not yet saved to a file is shown, and a reminder appears after every 25 unsaved replies. Nothing is saved automatically in the browser; FR-004 is unchanged.
- Q: (Prototype v10 review) Can anything be changed on the Results step? → A: No; it is read-only, apart from the thresholds (see the next answer), and "Open" in the Test case list shows a case without editing. Changes are made on the Run step or the Judge step.
- Q: (Prototype v10 review) Where are the thresholds for "Works" set, now that the Results step is read-only? → A: They stay in the "Details" section of the Results step, together with "Load check settings", as the only thing that can be changed there.
- Q: (Prototype v10 review) Must the evaluation be closed before it is exported? → A: No. There is no closing step; it changes little in practice. "Export HTML report" is available at any time, and the result and the report are marked provisional while cases are not run or await verification.
- Q: (Prototype v10 review) Does "Export JSON" stay, now that "Save evaluation" writes the same file? → A: No. "Export JSON" is removed because it duplicated "Save evaluation". The result as JSON is the evaluation file written by "Save evaluation" or "Save evaluation as", and it carries the provisional mark while cases are undecided.
- Q: (Prototype v10 review) What happens when the user pastes the judge's reply from the clipboard in the case window? → A: "Paste reply from clipboard" reads the clipboard and saves the reply in one action, and the differences appear at once. A new reply always resets the case: its decisions are removed and the automatic decisions are computed again. The tool asks first only when the case has decisions set by hand or approved from an LLM opinion, saying how many; otherwise it replaces the reply without asking. The right column is headed "Judge's reply", shows the four steps (Copy prompt, run it in a new conversation, copy the answer, Paste reply from clipboard), and, since the review of prototype v15, always shows the box for the reply (pasted with Ctrl+V and kept with "Save reply").
- Q: (Prototype v11 review) Which files does the tool work with, and how are they saved? → A: Two files. The **test project** holds the judge set (settings, rules, error catalog) together with the test cases, and is loaded to run the same test again, for example with another LLM or other model settings. The **evaluation** holds the whole progress of one run: the test project, every prompt, reply and decision, and the results. Each has its own remembered file: the first save asks for a file, later saves overwrite it, and "Save … as" picks a new one. "Save judge set" and "Save test cases" as separate files are removed. The unsaved-changes indicator is about the evaluation. The Results step has no file of its own. Loading an evaluation alone is enough to see the result and generate the report. Since the review of prototype v15 the evaluation is saved only on the Run step (Session 2026-11-13).
- Q: (Prototype v10 review) Which browsers must the tool support? → A: Only current Google Chrome and Microsoft Edge.
- Q: (Prototype v10 review) Is the second opinion from an LLM asked for per case or for all cases at once? → A: Per case: since the review of prototype v16 the "Second opinion…" button of the case window opens a window for that case (see Session 2026-11-13). The card on the Run step and "Approve all proposals" are removed.
- Q: (Prototype v10 review) Where is the work saved, and can the whole progress be saved and loaded back? → A: Only in files on the user's device; there is no server and no temporary file. "Save evaluation" (on the Run step) saves the whole progress (judge set, test cases, every prompt, reply and decision, and the results), "Save test project" saves the work before the run, and "Load evaluation" restores it.
- Q: (Prototype v10 review) How does "Save evaluation" write the file, now that only Chrome and Edge are supported? → A: The first "Save evaluation" asks for a file name and folder; every later one overwrites that same file without asking. "Save evaluation as" saves to a new file, and after "Load evaluation" saving goes to the loaded file. The reminder after every 25 unsaved replies stays.
- Q: (Prototype v11 review) Does the tool compute the result by itself for a judge that returns only a verdict for the whole text (for example a bias judge answering "biased: yes or no" or a score) and no list of problems? → A: Yes, in a minimal way. When every error rule uses only fields outside any list, the case is judged as a whole: flagged or not flagged. The result then uses two case-level measures (cases with errors that were flagged; clean cases flagged wrongly) and the minimum sample is counted in cases. Graded ratings ("partly present") and checking a number the judge returns against an expected number stay out of scope.
- Q: (Prototype v11 review) Which simplifications of the interface are required? → A: Three, besides keeping the file actions in the header's "File" menu ("Save evaluation" is on the Run step since the review of prototype v15). (1) Each step shows one "what next" line with one primary action; longer explanations move to Help and to hints opened on demand. (2) After a file is loaded the tool opens the first step with unfinished work and offers "Continue", which leads to the first case that is not decided. (3) Fewer buttons: the case window of Run shows one primary action, and the actions needed less often ("Add finding", "Second opinion…") are visible buttons under the list of items (no "More actions" since the review of prototype v16); the actions of a table row are set in Session 2026-11-13.
- Q: (Prototype v11 review) In what state does a loaded test project come back when it was finalized when saved? → A: As it was saved. A finalized test project comes back finalized and the Run step opens, ready for replies. While no reply has been entered, "Edit test cases" opens the dataset for editing again; after the first reply it is no longer offered.
- Q: (Prototype v12 review) Does the test project file also hold the active metric with its parameters and the thresholds for "Works"? → A: Yes. The test project holds the active metric (its id and parameters) and the check settings in use (the thresholds), so that every run of the same test project counts the same way; loading it restores them. The model details stay with each run, in the evaluation.
- Q: (Prototype v12 review) After "Edit the judge and run again", does saving the test project ask for a new file? → A: Yes. That action forgets both remembered files, so the next "Save test project" and "Save evaluation" each ask for a file and never overwrite the earlier run. "Edit test cases" before the first reply keeps both files, because it corrects the same test.
- Q: (Prototype v12 review) What do the counts and the Error analysis show for a judge evaluated per case? → A: Cases, not single errors. The Summary counts cases with expected errors (flagged, not flagged) and clean cases (flagged wrongly, not flagged). Error analysis groups cases by the categories and difficulties of the errors they contain; a case counts once in each of its categories, and the groups show counts only, with no rate.
- Q: (Prototype v13 review) Do "Load catalog" and "Export catalog" stay, and what is the file that holds the judge, settings, errors and test cases called? → A: The catalog has no file of its own: it is saved only inside the one file, which is named the **test project** (formerly "test set"; "Load test project", "Save test project", "Save test project as"). The test project covers the judge, the settings (metric and thresholds), the error catalog and the test cases, without replies.
- Q: (Prototype v13 review) Do clean base cases stay on the Judge step, or are they only on the Test cases step? → A: Only on the Test cases step. The Judge step holds the prompt, the sample reply and the error rules. Clean cases are added with "Add test case" (a clean case, made with the user's LLM; Session 2026-11-13), imported, or come with a ready example; they are listed in the table of test cases as "Clean" and are the base that cases with injected errors are made from. The judge set no longer contains clean base cases of its own.
- Q: (Prototype v13 review) Do loading test cases from a file and "Download example file" stay, now that the work is saved as a test project? → A: Test cases need their own import and export, besides the test project. "Export test cases" writes all cases to a JSON file; "Import test cases" reads a JSON file (the same layout, with expected errors) or a shortened CSV. The shortened CSV has only `name` and one `field:<variable>` column per variable, and every row becomes a clean case; cases with injected errors are made in the test case window or come in with JSON. "Import test cases", "Export test cases" and the example CSV are in the header's "File" menu, not on the Test cases step. Neither is a remembered file: each export asks for a file name, and the test project stays the only way to save the whole work.
- Q: (Prototype v13 review) What does the second opinion from an LLM check, and how does it handle a case with two or more errors? → A: It checks every item of the case on its own: for each expected error whether the judge found it, and for each additional finding whether it is a real error or a false positive, each with a short reason and a quotation from the reply. A case with two errors gets two separate opinions and two separate proposals. The prompt and the second-opinion window say what is checked in one line ("The LLM checks N expected errors and M additional findings of this case").
- Q: (Prototype v13 review) Which colors help the user verify the data in the case windows? → A: Highlights in the texts, always with a number or a word beside the color (FR-077). In the case window of Run and the read-only view: each expected error is highlighted in the judged text with its number, and the judge's findings in its reply are green when they hit an expected error, amber when only partly, red when they match none. In the window for adding a case: the fragments of the expected errors in the text, with their numbers, and the warnings in the warning color.
- Q: (Prototype v13 review) Can test cases be copied, and how are they named? → A: There is no "Clone" (removed in the owner review of 2026-11-14; see the answer about "Clone" below). A copy is made by hand with "Show JSON", "Copy JSON" and "Paste JSON". Test case names are unique, compared without regard to case and surrounding spaces: a new case cannot take a used name (the tool says which case has it), while an import or a loaded file that produces a duplicate is kept and marked with a warning (FR-078, FR-079).
- Q: (Prototype v13 review) Are "Load demo data", "Start from an example" and "Load metric definition" separate steps? → A: No. The demo and an example are only ways to fill the test project; loading a file leads to the same state and there is no second route to it. The example and a loaded metric definition are part of the test project configuration (judge, catalog, metric), not stages of their own. "Load demo data" stays one entry in the File menu.
- Q: (Prototype v11 review) What should the interface look like? → A: Modern, in black and red, and still easy to read: red is the one accent color on a black background (dark scheme) or a white one (light scheme), contrast meets WCAG AA, and red alone never means an error or "Fail" (FR-007).

### Session 2026-11-13

- Q: (Prototype v14 and v15 review) Where is the error catalog, and what happens when a category is renamed or is used by test cases? → A: No section of its own on the Judge step. An "Error categories" section on the Test cases step, which can be collapsed, lists every category with its description, example and the number of test cases that use it; a category is also added by typing a new name where the category of a wanted or expected error is given. Renaming applies to every expected error that uses it and works after finalizing too. An unused category is removed at once. A category used by at least one test case cannot be removed: "Remove" is disabled and the reason is shown beside it ("Used by N test cases. Remove those test cases first, or rename the category."; after finalizing, when every case that uses it has a reply, only the renaming is offered). The earlier choice to move the errors to another category or to leave them without one is removed (FR-015, FR-016, FR-024).
- Q: (Prototype v15 review) Which actions does a test case have? → A: Three, as visible buttons on its row: "Open", "Rename" and "Remove"; a click on the row also opens the case. Once the test cases are finalized "Open" stays enabled, and "Rename" and "Remove" stay enabled for a case without a reply; for a case with a reply they are disabled with the reason. "Modify", "Describe errors again", "Compare with base", "Use selected text as fragment", "Add error"/"Remove" for single expected errors and editing the text of a saved case are removed (FR-008, FR-025, FR-078).
- Q: (Prototype v15 review) What does "Add test case" offer? → A: Three choices, always available: "Paste JSON", "Clean case" and "Case with injected errors" (see the clarification on adding a case below). Clean cases and cases with injected errors are the only two kinds, and these two names are used everywhere (buttons, the Kind column, Help) (FR-038).
- Q: (Prototype v15 review) How is a clean case made? → A: In the test case window: the user types a name and an optional comment (for example what the text should be about, or examples), may pick another clean case in "Like case" as a model, sees the full prompt for their LLM with "Copy prompt", and pastes the LLM's answer into the answer box. The answer is checked as soon as it is pasted or changed against the structure the judge needs (a value for every variable of the judge prompt, no expected errors). When it is right, the fields are shown and "Approve and close" saves the case; when it is wrong, the problem and where it is (line and column, or the field path) are shown under the box. Typing the field values by hand and generating many clean cases at once are removed; many clean cases come in with "Import test cases" (FR-083, FR-084).
- Q: (Prototype v15 review) How is a case with injected errors made? → A: In three parts of the test case window. (1) The user may pick a clean case as the base and prepares the case with their LLM: they pick errors from the error catalog (or type a new category in a text box), give each a difficulty (obvious or subtle, or leave it to the LLM) and a short description, and copy one ready prompt that holds the judge prompt with its judged text, the base case and the chosen errors and asks for the case as JSON (the case with its list of expected errors). (2) The user pastes the LLM's JSON into one edit box; it is checked as it changes, problems are shown with where they are, and "Next" becomes available when it is valid. (3) The tool shows the case read-only: its fields, with the fragments of the expected errors highlighted, and the list of expected errors; the source JSON stays editable beside them and every change in it shows at once in the case and the list. Each expected error has "Show in text", which highlights and scrolls to the place it is at. "Save case" and "Close without saving" are available in all three parts; "Save case" is enabled only when the JSON is valid (FR-040, FR-041, FR-085).
- Q: (Prototype v15 review) What does "Open" show, and how is a saved case changed? → A: A saved case is never edited. "Open" shows it read-only, in the same layout as part 3 above (fields, expected errors with "Show in text"), with "Previous test case" and "Next test case", "Show JSON" (the case's JSON, rebuilt from the case in the same layout that is pasted when a case is made) with "Copy JSON". To change a wrong case the user copies the JSON, pastes it into a new case with "Paste JSON", changes it, saves it and may then remove the original (there is no "Clone") by hand (FR-078, FR-086).
- Q: (Clarify, prototype v15 review) What can still change in the test cases after they are finalized? → A: Two things, besides the reply mapping and the error rules. (1) The expected errors of a case that has no reply yet can be corrected through its JSON ("Correct expected errors" in its read-only view); its fields and name stay fixed. A case with a reply is not corrected; an expected error that should not count is marked "Ignore" on Run. (2) New test cases can be added ("Add test case", "Import test cases"); they start as Not run, and the replies and decisions of the other cases are kept. Each such change gives a new test cases version, and the result and the report say which cases were added or corrected after the first reply. "Rename" and "Remove" work after finalizing only for a case without a reply, and the judge prompt stays fixed (FR-025, FR-053, FR-075, FR-089).
- Q: (Prototype v15 review) What does the Judge step show, and where is "Save evaluation"? → A: Fewer buttons. The Judge step has no welcome section ("Start with your judge prompt, or look at a finished example first." and its three buttons are removed); loading an example, a test project or an evaluation is in the File menu only. The sample reply is read as soon as it is pasted or changed, so "Read sample reply" is removed; problems are shown under the box with where they are. The step's own buttons are "Add rule" (with "Add condition" and "Remove" inside a rule) and the one action of the "what next" line. "Save evaluation" and "Save evaluation as" are only on the Run step (and in the case window of Run); the header keeps the indicator of unsaved changes, the File menu and Help (FR-001, FR-008, FR-011, FR-076).
- Q: (Clarify, prototype v15 review) May the warnings that protect unsaved work offer to save the evaluation, although "Save evaluation" is only on Run? → A: Yes. Before loading a file, "Start new evaluation", "Load example…", "Edit the judge and run again" and leaving the page, the warning offers "Save evaluation first", "Discard" and "Cancel"; this is a safeguard, not a standing action, and the Judge, Test cases and Results steps show no "Save evaluation". A threshold changed on Results is saved with the next "Save evaluation" on Run or "Save test project" (FR-051).
- Q: (Clarify, prototype v15 review) How are clean cases and cases with injected errors shown on the Test cases step? → A: In one table of all test cases, where the Kind column says whether a case is "Clean" or has "Injected errors"; the filter can show one kind. There is no separate "Clean cases" section: its former content (adding a clean case by hand and generating many) is gone. The "Error categories" section can be collapsed and expanded: it is open while the test project has no test cases and starts collapsed when a test project with cases is loaded; a collapsed section shows a one-line summary in its heading ("8 categories"), and the state the user chooses is kept for the page session (FR-015, FR-023, FR-025, FR-087).
- Q: (Prototype v15 review) What does the case window of Run show, and how is each item marked? → A: The case as in the read-only view, without JSON (fields with highlights, expected errors with "Show in text"), the judge prompt with "Copy prompt", and the box where the judge's reply is pasted as JSON. After the reply is saved, the tool reads it with the reply mapping and the error rules and marks every item: an expected error that a finding points at is "Found"; one that no finding points at, fully or partly, is added to the list as "Issue: missed" (the feedback's "expected issue not found") when the case has no additional finding, and otherwise stays undecided (see the next session answers); a finding that points at no expected error is listed as an additional finding for the user to mark "Issue: false positive" or "Real error". "Ignore" is available on every item, and every mark can be changed (FR-055, FR-060 to FR-062).
- Q: (Clarify, prototype v15 review) Which marks does a finding that matches no expected error get on Run? → A: Three: "Issue: false positive", "Real error" and "Ignore". "Real error" means the judge found a true error that was not planned; it counts as a correct finding (in the false-positive rate it is among the findings but not a false positive) and the results show real errors as a separate count (FR-062, FR-066, FR-067).
- (Prototype v15 review, decided without a question) The reply is pasted as JSON, but any text is still kept: a reply that is not JSON, or that lacks a field a rule needs, is saved with the problem and where it is shown under the box, nothing is marked automatically, and the user marks the items by hand (FR-056, FR-061).
- (Prototype v14 review, decided without a question) The Judge step has no "Start from an example" section. One "Load example…" item in the File menu opens a small window that lists the ready examples Accuracy and Completeness (each starts a new test project with its judge, catalog and a few clean cases), the demo (a finished run of book summaries, formerly "Load demo data") and any example added with "Load metric definition…" in the same window. One route, no duplicate (FR-008, FR-019, FR-026).
- (Prototype v14 review, decided without a question) The one name for the user's work is **test project**; the word "dataset" is no longer used. A test project holds the judge set (judge prompt with its judged text, sample reply with its reply mapping, error rules), the error catalog, the test cases (clean and with injected errors, with names, fields, expected errors and links to base or original cases), the active metric with its parameters and the thresholds; it has a name, and its test cases have a version. It holds no replies and no decisions; those are in the evaluation file.
- Q: (Clarify, prototype v15 review) Is a clean case marked "No error" needed before a case with injected errors can be made? → A: No. The mark was only meant to prevent making a case with errors before any clean case existed, and that is no longer a problem: any case can be made by pasting its JSON, and the JSON may hold no errors, in both ways of adding a case. The "No error" mark, "Not checked", "Mark as No error" and the disabled "Case with injected errors" are removed. A base case is optional: when one is picked, the prompt and the checks against the base use it; without one, the LLM writes the whole case or the user pastes it. A JSON with no expected errors pasted while making a case with injected errors is saved as a clean case, and the window says so (FR-038, FR-040, FR-041, FR-082).
- Q: (Clarify, prototype v15 review) How does a new clean case refer to another clean case, so that its text reaches the prompt? → A: With an optional "Like case" choice beside the comment, listing the existing clean cases; the fields of the picked case go into the prompt as a model. The comment is plain text and the tool does not look for case names in it (FR-083).
- Q: (Clarify, prototype v15 review) Is an expected error that no finding points at marked "Issue: missed" automatically even when the case has an additional finding? → A: No. It is marked "Issue: missed" automatically only when the case has no additional finding; otherwise it stays undecided with the reason "an additional finding may be this error in other words", and the user decides (FR-061).
- Q: (Clarify, prototype v15 review) Which ways of adding a test case does "Add test case" offer, and what happens to a pasted JSON that does not match the chosen kind? → A: Three choices: "Paste JSON", "Clean case" and "Case with injected errors". "Paste JSON" takes any case JSON the user already has and saves it as a clean case when it has no expected errors, or as a case with injected errors when it has some. "Clean case" and "Case with injected errors" prepare the case with the user's LLM; the latter no longer has its own "Paste a ready JSON" route. An answer with expected errors pasted in the clean case view is a problem that points to "Paste JSON". There is no "Clone" (FR-078).
- Q: (Clarify, prototype v15 review) After finalizing, can a test case without a reply be removed or renamed? → A: Yes. A case without a reply can still be renamed and removed after finalizing (each change gives a new test cases version); for a case with a reply "Rename" and "Remove" are disabled with the reason "This case has a reply" (FR-025, FR-039, FR-053).
- Q: (Clarify, prototype v15 review) Should "Clone" stay? → A: No (owner review, Session 2026-11-14; this answer replaces the earlier ones that kept it). Copying a clean case is covered by "Like case" in the clean case view, which shows an existing case to the LLM as an example. Copying a case with injected errors is problematic: its errors are exported in the JSON too and would have to be changed by hand. The window already makes a clean case and a case with injected errors without copying. A wrong case is changed with "Show JSON", "Copy JSON" and "Paste JSON" and the old one is removed; before its first reply, its expected errors are corrected with "Correct expected errors" (FR-078, FR-089).
- (Prototype v16 review, decided without a question) The box for the judge's reply is always visible in the case window of Run, never behind "More actions": under the four steps, with "Paste reply from clipboard" and "Save reply". It is checked as the text changes (FR-084). Once a reply is saved the box holds it; changing it and pressing "Save reply" replaces the reply (FR-056). The case window has no "More actions" section (FR-055, FR-063).
- (Prototype v16 review, decided without a question) A finding added by hand ("Add finding") has "Remove"; findings read from the reply have none (they are marked, "Ignore" included). A finding added by hand may optionally get a category (from the catalog, or a new name that joins it) and a difficulty (obvious or subtle) (FR-062).
- (Prototype v16 review, decided without a question) The second opinion is one button, "Second opinion…", under the list of items of a case with a reply. It opens a window for that case: the line saying what is checked, (1) the verification prompt read-only with "Copy prompt", (2) one box for the LLM's answer, checked as it changes, (3) a preview of every change ("E1 undecided → Found", with the LLM's reason and fragment), and "Apply opinion" and "Cancel". "Copy verification prompt", "Paste LLM opinion from clipboard", "Read LLM opinion" and the box shown only when the clipboard cannot be read are removed (FR-063).
- (Prototype v16 review, decided without a question) When the opinion is readable but classifies none of the items (wrong numbers, missing "found" or "real", another case), the window says "The opinion classifies none of the N items of this case. Nothing will change.", names the reason for each item, keeps the pasted text and disables "Apply opinion"; the items keep their marks and reasons and the user marks them by hand. When it classifies only some items, "Apply opinion" changes only those, and the others keep their marks; an undecided one gets the reason "The LLM opinion gave no answer for this item" (FR-063).
- Q: (Clarify, prototype v16 review) Which marks does "Apply opinion" overwrite? → A: Every mark the opinion gives an answer for, including marks set by hand and marks from an earlier opinion; the preview lists each change, those that replace a mark set by hand included, before the user applies it. Items the opinion does not answer keep their marks (FR-063).
- Q: (Clarify, prototype v16 review) Are the category and difficulty of a finding added by hand counted in the results, or only shown with the finding? → A: Both. They are shown with the finding (case window, Test case list, report), and Error analysis and the report get a table of additional findings per category and per difficulty (real errors and false positives, counts only), kept apart from the rates of the expected errors; findings without them are counted under "(no category)" and "(not set)" (FR-062, FR-070).
- Q: (Clarify, prototype v16 review) May the second opinion add findings that are not in the list, for example when the reply was not JSON? → A: Yes. The verification prompt also asks for findings the reply contains that are not in the list (text, real error or false positive, reason, optional category and difficulty). The preview shows each as "+ new finding", and "Apply opinion" adds it as a finding added by hand, with "Remove", marked with the source "LLM opinion, approved by the user". An opinion that classifies no item and adds no finding changes nothing (FR-062, FR-063).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate one judge end to end (Priority: P1)

A judge author sets up a judge and a set of test cases, lets the tool compose the final prompt
for each case, runs each prompt by hand in an LLM of their choice outside the tool, pastes the
received reply back (any format), resolves the differences right after each reply, and then sees the
outcome: how many of the expected errors the judge found and missed, how many additional findings
it reported and how many of those were false positives, and one line of final answer.

**Why this priority**: This is the core value of the product: knowing how much a judge can be
trusted. Everything else builds on it.

**Independent Test**: Load the demo data, complete the whole flow in one session and see the
Results step with the main counts, the detection rate, the false-positive rate and a final answer.

**Acceptance Scenarios**:

1. **Given** a judge prompt and a set of test cases, **When** the user opens a case, **Then** the
   tool shows the fully composed prompt ready to copy.
2. **Given** a composed prompt was run outside the tool, **When** the user pastes the received
   reply for that case (any text), **Then** the tool accepts it and keeps it with the case and the
   prompt that produced it.
3. **Given** the reply can be read through the reply mapping and the error rules, **When** the
   user saves it, **Then** everything that is clear is already decided, and only the unclear items
   wait for a decision, each with its reason.
4. **Given** the reply is not JSON or lacks a field a rule needs, **When** it is pasted, **Then** it
   is kept, the problem and where it is are shown under the reply box, nothing is marked
   automatically, and the user marks the items in the case window.
5. **Given** every case is decided and the sample meets the minimum, **When** the user opens the
   Results step, **Then** the counts, the two rates and a final answer (Works or Does not work)
   with its reason are shown.
6. **Given** some cases are not run or await verification, or the sample is below the minimum,
   **When** the user opens the Results step, **Then** the final answer is Inconclusive and says
   what is missing.
7. **Given** no data of their own, **When** the user chooses to load the demo data, **Then** a
   ready judge set, test cases and replies are available immediately.

---

### User Story 2 - Set up the judge and say what counts as an error (Priority: P1)

A judge author pastes or loads the judge prompt. The tool lists every variable written as
`{{name}}` in it, whatever its name. The author pastes one sample reply from the judge; the tool
shows the fields of that reply and their paths. The author then writes rules that say when the
judge has reported an error, such as "`claims[].verdict` equals contradicted" or "`supported` is
false and `relevant` is true", and sees at once which parts of the sample reply the rules treat
as findings. The tool uses the prompt exactly as written and adds nothing to it.

**Why this priority**: Without a judge there is nothing to evaluate, and without rules the tool
cannot read the judge's replies.

**Independent Test**: Paste a prompt with three variables of any names, paste a sample reply,
write one rule with two conditions, and confirm the detected variables, the recognized fields and
the findings shown for the sample are correct.

**Acceptance Scenarios**:

1. **Given** a prompt that uses `{{prompt_input}}`, `{{prompt_output}}` and `{{context}}`,
   **When** it is pasted, **Then** exactly these three variables are listed and no others are
   assumed.
2. **Given** a valid sample reply, **When** it is pasted, **Then** the tool reads it at once, without
   a separate button, lists its fields with their paths and example values, and proposes which
   field holds the text of a finding.
3. **Given** recognized fields, **When** the user adds a rule with several conditions joined by
   "and" or by "or", **Then** the sample reply shows which of its parts are findings and by which
   rule.
4. **Given** a rule, **When** the user tries to use a field that is not in the sample reply,
   **Then** the tool does not accept it and says that the field must occur in the sample reply.
5. **Given** a sample reply that is not valid JSON, **When** it is pasted, **Then** the tool
   shows the problem and where it is (line and column) under the box, keeps the text and changes
   nothing else.
6. **Given** nothing is loaded, **When** the user chooses "Load example…" in the File menu and picks
   Accuracy, **Then** a new test project is filled: the prompt, the sample reply and the rules on the
   Judge step, the error catalog and a few clean cases on the Test cases step; the
   tool asks first when something would be replaced. The Judge step has no example or welcome
   section.
7. **Given** a prompt with several variables, **When** the variables are listed, **Then** the last
   one is proposed as the judged text (the output the judge evaluates) and the user can mark another
   one instead.
8. **Given** the Judge step, **When** the user looks for its buttons, **Then** apart from the header
   ("File" menu and Help) there are only "Add rule" (with "Add condition" and "Remove" inside each
   rule) and the one action of the "what next" line; there is no "Save evaluation" and no "Read
   sample reply".

---

### User Story 3 - Keep clean base cases among the test cases (Priority: P1)

A judge author keeps several clean base cases on the Test cases step: complete inputs for the
judge, with a value for every variable and no errors. To add one they press "Add test case",
choose "Clean case", type a name and, if they like, a comment (what the text should be about, or
examples) and pick another clean case in "Like case" as a model, copy the full prompt into their
own LLM and paste its answer back (a JSON they already have is added with "Paste JSON"). The tool
checks at once that the answer has the structure the judge needs and shows where it does not. When it is
right, "Approve and close" saves the case. Clean cases are listed in the one table of test cases, marked "Clean", and
the judge is expected to report nothing in them. The Judge step does not list them.

**Why this priority**: Clean cases are the base every injected error is made from, and the only
way to see whether the judge reports errors that are not there.

**Independent Test**: With a prompt that has two variables, add two clean cases through the
clean case window (one with "Like case" set to the other) and one with "Paste JSON", and
import three more from a CSV; confirm all five are listed in the table of test cases as "Clean" and are
saved in the test project file.

**Acceptance Scenarios**:

1. **Given** a judge prompt with variables, **When** the user chooses "Add test case" and then
   "Clean case", **Then** the window asks for a name and an optional comment, shows the full prompt
   for the LLM with "Copy prompt", and offers a box for the LLM's answer; there are no boxes for
   typing the field values.
2. **Given** a comment and another clean case picked in "Like case", **When** the prompt is shown,
   **Then** it contains the comment as written and the fields of the picked case as a model; with
   nothing picked, no other case is added.
3. **Given** an answer with a value for every variable, **When** it is pasted, **Then** it is
   checked at once, its fields are shown, and "Approve and close" adds the case to the table of
   test cases as "Clean".
4. **Given** an answer that is not JSON, lacks a variable or holds expected errors, **When** it is
   pasted, **Then** the problem and where it is (line and column, or the field path such as
   `fields.summary`) are shown under the box, the pasted text is kept, and "Approve and close" is
   not available; a field the judge prompt does not use is only named as a warning.
5. **Given** clean cases exist, **When** the user looks at the Test cases step, **Then** they are in
   the table of test cases with the kind "Clean", and the Judge step shows none of them.
6. **Given** a clean base case that cases with injected errors were made from, **When** the user
   tries to remove it, **Then** the tool refuses and names those cases.
7. **Given** the judge prompt gains a variable that a clean base case has no value for, **When**
   the user looks at the case, **Then** it is flagged with the name of the missing field.
8. **Given** the "Error categories" section, **When** the user collapses it,
   **Then** only its heading with a one-line summary stays, and expanding it shows it again.

---

### User Story 4 - Prepare a test case with injected errors (Priority: P1)

A user presses "Add test case" on the Test cases step and chooses "Case with injected errors". In
the test case window they may pick a clean case as the base, pick the errors they want from the
error catalog or type a new category, give each a difficulty and a short description, and copy one
ready prompt into their own LLM. They paste the LLM's JSON into one edit box (a JSON they already
have is added with "Paste JSON", which leads to the same edit box), the tool checks it and
shows where it is wrong, and "Next" turns it into the test case and its list of expected errors,
shown read-only. The user changes only the JSON; every change shows at once in the case and the
list. "Show in text" at each expected error shows where it is in the text. "Save case" and "Close
without saving" are always at hand.

**Why this priority**: Test cases with known, deliberately injected errors are the core of the whole
product, and making them by hand is slow and error-prone.

**Independent Test**: In a test project with no test cases at all, press "Add test case", choose
"Paste JSON", paste a ready JSON of a case with errors and save it; then choose "Case with injected
errors", pick a base case,
pick two errors ("wrong-number", subtle, "wrong year"; "factual-error", obvious, "wrong place"),
copy the prompt into an LLM, paste its answer, press "Next", use "Show in text" on both errors,
change one fragment in the JSON and save; confirm the new case records both categories, their
fragments and its base case.

**Acceptance Scenarios**:

1. **Given** the Test cases step, **When** the user presses "Add test case", **Then** a window opens
   that fills the screen and offers "Paste JSON", "Clean case" and "Case with injected errors".
2. **Given** a test project with no clean case, **When** the user looks at the choice, **Then**
   all three choices are available; "Case with injected errors" works without a base case.
3. **Given** "Case with injected errors", **When** the user looks at the base, **Then** any clean
   case can be picked or none.
4. **Given** a base case and two errors picked from the catalog, each with a difficulty and a
   description, **When** the user looks at the prompt, **Then** it is ready to copy with "Copy
   prompt" and holds the judge prompt with its judged text, the base case, and both errors with
   their categories' descriptions and examples, and it asks for the case as JSON with its list of
   expected errors; without a base case the prompt asks the LLM to write the whole case.
5. **Given** the list of errors to prepare, **When** the user types a category that is not in the
   catalog, **Then** it is used in the prompt and joins the error catalog when the case is saved.
6. **Given** a pasted JSON, **When** it is not valid, **Then** every problem is shown under the box
   with where it is (line and column for a syntax error, the path such as
   `expected_errors[2].description` for a missing or wrong field), the text is kept, and "Next" and
   "Save case" are disabled until it is valid.
7. **Given** a valid JSON, **When** the user presses "Next", **Then** the case's fields and its
   expected errors are shown read-only, with the fragments highlighted in the judged text and
   numbered, and the source JSON stays editable beside them.
8. **Given** that view, **When** the user changes the JSON, **Then** the fields and the list of
   expected errors show the change at once; while the JSON is invalid the last valid view stays,
   marked out of date, and "Save case" is disabled.
9. **Given** an expected error in the list, **When** the user presses "Show in text", **Then** its
   fragment is highlighted and scrolled into view in the judged text (or, for an omission, in the
   other field), or the error is marked "not in the text" when the fragment is not found.
10. **Given** a base case was picked and the injected version is identical to it, **When** the user
   tries to save, **Then** the tool refuses and explains that no error was introduced.
11. **Given** a changed place that no expected error covers, or a fragment that does not occur in the
   text, **When** the user saves, **Then** the tool names it and asks for confirmation.
12. **Given** any part of the window, **When** the user presses "Close without saving", **Then** the
   window closes and nothing is added; when there is pasted or typed content, the tool asks first.
13. **Given** a pasted JSON with no expected errors, **When** the user saves it in this window,
   **Then** it is saved as a clean case and the window says so before saving.
14. **Given** "Paste JSON", **When** the user pastes a valid case JSON and presses "Next", **Then**
   the case is shown read-only with its JSON beside it, and "Save case" saves it as a clean case
   when it has no expected errors or as a case with injected errors when it has some; the window
   names the kind before saving.

---

### User Story 5 - Import many test cases from a file and export them (Priority: P1)

A user imports one file (a shortened CSV of clean cases, or a JSON file of cases with their
expected errors) containing many test cases (up to 500), instead of entering cases one by one,
and can export all cases to a JSON file. The tool checks the whole file and shows a summary
before anything is accepted: how many cases were found, how many have injected errors and how
many are clean, and which rows have problems.

**Why this priority**: Without loading from a file the tool is unusable for realistic sample
sizes, and small samples make the results unreliable.

**Independent Test**: Import a file with 100 cases (some deliberately invalid) and verify the
summary shows correct counts and lists every invalid row with the reason; export the cases and
import the exported file into a new project.

**Acceptance Scenarios**:

1. **Given** a valid file, **When** the user imports it, **Then** a summary shows the number of
   cases and the split between cases with injected errors and clean cases, and the cases are added
   to the test project. It stays open until the user finalizes it (see User Story 11).
2. **Given** a file where some rows are invalid, **When** the user imports it, **Then** the summary
   lists each invalid row with its position and reason, and the user chooses to import only the
   valid rows or to cancel.
3. **Given** a file in an unsupported or newer format version, **When** the user imports it,
   **Then** the tool explains what is not supported and changes nothing.
4. **Given** the user is unsure of the format, **When** they open "Import test cases" and choose
   "Download example file", **Then** they get one example CSV file, and a sentence next to the
   action says what it is for.
5. **Given** a JSON file whose cases use categories that are not in the error catalog, **When** it
   is imported, **Then** the summary names those categories and the user chooses to add them to
   the catalog or to cancel.
6. **Given** a test project with cases, **When** the user chooses "Export test cases", **Then** a JSON
   file with every case (clean ones included) and its expected errors is written, and importing
   that file elsewhere gives the same cases.

---

### User Story 6 - Save the work and continue later (Priority: P1)

Nothing is remembered between sessions and nothing is kept on a server, so the user saves to a
file on their own device and carries on later. There are two files: the test project (the judge
set together with the test cases), saved from the File menu at any time and loaded again to run
the same test with another LLM or other model settings, and the evaluation (the whole progress of
one run: the test project, every prompt, reply and decision made so far, and the results), saved
only on the Run step, where the replies are entered. The tool shows clearly whether there are
changes not yet saved.

**Why this priority**: Building test cases and running dozens of prompts by hand takes time;
without a simple save the work would be lost when the page is closed.

**Independent Test**: Add 5 cases, finalize, enter replies for 3 of them, save the evaluation,
close and reopen the tool, load the file, and confirm the cases, the 3 replies and their
decisions are back and the remaining 2 cases can be run.

**Acceptance Scenarios**:

1. **Given** a judge set and at least one test case, **When** the user presses "Save test project",
   **Then** one file is produced containing the judge set, the test project name, all cases with
   their expected errors and base references, the active metric and the thresholds.
2. **Given** a saved test project file, **When** the user loads it later, **Then** the judge set and
   the test cases return with identical content and no replies; test cases that were finalized when
   saved come back finalized and the Run step opens, ready for the replies of another LLM, and
   "Edit test cases" opens it for editing while no reply has been entered.
3. **Given** an evaluation in progress, **When** the user saves it and loads the file in a new
   session, **Then** the judge set, the test cases, every reply and every decision are restored
   and the tool opens the Run step with "Continue", which opens the first case that is not
   decided.
4. **Given** there are changes since the last save, **When** the user looks at the screen,
   **Then** the tool shows that there are unsaved changes, and the indicator clears after saving.
5. **Given** the user has unsaved work, **When** they load a file that would replace it, **Then**
   the tool warns that the current work will be replaced and offers to save it first.
6. **Given** a saved file that was damaged or edited by hand, **When** the user loads it,
   **Then** the tool reports every problem and does not replace the current work.
7. **Given** an evaluation saved once to a chosen file, **When** the user presses "Save evaluation"
   on the Run step again, **Then** the same file is overwritten without a question; "Save evaluation
   as" (also on the Run step) asks for a new file, and after "Load evaluation" saving goes to the
   loaded file.
8. **Given** a test project saved once, **When** the user presses "Save test project" again, **Then** its
   file is overwritten without a question; the name of the remembered test project file is shown
   in the File menu next to "Save test project", and the name of the evaluation file next to "Save
   evaluation" on the Run step.
9. **Given** only an evaluation file, **When** the user opens the tool and loads it, **Then** the
   result is shown on Results and the report can be generated, without loading a test project first.
10. **Given** the Judge, Test cases or Results step, **When** the user looks for "Save evaluation",
   **Then** it is not there; the header shows only the indicator of unsaved changes, the "File" menu
   and Help, and the warnings before work would be lost still offer to save the evaluation first.

---

### User Story 7 - Run every test case by hand (Priority: P1)

After the test cases are finalized, the Run step shows all test cases in one list, with a short summary
of the judge being run (its version, the test project and the judged text) and a free-text box for the
model details, and "Save evaluation". A button
at each case opens a window that shows the case as it was shown when it was made, without its JSON
(name, fields with the expected errors highlighted, the list of expected errors with "Show in
text"), the judge prompt ready to copy and a box to paste the judge's JSON reply. The user copies
the prompt into their LLM, pastes the reply back, sees at once what the judge found (User Story 8)
and moves to the next case. Every prompt and reply is kept with its case.

**Why this priority**: This is the working loop the user repeats for every case; it has to be quick,
impossible to mix up and safe against losing work.

**Independent Test**: With finalized test cases of 5 cases, open each case's window, copy the prompt,
paste a reply, and confirm the list shows 5 of 5 replies and each case keeps its own prompt and
reply.

**Acceptance Scenarios**:

1. **Given** finalized test cases, **When** the user opens the Run step, **Then** all cases are in
   one list with their name, kind, number of expected errors and status, and a short summary shows
   the judge version, the test project name and version and the judged text.
2. **Given** the list, **When** the user presses the button at a case, **Then** a window opens that
   fills the screen in two columns: on the left the case in the same read-only layout as when it was
   made but without its JSON (name, fields with highlighted fragments, expected errors with "Show in
   text") and the judge prompt with "Copy prompt"; on the right "Judge's reply" with the four steps
   to follow, "Paste reply from clipboard" and the box for the reply with "Save reply".
3. **Given** the window of a case, **When** the user presses "Next test case" or "Previous test
   case" (or the matching keys), **Then** the window shows that case at once, with its position
   ("case 7 of 20"), without going back to the list.
4. **Given** the judge's answer copied in the user's LLM, **When** the user presses "Paste reply
   from clipboard", **Then** the reply is read from the clipboard and saved in one action, kept
   with the case together with the prompt that produced it, the progress count increases, and the
   differences appear below it.
5. **Given** a case that already has a reply with only automatic decisions, **When** the user
   pastes a new reply, **Then** the reply is replaced without a question, the case's decisions are
   removed and the automatic decisions are computed again.
6. **Given** a case with decisions set by hand or approved from an LLM opinion, **When** the user
   pastes a new reply, **Then** the tool asks whether to replace the earlier reply, saying how many
   such decisions will be removed, and resets the case only after confirmation.
7. **Given** the browser refuses to let the tool read the clipboard, **When** the user presses
   "Paste reply from clipboard", **Then** the tool says so and the user pastes with Ctrl+V into the
   box, which is always shown, and presses "Save reply", with the same effect.
8. **Given** a test project that is not finalized, **When** the user opens the Run step, **Then** the
   tool asks them to finalize the test cases first.
9. **Given** replies saved since the last "Save evaluation", **When** the user looks at the Run step
   or the case window, **Then** their number is shown, "Save evaluation" is available on the step and
   in the window header, and after every 25 such replies the tool reminds the user to save.
10. **Given** the Run step, **When** the user writes the model details (for example the model name
   and its settings, over several lines), **Then** the text is kept with the result and shown in
   the report.

---

### User Story 8 - Resolve the differences right after each reply (Priority: P1)

As soon as a reply is saved, the tool reads it with the judge's reply mapping and error rules and
shows one list of items with their marks: each expected error the judge found is "Found", each one
it did not find is "Issue: missed", and each finding that matches no expected error is an
additional finding for the user to mark "Issue: false positive" or "Real error". "Ignore" is
available on every item. For unclear items the user can ask their own LLM for a second opinion in
a window of its own, which shows every change it would make, with a short reason and the matching
fragment of data, before the user applies it. The user always decides last.

**Why this priority**: The user judges the judge; their decision is the ground truth, and the
automatic decisions and LLM opinions only save effort. Deciding while the case is still on the
screen saves a second pass through all cases.

**Independent Test**: Enter replies for several cases, confirm the clear items are decided
automatically, ask for a second opinion on the rest and apply it, change one of its marks, ignore
one item, add a finding by hand and remove it, and confirm the statuses and the results update.

**Acceptance Scenarios**:

1. **Given** received replies, **When** the user looks at the Run list, **Then** every case shows
   its status (Not run, Awaiting verification, Pass, Fail), the number still to decide is shown, and
   the user can show the cases that await verification first or only those.
2. **Given** a saved reply, **When** the case window shows it, **Then** the right column shows the
   received reply and one list of items: every expected error marked "Found", "Issue: missed" or
   undecided (a partial match), and every additional finding, undecided until the user marks it;
   each item shows its reason.
3. **Given** an expected error that no finding points at, fully or partly, **When** the reply is
   read, **Then** it is marked "Issue: missed" automatically if the case has no additional
   finding; if it has one, the expected error stays undecided with the reason "an additional
   finding may be this error in other words".
4. **Given** a finding that points at no expected error, **When** the reply is read, **Then** it is
   added to the list as an additional finding, and the user can mark it "Issue: false positive" or
   "Real error".
5. **Given** any item, **When** the user looks at its marks, **Then** "Ignore" is always among them.
6. **Given** that window, **When** the user presses "Next test case" or "Previous test case",
   **Then** the next or previous case opens at once, and the user can limit this to the cases that
   await verification.
7. **Given** an undecided item, **When** the user sets its mark, **Then** the decision is recorded as
   set by hand and the results update.
8. **Given** a case with a reply, **When** the user presses "Second opinion…", copies the prompt
   into their LLM and pastes its JSON answer into the window's box, **Then** the window shows every
   change the opinion would make, with its reason and fragment, and nothing changes until the user
   presses "Apply opinion"; then the answered items take the opinion's marks, also over marks set
   by hand, and findings the opinion adds join the list as findings added by hand, all with the
   source "LLM opinion, approved by the user".
9. **Given** a mark set from an opinion, **When** the user changes it, **Then** the user's mark is
   the one that counts.
10. **Given** an expected error or an additional finding that should not count, **When** the user
   marks it "Ignore", **Then** it is left out of every count and listed as ignored in the report.
11. **Given** an automatic mark, **When** the user changes it, **Then** the user's mark replaces it
   and is shown as set by hand.
12. **Given** an opinion that classifies none of the items, **When** it is pasted into the window,
   **Then** the window says so and why for each item, "Apply opinion" stays disabled, the pasted text
   is kept, and the case keeps its marks.
13. **Given** a finding added by hand, **When** the user presses its "Remove", **Then** it is removed
   with its mark; a finding read from the reply has no "Remove".

---

### User Story 9 - Read the results and export them (Priority: P1)

The Results step shows a clear summary first: how many errors were expected and how many of them
the judge found and missed; how many additional findings it reported, and how many of those were
confirmed as real errors and how many were false positives; and the same for subtle errors. One
line gives the final answer. Two more views give the analysis per category and difficulty and
the list of all test cases. Everything on the Results step is read-only, except the thresholds in
"Details". The result can be exported as an HTML report at any time; the evaluation file saved
with "Save evaluation" on the Run step holds the same result as JSON.

**Why this priority**: The result is the reason the tool exists; a first-time reader must
understand it without reading documentation.

**Independent Test**: With a fully verified demo evaluation, open the three views, check the
counts against the cases by hand, export the HTML report and save the evaluation; confirm the HTML
report can be read without the tool.

**Acceptance Scenarios**:

1. **Given** decided cases, **When** the user opens the Summary view, **Then** the counts of
   expected, found and missed errors, of additional findings, confirmed real errors and false
   positives, and of subtle errors found and missed are shown before anything else.
2. **Given** the Summary view, **When** the user looks for thresholds or confidence intervals,
   **Then** they are in a "Details" section that is closed by default, where the thresholds can be
   changed.
3. **Given** the Error analysis view, **When** it is opened, **Then** results are shown per
   category and per difficulty.
4. **Given** the Test case list view, **When** it is opened, **Then** every case shows its
   expected errors, what the judge reported and its verification status.
5. **Given** the Test case list view, **When** the user opens a case, **Then** its prompt, reply
   and decisions are shown and none of them can be changed there.
6. **Given** a result, **When** the user presses "Export HTML report", **Then** an HTML report is
   produced with the full prompts, replies and decisions.
7. **Given** cases that are not run or await verification, **When** the user exports the report or
   saves the evaluation, **Then** the report and the evaluation file are marked provisional and say
   how many cases are not decided.
8. **Given** the Results step, **When** the user looks for an export of the result as JSON, **Then**
   there is no separate "Export JSON" and no save action; the step says that "Save evaluation" on
   the Run step (or "Save evaluation as" for a copy) writes the result as JSON.

---

### User Story 10 - Get guidance while building the test project (Priority: P2)

While building the test project, the user sees help: a short description and an example for each
category, and live feedback on the test project being built, such as how many cases are clean and how
many have injected errors, whether the balance is poor, whether any text is duplicated, whether the test is big
enough for a final answer, and how far it is from the size limit.

**Why this priority**: The user is not a specialist in test design; guidance prevents weak
test projects (for example, only cases with injected errors) that would make the results meaningless.

**Independent Test**: Build a test project of only cases with injected errors and see a warning that clean cases
are needed; add a duplicate text and see it flagged.

**Acceptance Scenarios**:

1. **Given** the user selects a category, **When** they view its help, **Then** they see a
   plain-language description and a short example.
2. **Given** the test project has only cases with injected errors or only clean cases, **When** the user views it,
   **Then** a warning explains why both kinds are needed.
3. **Given** two cases have identical text, **When** the user views the test project, **Then** the
   duplicates are flagged.
4. **Given** the test project is near 500 cases, **When** the user adds cases, **Then** the remaining
   capacity is shown and adding beyond the limit is refused with a clear message.
5. **Given** the test project has fewer than 30 injected errors or fewer than 10 clean cases, **When**
   the user views it, **Then** the test-size summary shows what is missing and says that the final
   answer will be Inconclusive until it is added.

---

### User Story 11 - Mix hand-made and loaded cases, then finalize (Priority: P2)

A user can combine cases loaded from a file with cases prepared in the tool in one test project. When
satisfied, they finalize the test cases: they see a summary, confirm, and from that moment the judge
prompt and the cases are fixed for the evaluation. To change them afterwards they start a new
evaluation.

**Why this priority**: Real work mixes both routes, and the finalize step keeps results
trustworthy.

**Independent Test**: Load a 10-case file, prepare 2 more cases in the tool, finalize, and confirm
the test project holds 12 cases whose input data can no longer be edited.

**Acceptance Scenarios**:

1. **Given** a test project loaded from a file that is not yet finalized, **When** the user prepares
   more cases in the tool, **Then** they join the same test project.
2. **Given** a test project ready to use, **When** the user chooses to finalize, **Then** a summary
   (counts, balance, warnings) is shown and the test cases become fixed only after confirmation.
3. **Given** finalized test cases, **When** the user looks for ways to edit the judge prompt or
   the input data of a case, **Then** none are offered and a "Start new evaluation" action is
   offered instead.
4. **Given** the user has unsaved cases, **When** they try to leave the page, **Then** the tool
   warns them.

---

### User Story 12 - Test another version of the judge on the same test cases (Priority: P2)

A user keeps test cases as a file with a name and a version, and uses the same cases to test a
changed judge prompt. From the Results step they choose "Edit the judge and run again": the tool
offers to save and export the current result first, keeps the finalized test cases, clears the
replies
and lets the user change the prompt. Each exported result names the judge version and the test project
version it was made with, so two reports can be read against each other.

**Why this priority**: Improving a judge means changing its prompt and testing again on identical
cases. Showing two results side by side inside the tool (Compare) is deferred.

**Independent Test**: Evaluate a judge, export the result, choose "Edit the judge and run again",
change the prompt, evaluate again and export; confirm both reports name the same test cases version
and different judge versions.

**Acceptance Scenarios**:

1. **Given** a loaded test project, **When** the user views it, **Then** its name, version, case count
   and split between clean cases and cases with injected errors are visible.
2. **Given** a test project is saved and loaded again, **When** the two are compared, **Then** they are
   recognized as identical (same version).
3. **Given** an evaluation with replies, **When** the user chooses "Edit the judge and run again",
   **Then** the tool offers to save and export the current result first,
   keeps the test cases, clears the
   replies and decisions, and lets the user edit the judge prompt, which gets a new version
   identity.
4. **Given** the user loads a test project file, **When** it is loaded, **Then** a new evaluation is
   started with its judge set and test cases and no replies, and the first "Save evaluation" asks
   for a file, so an earlier run is never overwritten.
5. **Given** a finalized test project used for one run, **When** the user loads it again, writes
   other model details and enters the replies of another LLM, **Then** the two evaluation files
   name the same judge version, test cases version, metric and thresholds, and differ only in the
   model details, the replies, the decisions and the results.

---

### User Story 13 - Reproduce and audit past results (Priority: P2)

A user opens any saved result file and can see exactly which judge (prompt, reply mapping and
error rules) and which test cases produced it, together with every prompt, reply and decision.

**Why this priority**: Traceability underpins trust in the results.

**Independent Test**: Save an evaluation with results, reload the page, load the file, and confirm the
same numbers, judge version and test cases are shown.

**Acceptance Scenarios**:

1. **Given** a completed evaluation, **When** the user saves it, **Then** the file contains the
   results together with the judge set and the cases used.
2. **Given** a saved evaluation file, **When** it is loaded in a fresh session, **Then** the
   identical results, judge version and cases are displayed.
3. **Given** the same judge set, cases, replies and decisions, **When** results are recalculated,
   **Then** the numbers are identical.

---

### User Story 14 - Use my own error catalog for other kinds of judges (Priority: P3)

A user adds their own categories, each with a name and a short description, or pastes a category
list for another kind of judge in place of the ready Accuracy and Completeness examples, and
uses those categories when preparing test cases. The catalog is managed in the "Error categories"
section of the Test cases step, which shows how many test cases use each category and can be
collapsed, and is saved inside the test project file only. One evaluation tests one judge.

**Why this priority**: Different judges check different things; the ready examples may not fit,
but the product works without custom categories.

**Independent Test**: Add a category "tone-violation", use it for a prepared case, save the test project; confirm the category is in the saved file.

**Acceptance Scenarios**:

1. **Given** the user adds a category in the "Error categories" section, or types a new category
   name for a wanted error, **When** they prepare a case, **Then** the new category can be chosen.
2. **Given** a category used by expected errors in 3 test cases, **When** the user looks at it,
   **Then** it shows "3 test cases", its "Remove" is disabled, and the reason is shown beside it:
   the category is used by 3 test cases, which must be removed first, or the category can be
   renamed; renaming it changes it in all 3 cases and error analysis shows the new name.
3. **Given** a category no test case uses, **When** the user presses "Remove", **Then** it is
   removed at once.
4. **Given** a catalog saved inside a test project file, **When** the user loads that file in a new
   session, **Then** the catalog returns with its descriptions and examples; there is no separate
   catalog file.
5. **Given** a bias judge whose reply is only a verdict for the whole text and whose rules use no
   list, **When** the user saves a reply that is flagged for a case with expected errors, **Then**
   the case is decided as a whole, and the Summary shows the case detection rate and the
   clean-case false-positive rate and says that the judge was evaluated per case.

---

### User Story 15 - Browse a large test project (Priority: P3)

A user can search, filter (with injected errors, clean, with a reply, without a reply,
with warnings) and sort the lists of test cases to check what was loaded, and open any case with
"Open" to see it in full, read-only, and get its JSON back to reuse it.

**Why this priority**: Useful for inspection, but the product works without it.

**Independent Test**: Load 500 cases, filter to "with injected errors and without a reply", and
confirm the lists and the count are correct; open one case, copy its JSON, paste it into a new
case and confirm the new case has the same fields and expected errors.

**Acceptance Scenarios**:

1. **Given** a large test project, **When** the user applies filters or search, **Then** the table
   shows only matching cases with a count, and the kind filter shows only clean cases or only cases
   with injected errors.
2. **Given** the user presses "Open" at a case, **When** the window opens, **Then** it shows the
   case read-only: its fields with the fragments highlighted, its expected errors with "Show in
   text", its composed prompt, and its reply if one exists; nothing in it can be edited.
3. **Given** an open case, **When** the user presses "Show JSON", **Then** the case's JSON, rebuilt
   from the case in the layout used to make cases, is shown with "Copy JSON"; pasted into a new case
   it gives the same fields and expected errors.
4. **Given** an open case, **When** the user looks at its buttons, **Then** there is no "Clone"; "Show JSON"
   and "Copy JSON" give the JSON that "Paste JSON" takes.
5. **Given** a row of either list, **When** the user looks at its actions, **Then** it shows "Open",
   "Rename" and "Remove"; after finalizing "Open" stays enabled, "Rename" and
   "Remove" stay enabled for a case without a reply, and for a case with a reply they are disabled
   and say why.
7. **Given** finalized test cases and a case without a reply, **When** the user presses "Correct
   expected errors" in its read-only view, **Then** its JSON opens for editing; a change to its
   fields or name is shown as a problem, a change to its expected errors is saved with "Save case",
   and the test cases version changes.
8. **Given** finalized test cases with replies, **When** the user adds a test case, **Then** it
   appears on Run as Not run, and every earlier reply and decision is kept.
6. **Given** "Rename" at a case, **When** the user types a name another case already has, **Then**
   the name is refused and the tool says which case has it.

---

### Edge Cases

**General**

- No data loaded yet: every screen shows a helpful empty state with the next step.
- The page is closed or reloaded with unsaved work (judge set, test cases, replies or decisions):
  the work is lost, so the tool warns before leaving the page whenever there are unsaved changes.
- Loaded files are from an older or newer format version than the tool understands: reported as
  unsupported, nothing is changed.
- Text containing quotes, commas, line breaks, or Polish and other non-English characters.
- Different line-ending or text-encoding conventions.

**Setting up the judge**

- A prompt with no variables: the tool says that test cases will have no fields and nothing from
  them will reach the prompt.
- The same variable used several times: it is one variable and one field, filled in everywhere.
- A variable is renamed or removed after base cases exist: the cases are flagged (a value with no
  variable is kept but unused; a variable with no value is filled with empty text).
- A sample reply that is not JSON, is wrapped in other text or a code fence, or contains no list:
  wrapped JSON is read; anything unreadable is explained and nothing changes.
- The sample reply is replaced and a rule still uses a field that is gone: the rule is marked as
  broken and reported when finalizing.
- No rules, or no field marked as the text of a finding: allowed, with a warning that every case
  will then be verified by hand or with an LLM opinion.
- A rule that uses only fields outside any list: it gives one finding for the whole reply, with
  no place. When every rule is of this kind, the case is judged as a whole (FR-061, FR-067).
  When the judge also has rules on list items, the whole-reply finding is an additional finding
  and is never matched automatically.
- A prompt with one variable: that variable is the judged text. The variable marked as the judged
  text is renamed or removed: the tool proposes the last variable again and says so.

**Building the test project**

- Empty file, file with only a header, or file with a single case.
- A file with more than 500 cases: the tool rejects it with a clear message stating the limit and how many cases were found, and suggests splitting it.
- Reaching the 500-case limit while adding cases.
- Duplicate test case names (FR-079): a new or renamed case cannot take a used name; an import or a loaded file may produce duplicates, which are kept and marked with a warning on every case involved.
- Duplicate case identifiers within one file: the file is reported as invalid for those rows and the user chooses to import only the valid rows or cancel.
- A file where only some cases have identifiers: the tool rejects the mix and asks the user to supply identifiers for all cases or for none.
- Identifier collision between a case made in the tool and a loaded case.
- Import is interrupted halfway: the previously loaded test project must remain intact.
- Empty text or text consisting only of spaces.
- A judge variable with no matching field in a case: filled with empty text and flagged with a
  warning; finalizing is still allowed (FR-047).
- A loaded file with fields that match no variable of the judge prompt: reported in the summary;
  the fields are kept but do not reach the prompt.
- A loaded file that uses categories missing from the error catalog (FR-029).
- Very long text: a field longer than 30,000 characters shows a warning that it may not fit the
  model's context window; a field longer than 100,000 characters is refused, stating the limit
  (FR-037).
- A pasted LLM answer or JSON that is not JSON, is wrapped in other text or a code fence, holds more
  than one case, lacks a variable, or (for a clean case) holds expected errors: the first readable
  JSON block is used; every problem is shown under the box with its line and column or its field
  path; the pasted text is kept (FR-084). A field the judge prompt does not use, an `id` or a
  different `base` is not a problem: it is handled as FR-031 says and named
  where it matters.
- A pasted case identical to the base case picked for it: refused on "Save case" with the reason (FR-044).
- Injection that changes so much that the base case is not recognizable: allowed, with the
  changed places that no expected error covers named before saving (FR-080).
- Several expected errors in one case: allowed; each has its own category and fragment.
- A pasted case whose fragment is not in the text: the error is marked "not in the text" and saving
  asks for confirmation (FR-080).
- A JSON that becomes invalid while the user edits it after "Next": the last valid view stays,
  marked out of date, and "Save case" is disabled until it is valid again (FR-085).
- A clean case picked in "Like case" is removed or renamed while the clean case view is open: the
  pick is cleared or shows the new name, and the prompt is rebuilt (FR-083).
- No clean case exists yet: "Case with injected errors" still works; the case is made without a
  base, and the checks against the base (identical text, changed places not in the list) do not
  apply (FR-040, FR-080).
- A JSON with no expected errors pasted while making a case with injected errors: saved as a clean
  case, and the window says so before saving (FR-041).
- Removing a category that is in use: "Remove" is disabled with the reason (FR-015). Removing a
  clean base case that other cases were made from: refused, naming those cases (FR-017).
- Test project with only cases with injected errors or only clean cases: some measures cannot be
  computed, and the tool says so clearly.
- Finalizing an empty test project or one with only one kind of case.
- Saving an empty test project: the tool explains there is nothing to save.
- Loading a saved file while there are unsaved changes.
- A case being made in the test case window but not yet kept with "Save case" or "Approve and
  close": the window covers the page and has no file action of its own, so nothing can be saved to
  a file while it is open; "Close without saving" with pasted or typed content asks first, and a
  file holds only kept cases.
- A saved case that turns out to be wrong: its text is not edited; before finalizing the user copies its JSON
  ("Show JSON", "Copy JSON"), pastes it into a new case with "Paste JSON", corrects it, saves it and removes the original; after finalizing, its expected
  errors are corrected with "Correct expected errors" while it has no reply, and are marked
  "Ignore" on Run once it has one (FR-053, FR-089).
- A case added after the first reply: it is Not run, so the result stays provisional until it is
  run and decided; the result and the report list it as added after the first reply (FR-075).

**Running, verifying and results**

- Some cases have no reply: results can be viewed as partial and are clearly labeled as such,
  with the number of cases still missing.
- Very small test projects: the tool states that the sample is too small for a final answer.
- A reply that is free text, partly JSON, or in an unexpected format: it is kept, the problem and
  where it is are shown under the reply box, nothing is marked automatically, and the user marks
  the items in the case window (FR-056).
- An additional finding that is an expected error in other words: the expected error was left
  undecided, because the case has an additional finding (FR-061); the user marks it "Found" and the
  finding "Ignore", so it is not counted twice.
- A reply that lacks a field one of the rules needs: the tool does not guess; the case awaits
  verification with the reason.
- The same case answered twice: the new reply resets the case's decisions; the
  tool asks first only when decisions set by hand or approved from an LLM opinion would be
  removed, and says how many (FR-056).
- A very large pasted reply.
- A pasted LLM opinion that is malformed or refers to another case: the problem is explained
  under the box with where it is, the pasted text is kept, and nothing is changed.
- A readable LLM opinion that classifies none of the items of the case and adds no finding: the second-opinion window
  says so and why for each item, "Apply opinion" stays disabled, and the case keeps its marks; it
  classifies only some: only those items change (FR-063).
- The browser refuses to let the tool read the clipboard: the tool says so and offers a box to
  paste into with Ctrl+V instead.
- The user exports the report or saves the evaluation while cases are not run or await
  verification: the report and the file are marked provisional and say how many cases are not
  decided.
- A remembered file (judge set, test cases or evaluation) was moved or removed, or the browser
  withdrew permission: the tool says so, forgets it and asks for a file again; the work on the
  page is kept.
- "Edit the judge and run again" after the evaluation was saved: the new run's first "Save
  evaluation" asks for a file, so the earlier run's file is never overwritten.
- Every expected error of a case is ignored: its expected errors are left out of the counts; the
  case is still not a clean case, and its status follows only its additional findings (FR-064).
- A saved evaluation is loaded while another evaluation is in progress.
- The page stops responding after many replies were entered: work since the last "Save evaluation"
  is lost, so the tool shows how many replies are not saved to a file and reminds the user to save
  after every 25 (FR-059).

## Requirements *(mandatory)*

### Functional Requirements

**Workflow and general rules**

- **FR-001**: The workflow MUST be presented as four steps in a fixed order, each on its own screen
  with one primary next action: (1) Judge: the judge set, that is the judge prompt with its
  variables and its judged text, the sample reply with its reply mapping and the error rules;
  (2) Test cases: the collapsible "Error categories" section (FR-015) and one table of all test
  cases, clean and with injected errors (FR-025, FR-087), adding cases in the test case window, ending with finalizing; (3) Run:
  every case with its complete prompt to copy, a place to paste the received reply and, right after
  it, the marks of every expected error and additional finding, and saving the evaluation; (4)
  Results: the summary, the error analysis and the list of test cases, all read-only, and
  export. The user MUST be able
  to go back to an earlier step to look, and the current step and progress MUST always be visible.
  Each step MUST show one "what next" line at the top: one sentence that says what is still
  missing or what to do next, together with the one primary action. A step screen MUST NOT carry
  explanations longer than one sentence; they belong in Help and in short hints that open on demand
  next to the field they explain. There is no welcome section: when nothing is loaded the tool
  opens the Judge step with an empty judge prompt, its "what next" line says what is missing, and
  loading an example, a test project or an evaluation is offered only in the "File" menu.
- **FR-002**: The system MUST NOT call any LLM itself; the judge, and any prompt the tool prepares
  for generating test data or verifying results, is run by the user outside the tool, by copying
  the prompt and pasting the answer back.
- **FR-003**: The system MUST work without accounts, servers or databases. All work MUST happen on
  the user's device, and user data MUST stay there unless the user exports it. Saving writes a
  file to the user's device; nothing is kept on a server or in a temporary file elsewhere. The
  system MUST work in the current versions of Google Chrome and Microsoft Edge; other browsers
  are not supported in this version.
- **FR-004**: The system MUST NOT retain judge sets, test cases, replies, decisions or results
  after the page is closed; it MUST warn the user before they leave or reload the page with
  unsaved changes, and MUST make saving the current work one clear action: "Save test project"
  in the "File" menu at any time, and "Save evaluation" on the Run step (FR-076).
- **FR-005**: All data (judge sets, error catalogs, test cases, results, metric definitions, check
  configuration) MUST be loadable from and exportable to files, with clear errors for invalid
  or unsupported-version files.
- **FR-006**: The tool MUST include built-in Help explaining how to use each part of the
  workflow, kept current with the features. Help MUST be written in plain, everyday language for a
  user without a statistics background: short sentences, a worked example for each measure and for
  the test size, and any technical term explained where it first appears. It MUST explain what one
  test case is and how many cases and errors a test needs; variables, the reply mapping and error
  rules; making clean cases; preparing cases with injected errors from
  their JSON, getting a case's JSON back with "Show JSON" and cloning; categories and finalizing;
  the marks of Run ("Found", "Issue: missed", "Issue: false positive", "Real error", "Ignore");
  loading test cases
  from a file, loading check settings and loading demo data; the manual copy-paste workflow,
  including the second opinion from an LLM for one case; the two files (the test project, reused for
  every run, and the evaluation), the indicator of unsaved changes, loading back and "Continue";
  "Edit test cases" before the first reply; judges that give only a verdict and are evaluated per
  case, with a worked example; and how to read and export the results, with
  examples that are valid for the current file formats.
- **FR-007**: The interface MUST be modern, clear, responsive, accessible, and present helpful
  empty and error states. Its color scheme MUST be black and red: in the dark scheme a black or
  near-black background with red as the one accent color (primary action, current step, focus); in
  the light scheme a white or near-white background with black text and the same red accent. Text
  and controls MUST meet WCAG AA contrast in both schemes. Because red is the accent, a failure, an
  error or a "Fail" status MUST never be shown by red alone: each MUST also carry a word or an icon,
  and "Pass" and "Fail" MUST be told apart without relying on color.
- **FR-008**: Every action MUST have a name that says what it does, and the same action MUST carry
  the same name wherever it appears. Actions that take text from the clipboard and have the tool
  read it are named "Paste ... from clipboard"; the one remaining action that reads a box filled by
  hand is named "Read ..."; text pasted into a box that is checked as it changes (the sample reply,
  the LLM answer for a clean case, the JSON of a case) needs no action. Actions that keep something
  are named "Save ...", and "Approve ..." keeps something the user has confirmed. The main
  actions are:
  Judge: "Add rule" (with "Add condition" and "Remove" inside a rule); these and the one action of
  the "what next" line are the only buttons of the Judge step (FR-011, FR-088).
  Test cases: "Add category", "Rename" and "Remove" in the "Error categories" section; "Add test case"; "Open", "Rename" and "Remove" at
  each case; "Finalize test cases", "Edit test cases" (FR-053); in the test cases part of the
  "File" menu: "Import test cases" (adds cases from a CSV or JSON file), "Export test cases" (all
  cases to a JSON file) and, in the import window, "Download example file".
  In the test case window when adding a case: "Paste JSON", "Clean case" and "Case with injected
  errors"; for "Paste JSON" "Next", "Show in text", "Save case" and "Close without saving"; for a
  clean case "Copy prompt", "Approve and close" and "Close without saving"; for a case with
  injected errors "Add error" and "Remove" in the list of errors to prepare, "Copy prompt", "Next", "Show in text", "Save case" and "Close without
  saving". In the read-only view of a saved case ("Open"): "Previous test case", "Next test case",
  "Show in text", "Show JSON", "Copy JSON", "Copy prompt" and, after finalizing,
  "Correct expected errors".
  Run: "Save evaluation", "Save evaluation as", "Open" at each case; in its window "Previous test
  case", "Next test case", "Show in text", "Copy prompt", "Paste reply from clipboard", "Save reply"
  (for the box), the marks of an item ("Found", "Issue: missed", "Issue: false positive", "Real
  error", "Ignore"), "Approve", "Add finding", "Remove" (for a finding added by hand), "Second
  opinion…" (in its window "Copy prompt", "Apply opinion" and "Cancel") and "Save evaluation". Results: the views "Summary", "Error analysis" and "Test case list", and the actions
  "Export HTML report", "Load check settings" and "Edit the judge and run again". Removing
  something (a rule, condition, category, error to prepare or test case) is always named "Remove".
  Available at any time, in the header: the indicator of unsaved changes, the "File" menu with
  "Load example…" (Accuracy, Completeness, the demo, and "Load metric definition…" in its window),
  "Load test project", "Save test project", "Save test project as", "Load evaluation", "Import
  test cases", "Export test cases" and "Start new evaluation"; and Help. "Save evaluation" and
  "Save evaluation as" are only on the Run step and in the case window of Run (FR-076).
  On every screen: "Explain" opens the explanation of a section, and "Continue" and "Edit test
  cases" appear in the "what next" line. No action may duplicate another one under a different name. There is no Verify
  step, no Compare step, no result shelf, and no action that leads to them; "Modify", "Describe
  errors again", "Compare with base", "Use selected text as fragment", "Read sample reply", "Copy
  prompt for clean base cases", "Read clean base cases", "Read LLM answer", "Discard case", "Copy
  verification prompt", "Paste LLM opinion from clipboard", "Read LLM opinion" and "More actions"
  are not offered. To keep the screens light, a table row MUST show its actions as visible buttons,
  never in a menu of the row: Test cases "Open", "Rename" and "Remove" (FR-025);
  Run and Results "Open". A click on the row also opens the case. In the case window of Run the one
  action needed next ("Copy prompt", then "Paste reply from clipboard", then "Approve") MUST be the
  primary one; the actions for the whole case that are needed less often, "Add finding" and
  "Second opinion…", MUST be visible buttons under the list of items, never in a collapsed section
  or a menu, and the marks of single items stay visible. "Continue"
  (FR-073) is the action of the "what next" line after a file is loaded, and on the Run step
  whenever a case is not run or awaits verification.


**Step 1: Judge**

- **FR-009**: The Judge step MUST hold one judge set: the judge prompt with its judged text
  (FR-010), the sample reply with its reply mapping (FR-011, FR-012), the error rules (FR-013,
  FR-014); the error catalog (FR-015, FR-016) and the clean base cases (FR-017, FR-082, FR-083) belong to the
  Test cases step. One
  evaluation MUST test one judge. Users MUST be able to provide the judge prompt by typing or
  pasting it or by loading a test project file. The system MUST use the prompt exactly as written.
- **FR-010**: The system MUST detect every variable written as `{{name}}` in the judge prompt and
  list the detected variables next to the prompt, updated as the prompt changes. It MUST NOT assume
  any variable names of its own and MUST NOT treat any name as an alias of another. Spaces around a
  name are ignored, and a name used several times is one variable. The detected variables are the
  fields of every test case and every clean base case; no other field is requested or shown. When
  the prompt has no variables, the system MUST say that nothing from the test cases will reach the
  prompt. The user MUST mark one variable as the **judged text**: the output the judge evaluates,
  into which errors are injected. The last variable is proposed; with one variable it is that one.
  When the marked variable disappears from the prompt, the last variable is proposed again and the
  user is told.
- **FR-011**: Users MUST be able to paste one sample reply of the judge in the judge's own JSON.
  The system MUST read it as soon as it is pasted or changed, with no separate action (also when
  the JSON is wrapped in other text or a code fence), and show
  its fields with their paths (for example `claims[].verdict`), the kind of value each holds and
  the values seen in the sample. This recognized structure is the reply mapping; it MUST NOT say
  by itself what an error is. A sample that cannot be read MUST be explained under the box, with
  where the problem is (FR-084), without discarding the pasted text or the mapping already set.
- **FR-012**: The reply mapping MUST let the user mark, for each list found in the sample reply,
  one recognized field of its items as the text of a finding: the words of the judged data that
  the judge is pointing at. The system proposes the most likely field and the user confirms or
  changes it. Findings from a list without such a field, and findings from rules that use no
  list (FR-014), cannot be matched to expected errors automatically and are decided by the user
  after the reply is saved (FR-060).
- **FR-013**: Users MUST be able to write error rules that say when the judge has reported an
  error. The system MUST NOT create, propose or change rules by itself. Each rule has a name and
  one or more conditions, and the user chooses whether all of its conditions must hold ("and") or
  any one of them ("or"); the number of conditions and of rules is not limited. A condition
  names one recognized field of the reply, a comparison (equals, does not equal, is greater
  than, is less than, is empty, is not empty) and, where needed, a value, which the user can
  pick from the values seen in the sample or type. Text is compared ignoring letter case. The
  judge has reported an error when at least one rule holds; to combine "and" with "or", the user
  writes several rules.
- **FR-014**: A rule whose fields belong to the items of a list MUST be checked for each item
  separately, and every item for which a rule holds is one finding. A rule that uses only fields
  outside any list is checked once per reply and gives one finding for the whole reply, with no
  place. One rule MAY combine fields of one list with fields outside any list (the latter are
  read once from the reply and apply to every item), but MUST NOT use fields from two different
  lists. Every field used in a rule MUST
  occur in the sample reply: the system MUST NOT accept a rule on any other field, and MUST mark
  a rule as broken when its field disappears after the sample reply is replaced. With the sample
  reply and the rules, the system MUST show which parts of the sample are findings and by which
  rule, updated as the rules change. When a real reply lacks a field a rule needs, the system
  MUST NOT guess; the case awaits verification with the reason (FR-061).
- **FR-015**: The error catalog (the error categories of the test project, each with a name, an
  optional description and an optional example) MUST be managed in one compact "Error categories"
  section on the Test cases step, which can be collapsed (FR-087); the Judge step has no catalog
  section. The section lists every category with its description, example and the number of test
  cases that use it (a case counts once, however many of its expected errors have the category).
  Users MUST be able to add categories there by typing them or by pasting a plain-text list with
  one category per line (optionally `name - description`), and by typing a new name where the
  category of an error to prepare is given (FR-024); names are normalized to lower case with
  dashes, and names already in the catalog are skipped and reported. Users MUST be able to edit a
  category's description and example, and to rename it: a rename applies to every expected error
  that uses the category, and a new name already in the catalog is refused. Removing a category
  that no test case uses happens at once. While at least one test case uses a category, its
  "Remove" MUST be disabled and the reason shown beside it in one sentence that names the way out
  ("Used by N test cases. Remove those test cases first, or rename the category."; after
  finalizing, when every case that uses it has a reply and can no longer be removed: "Used by N
  test cases. It can be renamed."). Renames are
  allowed after finalizing; they change the test cases version, and error analysis, the totals per
  category and the report are computed from the current categories. The system MUST NOT add,
  rename or remove categories by itself. It MUST show each category's description and example
  where a category is chosen. The judge does not have to use the catalog.
- **FR-016**: The error catalog has no file of its own and no "Load catalog" or "Export catalog"
  action. It belongs to the test project, not to the judge set, and is saved and loaded only inside
  the test project file (FR-020), together with the judge and the test cases. To reuse a catalog the
  user loads the test project that holds it, or loads an example (FR-019).
- **FR-017**: The Test cases step MUST let the user keep clean base cases in its table of test
  cases, with the kind "Clean" (FR-025); the Judge step does not list them. A clean base case has a name and a value
  for every variable of the judge prompt and no expected errors. Users MUST be able to add any number of them in the test case window
  ("Add test case", "Clean case", FR-083), and to open, rename and remove each one
  (FR-025). The system MUST refuse to remove a clean base case that cases with injected errors
  were made from, naming those cases. Clean base cases show what correct data looks like; they
  MUST NOT be used in place of the error rules.
- **FR-018**: Removed (prototype v15 review): the prompt that asked the user's LLM for many clean
  base cases at once, with its count, topic and review of every proposed case, is not offered. A
  clean case is made one at a time (FR-083); many clean cases come in with "Import test cases"
  (FR-027).
- **FR-019**: The system MUST offer two ready examples, Accuracy and Completeness, through one
  "Load example…" item of the File menu; the Judge step has no example section. The item opens a
  small window that lists the two examples, the demo (FR-026) and any example added by "Load metric
  definition…" in the same window, each with one line saying what it fills. An example starts a new
  test project: it fills the judge prompt, a sample reply with its reply mapping and the error
  rules on the Judge step, the error catalog and a few clean cases on the Test
  cases step, and forgets both remembered files (FR-076); the tool MUST ask before replacing existing content. The
  examples and the demo are the only built-in starting points.
- **FR-020**: "Save test project" MUST write the judge set and the test cases to one file, at any
  time, whether or not the test cases are finalized: the judge prompt with its judged text, the sample
  reply and reply mapping, the error rules, the error catalog, the test project
  name and every test case with its fields, expected errors, and base reference, together with the
  active metric (its id and parameters) and the check settings in use (the thresholds). It holds
  no replies, decisions, results or model details, and saves as FR-076 describes. "Load test project" MUST restore all of
  it with identical content, including the active metric and the thresholds, and start a new
  evaluation with no replies; the test project MUST come back
  in the state it was saved in, finalized or open, so that a finalized test project can be run again
  at once (FR-053 says how to change a part of it first). An
  invalid or incomplete file MUST be explained and MUST NOT replace the current work. There is no
  separate judge set file; the cases alone can be exported and imported (FR-050).
- **FR-021**: Other kinds of judges MUST be usable by typing or loading their prompt, writing
  their rules and typing or pasting their category list, without changing the rest of the tool,
  and check thresholds MUST be configurable from files. The system MUST warn, on the Judge step
  and before finalizing, when replies cannot be read automatically (no sample reply, no rules, a
  broken rule, or no field marked as the text of a finding), explaining that every case will
  then need verification by hand or with an LLM opinion.

**Step 2: Test cases — data and files**

- **FR-022**: Each test case MUST have an identifier, a name, one field for each variable of the
  judge prompt, and zero or more expected errors (none for a clean case). Each expected error MUST
  have a description and MAY have a category from the error catalog, a fragment, and a difficulty
  (obvious or subtle). Expected errors always concern the judged text (FR-010) and have no field of
  their own. A case made from another case MUST keep a reference to its base case. There are two
  kinds of test case, named the same everywhere: a **clean case** (no expected errors) and a **case
  with injected errors** (at least one expected error, made from a clean base case or without one).
- **FR-023**: A clean base case and a clean test case are the same thing, kept in one list, the
  table of test cases (FR-025): a clean case added with "Add test case", loaded from a file or
  coming with a ready example is a clean base case. Any clean case can be the base of a case with
  injected errors; a base is optional (FR-040).
- **FR-024**: The error catalog is shown in one place only, the "Error categories" section of the
  Test cases step (FR-015). Wherever the category of an error is given (the list of errors to
  prepare, FR-040), the user MUST be able to pick a category from the catalog or type a new name;
  a new name joins the catalog when the case is saved, normalized as in FR-015. A category in a
  pasted JSON that is not in the catalog is named under the JSON box and joins the catalog when
  the case is saved.
- **FR-025**: The Test cases step MUST show all test cases, clean and with injected errors, in one
  table below the "Error categories" section (FR-087). Each row shows the case's
  identifier, name, kind ("Clean" or "Injected errors"), base case,
  number of expected errors, categories and any warnings. "Add test case" is above the table, and the
  user can search, sort and filter it, including by kind. Each row MUST show three buttons: "Open" (the read-only
  view, FR-086; a click on the row does the same), "Rename" (asks for the new
  name; a name another case has is refused, FR-079) and "Remove" (asks for confirmation; refused
  for a base case in use, FR-017). There is no details panel and no menu in a row. Once the test
  cases are finalized "Open" stays enabled,
  and "Rename" and "Remove" stay enabled for a case that has no reply; for a case with a reply they
  are disabled with the reason ("This case has a reply"). The fields of a saved case are never edited;
  before finalizing a case is changed by cloning it, changing the copy's JSON and removing the
  original (FR-086), and after finalizing only the expected errors of a case without a reply can be
  corrected (FR-089).
- **FR-026**: The system MUST offer demo data as a fixed sample that is usable without
  regeneration: a judge set, test cases and replies, loaded
  from the "Load example…" window
  (FR-019) in one clearly labeled choice as a finalized evaluation (the same state "Load evaluation" produces), so that the Run and Results
  steps can be tried at once. The demo's variables are named after their content (`source_text`
  and `summary`, not `input` and `output`), so that the free choice of variables (FR-010) is
  visible.
- **FR-027**: Users MUST be able to import many test cases from a single CSV or JSON file in one
  action ("Import test cases", in the "File" menu). The system MUST validate the entire file before accepting it and present a summary:
  total cases, the count of cases with injected errors, the count of clean cases, and a list of invalid rows with position and
  reason. For CSV, it MUST handle text containing commas, quotes, line breaks, and Polish and
  other non-English characters, and report unreadable files clearly.
- **FR-028**: Users MUST be able to choose to import only valid rows or cancel when invalid rows
  exist; a cancelled or failed import MUST NOT change the currently loaded test project.
- **FR-029**: When a loaded file uses categories that are not in the error catalog, the summary
  MUST name them, and the user MUST choose to add them to the catalog in one action or to
  cancel the import; they are never added silently. When a loaded file has fields that match no
  variable of the judge prompt, or lacks a field for a variable, the summary MUST say so.
- **FR-030**: The import window MUST provide one "Download example file" action, with a plain
  one-sentence explanation next to it: the file is an example that shows how to lay out clean
  test cases in a spreadsheet so that they can be imported here. The example MUST be a CSV file
  that uses the variables of the current judge prompt as its field columns and contains two
  clean cases. Help shows the JSON layout, which is the one the cases have inside a test project
  file. There are no separate template actions.
- **FR-031**: The shortened CSV MUST have a `name` column (optional) and one column
  `field:<variable name>` for each variable of the judge prompt; every row becomes a clean case.
  The CSV has no columns for identifiers, base cases or expected errors. JSON is the format for cases with expected errors: a case has
  `name`, `fields` (name to text) and `expected_errors` (list of objects with `category`,
  `fragment`, `description` and optionally `difficulty`), and optionally `id` and `base` (the case it
  was made from). This one **case JSON** layout is used everywhere a case is exchanged as JSON: in the
  answer the LLM is asked for (FR-040, FR-083), in the box where a case is pasted (FR-085), in
  "Show JSON" (FR-086), and in "Export test cases". "Export test cases" MUST
  always write JSON, with every case, clean ones included. When a case JSON is pasted to make a
  new case in the test case window: `id` is ignored (a new identifier is
  assigned); for a case with injected errors
  the base picked in the window is used, and a different `base` in the JSON is named in a note
  under the box; with "Paste JSON" (FR-090) the `base` of the JSON is used when it names an
  existing clean case. The check of fields concerns the keys under `fields`: a variable of the judge prompt
  with no value is a problem, while a key the prompt does not use is named as a warning, kept and
  never sent to the judge, as in an import (FR-029).
- **FR-032**: The system MUST reject a file with more than 500 cases, state the limit and the
  number found, and leave the currently loaded test project unchanged.
- **FR-033**: The system MUST use the case identifier supplied in a JSON file when present,
  otherwise (always for CSV) assign identifiers by row order and tell the user. It MUST assign a unique identifier to each
  case made in the tool and MUST prevent identifier collisions with loaded cases.
- **FR-034**: Each test project MUST have a name, and its test cases a version derived from their
  content, so loading different content gives a different version.
- **FR-035**: Merged into FR-050, and with it into FR-020: the test cases are saved and loaded
  again with identical content inside the test project file.
- **FR-036**: The system MUST remain responsive when handling test projects of up to 500 cases.
- **FR-037**: The system MUST refuse to save an expected error without a description, and any case
  with no non-empty field, and MUST explain why. Each field MUST hold at most 100,000
  characters: above 30,000 the system MUST warn that the composed prompt may not fit the model's
  context window, and above 100,000 it MUST refuse the case (typed, pasted or loaded from a
  file, where it is reported as an invalid row) and state the limit.

**Step 2: Test cases — the test case window and injected errors**

- **FR-038**: "Add test case" MUST open the **test case window**: it fills the screen, has two
  columns that scroll on their own, and always shows "Close without saving" (which asks first when
  something was pasted or typed). It first offers three choices, "Paste JSON", "Clean
  case" and "Case with injected errors", all always available, also when the test project has no
  test case yet. "Paste JSON" leads to the JSON box and the case view (FR-090); "Clean case" to the
  clean case view (FR-083); "Case with injected errors" to the three parts of FR-040, FR-041 and
  FR-085. There is no "Clone" (FR-078). The read-only view of a saved case ("Open", FR-086) and the
  case window of Run (FR-055) show a case in the same layout as part 3 of FR-085, without the JSON
  on Run. The window replaces the former preparation window, the details panel of the Test cases
  step and every way of editing a saved case.
- **FR-039**: Until the test cases are finalized, users MUST be able to add, rename and
  remove cases; after finalizing, to add them, and to rename and remove a case that has
  no reply (FR-053). Each change MUST update the test
  cases version. A saved case's fields are not edited (FR-025).
- **FR-040**: For a case with injected errors the window MUST first offer the base: any clean case,
  or none (the base is optional). The window MUST then show the **list of errors to prepare**: one row per wanted error with its category (picked
  from the catalog, or typed as a new name in a text box, FR-024; its description and example are
  taken from the catalog and MUST NOT have to be typed again), its difficulty (obvious, subtle, or
  left to the LLM) and a short description of what should be wrong. The user MUST be able to add
  and remove rows ("Add error", "Remove"). From the base case and these rows the window MUST build
  one ready, universal prompt for the user's own LLM, shown in full with "Copy prompt" and rebuilt
  whenever a row or the base changes. It MUST contain the judge prompt with its judged text (so the
  LLM knows what the judge checks), every field of the base case when one is picked (without one,
  it asks the LLM to write the whole case, a value for every variable, with the errors in its
  judged text), the rows with each category's description and example, the rules for realistic
  errors and exact-fragment quoting, and the answer format: one case in the case JSON layout
  (FR-031) with the judged text and one expected error per row, each with its exact fragment. "Next" leads to the JSON box.
- **FR-041**: The window MUST then offer one JSON box into which the user pastes the case JSON (the
  LLM's answer). The same box is used by "Paste JSON" (FR-090) for a JSON the user already has. The JSON MUST be
  checked as soon as it is pasted and whenever it changes (FR-084): it must be readable (the first
  complete JSON block, also inside other text or a code fence), hold exactly one case, have a value
  for every variable of the judge prompt, and give every expected error a description; the other
  keys are treated as FR-031 says. An expected error without a fragment
  (for example bias of the whole text) or without a category is allowed and named as a warning:
  it cannot be matched automatically and is decided by hand on Run (FR-061). Every problem and
  warning MUST be shown under the box with where it is. A JSON with no expected errors is valid
  here too: it is saved as a clean case, and the window says so before saving.
  "Next" MUST be enabled only while the JSON is valid and leads to the case view (FR-085). An
  answer whose number of expected errors differs from the list of errors to prepare is accepted
  with a note naming the difference. The tool MUST NOT have built-in rules that change text by
  themselves, and MUST make clear that what the LLM returns is a proposal to review, not a
  guaranteed result.
- **FR-042**: Merged into FR-085 and FR-080: the review of a case before saving happens in the case
  view built from its JSON, with "Show in text" at each expected error and the warnings of FR-080;
  "Compare with base", "Use selected text as fragment" and editing single expected errors are not
  offered.
- **FR-043**: The prompt that prepares errors MUST explain the two difficulty levels and ask the
  LLM to keep the difficulty given in the list, or to choose one where the row leaves it to the
  LLM. A difficulty is changed by changing it in the JSON.
- **FR-044**: When saving a case with injected errors, the system MUST record its base case when one
  was picked, and for each expected error the category and a description of what was changed, and
  MUST reject a case identical to its base case. The system MUST also record the exact fragment each error is at,
  when the JSON gives one, because automatic matching of the judge's findings uses it: for an error present in the text, the
  changed fragment of the judged text; for an omission, the fragment of another field that the
  judged text no longer covers. A new category in the JSON joins the catalog on saving (FR-024).

**Step 2: Test cases — prompts, feedback, saving and finalizing**

- **FR-045**: The system MUST show live feedback on the test cases: counts of clean cases and of cases with injected errors,
  warnings for missing kinds (stating clearly that some measures cannot be computed without both
  kinds), flagged duplicate texts, and remaining capacity up to 500 cases.
- **FR-046**: The system MUST compute and show a test-size summary from the test project, updated on
  every change: total cases (one judge run each), clean cases, cases grouped by the number of
  injected errors (for example "10 cases with 2 errors"), and total injected errors. The totals of
  injected errors and clean cases MUST be shown against the fixed minimums (30 injected errors, 10
  clean cases) as met or missing N, with the plain statement that the system needs them to give a
  final answer (FR-068), so the user knows before running whether the answer can be other than
  Inconclusive. This count is taken from the test project and is a forecast; the minimum that decides
  the final answer is counted from decided items (FR-068). The user never enters or calculates
  these numbers. When the judge is evaluated per case (FR-061), the summary MUST count cases with
  expected errors instead of injected errors and show them against the minimum of 30 cases with
  expected errors and 10 clean cases.
- **FR-047**: The system MUST compose the final prompt for each case from the judge prompt with the
  case's fields filled into the matching variables. The system MUST NOT add any text of its own
  to that prompt (no appended material, instructions, or format requirements); the prompt is
  used exactly as the user wrote it. When a case has no field for a variable in the prompt, the
  variable MUST be replaced with empty text and the case MUST be flagged with a warning naming
  the missing field, in the read-only view of the case, in its row and in the finalize summary;
  this MUST NOT block finalizing.
- **FR-048**: Whenever a judge prompt and at least one case are present, the system MUST show, in
  the read-only view of a case (FR-086) and in the case window of Run, the complete prompt that
  would be sent to the LLM for that case (FR-047), with "Copy prompt", including before the test
  cases are finalized.
- **FR-049**: Users MUST be able to combine cases prepared in the tool with cases imported from a
  file in one test project before finalizing.
- **FR-050**: "Export test cases" MUST write all cases of the test project (clean ones included, with
  their expected errors and base references) to a JSON file, at any time, whether or not the
  test cases are finalized. The file holds only the cases: no judge, catalog, metric, thresholds or
  replies, and no record of whether the test cases were finalized. It is an export, not a save: each
  export asks for a file name, no file is remembered for it, and it does not clear the indicator
  of unsaved changes (FR-051); the whole work is saved only as the test project (FR-020) and the
  evaluation (FR-073). "Import test cases" (FR-027) reads the exported file back, adds its cases
  to the test project, also after finalizing (FR-053).
- **FR-051**: The system MUST show, in the header, whether there are unsaved changes, and MUST warn
  before a load, a new evaluation, "Load example…" or "Edit the judge and run again" would replace
  work that has unsaved changes, with three choices: "Save evaluation first", "Discard" and
  "Cancel". That offer inside the warning is the only way to save the evaluation outside the Run
  step; it is not a standing action (FR-076).
  There is one indicator. It clears after "Save evaluation" or "Save evaluation as";
  while no reply has been entered it also clears after "Save test project" or "Save test project as",
  because the test project then holds all the work. Once a reply exists, saving the test project does not
  clear it, and the tool says that the replies are saved only by "Save evaluation". Any change sets
  it, including a threshold changed in "Details" and "Load check settings", because both files
  store the thresholds (FR-020, FR-069); such a change is saved by the next "Save evaluation" on
  the Run step or "Save test project".
- **FR-052**: Users MUST be able to finalize the test cases after seeing a summary of counts, balance
  and warnings. The summary MUST warn when replies cannot be read automatically (FR-021), when a
  rule is broken (FR-014), when a case lacks a field for a variable (FR-047), and when no expected error
  is marked subtle, because the result would then say nothing about subtle errors.
- **FR-053**: The test cases MUST stay open until the user finalizes them, whether they came from a file,
  was built in the tool, or both. Once it is finalized, the system MUST keep the judge prompt and
  the cases' fields fixed for the evaluation and MUST offer "Start new evaluation" instead of
  editing them. One exception: while no reply has been entered, the Test cases and Run steps MUST
  offer "Edit test cases", which opens the test project and the judge prompt for editing again; nothing
  is lost, and the test cases are finalized again before replies can be entered. After the first reply
  "Edit test cases" MUST NOT be offered. Two things MAY still be corrected, because they describe
  how replies are read and judged, not what was sent to the judge: the reply mapping and the error
  rules. After such a change, automatic decisions MUST be recomputed, decisions made by hand MUST
  be kept, and the judge gets a new version (FR-075). Two changes to the test cases MAY also be made
  after finalizing, each giving a new test cases version: the expected errors of a case that has no
  reply yet are corrected through its JSON (FR-089), and new test cases are added with "Add test
  case" or "Import test cases"; a new case starts as Not run, and the replies and
  decisions of the other cases are kept. A case with a reply is not corrected: an expected error
  that should not count is marked "Ignore" on Run (FR-062). A category may still be renamed
  (FR-015). After finalizing, a test case without a reply can still be renamed and removed (the test
  cases version changes); a case with a reply cannot. Entering replies MUST be available only after finalizing. "Load test
  project" MUST start a new evaluation; if replies exist, the system MUST warn that they will be
  discarded, offer to save the evaluation first, and proceed only after confirmation. "Import test
  cases" adds cases to the test project before and after finalizing.

**Step 3: Run**

- **FR-054**: The Run step MUST show all test cases in one list, each with its name, kind, number of
  expected errors and status (Not run, Awaiting verification, Pass, Fail), together with the
  progress (replies received and cases decided, out of all cases) and the number of items still to
  decide. The user MUST be able to show the cases that await verification first, or only those.
  Above the list the Run step MUST show a short summary of the judge being run: the judge
  version, the test project name and version, and the judged text. The judge prompt and the error rules
  are not repeated there; they are on the Judge step.
- **FR-055**: Each case in the list MUST have an "Open" button that opens the **case window**. It
  MUST fill the screen and show two columns, each scrolling on its own. The left column shows the
  case in the same read-only layout as part 3 of FR-085, without its JSON: name, fields with the
  fragments of the expected errors highlighted and numbered, the list of expected errors with "Show
  in text", and then the complete judge prompt with "Copy prompt". The right column, headed
  "Judge's reply", holds the four steps to follow (Copy prompt; run it in a new conversation; copy
  the answer; Paste reply from clipboard), "Paste reply from clipboard", and the box for the JSON
  reply with "Save reply", always shown and never behind a collapsed section, checked as the text
  changes (FR-084); once a reply is saved the box holds it, and below it the list of items with
  their marks, "Add finding" and "Second opinion…" (FR-060 to FR-064). The window has no "More
  actions" section. The window header MUST hold "Previous test case" and
  "Next test case", always visible and also reachable from the keyboard, the position of the case
  ("case 7 of 20"), its status, and "Save evaluation". Moving to another case MUST NOT lose a reply
  that was typed but not saved: the system asks first.
- **FR-056**: Users MUST be able to enter the received reply for each case in one action with
  "Paste reply from clipboard", which reads the clipboard and saves the reply, or by pasting into
  the box and pressing "Save reply". The reply is expected as the judge's JSON, but the system MUST
  keep any text: when the reply is not readable JSON, or lacks a field a rule needs, it is saved,
  the problem and where it is (line and column, or the field path) are shown under the box (FR-084),
  nothing is marked automatically, and the user marks the items by hand. An empty clipboard or box
  is explained and changes nothing. Every new reply MUST reset the case: its decisions, the
  findings added by hand included, are removed and the automatic marks are computed again from the new reply. When
  the case has decisions set by hand or approved from an LLM opinion, the system MUST ask before
  replacing the reply, saying how many such decisions will be removed; otherwise it replaces the
  reply without asking.
- **FR-057**: The system MUST keep, with every test case, the judge prompt that was composed for it
  and the reply that was received, and MUST include both in the saved evaluation and in every
  exported result.
- **FR-058**: On the Run step the user MUST be able to record **model details**: optional
  multi-line free text with the parameters of the LLM that ran the judge (for example the model
  name, temperature and other settings), in any form. The tool does not read or check it. It MUST
  be stored with the result and shown in the
  report, and the Run step MUST remind the user to run every prompt in a new conversation, so that
  one case cannot influence another.
- **FR-059**: Replies are entered one case at a time. Exporting all prompts to one file and
  importing all replies from one file are not part of this version (see Assumptions). Because
  nothing is saved automatically (FR-004), the Run step MUST offer "Save evaluation" and "Save
  evaluation as", the case window of Run MUST offer "Save evaluation" in its header, and the system
  MUST show in both how many replies were saved since the last "Save evaluation" and remind the
  user to save after every 25 of them. No other step offers these two actions (FR-076).

**Step 3: Run — resolving the differences**

- **FR-060**: Right after a reply is saved, the case window MUST show **one list of items** with
  their marks: every expected error of the case, and every additional finding (a finding that
  points at no expected error), each undecided item with its reason, together with the decisions
  of FR-062 to FR-064 and "Approve". The marks are: for an expected error "Found", "Issue: missed"
  or "Ignore"; for an additional finding "Issue: false positive", "Real error" or "Ignore". The two
  "Issue" marks count against the judge; "Ignore" leaves the item out of every count. "Previous
  test case" and "Next test case" MUST move through the cases, and the user MUST be able to limit
  this to the cases that await verification. There is no separate Verify step.
- **FR-061**: The system MUST mark automatically everything that can be settled from valid JSON
  and the explicit rules. It reads the reply as JSON (the first complete JSON block, also inside
  other text or a code fence), applies the error rules (FR-013, FR-014) to get the findings, and
  matches findings to expected errors by place: an expected error is "Found" when at least one
  finding's text points at the expected fragment. Several findings may point at the same
  expected error, and none of them is an additional finding. A category is not required for a
  match. Because claim-based judges often rephrase the text, matching MUST tolerate rephrasing,
  and a finding that only partly resembles an expected fragment leaves that expected error
  undecided. An expected error that no finding points at, fully or partly, MUST be marked "Issue:
  missed" automatically only when the case has no additional finding; when it has one, which may be
  the same error in other words, the expected error stays undecided with that reason. Every finding that points at no expected error MUST be added to the list
  as an additional finding; it is never marked automatically. Nothing is marked automatically, and
  every item stays undecided with the reason shown, when the reply cannot be read as JSON or lacks
  a field a rule needs; an expected error with no fragment and a finding with no text also stay
  undecided. **Whole-case verdict**: when every error rule uses only fields
  outside any list, the judge gives a verdict for the whole text and there is no place to match.
  The case is then decided as a whole: when the reply is flagged (at least one rule holds), every
  expected error of the case is "Found"; when it is not flagged, every expected error is "Issue:
  missed". On a clean case a flag is an additional finding, which the user marks as always. The
  Judge step and the case window MUST say that this judge is evaluated per case, and the user can
  still change every mark by hand.
- **FR-062**: For every item the user MUST be able to set the final mark: an expected error
  "Found", "Issue: missed" or "Ignore", and an additional finding "Issue: false positive", "Real
  error" or "Ignore"; "Ignore" is always available. The user MUST be able to add additional findings
  by hand ("Add finding"), for example when the tool could not read the findings from the reply,
  each with its text and, optionally, a category (from the catalog, or a new name that joins it)
  and a difficulty (obvious or subtle), shown with the finding in the case window, the Test case
  list of Results and the report, and counted in the table of additional findings of FR-070. A finding added by hand MUST have "Remove", which removes it
  with its mark; a finding read from the reply MUST NOT have one. An item
  marked "Ignore" MUST be left out of every count and listed as ignored in the report. An
  additional finding marked "Real error" (a true error that was not planned) is counted on its own
  (FR-066); it MUST NOT be added to the expected errors of the case. The user MUST be able to
  change any mark, including an automatic one, and to add a short note.
- **FR-063**: In the case window of every case with a reply, the system MUST offer a second
  opinion from the user's own LLM, one case at a time, through one button, "Second opinion…", under
  the list of items. It opens a **second-opinion window** for that case, not a collapsed section,
  which holds, in order: one line saying what is checked ("The LLM checks N expected errors and M
  additional findings of this case"); the verification prompt, read-only, with "Copy prompt"; one
  box for the LLM's answer, checked as soon as it is pasted and whenever it changes (FR-084); a
  preview of every change the opinion makes; and "Apply opinion" and "Cancel". The prompt MUST
  contain the case's fields, the numbered expected errors, the numbered additional findings and
  the received reply, and ask for a fixed JSON opinion: for each expected error whether the judge
  found it, and for each additional finding whether it is a real error or a false positive, each
  with a short reason and the fragment of the data or of the reply it is based on; every item is
  judged on its own and each answer names the item by its number. The prompt MUST also ask for
  any finding the reply contains that is not in the list (for example when the reply is not
  JSON), each with its text, "real" true or false, a reason and, optionally, a category and a
  difficulty. The preview MUST list, for each
  answered item, its mark now and the mark it will get ("E1 undecided → Found", "A1 Real error →
  Issue: false positive (set by hand)") with the reason and fragment, and every new finding as
  "+ new finding “…” → Real error". "Apply opinion" adds each new finding as a finding added by
  hand (FR-062: with "Remove", and with its category and difficulty when the opinion gives them),
  marked with the source "LLM opinion, approved by the user". "Apply opinion" is the
  user's approval: it sets the mark of every answered item, including marks set by hand and marks
  from an earlier opinion, with the source "LLM opinion, approved by the user"; items the opinion
  does not answer keep their marks, and an undecided one gets the reason "The LLM opinion gave no
  answer for this item" (shown in the window only, not stored in the evaluation file). When the
  answer is not readable JSON, or is for another case, the problem and where it is are shown under the box and "Apply opinion" is disabled. When it is readable but
  classifies none of the items and adds no finding, the window says "The opinion classifies none of the N items of
  this case. Nothing will change.", names the reason for each item, and "Apply opinion" stays
  disabled. In every such case the pasted text is kept and nothing changes. Every mark can be
  changed by hand afterwards. There is no verification prompt for several cases at once and no
  approval of several cases in one action.
- **FR-064**: Every test case MUST have a status: Not run, Awaiting verification, Pass, or Fail. A
  case awaits verification while any of its items is undecided, and a case whose reply could not
  be read awaits verification until the user approves it, because the tool cannot know that the
  reply holds no further findings. It is Pass when every expected
  error that is not ignored is "Found" and no additional finding is marked "Issue: false
  positive", otherwise Fail. The user's decision MUST be authoritative, and every decision MUST show its source:
  automatic, set by hand, or an LLM opinion approved by the user.

**Step 4: Results**

- **FR-065**: The Results step MUST have three views: Summary, Error analysis, and Test case
  list. Summary is shown first. The Results step MUST be read-only: no reply, decision, expected
  error, rule or reply mapping can be changed there; changes are made on the Run step or the
  Judge step. The only exception is the thresholds in "Details" (FR-069). Results MUST be computed
  from the cases that are decided, labeled "provisional" while any case is not run or awaits
  verification, with the number of such cases shown.
- **FR-066**: The Summary view MUST show these counts before anything else: the total number of
  expected errors, with how many were found and how many missed; the number of additional
  findings the judge reported, with how many were confirmed as real errors and how many were
  false positives; and the number of subtle expected errors, with how many were found and how
  many missed. Ignored items MUST be shown as a separate count and left out of the others. For a
  judge evaluated per case (FR-061) the Summary MUST count cases instead: the decided cases with
  expected errors, with how many the judge flagged and how many it did not, and the decided clean
  cases, with how many were flagged wrongly; a case whose expected errors are all ignored is left
  out. It MUST NOT show per-error counts that the judge's reply cannot support.
- **FR-067**: The system MUST compute and display, as its two built-in measures, the detection
  rate and the false-positive rate (formerly the false-alarm rate). The detection rate MUST be
  counted per expected error: expected errors found divided by all expected errors in decided
  cases. The false-positive rate MUST be counted per finding: additional findings confirmed as
  false positives, divided by all findings the judge reported in decided cases, clean or not.
  Several findings that point at the same expected error each count as a correct finding, and so
  does an additional finding confirmed as a real error. Ignored items are left out of both. When
  the judge reported no findings at all, the false-positive rate MUST be shown as not available.
  For a judge evaluated per case (whole-case verdict, FR-061) the two measures shown instead MUST
  be counted per case: the case detection rate (decided cases with expected errors that the judge
  flagged, divided by all decided cases with expected errors) and the clean-case false-positive
  rate (decided clean cases with a confirmed false positive, divided by all decided clean cases).
  The Summary, the Help and the report MUST say in plain words which way was counted.
- **FR-068**: Below the counts and the two rates, the Summary view MUST state the overall result
  in one line with its reason: Works, Does not work, or Inconclusive. It is Works when the
  detection rate and the false-positive rate both meet their thresholds, Does not work when
  either does not, and Inconclusive when any case is Not run or Awaiting verification or the
  sample is below the minimum, counted from the expected errors and clean cases that are decided and not
  ignored. Threshold defaults: detection rate at least 80%, false-positive
  rate at most 10%. The minimum sample is fixed in the tool and not editable: 30 expected errors
  and 10 clean cases. The "Test size" summary (FR-046) MUST be shown with the plain statement
  that the system needs at least 30 injected errors and 10 clean cases to give a final answer.
  There is no combined score.
  For a judge evaluated per case the two case-level measures (FR-067) have thresholds of their
  own in the check configuration, with the same defaults (case detection rate at least 80%,
  clean-case false-positive rate at most 10%); only the thresholds of the measures in use apply and
  are shown in "Details". The minimum sample is then 30 cases with expected errors and 10 clean
  cases.
- **FR-069**: Thresholds and advanced statistics MUST NOT draw attention away from the counts.
  They MUST sit in a "Details" section of the Summary view that is closed by default: the two
  thresholds, each with a one-sentence plain-language explanation, which the user can change
  there or load from a check configuration file ("Load check settings"), with the overall result
  updating at once; the
  95% confidence interval of each rate, with a "borderline" note when an interval includes its
  threshold; and, as information, the share of cases with at least one false positive and the
  same share for clean cases alone. The values used MUST be stored with the result and shown in
  the report.
- **FR-070**: The Error analysis view MUST show a breakdown per category and a breakdown per
  difficulty (obvious, subtle, not set): expected errors, found, missed and the detection rate.
  A group with fewer than 10 expected errors MUST show counts only, with no rate. The view MUST
  also show the number of additional findings, real errors and false positives per error rule,
  and a table of additional findings per category and per difficulty (real errors, false
  positives; counts only, with no rate), which counts the findings added by hand that have a
  category or a difficulty, the others in the row "(no category)" or "(not set)"; it is kept apart
  from the rates of the expected errors (FR-062). The HTML report holds the same table.
  For a judge evaluated per case, both breakdowns MUST count cases: a case with expected errors
  counts once in each category and each difficulty its errors have, as flagged or not flagged, and
  every group MUST show counts only, with no rate, because the judge does not say which error it
  found. The view MUST say this in one sentence.
- **FR-071**: The Test case list view MUST list every test case with its name, kind, expected
  errors, what the judge reported (findings, and how many expected errors were found), its
  status and the source of its decisions. Opening a case MUST show its full judge prompt, the
  received reply and the decisions made on it, read-only, with "Previous test case" and "Next test
  case"; it MUST offer no action that changes the case.
- **FR-072**: Users MUST be able to export the result as an HTML report at any time ("Export HTML
  report"). The result as JSON is the evaluation file of FR-073; there is no separate "Export
  JSON". While any case is not run or awaits verification, the report and the evaluation file MUST
  be marked provisional and say how many cases are not decided. The HTML report MUST contain the
  three views in the same order, be readable without the tool, and print cleanly to PDF from the
  browser. The report and the evaluation file MUST always contain the judge set (prompt,
  reply mapping, error rules, error catalog), the full final prompts with the real input data
  filled in, the expected errors, the received replies, every decision with its source, the
  ignored items, and the overall result with the values it was based on; there is no option to
  omit them. The Help MUST state that exported files contain the user's data.
- **FR-073**: "Save evaluation", on the Run step and in the case window of Run (FR-059), MUST
  save the whole progress to a file on the user's device at any time on that step, also while
  cases are not run or await verification. Before the test cases are finalized the work is saved
  with "Save test project", which then holds all of it (FR-051). It saves as FR-076 describes. The evaluation file is also the result as JSON (FR-072): one file format whose
  results part is empty until decisions exist. "Load evaluation" MUST restore the judge set, the
  test cases, every prompt, reply and decision exactly as saved (finalized or not), so that the
  user can view the result or continue the work. An evaluation file alone is enough: the user can
  start by loading it, without a test project file, to see the result and generate the
  report. An invalid file MUST be explained and MUST NOT replace the current work. After "Load
  evaluation" or "Load test project" the tool MUST open the first step with unfinished work, derived
  from the content of the file: Judge when there is no judge prompt, Test cases when the test project
  is not finalized, Run when any case is not run or awaits verification (so a finalized test project
  opens on Run), and Results when every case is decided. The "what next" line MUST then say how far the work is (for example "12 of 20
  cases decided") and offer "Continue", which on the Run step opens the first case that is not run
  or awaits verification.
- **FR-074**: The system MUST offer "Edit the judge and run again" on the Results step. It keeps
  the finalized test cases, offers to save and export the current result first, clears the
  replies and decisions, lets the user change the judge prompt, and gives the judge a new version
  identity. The new run forgets both remembered files (FR-076), so its first "Save test project" and
  its first "Save evaluation" each ask for a file and never overwrite the earlier run.
- **FR-075**: Every result MUST record what produced it: the judge version (prompt, reply mapping
  and error rules), the test project name and version, the model details when given, the
  thresholds used, and the version of the tool. When the error rules or the reply mapping were
  corrected after replies were received, the judge version changes, the replies and decisions
  are kept, and the result, the Results step and the report MUST note this and name the judge
  version in force when the replies were received. When test cases were added or expected errors corrected after the first reply (FR-053), the
  result, the Results step and the report MUST say so and name those cases. Because evaluation per case (FR-061) follows
  from the shape of the error rules, a correction of the rules can switch between counting per
  expected error and counting per case; when it does, the result, the Results step and the report
  MUST say which way was counted before and after. Recalculating results from the same judge
  set, cases, replies and decisions MUST give identical numbers.
- **FR-076**: The tool MUST work with two files on the user's device: the test project (FR-020) and
  the evaluation (FR-073). The Results step has no file of its own; it shows the result held in
  the evaluation and generates the HTML report (FR-072). The load actions of both files and the
  save actions of the test project MUST be in the header's "File" menu. "Save evaluation" and
  "Save evaluation as" MUST be only on the Run step and in the header of the case window of Run
  (FR-059), where the replies are entered; the header of the page holds no "Save evaluation". For
  each of the two files the system MUST remember,
  separately and only for the page session, the file it last saved to or loaded through the file
  picker:
  - The first "Save test project" or "Save evaluation" MUST ask for a file name and folder; every
    later one MUST overwrite that same file without asking for a file again.
  - "Save test project as" and "Save evaluation as" MUST save to a new file, which then becomes the
    remembered one.
  - After a load through the file picker, saving goes to the loaded file; the browser may ask once
    for permission to write to it. A file dropped onto the page is loaded but not remembered, so
    the next save asks for a file.
  - "Load test project" sets the remembered test project file and forgets the evaluation file, because a
    new evaluation starts. "Load evaluation" sets the remembered evaluation file and forgets the
    test project file, so that "Save test project" can never silently overwrite the file of another test.
  - When a remembered file can no longer be written (moved, removed, or permission withdrawn), the
    system MUST say so, forget it and ask for a file again; nothing is lost from the page.
  - "Start new evaluation" and "Load example…" (an example or the demo) forget both files. "Edit the judge and run again"
    also forgets both, because the changed judge is a new test (FR-074); "Edit test cases" before
    the first reply (FR-053) keeps both, because it corrects the same test.
  The name of the remembered test project file MUST be shown next to "Save test project" in the
  header's "File" menu, and the name of the remembered evaluation file next to "Save evaluation"
  on the Run step and beside the indicator of unsaved changes.

- **FR-077**: To help the user check the data, the case windows MUST highlight text, and every
  highlight MUST carry a number or a word as well as its color (FR-007):
  - In the case window of Run and in the read-only case view: each expected error is highlighted
    in the judged text, wherever its fragment is found (word for word, otherwise the nearest
    match), with the number the error has in the list of expected errors, and the same number
    stands beside its decision. In the judge's reply, the part each finding points at is
    highlighted: green with the label "matches error N" when it hits an expected error, amber
    with "partial match with error N" when it only partly resembles it, and red with "no
    expected error" for an additional finding. An expected error whose fragment is not found in
    the text is listed with the note "fragment not found". A reply that is not JSON, or a judge
    evaluated per case (FR-061), is shown without finding highlights and says so in one line.
  - In the case view built from JSON (FR-085) and in the read-only view (FR-086): the fragments of
    the expected errors are highlighted in the fields with their numbers; "Show in text" at an
    expected error gives its fragment a stronger highlight and scrolls it into view; a changed
    place covered by no expected error, an expected error whose fragment is not found and a case
    identical to its base are marked in the warning color with their words (FR-080).
  - A field with a problem in the import summary or in a case (a missing variable, a field too
    long, a case identical to another) is marked in the warning color with the word "missing",
    "too long" or "duplicate".
  Highlights never hide the text, never change it, and meet the contrast rules of FR-007 in both
  schemes.

- **FR-078**: There MUST be no "Clone" button, on the row of a case or in its read-only view (removed
  in the owner review of 2026-11-14). A copy of a case is made by hand: "Show JSON" and "Copy JSON"
  (FR-086), then "Paste JSON" (FR-090) in a new case, where the user changes the name and the rest
  and presses "Save case"; the copy is an ordinary new case with no link to the original. A new
  clean case is made with "Clean case" and its "Like case" (FR-083), and a new case with injected
  errors with "Case with injected errors" (FR-040), neither of which needs a copy. Before its first
  reply, the expected errors of a saved case are corrected with "Correct expected errors" (FR-089).

- **FR-079**: Test case names MUST be unique within a test project, compared without regard to case
  and surrounding spaces. When a case is added or renamed ("Rename" at its row), an empty
  name is allowed (the tool shows "Case N") but a used name is refused with the number of the case
  that has it. An import and a loaded test project that contain a duplicate name are kept, and
  every case involved shows a warning ("The name … is also used by case #N"), which is also counted
  by the filter "With warnings"; the user resolves it with "Rename". Names do not replace
  identifiers: files refer to cases by identifier.

- **FR-080**: Before a case with injected errors is saved, the case view (FR-085) MUST show one
  line that says whether its text and its list of expected errors agree, recomputed whenever the
  JSON changes: "Text and list agree", or the count of each mismatch. A mismatch is (a) a changed
  place, against the base case, that no expected error covers: it is highlighted in the text in the
  warning color with the words "not in the list" (only when a base case was picked); (b) an expected error whose fragment does not
  occur in the judged text (nor, for an omission, in another field): it is marked "not in the text"
  in the list; (c) a case identical to its base case (only with a base); (d) an expected error with no fragment or no
  category: it is named, as it cannot be matched automatically or grouped. "Save case" with (a) or
  (b) MUST ask for confirmation and say what does not agree; (c) is refused (FR-044); (d) is only
  a note. A mismatch is resolved by changing the JSON.

- **FR-081**: Making and changing cases is reduced to these routes: "Paste JSON" (FR-090); "Clean
  case" (FR-083); "Case with injected errors", prepared with the user's LLM (FR-040, FR-041,
  FR-085); and "Import test cases" (FR-027). The list of expected errors of a case
  always comes as a whole from its JSON or from an imported or loaded file; there is no action
  that adds, removes or edits a single expected error, and no way to edit the text of a saved case.
  The former "Describe errors again", "Compare with base", "Use selected text as fragment", typing
  the fields of a clean case by hand, generating many clean cases at once, bulk preparation of
  errors and "Edit by hand" are not offered.

- **FR-082**: Removed (clarification of 2026-11-13): there is no "No error" mark, no "Not checked"
  state and no "Mark as No error". Any clean case can be the base of a case with injected errors,
  a base is optional, and "Case with injected errors" is always available (FR-038, FR-040).

- **FR-083**: "Clean case" MUST open the **clean case view**: a box for the name, a box for an
  optional comment, the full prompt for the user's LLM with "Copy prompt", the box for the LLM's
  answer, and "Approve and close" and "Close without saving". The comment is free text (what the
  text should be about, or examples) and goes into the prompt as written; the tool does not look
  for case names in it. Beside it, an optional "Like case" choice lists the existing clean cases;
  the fields of the one picked are put into the prompt as a model. The prompt MUST be rebuilt when
  the comment or the pick changes and MUST contain the judge prompt with its variables and its
  judged text, the error catalog (so the case contains none of its errors), the comment, the
  picked case if any, and the answer format:
  one clean case in the case JSON layout (FR-031) with a value for every variable and no expected
  errors. The answer MUST be checked as soon as it is pasted and whenever it changes (FR-084)
  against the structure the judge needs: one case, a non-empty value for every variable of the
  judge prompt, no expected errors, and no field over the length limit (FR-037); an answer with
  expected errors is a problem, and the note under the box points to "Paste JSON", which accepts
  it; a field the prompt does not use is named as a warning, and the other keys are treated as FR-031 says. When the answer is right, its fields are shown read-only and "Approve and close"
  is enabled: it saves the case under the typed name (or the answer's name when the box is empty)
  and closes the window. When it is wrong, "Approve and close" is disabled and
  the problems are shown under the box.

- **FR-084**: Wherever the user pastes text that the tool reads (the sample reply, the answer for a
  clean case, the JSON of a case, the judge's reply, an LLM opinion), every problem MUST be shown
  directly under the box together with where it is: the line and column for text that is not
  readable JSON, and the path of the field (for example `fields.summary`, `expected_errors[2].description`)
  for a missing, unknown, empty or too long field. The pasted text MUST be kept, and nothing that
  was already saved is changed by a wrong paste.

- **FR-085**: For a case with injected errors, "Next" (FR-041) MUST turn the JSON into the **case
  view**. The left column shows the case read-only: its name, the judged text with the fragments of
  the expected errors highlighted and numbered (FR-077), and the other fields. The right column
  shows the list of expected errors read-only (number, category, difficulty, fragment,
  description), each with "Show in text", the line of FR-080, and below them the source JSON in an
  editable box. Fields and expected errors MUST NOT be editable in the view; the user changes the
  JSON, and every change MUST show at once in the fields and the list. While the JSON is invalid
  the view keeps its last valid state, marked out of date, the problems are shown under the box
  (FR-084), and "Save case" is disabled. "Show in text" MUST highlight the fragment of that error
  and scroll it into view, in the judged text or, for an omission, in the other field; when the
  fragment is not found, the error is marked "not in the text". "Save case" (enabled only while
  the JSON is valid; it asks for confirmation as FR-080 says) and "Close without saving" MUST be
  available in every part of the window, from the choice of the base to this view.

- **FR-086**: "Open" MUST show a saved case **read-only**, in the layout of the case view (FR-085)
  without the JSON box: name, fields with highlighted fragments, the list of expected errors with
  "Show in text", the composed judge prompt with "Copy prompt" (FR-048), and the reply if one
  exists, with "Previous test case" and "Next test case". Nothing in it can be edited. "Show JSON"
  MUST show the case's JSON, rebuilt from the case in the case JSON layout (FR-031), with "Copy
  JSON"; pasting it into a new case MUST give the same fields and expected errors (the base of
  the new case is set in its window, FR-031).
  The view MUST NOT offer "Clone" (FR-078); it offers, after finalizing, for a case without a reply,
  "Correct expected errors" (FR-089).

- **FR-087**: The Test cases step MUST show, in this order, the "Error categories" section
  (FR-015) and the table of all test cases (FR-025); there is no separate "Clean cases" section.
  The "Error categories" section MUST be collapsible and expandable by a click on its heading, also
  from the keyboard. It is open while the test project has no test cases, and starts collapsed when
  a test project with test cases is loaded or the step is first opened with cases. Collapsed, it
  shows a one-line summary in its heading (for example "8 categories"), and the state the user
  chooses is kept for the page session.

- **FR-088**: The Judge step MUST keep its buttons to a minimum: "Add rule" (with "Add condition"
  and "Remove" inside each rule) and the one action of the "what next" line. The judge prompt, the
  judged text and the sample reply are read as they change, with no action of their own; "Explain"
  hints open on demand. The step MUST NOT show a welcome section or "Save evaluation".

- **FR-089**: After the test cases are finalized, the read-only view of a case that has no reply
  yet MUST offer "Correct expected errors". It opens the case view of FR-085 with the case's JSON:
  only its `expected_errors` may change; a change to its fields or name is shown under the box as a
  problem and blocks "Save case". The checks of FR-041, FR-080 and FR-084 apply. Saving gives a new
  test cases version. Once the case has a reply, the action is not offered and the view says why.

- **FR-090**: "Paste JSON" MUST open the JSON box of FR-041 directly, for a case JSON the user
  already has (prepared elsewhere, copied with "Copy JSON", or exported). The checks of FR-041 and
  FR-084 apply, except that the JSON may hold no expected errors; a `base` that names an existing
  clean case is used as the base, otherwise the case has none. "Next" leads to the case view of
  FR-085, where the window names the kind the case will have: a clean case when it has no expected
  errors, a case with injected errors when it has at least one. "Save case" saves it as that kind.

### Key Entities

- **Test Project** (formerly "test set"; also replaces "dataset"): the user's whole test, saved and
  loaded as one file and used again for every run of the same test. It holds the judge set, the
  error catalog, the test cases with their name and version, the active metric with its parameters
  and the thresholds. It holds no replies and no decisions (they are in the evaluation).
- **Judge Set**: Everything on the Judge step, saved inside the test project file: the judge prompt,
  the sample reply with its reply mapping and the error rules. Has a version identity.
- **Judge Prompt**: The prompt under test, used exactly as written. Only the prompt comes from
  outside; everything else is built in the tool.
- **Judged Text**: The variable the user marks as the output the judge evaluates. Errors are
  always injected into it, and expected errors concern it.
- **Variable** (formerly "placeholder"): A name written as `{{name}}` in the judge prompt. Any
  name is allowed. Each variable is one field of every test case.
- **Reply Mapping**: The recognized structure of the judge's own JSON reply, taken from one
  sample reply: its fields with their paths, and which field holds the text of a finding. It
  does not say what an error is.
- **Error Rule**: A named rule written by the user that says when the judge has reported an
  error: one or more conditions on fields of the reply, joined by "and" or by "or".
- **Error Catalog**: The error categories injected into the test data. Belongs to the test project
  (not the judge set), managed in the collapsible "Error categories" section of the Test cases step,
  which shows how many test cases use each category; changed only by the user (add, rename, and
  remove while no test case uses it); used to prepare errors and to group results. The judge does
  not have to use it.
- **Category** (formerly "label"): A named kind of error with an optional description and
  example, held in the error catalog.
- **Clean Base Case** (clean case): A named, complete input for the judge (a value for every
  variable) with no injected errors. A clean test case, listed in the table of test cases with the kind "Clean", and the
  optional base that cases with injected errors are made from.
- **Test Cases**: All test cases of a test project, evaluated together. Their version is derived from
  their content. Cases can be added, renamed and removed until finalized; afterwards they
  can still be added, and a case without a reply can still be renamed and removed; a saved case's fields are never edited, and after finalizing only the
  expected errors of a case without a reply can be corrected.
- **Test Case**: One input to be judged, with a unique identifier, a name, one field per
  variable, zero or more expected errors, and, when it was made from a clean base case, a
  reference to it. Its name is unique within the test project (FR-079). The final prompt is derived from the judge prompt and the fields.
- **Expected Error**: What the judge should find in the judged text of a case: a category, an
  optional fragment, a description, and an optional difficulty (obvious or subtle).
- **Case JSON**: One test case written in the one JSON layout of FR-031 (name, fields, expected
  errors, and optionally base). It is what the user's LLM
  returns, what is pasted and edited when a case with injected errors is made, what "Show JSON"
  gives back, and what "Export test cases" writes. Until saved it is a
  proposal for the user to review.
- **Import Summary**: The report shown after reading a file or a pasted answer: counts, invalid
  rows with reasons, and the user's choice on how to proceed.
- **Test Cases Summary**: The overview shown while building and before finalizing: counts, balance,
  test size against its minimums, and warnings.
- **Received Reply**: The text the judge produced for one case, pasted by the user in any format
  and kept with the judge prompt that produced it.
- **Finding**: A part of the judge's reply (or the whole reply) for which at least one error rule
  holds; its text is the place it points at.
- **Additional Finding** (formerly "unexpected finding"): A finding that points at no expected
  error of the case. The user marks it "Issue: false positive", "Real error" or "Ignore". One added
  by hand may have a category and a difficulty, and can be removed.
- **Decision** (mark): What was settled for one expected error ("Found", "Issue: missed",
  "Ignore") or one additional finding ("Issue: false positive", "Real error", "Ignore"), with its
  source: automatic, set by hand, or an LLM opinion approved by the user.
- **Verification Opinion**: An external LLM's JSON assessment of one case, with a short reason
  and a fragment for each item, pasted back by the user in the second-opinion window. It changes
  nothing until the user applies it after seeing the preview of every change; it then sets the
  marks of the items it answers.
- **Case Status**: Not run, Awaiting verification, Pass or Fail, derived from the decisions.
- **Evaluation Result**: The counts and measures for one judge version on one test cases version,
  together with everything needed to reproduce it. Saved and loaded as one file.
- **Overall Result**: The one-line conclusion for the evaluated judge (Works, Does not work,
  Inconclusive), with the thresholds, the minimum sample and the reason it was based on.
- **Metric Definition**: A loadable file that describes one kind of judge evaluation: a complete
  starter judge set, the matching parameters and the measures computed from the counts. Thresholds
  are kept in a separate check configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Evaluating a judge**

- **SC-001**: A first-time user can go from opening the tool with demo data to seeing the counts
  of found and missed errors, the two rates and the overall result in a single session of under
  15 minutes.
- **SC-002**: A user can run one test case (open its window or move to it, copy the prompt, paste
  the reply from the clipboard) with no more than 3 deliberate actions inside the tool.
- **SC-003**: 100% of saved evaluation files can be loaded in a fresh session and show identical
  numbers, judge version and test cases.
- **SC-004**: 100% of invalid files (test projects, test-case files, evaluation files) are
  rejected with a message that tells the user what to fix.
- **SC-005**: Adding a new measure requires only loading one definition file, with no change
  to any other part of the tool.
- **SC-006**: The tool is fully usable with no account, server or database, and no user data
  leaves the device unless exported.
- **SC-007**: Every test case shows an unambiguous status (Pass, Fail, Awaiting verification, Not run) in the test case list.
- **SC-008**: A result can be exported as an HTML report that a person without the tool can read, and the evaluation file that holds it as JSON can be loaded again with identical content.
- **SC-009**: 100% of evaluations show exactly one overall result (Works, Does not work, or Inconclusive) together with the reason, on the Results step and in the report.
- **SC-010**: A first-time user can say how many expected errors the judge found and missed, and how many false positives it reported, within 30 seconds of opening the Results step.

**Setting up the judge**

- **SC-011**: 100% of the variables written as `{{name}}` in a judge prompt are detected, whatever
  their names, and no field is shown that the prompt does not use.
- **SC-012**: A user can go from a pasted sample reply to a working rule with two conditions in
  under 3 minutes, without reading documentation.
- **SC-013**: A test project saved and loaded again has identical content in 100% of cases: prompt,
  reply mapping, rules, catalog and test cases (clean base cases included).
- **SC-014**: 100% of rules that use a field missing from the sample reply are refused or marked
  as broken before the test project can be finalized without a warning.

**Building test cases**

- **SC-015**: A user can load a 100-case file and see its summary within 5 seconds of choosing the
  file, with no per-case manual entry.
- **SC-016**: 100% of invalid rows in a loaded file are reported with their position and a reason
  the user can act on.
- **SC-017**: A failed or cancelled import leaves the previously loaded data unchanged in
  100% of cases.
- **SC-018**: Test projects of 500 cases load and can be browsed without the interface becoming
  unresponsive for more than 2 seconds.
- **SC-019**: Test cases exported and imported again into an empty test project have identical content
  and an identical version in 100% of cases.
- **SC-020**: First-time users can import test cases using only the example file and Help,
  successfully on the first attempt in at least 90% of trials.
- **SC-021**: A first-time user can add a clean case (name, comment, one copy of
  the prompt, one paste of the LLM's answer, "Approve and close") in under 2 minutes, not counting
  the time the LLM takes to answer.
- **SC-022**: A user can prepare a case with injected errors from a clean base case in under
  3 minutes, not counting the time the LLM takes, with a single copy and a single paste and no
  re-typing of the LLM's answer.
- **SC-023**: 100% of cases with injected errors carry a description of every expected error and,
  when a base case was picked, a reference to it, and in 100% of them every expected error without a
  category or a fragment was named before saving.
- **SC-024**: 100% of attempts to save an invalid case (empty text, an expected error without a
  description, a version identical to its base) are refused with a message the user can act on.
- **SC-025**: A user building a one-sided test project (only clean or only with injected errors) is warned in
  100% of cases before finalizing.
- **SC-026**: At least 90% of first-time users complete a small test project (5 cases, mixed) using
  only the in-tool help.

**Verifying and saving**

- **SC-027**: 100% of decisions shown in the results and the report carry their source
  (automatic, set by hand, or LLM opinion approved by the user).
- **SC-028**: No item counts in the results on the strength of an LLM opinion alone: in 100% of
  cases an opinion changes marks only when the user presses "Apply opinion" after its preview has
  listed every change.
- **SC-029**: An evaluation saved part-way and loaded in a later session has identical content in
  100% of cases, and the user can continue within 1 minute of choosing the file.
- **SC-030**: A user can move from one test case to the next on Run, or in the read-only view of
  a case, with a single action and see the next case's data and prompt, or its reply and marks,
  without scrolling the page, on a screen of 1280 x 720 pixels or larger.
- **SC-031**: A case with up to five expected errors can be read, with every expected error shown
  by "Show in text", in the case view, the read-only view and the case window of Run without
  scrolling the list of expected errors, on a screen of 1280 x 720 pixels or larger.
- **SC-032**: A user who has entered replies never has more than 25 replies unsaved to a file
  without having been reminded to save.
- **SC-033**: In the case window of Run, for a case with up to five expected errors whose
  fragments occur in the judged text, 100% of the fragments are highlighted with their numbers,
  and every finding in a JSON reply is marked as matching, partly matching or matching no
  expected error, each with its label.

- **SC-034**: A case like a saved one is made in at most four actions besides changing its JSON ("Open",
  "Show JSON", "Paste JSON" in a new case, "Save case"), and no two test cases share a name unless an import or a
  loaded file made it so, in which case both cases show the warning.

- **SC-035**: Apart from choosing the wanted errors, a user makes a case with injected errors from a
  clean base case in at most four presses (the base, if any, "Copy prompt", "Next", "Save case")
  plus one paste, and in 100% of saved cases the line of FR-080 was shown
  before saving.

- **SC-036**: In 100% of cases, the JSON shown by "Show JSON", pasted into a new case of the same
  kind, gives a case with the same fields and expected errors, and with the same base when the
  same base case is picked.

- **SC-037**: 100% of problems in a pasted sample reply, clean case answer, case JSON or judge reply
  are shown under the box with their line and column or their field path, and the pasted text is
  never lost.

- **SC-038**: The Judge step shows no more than three kinds of button of its own ("Add rule", "Add
  condition", "Remove") plus the one action of the "what next" line, and "Save evaluation" appears
  on no step other than Run.

- **SC-039**: In 100% of cases with a JSON reply, every expected error of the case has a mark or the
  reason it is undecided right after the reply is saved, and every finding that matches no expected
  error is in the list as an additional finding.

## Assumptions

**Users and scope**

- Only the judge prompt is supplied from outside. All test data (the clean base cases and the
  injected errors) is built by the user in the tool: by hand, by generation with their own LLM,
  or from their own files.

- The primary user is a judge author comfortable with prompts and JSON but not necessarily a
  developer; the secondary audience (people relying on judge results) only reads results.
- This stage is manual: the user copies each prompt into an LLM and pastes the answer back.
  Calling an LLM from the tool is out of scope for this version, and so are exporting all
  prompts to one file and importing all replies from one file; both return when the tool is
  connected to an LLM.
- Version 1 handles one judge and one test project per evaluation; batch management of many judges
  is out of scope.
- The tool supports the current versions of Google Chrome and Microsoft Edge only. Other
  browsers (Firefox, Safari) are not supported in this version.
- Evaluating model answers themselves and public sharing of results are out of scope for this
  version.
- Comparing two results inside the tool (the Compare step and the result shelf) is out of scope
  at this stage. Two versions of a judge are compared by reading their exported reports, which
  name the judge version and the test cases version.
- The judge is a single prompt that gives one reply per test case. A judge built as a chain of
  prompts, where one reply feeds the next prompt, is out of scope for this version.
- A judge that returns only an overall rating, with no itemized parts (for example a bias judge
  answering "biased: yes or no"), is evaluated per case: flagged or not flagged (FR-061, FR-067).
  It cannot be matched to single expected errors, so its result says how many cases with errors
  were flagged, not which error was found.
- Two things stay out of scope for this version: graded ratings (for example "partly present" in
  a Completeness judge; a rule counts such an item either as a finding or not), and checking a
  number the judge returns (for example a coverage score) against an expected number. Bias that
  belongs to the whole text and has no fragment is entered as an expected error with no fragment.
- Combining or merging two test projects into one is out of scope for this version.
- The detailed technical document named in the source (`judge-the-judge-specyfikacja.md`) was
  not available; details such as exact file formats are left to planning.

**Reading replies, rules and measures**

- The results always show two overall measures: detection rate and false-positive rate. The
  project's two built-in metrics are Accuracy and Completeness, offered as ready examples (judge
  prompt, sample reply, reply mapping, error rules, error catalog and a few clean cases), each
  tested in its own evaluation; other kinds of judges are typed or loaded by the user. Further
  measures built from the same counts can be loaded from metric definition files; measures that
  need other inputs (agreement with human ratings, stability across repeated runs) are out of scope
  for this version.
- The ready Accuracy example initially has the categories: factual-error, contradiction, wrong-number,
  unsupported-claim, and misattribution. The ready Completeness example initially has: missing-information,
  missing-step, omitted-requirement, partial-answer, and missing-caveat. Each category has a
  description and an example; exact sets are refined in planning.
- Error rules are kept deliberately simple: one rule is either all-of or any-of, with no nesting;
  several rules together mean "any of these rules". This covers "A and B", "A or B" and
  "(A and B) or (C and D)". The exact way a field path is written is set in planning.
- The reply mapping and the error rules are used only for automatic decisions. A finding points at
  an expected fragment when the two share their key content after ignoring letter case, spacing
  and rephrasing; the exact rule, and the line between a clear and a partial match, are set in
  planning. A false positive is an additional finding, in any case clean or not, that the user
  has confirmed as not being an error.
- The 95% confidence level is the default for confidence intervals, which are shown only in the
  "Details" section; the method may be refined in planning.
- Thresholds for the measures ship with defaults (FR-068) and remain the user's choice: they are
  changed in the "Details" section of the Results step or via check configuration. The minimum
  test size (30 injected errors, 10 clean cases) is fixed in the tool.
- A result describes one judge prompt run on one model. The tool measures only the kinds of errors
  present in the test data: a high detection rate says nothing about kinds of errors that were
  never injected, and the Help says so.

**Test projects and files**

- Test cases reach the test project from files, from a ready example, or from the test case window;
  all routes build the same test project, which is editable until finalized and
  fixed afterwards.
- Test cases can be loaded from CSV (editable in a spreadsheet) or JSON and are always saved as
  JSON, so no information is lost. Exact field layouts are decided in planning.
- CSV is the easy route for preparing cases in a spreadsheet; several fields and several expected
  errors per case are expressed through the documented convention in FR-031.
- Each case has a unique identifier within its test project. The identifier from the file is used when every case has one; if none have one, the system assigns numbers by row order and tells the user.
- The upper size is 500 cases per test project (a deliberate simplification); larger sets are out of scope and are rejected with a clear message. The limit may be revisited in a later version.
- Test cases versions are derived from content, so identical content always gives the same
  version.
- A case can have any number of expected errors; a case with injected errors has exactly the
  errors in its JSON, and the list is changed only by changing the JSON before the case is saved
  (or by cloning the case).
- Errors are always injected into the judged text (the output the judge evaluates). For an
  omission the fragment is taken from the other fields. Where exactly in the output an error sits
  makes no difference to matching, which uses only the fragment's words.
- Error injection works through a prompt the user runs in their own LLM, or through a JSON the user
  prepares and pastes; there are no
  built-in rules that change text, because they give artificial errors that are easy to detect in
  narrative texts and would overstate the judge's detection rate. The paste-ready format for
  injected cases is fixed by the tool, documented in Help, and the prepared prompt asks the LLM
  for exactly that format.
- The expected errors and the base reference of a case are for the user and for matching the
  judge's findings; they are never shown to the judge.

**Saving and privacy**

- Nothing is stored on a server, in a temporary file elsewhere, or in the browser between
  sessions. Saving to a file on the user's device is the only way to keep work. Two files cover
  it, each remembered and overwritten by its save action (FR-076): the test project (the judge set
  with the test cases) and the evaluation (the whole progress of one run: the test project together
  with every prompt, reply, decision and the results). The results have no file of their own; the HTML report is generated
  from the evaluation.
- Help requirements are unchanged by the review of prototype v7. Help content is updated together
  with the features it describes, before the first public release.
- Exported reports and result files are plain files on the user's device and may contain sensitive
  data from the user's test cases; protecting or sharing them is the user's responsibility.
