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
- Q: May a single error rule combine fields of a list in the reply with fields outside it, and how is the finding text set? → A: Yes, one list at most: fields outside the list are read once and apply to every item. The field holding the text of a finding is chosen per rule, as "Where the error is" (Owner review 2026-11-14, T232).
- Q: (Run review of prototype v8) How is the window that opens from a case laid out? → A: In two columns that fill the whole screen. Data on the left, outcome on the right. The left column holds the case name, its fields and expected errors and the judge prompt with "Copy prompt"; the right column holds the place for the LLM's reply ("Paste reply", see Session 2026-11-12) and, once the reply is saved, the received reply, the differences and the user's decisions. Each column scrolls on its own, so nothing is hidden.
- Q: (Run review of prototype v8) How does the user move between cases without going back to the list? → A: "Previous case" and "Next case" buttons at the top of the window, always visible, also usable from the keyboard, with the position shown (for example "case 7 of 20"). Moving may be limited to cases that await verification.
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
- Q: (Prototype v10 review) What happens when the user pastes the judge's reply from the clipboard in the case window? → A: "Paste reply" reads the clipboard and saves the reply in one action, and the differences appear at once. A new reply always resets the case: its decisions are removed and the automatic decisions are computed again. The tool asks first only when the case has decisions set by hand or approved from an LLM opinion, saying how many; otherwise it replaces the reply without asking. The right column is headed "Judge's reply", shows the four steps (Copy prompt, run it in a new conversation, copy the answer, Paste reply), and, since the review of prototype v15, always shows the box for the reply (pasted with Ctrl+V and kept with "Save reply").
- Q: (Prototype v11 review) Which files does the tool work with, and how are they saved? → A: Two files. The **test project** holds the judge set (settings, rules, error catalog) together with the test cases, and is loaded to run the same test again, for example with another LLM or other model settings. The **evaluation** holds the whole progress of one run: the test project, every prompt, reply and decision, and the results. Each has its own remembered file: the first save asks for a file, later saves overwrite it, and "Save … as" picks a new one. "Save judge set" and "Save test cases" as separate files are removed. The unsaved-changes indicator is about the evaluation. The Results step has no file of its own. Loading an evaluation alone is enough to see the result and generate the report. Since the review of prototype v15 the evaluation is saved only on the Run step (Session 2026-11-13).
- Q: (Prototype v10 review) Which browsers must the tool support? → A: Only current Google Chrome and Microsoft Edge.
- Q: (Prototype v10 review) Is the second opinion from an LLM asked for per case or for all cases at once? → A: Per case: since the review of prototype v16 the "Second opinion…" button of the case window opens a window for that case (see Session 2026-11-13). The card on the Run step and "Approve all proposals" are removed.
- Q: (Prototype v10 review) Where is the work saved, and can the whole progress be saved and loaded back? → A: Only in files on the user's device; there is no server and no temporary file. "Save evaluation" (on the Run step) saves the whole progress (judge set, test cases, every prompt, reply and decision, and the results), "Save test project" saves the work before the run, and "Load evaluation" restores it.
- Q: (Prototype v10 review) How does "Save evaluation" write the file, now that only Chrome and Edge are supported? → A: The first "Save evaluation" asks for a file name and folder; every later one overwrites that same file without asking. "Save evaluation as" saves to a new file, and after "Load evaluation" saving goes to the loaded file. The reminder after every 25 unsaved replies stays.
- Q: (Prototype v11 review) Does the tool compute the result by itself for a judge that returns only a verdict for the whole text (for example a bias judge answering "biased: yes or no" or a score) and no list of problems? → A: Yes, in a minimal way. When every error rule uses only fields outside any list, the case is judged as a whole: flagged or not flagged. The result then uses two case-level measures (cases with errors that were flagged; clean cases flagged wrongly) and the minimum sample is counted in cases. Graded ratings ("partly present") and checking a number the judge returns against an expected number stay out of scope.
- Q: (Prototype v11 review) Which simplifications of the interface are required? → A: Three, besides keeping the file actions in the header's "More" menu ("Save evaluation" is on the Run step since the review of prototype v15). (1) Each step shows one "what next" line with one primary action; longer explanations move to Help and to hints opened on demand. (2) After a file is loaded the tool opens the first step with unfinished work and offers "Continue", which leads to the first case that is not decided. (3) Fewer buttons: the case window of Run shows one primary action, and the actions needed less often ("Add finding", "Second opinion…") are visible buttons under the list of items (no "More actions" since the review of prototype v16); the actions of a table row are set in Session 2026-11-13.
- Q: (Prototype v11 review) In what state does a loaded test project come back when it was finalized when saved? → A: As it was saved. A finalized test project comes back finalized and the Run step opens, ready for replies. While no reply has been entered, "Reopen test cases" opens the dataset for editing again; after the first reply it is no longer offered.
- Q: (Prototype v12 review) Does the test project file also hold the active metric with its parameters and the thresholds for "Works"? → A: Yes. The test project holds the active metric (its id and parameters) and the check rules in use (the thresholds), so that every run of the same test project counts the same way; loading it restores them. The model details stay with each run, in the evaluation.
- Q: (Prototype v12 review) After "Run again with a new judge…", does saving the test project ask for a new file? → A: Yes. That action forgets both remembered files, so the next "Save test project" and "Save evaluation" each ask for a file and never overwrite the earlier run. "Reopen test cases" before the first reply keeps both files, because it corrects the same test.
- Q: (Prototype v12 review) What do the counts and the Error analysis show for a judge evaluated per case? → A: Cases, not single errors. The Summary counts cases with expected errors (flagged, not flagged) and clean cases (flagged wrongly, not flagged). Error analysis groups cases by the categories and difficulties of the errors they contain; a case counts once in each of its categories, and the groups show counts only, with no rate.
- Q: (Prototype v13 review) Do "Load catalog" and "Export catalog" stay, and what is the file that holds the judge, settings, errors and test cases called? → A: The catalog has no file of its own: it is saved only inside the one file, which is named the **test project** (formerly "test set"; "Load test project", "Save test project", "Save test project as"). The test project covers the judge, the settings (metric and thresholds), the error catalog and the test cases, without replies.
- Q: (Prototype v13 review) Do clean base cases stay on the Judge step, or are they only on the Test cases step? → A: Only on the Test cases step. The Judge step holds the prompt, the sample reply and the error rules. Clean cases are added with "Add test case" (a clean case, made with the user's LLM; Session 2026-11-13), imported, or come with a ready example; they are listed in the table of test cases as "Clean" and are the base that cases with injected errors are made from. The judge set no longer contains clean base cases of its own.
- Q: (Prototype v13 review) Do loading test cases from a file and "Download example file" stay, now that the work is saved as a test project? → A: Test cases need their own import and export, besides the test project. "Export test cases" writes all cases to a JSON file; "Import test cases" reads a JSON file (the same layout, with expected errors) or a shortened CSV. The shortened CSV has only `name` and one `field:<variable>` column per variable, and every row becomes a clean case; cases with injected errors are made in the test case window or come in with JSON. "Import test cases", "Export test cases" and the example CSV are in the header's "More" menu, not on the Test cases step. Neither is a remembered file: each export asks for a file name, and the test project stays the only way to save the whole work.
- Q: (Prototype v13 review) What does the second opinion from an LLM check, and how does it handle a case with two or more errors? → A: It checks every item of the case on its own: for each expected error whether the judge found it, and for each additional finding whether it is a real error or a false positive, each with a short reason and a quotation from the reply. A case with two errors gets two separate opinions and two separate proposals. The prompt and the second-opinion window say what is checked in one line ("The LLM checks N expected errors and M additional findings of this case").
- Q: (Prototype v13 review) Which colors help the user verify the data in the case windows? → A: Highlights in the texts, always with a number or a word beside the color (FR-077). In the case window of Run and the read-only view: each expected error is highlighted in the judged text with its number, and the judge's findings in its reply are green when they hit an expected error, amber when only partly, red when they match none. In the window for adding a case: the fragments of the expected errors in the text, with their numbers, and the warnings in the warning color.
- Q: (Prototype v13 review) Can test cases be copied, and how are they named? → A: There is no "Clone" (removed in the owner review of 2026-11-14; see the answer about "Clone" below). A copy is made by hand with "Show JSON", "Copy JSON" and "From JSON". Test case names are unique, compared without regard to case and surrounding spaces: a new case cannot take a used name (the tool says which case has it), while an import or a loaded file that produces a duplicate is kept and marked with a warning (FR-078, FR-079).
- Q: (Prototype v13 review) Are "Load demo data", "Start from an example" and "Load metric definition" separate steps? → A: No. The demo and an example are only ways to fill the test project; loading a file leads to the same state and there is no second route to it. The example and a loaded metric definition are part of the test project configuration (judge, catalog, metric), not stages of their own. "Load demo data" stays one entry in the More menu.
- Q: (Prototype v11 review) What should the interface look like? → A: Modern, in black and red, and still easy to read: red is the one accent color on a black background (dark scheme) or a white one (light scheme), contrast meets WCAG AA, and red alone never means an error or "Fail" (FR-007). The colors were replaced by the answers of Session 2026-11-16 (UI redesign).

### Session 2026-11-13

- Q: (Prototype v14 and v15 review) Where is the error catalog, and what happens when a category is renamed or is used by test cases? → A: No section of its own on the Judge step. An "Error categories" section on the Test cases step, which can be collapsed, lists every category with its description, example and the number of test cases that use it; a category is also added by typing a new name where the category of a wanted or expected error is given. Renaming applies to every expected error that uses it and works after finalizing too. An unused category is removed at once. A category used by at least one test case cannot be removed: "Remove" is disabled and the reason is shown beside it ("Used by N test cases. Remove those test cases first, or rename the category."; after finalizing, when every case that uses it has a reply, only the renaming is offered). The earlier choice to move the errors to another category or to leave them without one is removed (FR-015, FR-016, FR-024).
- Q: (Prototype v15 review) Which actions does a test case have? → A: Three, as visible buttons on its row: "Open", "Rename" and "Remove"; a click on the row also opens the case. All three stay enabled at all times, also after finalizing and also for a case with a reply (Owner review 2026-11-14, T234: "Rename" and "Remove" are active the whole time); "Remove" of a case with a reply asks first and says that its reply and its N decisions are removed with it and the results change. "Modify", "Describe errors again", "Compare with base", "Use selected text as fragment", "Add error"/"Remove" for single expected errors and editing the text of a saved case are removed (FR-008, FR-025, FR-078).
- Q: (Prototype v15 review) What does "Add test case" offer? → A: Three choices, always available: "From JSON", "Clean case" and "Case with errors" (see the clarification on adding a case below). Clean cases and cases with injected errors are the only two kinds, and these two names are used everywhere (buttons, the Kind column, Help) (FR-038).
- Q: (Prototype v15 review) How is a clean case made? → A: In the test case window: the user types a name and an optional comment (for example what the text should be about, or examples), may pick another clean case in "Like case" as a model, sees the full prompt for their LLM with "Copy prompt", and pastes the LLM's answer into the answer box. The answer is checked as soon as it is pasted or changed against the structure the judge needs (a value for every variable of the judge prompt, no expected errors). When it is right, the fields are shown and "Save case" saves the case; when it is wrong, the problem and where it is (line and column, or the field path) are shown under the box. Typing the field values by hand and generating many clean cases at once are removed; many clean cases come in with "Import test cases" (FR-083, FR-084).
- Q: (Prototype v15 review) How is a case with injected errors made? → A: With the user's own LLM, in one window whose parts follow one another on one page (the layout is set in Session 2026-11-14, owner review; the earlier three parts with "Next" and "Back" are replaced). The user may pick a clean case as the base: they pick errors from the error catalog (or type a new category in a text box), give each a difficulty (obvious or subtle, or leave it to the LLM) and a short description, copy one ready prompt that holds the judge prompt with its judged text, the base case and the chosen errors and asks for the case as JSON (the case with its list of expected errors), and paste the LLM's JSON into one edit box that is checked as it changes. Under it the expected errors are listed read-only. "Save case" is enabled only when the JSON is valid (FR-040, FR-041, FR-085).
- Q: (Prototype v15 review) What does "Open" show, and how is a saved case changed? → A: A saved case is never edited. "Open" shows it read-only (fields with highlighted fragments, expected errors with "Show the issue"), with "Previous case" and "Next case", "Show JSON" (the case's JSON, rebuilt from the case in the same layout that is pasted when a case is made) with "Copy JSON". To change a wrong case the user copies the JSON, pastes it into a new case with "From JSON", changes it, saves it and may then remove the original (there is no "Clone") by hand (FR-078, FR-086).
- Q: (Clarify, prototype v15 review) What can still change in the test cases after they are finalized? → A: Two things, besides the reply mapping and the error rules. (1) The expected errors of a case that has no reply yet can be corrected through its JSON ("Edit expected errors" in its read-only view); its fields and name stay fixed. A case with a reply is not corrected; an expected error that should not count is marked "Ignore" on Run. (2) New test cases can be added ("Add test case", "Import test cases"); they start as Not run, and the replies and decisions of the other cases are kept. Each such change gives a new test cases version, and the result and the report say which cases were added or corrected after the first reply. "Rename" and "Remove" work after finalizing only for a case without a reply, and the judge prompt stays fixed (FR-025, FR-053, FR-075, FR-089).
- Q: (Prototype v15 review) What does the Judge step show, and where is "Save evaluation"? → A: Fewer buttons. The Judge step has no welcome section ("Start with your judge prompt, or look at a finished example first." and its three buttons are removed); loading an example, a test project or an evaluation is in the More menu only. The sample reply is read as soon as it is pasted or changed, so "Read sample reply" is removed; problems are shown under the box with where they are. The step's own buttons are "Add rule" (with "Add condition" and "Remove" inside a rule) and the one action of the "what next" line. "Save evaluation" and "Save evaluation as" are only on the Run step (and in the case window of Run); the header keeps the indicator of unsaved changes, the More menu and Help (FR-001, FR-008, FR-011, FR-076).
- Q: (Clarify, prototype v15 review) May the warnings that protect unsaved work offer to save the evaluation, although "Save evaluation" is only on Run? → A: Yes. Before loading a file, "New evaluation", "Load demo…", "Run again with a new judge…" and leaving the page, the warning offers "Save evaluation first", "Discard" and "Cancel"; this is a safeguard, not a standing action, and the Judge, Test cases and Results steps show no "Save evaluation". A threshold changed on Results is saved with the next "Save evaluation" on Run or "Save test project" (FR-051).
- Q: (Clarify, prototype v15 review) How are clean cases and cases with injected errors shown on the Test cases step? → A: In one table of all test cases, where the Kind column says whether a case is "Clean" or has "Injected errors"; the filter can show one kind. There is no separate "Clean cases" section: its former content (adding a clean case by hand and generating many) is gone. The "Error categories" section can be collapsed and expanded: it is open while the test project has no test cases and starts collapsed when a test project with cases is loaded; a collapsed section shows a one-line summary in its heading ("8 categories"), and the state the user chooses is kept for the page session (FR-015, FR-023, FR-025, FR-087).
- Q: (Prototype v15 review) What does the case window of Run show, and how is each item marked? → A: The case as in the read-only view, without JSON (fields with highlights, expected errors with "Show the issue"), the judge prompt with "Copy prompt", and the box where the judge's reply is pasted as JSON. After the reply is saved, the tool reads it with the reply mapping and the error rules and marks every item: an expected error that a finding points at is "Found"; one that no finding points at, fully or partly, is added to the list as "Issue: missed" (the feedback's "expected issue not found") when the case has no additional finding, and otherwise stays undecided (see the next session answers); a finding that points at no expected error is listed as an additional finding for the user to mark "Issue: false positive" or "Real error". "Ignore" is available on every item, and every mark can be changed (FR-055, FR-060 to FR-062). The layout (and "Approve") was replaced by the answer "(Owner review 2026-11-14, Case window of Run)", and "Save reply" by the answer "(Owner review 2026-11-14, Reply box and note of the case window of Run)".
- Q: (Clarify, prototype v15 review) Which marks does a finding that matches no expected error get on Run? → A: Three: "Issue: false positive", "Real error" and "Ignore". "Real error" means the judge found a true error that was not planned; it counts as a correct finding (in the false-positive rate it is among the findings but not a false positive) and the results show real errors as a separate count (FR-062, FR-066, FR-067).
- (Prototype v15 review, decided without a question) The reply is pasted as JSON, but any text is still kept: a reply that is not JSON, or that lacks a field a rule needs, is saved with the problem and where it is shown under the box, nothing is marked automatically, and the user marks the items by hand (FR-056, FR-061).
- (Prototype v14 review, decided without a question) The Judge step has no "Start from an example" section. One "Load demo…" item in the More menu opens a small window that lists the ready examples Accuracy and Completeness (each starts a new test project with its judge, catalog and a few clean cases), the demo (a finished run of book summaries, formerly "Load demo data") and any example added with "Load metric definition…" in the same window. One route, no duplicate (FR-008, FR-019, FR-026).
- (Prototype v14 review, decided without a question) The one name for the user's work is **test project**; the word "dataset" is no longer used. A test project holds the judge set (judge prompt with its judged text, sample reply with its reply mapping, error rules), the error catalog, the test cases (clean and with injected errors, with names, fields, expected errors and links to base or original cases), the active metric with its parameters and the thresholds; it has a name, and its test cases have a version. It holds no replies and no decisions; those are in the evaluation file.
- Q: (Clarify, prototype v15 review) Is a clean case marked "No error" needed before a case with injected errors can be made? → A: No. The mark was only meant to prevent making a case with errors before any clean case existed, and that is no longer a problem: any case can be made by pasting its JSON, and the JSON may hold no errors, in both ways of adding a case. The "No error" mark, "Not checked", "Mark as No error" and the disabled "Case with errors" are removed. A base case is optional: when one is picked, the prompt and the checks against the base use it; without one, the LLM writes the whole case or the user pastes it. A JSON with no expected errors pasted while making a case with injected errors is saved as a clean case, and the window says so (FR-038, FR-040, FR-041, FR-082).
- Q: (Clarify, prototype v15 review) How does a new clean case refer to another clean case, so that its text reaches the prompt? → A: With an optional "Like case" choice beside the comment, listing the existing clean cases; the fields of the picked case go into the prompt as a model. The comment is plain text and the tool does not look for case names in it (FR-083).
- Q: (Clarify, prototype v15 review) Is an expected error that no finding points at marked "Issue: missed" automatically even when the case has an additional finding? → A: No. It is marked "Issue: missed" automatically only when the case has no additional finding; otherwise it stays undecided with the reason "an additional finding may be this error in other words", and the user decides (FR-061).
- Q: (Clarify, prototype v15 review) Which ways of adding a test case does "Add test case" offer, and what happens to a pasted JSON that does not match the chosen kind? → A: Three choices: "From JSON", "Clean case" and "Case with errors". "From JSON" takes any case JSON the user already has and saves it as a clean case when it has no expected errors, or as a case with injected errors when it has some. "Clean case" and "Case with errors" prepare the case with the user's LLM; the latter no longer has its own "Paste a ready JSON" route. An answer with expected errors pasted in the clean case view is a problem that points to "From JSON". There is no "Clone" (FR-078).
- Q: (Clarify, prototype v15 review) After finalizing, can a test case without a reply be removed or renamed? → A: Yes, and so can a case with a reply (Owner review 2026-11-14, T234, replacing the earlier answer that disabled them): each change gives a new test cases version; "Rename" keeps the reply; "Remove" of a case with a reply asks first and removes the case together with its reply and its decisions, so the results change (FR-025, FR-039, FR-053).
- Q: (Clarify, prototype v15 review) Should "Clone" stay? → A: No (owner review, Session 2026-11-14; this answer replaces the earlier ones that kept it). Copying a clean case is covered by "Like case" in the clean case view, which shows an existing case to the LLM as an example. Copying a case with injected errors is problematic: its errors are exported in the JSON too and would have to be changed by hand. The window already makes a clean case and a case with injected errors without copying. A wrong case is changed with "Show JSON", "Copy JSON" and "From JSON" and the old one is removed; before its first reply, its expected errors are corrected with "Edit expected errors" (FR-078, FR-089).
- Q: (Owner review 2026-11-14, Judge) Are the "Values seen" of the sample reply a closed list? → A: No. The sample reply may hold only part of the values the judge can return, so they are examples. The column says so, and a rule can use any value typed by hand. The fields stay limited to the sample reply: no field is typed by hand (FR-013, FR-014).
- Q: (Owner review 2026-11-14, Judge) Why did "Add condition" show "Broken rule … with no value" after a typed value? → A: "Add condition" adds a new, empty condition, and the whole rule was then shown as broken, so the typed value looked lost. Now a short line beside the value box says that any value is kept as typed, and a condition just added without a value is shown as unfinished next to that condition ("Condition 3: type a value"). Such a rule is not used until it is complete, and the preview says so; "Broken rule" stays for a field that is not in the sample reply, a rule with no conditions and a rule with two lists (FR-013, FR-014).
- Q: (Owner review 2026-11-14) Where is "Add test case"? → A: Not in the "what next" line on any step. It is a button above the list of cases: on Test cases above the table and on Run above the table of cases (after finalizing), disabled at the limit of 500 cases. The Judge step has no such button. With no cases, the "what next" line shows "Finalize test cases", disabled, and says to use the button below. "Reopen test cases" stays in the line (FR-025, FR-053, FR-088).
- Q: (Owner review 2026-11-14, Test case window) How is the test case window laid out? → A: As one vertical page for every way of adding a case; there are no two columns, no "Next", no "Back" and no "Part N of 3". The header holds the title, the save button, "Save case" (or "Save case" for a clean case), with the reason beside it while it is disabled, and "Close without saving" (Escape too; it asks first when something was typed or pasted); there is no bottom bar (Owner review 2026-11-14, T233, replacing the bottom button). Each numbered part is in its own frame; in every part the labels stand in a column on the left and the fields on the right; in the row of an error the description of the category stands under the whole row, so Category, Difficulty, What should be wrong and Remove are on one line. The parts are numbered from 1 in each window, from top to bottom. **Case with errors**: the base (optional, with its fields); the errors to prepare, one horizontal row per error (Category, Difficulty, What should be wrong, Remove) with "Add error", and the own instructions; the prompt with "Copy prompt"; the box for the LLM's JSON, checked as it changes, with the changed places that no expected error covers listed under it as warnings; the expected errors as a read-only list (each marked "not in the text" when its fragment is not found), changed only through the JSON. The list is not the case with its highlighted fields (decided). **Clean case**: Name, Comment and Like case; the prompt; the answer, with its fields shown read-only once valid; no errors to prepare and no list. **From JSON**: the JSON box and the expected errors only; a JSON with no expected errors says "No expected errors: this will be saved as a clean case." **Edit expected errors**: the same as From JSON. The read-only "Open" view is not changed. This replaces the earlier answers on the three parts of a case with injected errors and on "Next" (FR-040, FR-041, FR-083, FR-085, FR-090).
- Q: (Owner review 2026-11-14, Case window of Run) How is the case window of Run laid out, and what happens to "Approve"? → A: As one vertical page of three numbered parts under a header that does not scroll. **1. Case**: every field of the case with the highlights of the expected errors, over the full width. **2. Marking**: one row with "Add finding", "Second opinion…", the meter "Marked N of M" (items that are not undecided, "Ignore" included, of all expected errors and additional findings) and the status of the case (Awaiting verification, Pass, Fail; the header no longer shows it). **3. Judge reply and errors**: two columns of the same width, stacked below 760 px. On the left "Judge reply": the four steps with "Copy prompt" and "Paste reply", the complete judge prompt collapsed under "Show complete prompt", then the reply box with "Save reply". On the right "Errors": the expected errors and the additional findings with their marks, then the findings in the reply. Before a reply is saved part 2 shows only the status and the right column says that the errors appear when the reply is saved. **"Approve" is removed** from the actions of Run (decided): it saved nothing, it was taken for a duplicate of "Save evaluation", and for a reply that can be read it changed nothing. Only for a reply that cannot be read a button "No more findings" stands next to the message that says so; it confirms that the findings added by hand are all and sets the approval as "Approve" did, and the case awaits verification until then. This replaces the earlier answers on the two columns of the case window and on "Approve" (FR-055, FR-060, FR-064, the naming list).
- Q: (Owner review 2026-11-14, T240) Where is "Paste reply" in the case window of Run, and how does a finding point at its place in the case? → A: "Paste reply" is below the reply box (it was above). Every expected error and every additional finding that has text shows the field that holds it ("in summary"; the judged field is searched first, then the others, word for word and then ignoring case); "Show the issue" is offered only when the text is found, scrolls to part 1 and highlights the place strongly for about two seconds, for an additional finding too. A text found in no field says "not found in the case" and has no button; a finding about the whole reply (no text) shows neither (FR-055, FR-062).
- Q: (Owner review 2026-11-14, T237) How are the error categories shown? → A: As a **table**: Name, Description (edited in the cell), Used by, and the buttons **Example**, **Rename**, **Remove**. The column with the short example is gone. **Example** opens a dialog with the test cases that use the category, one at a time ("case 14 · Anna + 2 errors (1 of 4)", Previous case and Next case): every field with the fragments of the category highlighted and the description of each error; it is disabled while no case uses the category. The short text `example` stays in the file and in the generation prompts and is edited in that dialog as "Short example for prompts". **Rename** says before it acts that the N test cases using the category are renamed too, that the test cases version changes and that the error analysis of Results uses the new name (FR-015, FR-024, FR-087).
- Q: (Owner review 2026-11-14, T238) What does "Open" offer instead of "Show JSON" and "Copy JSON"? → A: **"Recreate the test case"**, at the top of the view, enabled when the case keeps the prompt it was generated with. A test case may carry an optional `generation_prompt`, written when a case is saved from "Clean case" or "Case with errors" (the prompt of that window, FR-083, FR-085); a case pasted as JSON, imported or from the demo has none and the button says so. It opens "Original prompt" with "Copy", "Copy and recreate" and "Close"; "Copy and recreate" copies the prompt, closes the view and opens an empty "From JSON" window. The prompt is not part of the test cases version (old files keep their version). "Show JSON" and "Copy JSON" are removed; "Show prompt" opens a dialog of about 90% of the screen in both directions (FR-031, FR-083, FR-085, FR-086).
- Q: (Owner review 2026-11-14, Reply box and note of the case window of Run) When is a reply saved, and what happens to the note of a case? → A: **There is no "Save reply".** A reply that is readable JSON (the whole text, a code fence, or the first balanced block; FR-084) is saved as soon as it is in the box, typed or pasted, and the case is marked from it at once. Replacing a reply that has decisions still asks first, naming how many (FR-056); if the user cancels, the text stays in the box and nothing is saved. Text that is not JSON is not saved by itself: the box says "This is not JSON" with the line and column of the problem, and a button "Keep as text" (primary) keeps the text as the reply, as any text could always be kept (such a reply then needs "No more findings"). Leaving the case (Next, Previous, Close, Escape) with text in the box that is not saved still asks first (FR-055). **The per-case "Note" button and box are removed** (decided): the note of the run is the "Model details" box of the Run step (model name, temperature, settings), which is saved in the evaluation file and shown in the HTML report. A file that holds notes of cases still loads, the notes are kept when the file is saved again, and the HTML report and the read-only view still show a note a file has. This replaces the earlier answers on "Save reply" and on the short note (FR-055, FR-056, FR-062).
- Q: (Owner review 2026-11-14, T234 to T236) How do the read-only view ("Open") and the case window of Run show the prompt, the reply and the highlights? → A: The complete judge prompt is no longer a box: a button **"Show prompt"** opens a dialog with the whole prompt and only **Close**, in the read-only view and in part 1 of the case window of Run, each with **"Copy prompt"** beside it. The read-only view of a case no longer shows "Judge’s reply" (a reply belongs to Run); "Show JSON" and "Copy JSON" stay. Its sections are in frames. In the case window of Run the left column of part 3 keeps only "Paste reply" above the reply box: the four steps, "Show complete prompt" and "Readable JSON" are gone, while the problem messages stay ("This is not JSON" with its place and "Keep as text", the empty or refused clipboard). "Copy prompt" is the primary button until pressed, then "Paste reply". The three parts are in frames. The highlights of the expected errors are stronger in all windows: a stronger background, a thicker underline and a bold label (E1 …), with 4.5:1 for the text in both schemes. This replaces the four steps and the collapsed prompt of the answer on the case window of Run (FR-025, FR-055, FR-086).
- Q: (Owner review 2026-11-14, T232) Where is the field that shows where an error is set? → A: In each error rule, as **"Where the error is"**, not once per list in "Sample reply and fields" (the choice "Text of a finding in claims[]" is removed from there). The reason: two fields of one item can each produce an error, and each rule then points at its own field. The field is a text field of the items of the list the rule is about; the tool proposes the field it proposed before (the likely text field of the list) and the user may change it; a rule about the whole reply has none. When two rules hold for the same item with different fields, the first rule in the list gives the text of the finding. **How it is stored** (decided to keep the judge version of every existing file): the file keeps `reply_mapping.finding_text` as the field a rule takes when it has none of its own, and a rule carries `finding_text` only when the user chose a field other than that one; choosing the proposed field again removes it. A file written before this change loads and gives the same judge version, because its rules have no field of their own. This replaces the answer on how the finding text is marked per list (FR-011, FR-012, FR-021).
- (Prototype v16 review, decided without a question) The box for the judge's reply is always visible in the case window of Run, never behind "More actions": under the four steps, with "Paste reply" and "Save reply". It is checked as the text changes (FR-084). Once a reply is saved the box holds it; changing it and pressing "Save reply" replaces the reply (FR-056). The case window has no "More actions" section (FR-055, FR-063). The layout (and "Approve") was replaced by the answer "(Owner review 2026-11-14, Case window of Run)", and "Save reply" by the answer "(Owner review 2026-11-14, Reply box and note of the case window of Run)".
- (Prototype v16 review, decided without a question) A finding added by hand ("Add finding") has "Remove"; findings read from the reply have none (they are marked, "Ignore" included). A finding added by hand may optionally get a category (from the catalog, or a new name that joins it) and a difficulty (obvious or subtle) (FR-062).
- (Prototype v16 review, decided without a question) The second opinion is one button, "Second opinion…", under the list of items of a case with a reply. It opens a window for that case: the line saying what is checked, (1) the verification prompt read-only with "Copy prompt", (2) one box for the LLM's answer, checked as it changes, (3) a preview of every change ("E1 undecided → Found", with the LLM's reason and fragment), and "Apply opinion" and "Cancel". "Copy verification prompt", "Paste LLM opinion from clipboard", "Read LLM opinion" and the box shown only when the clipboard cannot be read are removed (FR-063).
- (Prototype v16 review, decided without a question) When the opinion is readable but classifies none of the items (wrong numbers, missing "found" or "real", another case), the window says "The opinion classifies none of the N items of this case. Nothing will change.", names the reason for each item, keeps the pasted text and disables "Apply opinion"; the items keep their marks and reasons and the user marks them by hand. When it classifies only some items, "Apply opinion" changes only those, and the others keep their marks; an undecided one gets the reason "The LLM opinion gave no answer for this item" (FR-063).
- Q: (Clarify, prototype v16 review) Which marks does "Apply opinion" overwrite? → A: Every mark the opinion gives an answer for, including marks set by hand and marks from an earlier opinion; the preview lists each change, those that replace a mark set by hand included, before the user applies it. Items the opinion does not answer keep their marks (FR-063).
- Q: (Clarify, prototype v16 review) Are the category and difficulty of a finding added by hand counted in the results, or only shown with the finding? → A: Both. They are shown with the finding (case window, Test case list, report), and Error analysis and the report get a table of additional findings per category and per difficulty (real errors and false positives, counts only), kept apart from the rates of the expected errors; findings without them are counted under "(no category)" and "(not set)" (FR-062, FR-070).
- Q: (Clarify, prototype v16 review) May the second opinion add findings that are not in the list, for example when the reply was not JSON? → A: Yes. The verification prompt also asks for findings the reply contains that are not in the list (text, real error or false positive, reason, optional category and difficulty). The preview shows each as "+ new finding", and "Apply opinion" adds it as a finding added by hand, with "Remove", marked with the source "LLM opinion, approved by the user". An opinion that classifies no item and adds no finding changes nothing (FR-062, FR-063).
- Q: (Owner review 2026-11-14, second look, T239) What is the name of a new case? → A: Every way of adding a case (a clean case, "From JSON", "Case with errors") has a "Test case name" field at the top of part 1, filled with "Case N" (N the identifier the case will get, not the number of cases) and changeable. A name in the pasted JSON replaces the automatic one while the user has not typed in the field; what the user typed wins over the name in the JSON. "Edit expected errors" has no such field: the name cannot change there (FR-040, FR-083, FR-085, FR-090).
- Q: (Owner review 2026-11-14, second look, T242) Where are the save buttons? → A: Only in the page header: "Save test project" and "Save evaluation", always visible, each with the name of its file under it. The More menu keeps "Save test project as…", "Save evaluation as…" and the loads. The "Evaluation file" card of Run and "Save evaluation" in the case window are removed; the window keeps the reminder at 25 unsaved replies, worded "25 replies are not saved to a file. Close the window and press Save evaluation at the top." (FR-057, FR-059, FR-076).
- Q: (Owner review 2026-11-14, second look, T243) What does "Load demo…" do, and how is a metric loaded? → A: "Load demo…" loads the demo (book summaries) at once, with no window, and opens the Judge step. Accuracy and Completeness as ready examples and "Load metric definition…" are removed ("only Load test project, which holds everything"). A test project (only the test project, not the evaluation file) may carry the definition of a metric that is not built in, in `metric.definition` (name, description, limitations, output_format, parameters, measures); loading the file registers it for the session, replacing an earlier one with the same id without a question, and never replacing the built-in Accuracy. Completeness is no longer built in. The metric file format and `examples/metrics/*` stay as examples to copy from (FR-019, FR-026).
- Q: (Owner review 2026-11-14, second look, T245) How are buttons named? → A: One list (FR-008), sentence case, verb and noun, and "…" when the button opens a dialog or a file picker: "Load test project…", "Load evaluation…", "Save test project as…", "Save evaluation as…", "Import test cases…", "Export test cases…", "Load demo…", "New evaluation", "Add test case…", "From JSON", "Case with errors", "Save case" (also for a clean case), "Edit expected errors", "Reopen test cases", "Finalize test cases…", "Add categories", "Show prompt", "Show the issue", "Previous case" and "Next case", "Paste reply", "Keep as text", "Missed", "False positive", "Add finding…", "Load check settings…", "Export HTML report…" and "Run again with a new judge…". The state words in tables and the report ("Issue: missed") are not buttons and stay. "Approve", "Save reply", "Clone" and "Back" have no button; their labels stay in the code only until the Help is rewritten (T225).
- Q: (Owner review 2026-11-14, third look, T246) What is in the top bar of the page? → A: The tool name, the indicator of unsaved changes, "Save test project", "Save evaluation", the menu, which is now named **More** (was "File"), and **Help**, all on one line; Help is no longer at the end of the step bar. The More menu opens inside the screen at every width (FR-008, FR-076).
- Q: (Owner review 2026-11-14, third look, T247) How large are the dialogs that hold a long text, and how wide is the case window of Run? → A: One **standard large dialog**: about 90% of the screen in both directions, its buttons in a bar at the bottom. It is used by every "Show prompt" (Test cases, Run, the "From JSON" window after Recreate), by "Original prompt", by "Second opinion…" and by "Edit expected errors". Small questions (Rename, Remove, "Replace this reply?") keep the small dialog. The case window of Run and the case view of Results use the whole width of the screen.
- Q: (Owner review 2026-11-14, third look, T248) How are the error categories shown and changed? → A: The table has the columns Name, **Description & examples** (one multi-line cell), Used by, and the buttons Rename and Remove. The "Example" button, its dialog and the separate short example are gone: an `example` in an older file is joined to the description when the file is loaded and is not written again (the catalog is in no version, so no version changes). **Remove** is enabled for every category; for a category in use it asks first, and the expected errors that used it stay and lose the category (the test cases version changes). The text box "Categories to add" is replaced by one button, **Add category**, which appends an editable row. "Used by" is computed from the test cases; in the demo "unsupported-claim" is used by one case, number 15. This replaces the T237 answer on "Example" and FR-015 on a disabled "Remove".
- Q: (Owner review 2026-11-14, third look, T249) What do the windows for adding a case lose? → A: In "Case with errors" the part "Errors to prepare" is a table like the categories table, with the columns Category, Difficulty and Description (what should be wrong) and "Remove" in each row; the box "Your own instructions (optional)" is removed. In "Clean case" the box "Comment (optional)" is removed. The prompts for the LLM no longer have those two texts (FR-040, FR-083).
- Q: (Owner review 2026-11-14, third look, T250) An error is shown with the text of the source beside the text that was judged ("lost his leg" beside "took his arm"). Where does the text of the source come from? → A: From a new optional key of an expected error, `source_fragment`: the exact words of another field that the error contradicts. The generation prompt asks the LLM for it, "From JSON", the import and "Edit expected errors" accept it, and the demo has it for every error. An error without it shows only its own side. It is not used for matching, and it is part of the test cases version only for an error that has it, so older files keep their version (FR-041).
- Q: (Owner review 2026-11-14, third look, T251) How is an error shown in Test cases, Run and Results? → A: By one shared component: its number, what is wrong, the category and difficulty, then one line per side with the name of the field before the passage, the words of the source first and the words of the judged text second ("source_text: “lost his leg to a white whale”", "summary: “the whale that took his arm”"). The field names come from the case, so they follow the variables and the judged text of Judge. "Show the issue" scrolls to the fields and highlights both passages strongly for a moment. A finding of the judge, and an error without `source_fragment`, show one side (FR-062, FR-063, FR-086).
- Q: (Owner review 2026-11-14, third look, T252) What are the marks called? → A: The errors of Run are in two groups. **Expected errors**: Found · Not found · Ignored. **Additional errors**: Real error (missed in scenario) · False positive · Ignored. The same words are used for the state of an item in Results, in the preview of a second opinion and in the HTML report, and the count columns say "Not found" (was "Missed"). This replaces "Missed", "Ignore", "Real error", "Issue: missed" and "Issue: false positive" (FR-008, FR-062, FR-064).
- Q: (Owner review 2026-11-14, third look, T253) What happens to an additional error marked "Real error (missed in scenario)"? → A: It is added at once, with no question, to the expected errors of its test case, and a banner in the window says so ("Added to the expected errors of case 15 as E4."). It stays in "Additional errors" with its mark and the words "Added to the expected errors as E4"; it is counted once, as an expected error that was found (not as an additional real error). Changing the mark or removing the finding takes the expected error out again; when the replies are cleared the error stays. The decision keeps the link (`promoted_to`); the test cases version changes and the case is marked "corrected" after the first reply. The demo results change accordingly (31 expected errors, 28 found). This replaces FR-062: "it MUST NOT be added to the expected errors".
- Q: (Owner review 2026-11-14, third look, T254) Where and when can the expected errors of a case be edited? → A: On every case in Open, before and after finalizing, with or without a reply. "Edit expected errors" opens the standard large dialog with the JSON of the list of the expected errors only (each with its `id`), checked as it changes. An error that keeps its `id` and its words keeps its mark. For a case with a reply Save asks first: the marks of the changed and removed errors are dropped, the case is marked again from the reply and the test cases version changes. This replaces FR-089 (only a case without a reply, after finalizing, in the From JSON window).
- Q: (Owner review 2026-11-14, third look, T255) What does "Copy and recreate" open? → A: The empty "From JSON" window, as before (the box is the place for the new case, nothing is pasted into it), now with **Show prompt** at the top: it opens the prompt that was copied, in the standard large dialog (with **Copy prompt** and **Close**), in case it is needed again. The case saved from that window keeps that prompt as its `generation_prompt`. This replaces the part of T238 that opened the window with nothing on it (FR-086).
- Q: (Owner review 2026-11-14, third look, T256) What does Open show in Results › Test case list, and can marks be changed there? → A: The same layout as Run, read-only, in three parts: 1. Case (the fields with the highlights and the complete prompt, no buttons), 2. Judge reply, 3. Errors, which begins with a summary line ("3 expected: 2 found, 1 not found · Additional: 2 false positive") and then the two groups with the shared error component and "Show the issue". The part "Result" and the meter "Marked N of M" go; the status is in the header. Marks cannot be changed there; "Open on Run" stays as the way to change them. This replaces T241 and keeps FR-071 ("no action that changes the case"). (The owner's list said "Test Run"; this is the screen understood by it.)
### Session 2026-11-15

- Q: (Owner review 2026-11-15, fourth look, T259) Is a real error of the judge that the test case missed still added to the expected errors? → A: No. It stays in "Additional errors" with its mark (Genuine error, T260) and is counted on its own, so the owner gets the feedback that the test case was not complete; Results › Summary lists every such finding with its case and Open ("Genuine errors the test cases missed"). Adding it to the case is a separate step (Test cases › Open › Edit expected errors). This replaces the answer of T253; a file with `promoted_to` loads and the key is dropped. The demo is back to 27 of 30 found and 1 genuine error.
- Q: (Owner review 2026-11-15, fourth look, T260) A shorter name for "Real error (missed in scenario)"? → A: **Genuine error**: the judge was right and the test case missed it, so it may be added to the case. Used in Run, Results (counts "Genuine errors"), the second opinion preview and the HTML report; the state value `real_error` in the files stays. Replaces the name of T252.
- Q: (Owner review 2026-11-15, fourth look, T258) Does "Findings in the reply" repeat the expected and additional errors? → A: Yes; the list goes. The one thing only it showed, which words of the judge match an expected error and whether fully or partly, moves into the card of that expected error ("Judge: “…” (matches)" or "(partly matches)"). Replaces the reply part of FR-077.
- Q: (Owner review 2026-11-15, fourth look, T257) Should the fields of a case highlight the expected errors all the time? → A: No; that is redundant with "Show the issue". The fields of Test cases › Open, Run part 1 and Results part 1 show no highlight of their own; "Show the issue" highlights both passages of the error for a moment, with its number (and its state after a reply). The warnings of FR-080 ("not in the list") stay. Replaces the always-on highlights of FR-077.
- Q: (Owner review 2026-11-15, fourth look, T261) Pasting or typing over a saved judge reply changes the results; what should the box do? → A: It stays editable, but the first change (typed or Paste reply) asks "Change the judge’s reply?": the reply is what the judge returned and the results are counted from it; the case is marked again from the changed text and the marks set by hand are removed (named with their number). Cancel keeps the reply; after Change reply the case can be edited freely until the window moves to another case. Replaces the question of FR-056 that asked only when there were marks set by hand.
- Q: (Owner review 2026-11-15, fourth look, T262) Is "Recreate the test case" needed, when "Add test case" already makes clean cases and cases with errors? → A: No; it goes, and From JSON loses its Show prompt. Instead "Case with errors" can start from a case with errors: "Base case" lists the clean cases and the cases with errors; choosing a case with errors copies its errors into "Errors to prepare" (still editable) and uses its own clean base, if it has one, as the base text (its text with the errors is not used as the base, so the LLM does not have to keep old errors in place). The prompts of Case with errors and Clean case can be edited before they are copied; an edited prompt is no longer rebuilt, and Rebuild prompt asks first. `generation_prompt` stays in the format and holds the prompt in the box. Replaces T238 and T255.
- Q: (Owner review 2026-11-15, fifth look, T263) What does the table of the Run step count for each case? → A: Four counts side by side: "Expected errors", "Additional findings" (the judge's findings that point at no expected error), "Added by hand" (the findings added with "Add finding…" or a second opinion) and "Items to decide" (unchanged). Each is 0 before the reply; the two kinds of additional findings stay apart.
- Q: (Owner review 2026-11-15, fifth look, T264) What does the case window of Run show before the judge's reply is saved? → A: The expected errors of the case at once (description, fragment, category, difficulty, "Show the issue"), with no marks; the marks, "Judge: …" and the additional findings appear when the reply is saved.
- Q: (Owner review 2026-11-15, fifth look, T265) Where is "Details" in the Summary view? → A: At the top of the view, above the counts, still closed by default.
- Q: (Owner review 2026-11-15, fifth look, T266) Is "Load check settings" needed for two thresholds? → A: No; it goes. The two thresholds keep their defaults and stay editable in "Details"; they are still saved in the test project and the evaluation file. The tool no longer reads a check configuration file, so its format, schema and example go too.
- Q: (Owner review 2026-11-15, fifth look, T267) Is the section "Report and next version" of Results needed, and is there a final result? → A: No and no: the section goes, and so do the words "provisional" and "final", because the test cases can change at any time. The bar of Results always says how many cases are decided (and how many are not yet), its main action is always "Export HTML report", next to "Run again with a new judge…"; there is no "Continue" there. The Summary, the report and the export message still say how many cases are not decided yet, and the report's file name has no "(provisional)".
- Q: (Owner review 2026-11-15, fifth look, T268) Error analysis shows "counts only" for a group below 10 expected errors and a rate above it, which reads as a jump (a group of 15 found 15 shows 100%); what should it show? → A: The detection rate of every group, whatever its size (per expected error; a judge evaluated per case still has no rate). How much data a rate needs is said in "Details" by the thresholds: the overall result needs at least 30 expected errors and 10 clean cases, and a group of fewer than 10 expected errors says little.
- Q: (Owner review 2026-11-15, convergence, T273) Where do the default thresholds of a new test project come from? → A: From the bundled checks file (`checks.default.json`), not from code. They are saved with the test project, and a loaded project keeps its own.
- Q: (Owner review 2026-11-15, convergence, T274) Is any metric built in? → A: No. Accuracy is the default metric file: a new test project starts with it selected, it is registered like a loaded file and a loaded file with the same id replaces it. A file that names a metric which is not loaded, and carries no definition of it, is refused with a plain message. The constitution says so (3.0.0, Principle VI).
- Q: (Owner review 2026-11-15, convergence, T277) What happens to an imported file where some cases have no identifier, or two cases have the same one? → A: The import works and gives new identifiers to those cases, and says how many (FR-033); the file is not refused.
- Q: (Owner review 2026-11-15, convergence, T276, T278) Should the spec follow what the tool does? → A: Yes. The statements that named older behavior (Remove and Rename of a case with a reply, "Edit expected errors", where "Save evaluation" is, the question on a new reply, the comment of a clean case, Remove of a category in use, "Show JSON", the check configuration file) and the old names of buttons were corrected, and a glossary was added.
- Q: (Owner review 2026-11-15, fifth look, T270) The Test project card still says "A final answer needs…", though there is no final result (T267); what should it say? → A: "A reliable answer needs at least 30 injected errors and 10 clean cases; until then the result is Inconclusive.", the same words as the test size of the Summary. The minimum sample of FR-068 is unchanged; only the word changes (the sentence of the card, FR-045, FR-052, FR-068, and the same on Results).
- Q: (Owner trial 2026-11-15, T288) Is "Finalize test cases…" still needed, now that most of the test cases can change after it? → A: Yes, as **"Start test run"**, a button at the top of the Test cases step. Before the start, the Test run step shows its actions disabled with the reason. After the start, the judge prompt and the judged text are fixed and there is no way back; the rules, the reply mapping and the categories stay editable, because they say how a reply is read, not what the judge received. "Reopen test cases" goes. Replaces the answers about finalizing of Sessions 2026-11-08 and 2026-11-12.
- Q: (Owner trial 2026-11-15, T289) How many files does the work need? → A: One, the **test project**. It holds the judge set, the test cases, the metric and the thresholds and, once it has started, the **test run** (replies, decisions, model details). "Save test project" saves everything. "Load test project…" asks, for a file with a test run, "Load with the test run" or "Load the test project only"; the second is how a changed judge is tested on the same cases, so "Run again with a new judge…" goes. The evaluation file, "Load evaluation…", "Save evaluation" and "Save evaluation as…" go; "New evaluation" becomes "New test project"; the step "Run" is named "Test run". The tool is not released, so old evaluation files are not read. Replaces the two files of FR-076.
- Q: (Clarify 2026-11-15) After "Load the test project only", where does the next "Save test project" go? → A: To a new file: the loaded file is not remembered, so the first save asks for a file name and the loaded test run is never overwritten.
- Q: (Owner trial 2026-11-15, T283) May the user remove a clean case that other cases use as their base? → A: Yes. A case is independent once it is made, so "Remove" asks as for any case, with no refusal and no extra warning. The cases made from it keep their content and lose `base`, and are not marked "corrected"; the test cases version changes as with any removal.
- Q: (Owner trial 2026-11-15, T284) Does the list of expected errors under the JSON box of the test case window offer "Show the issue"? → A: Yes, as "Open" and Test run do (FR-085). Part 5 shows the fields of the case, and pressing "Show the issue" on an error marks and scrolls to its passages in them; an error whose passage is not in the case has no button.
- Q: (Owner trial 2026-11-15, T286) Is the text of a case still checked against its list of expected errors? → A: No, not at all (option B). FR-080 is removed: no check line, no "not on the list" mark, no "not in the text" mark, no confirmation on "Save case", no refusal of a case identical to its base, no note for a missing fragment or category. "Show the issue" of an error whose passage is not in the case is missing and its side line says "not found in the case". A mistake in a fragment is seen on Test run.
- Q: (Owner trial 2026-11-15, T290) Are "Add finding" and "Second opinion…" hidden before the judge’s reply is saved? → A: No. They are shown disabled, with the reason "Paste the judge’s reply first" beside them, and become enabled when a reply is saved (FR-055).
- Q: (Owner trial 2026-11-15, T291) What does emptying the reply box of a saved reply do? → A: It removes the reply, after asking: "Remove the judge’s reply?", naming the marks by hand that are lost. The case is then "Not run" again, with no reply, no decisions and no added findings. Before this, an emptied box saved nothing and the old reply stayed (FR-056).
- Q: (Owner trial 2026-11-15, T292) Should a pasted JSON be formatted? → A: Yes, everywhere the tool reads JSON (the sample reply on the Judge step, the case JSON, the reply box of Test run, the second opinion, "Edit expected errors"): when the whole text of the box is valid JSON after a paste, it is shown with new lines and an indent of 2 spaces. Invalid text, fenced JSON and JSON with other text around it stay as pasted. The judge’s reply is stored formatted (FR-084).
- Q: (Owner trial 2026-11-15, T293) How is a saved judge reply shown on Test run? → A: Read-only and formatted, not in a text box. Each part that an error rule turned into a finding is highlighted, labelled with the rule and its number ("F1") in the right column; pressing a finding on the right scrolls to and marks its block, and pressing a block marks its finding. "Change reply" turns the view into the box with "Save reply" (asks first, as FR-056; an emptied box removes the reply, T291) and "Cancel". "Paste reply" still saves at once, so a case takes no more than three actions (SC-002). A reply kept as text has no highlights (FR-055, FR-056). The labels in the reply were replaced by the answer "(UI redesign 2026-11-16, Judge reply)".

### Session 2026-11-16

UI redesign brief of the owner. It changes how the tool looks, not what it does or what it stores:
the steps, actions, labels, checks, confirmations, file formats and results stay as they are.

- (UI redesign 2026-11-16, Judge reply, decided in the brief and built in T311) How does the case window of Test run mark the findings in a saved JSON reply? → A: Each finding marks the **whole JSON object** that holds it (with `text`, `verdict`, `reason` and its other fields), not only its text. The mark is a light background and a thin vertical line at the left of all the lines of the object. The reply shows no "F1" label, no rule name, no category and no description of an error: these stay in "Errors". A block is marked strongly when its item is pointed at ("Show the issue" or the block itself; see the next answers for how long and for what was removed). A reply kept as text, and JSON that no rule turned into a finding, have no marks. This replaces the labels of the answer on T293 (FR-055, SC-033).
- Q: (UI redesign 2026-11-16) The new palette replaces black and red, but only its light colors are given; what happens to the dark scheme? → A: It stays and follows the system setting, with dark tokens derived from the forest green palette and 4.5:1 contrast; there is no theme switch (FR-007).
- Q: (UI redesign 2026-11-16) "Show the issue" scrolls to the fields of the case, so the finding's block in the reply is out of view; how long is that block marked? → A: Until another item is pointed at. The passage in the fields of the case is still marked for about two seconds, but the block in the reply stays strongly marked, so the user sees it on scrolling down. This replaces the timed mark of the block (T311) (FR-055).
- Q: (Owner trial 2026-11-16, case 15) The error card has buttons that mark the object in Judge reply ("F1 · Judge: “…” (matches)" and "Show F2 in the reply"), and "Show the issue" marks it too; do all of them stay? → A: No. The two buttons go, because they repeat "Show the issue" and crowd the card. The marks stay: "Show the issue" and pressing the block itself mark the object. The line "F1 · Judge: “…” (matches)" stays as text, because it says which words of the judge match the error, and pressing a block still marks its line (FR-055, SC-045).
- Q: (Owner trial 2026-11-16, after case 15) Does the line "F1 · Judge: “…” (matches)" stay in the error card? → A: No. The line goes; a partial match is still explained by the reason of the undecided mark. Pressing a block in Judge reply now marks and scrolls to the card of the expected error that the finding matches, and the card of a finding with no expected error as before (FR-055, SC-045; T347). Replaces the end of the answer above and the "words of the judge" part of FR-055 (T258).
- Q: (Owner trial 2026-11-16, case 15) Part 3 of the case window of Test run is called "Judge reply and errors", which names the two columns, not the work; what is it called? → A: "Verify the judge reply". The left column keeps its label "Judge reply" and the right column keeps "Errors". This is the one change of a label made by the redesign, at the owner's request (FR-055; SC-040 gate exception 4, the e2e test of `v6-run.spec.ts`).
- Q: (UI redesign 2026-11-16) A case can have any number of fields; how does part 1 of the case window lay them out? → A: From 760 px up, in two columns: the judged field on the right, every other field stacked on the left. A case with one field shows it over the full width. Below 760 px all fields are stacked and the judged field is last. This replaces "the fields, over the full width" (FR-055).
- Q: (UI redesign 2026-11-16) The main content is at most 1280 px wide, which leaves empty margins on a wide screen; what limit applies? → A: The main content and the case window are at most 1600 px wide, so at 1440 × 900 they fill the width less the side margins. Paragraphs of text (descriptions, messages, Help) are at most about 72 characters wide; tables and JSON use the full width (FR-092).
- (UI redesign 2026-11-16, decided in the brief) What else does the redesign set? → A: A calm, plain look built from tokens (FR-091), the layout of each step, the case window and the dialogs at four screen sizes (FR-092, FR-093), and the keyboard and contrast rules (FR-094), with acceptance criteria SC-040 to SC-047. No action, label, check, confirmation, file format or result changes, and no theme switch is added. The Help texts that describe the old look are rewritten with the Help (T225), not in this change.
- Q: (UI redesign 2026-11-16) The secondary text colors of the brief, `#687267` (green) and `#667381` (navy), are 4.49:1 and 4.43:1 on their backgrounds, below 4.5:1; which colors apply? → A: `#5F6A5E` and `#5E6B7A`, the nearest shades that meet 4.5:1 on the background, the surface and the quiet button (5.07:1 and 4.97:1). This replaces the two values of the brief (FR-007).
- Q: (UI redesign 2026-11-16) Which name stands next to the tool name in the header? → A: The name of the test project (`dataset.name`, for example "Book summaries"). The file name moves from under "Save test project" into the save indicator ("All changes saved · books.json", or "no file yet"), so each name is shown once (FR-092).
- Q: (UI redesign 2026-11-16) SC-030 and SC-031 ask for no page scrolling at 1280 × 720, but the case window now scrolls as one page; what do they require? → A: SC-030: one action moves to the next case, and the header, the case name and the start of part 1 are in view without scrolling; the rest is further down the same page, with the header in view. SC-031: "Show the issue" of each of up to five errors scrolls to its passage, not hidden under the header, and the list of errors has no scroll area of its own. This replaces the "without scrolling" wording of both (SC-030, SC-031).
- Q: (UI redesign 2026-11-16) The load question has two equal actions; which one is the main action, placed last? → A: "Load with the test run", because continuing the work is the usual case. The order is "Cancel", "Load the test project only", "Load with the test run", as built today (FR-093, FR-020).
- Q: (Owner request 2026-11-16, T343) "Load demo…", "Load test project…" and "New test project" replace the current work at once when nothing is unsaved; should they ask first? → A: Yes, whenever the session has work. The dialog is "Replace the current work?"; it says that the judge, the test cases and the test run in the app will be reset and that saving the test project first keeps them. "Cancel" is first and the action's name last (the only `primary`, FR-093). With unsaved changes the existing "Unsaved changes" warning stays alone; an empty project asks nothing. A loaded or saved file counts as work (FR-051).
- Q: (UI redesign 2026-11-16) The case window has five heading levels in its HTML; what does "at most three levels of heading" count? → A: The looks of a heading. h4 and h5 stay in the HTML, for screen readers and tests, but look like an h3 (16 px, 600) or a small label (14 px, 600, secondary text). There is no fourth size (FR-091).
- Q: (UI redesign 2026-11-16) Below 760 px the header of the case window wraps; does "Close" move to the first row? → A: No. The header wraps naturally in the order of FR-092, with "Close" last, and nothing is moved with CSS, so the order of Tab is the order on screen (FR-092).
- Q: (UI redesign 2026-11-16) The saved reply and the base case of "Case with errors" scroll inside their frames today; do they keep that? → A: No. Both grow with their text and the page scrolls, so "Show the issue" scrolls the page and the header stays above the passage (FR-092, SC-031).

## Glossary

One term for each concept (Constitution, Writing style). Names of buttons and marks are the ones in
`src/ui/labels.ts`; this list gives the meaning.

- **Test project**: the one file of the work. It holds the judge set, the error categories, the test cases, the metric with its parameters and the thresholds and, once the test run has started, the test run.
- **Test run**: the replies of one judge version to the test cases, with every decision, the model details and the results. It begins with "Start test run"; after that the judge prompt and the judged text are fixed. It is saved inside the test project file. (The word "evaluation" is not used for it.)
- **Test case**: one input for the judge, with a value for each variable of the judge prompt. A **clean case** has no expected errors; a **case with errors** has one or more.
- **Expected error**: an error that was put into a case on purpose, with a description and, optionally, a category, a fragment and a difficulty.
- **Judge reply**: the text the judge returned for one case. A reply that is readable JSON is saved at once.
- **Finding**: one thing the judge reported in its reply. A finding that matches an expected error is a match. A finding that matches none is an **additional error** (the list on Test run) and is counted as an **additional finding** (the column of the table).
- **Marks of an expected error**: Found, Not found, Ignored. **Marks of an additional error**: Genuine error, False positive, Ignored.
- **Case window**: the page of Test run where one case is read, its reply pasted and its errors marked. The **read-only view** is the page that "Open" shows on Test cases and Results.
- **Metric**: the definition of how a judge is tested: prompt, reply mapping, error rules, categories and measures. No metric is built in; the **default metric file** (Accuracy) is what a new test project starts with.
- **Thresholds** (check rules): the pass or fail limits for the two rates. They are saved in the test project file and changed in "Details" on Results.
- **Overall result**: Works, Does not work or Inconclusive. The result is Inconclusive while cases are not decided or the test is below the **minimum test size** (30 expected errors and 10 clean cases, fixed in the bundled checks file); a **reliable answer** needs at least that size.
- **Cases not decided**: cases that are not run, or that await verification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate one judge end to end (Priority: P1)

A judge author sets up a judge and a set of test cases, lets the tool compose the final prompt
for each case, runs each prompt by hand in an LLM of their choice outside the tool, pastes the
received reply back (any format), resolves the differences right after each reply, and then sees the
outcome: how many of the expected errors the judge found and missed, how many additional findings
it reported and how many of those were false positives, and one line with the overall result.

**Why this priority**: This is the core value of the product: knowing how much a judge can be
trusted. Everything else builds on it.

**Independent Test**: Load the demo data, complete the whole flow in one session and see the
Results step with the main counts, the detection rate, the false-positive rate and the overall result.

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
   Results step, **Then** the counts, the two rates and the overall result (Works or Does not work)
   with its reason are shown.
6. **Given** some cases are not run or await verification, or the sample is below the minimum,
   **When** the user opens the Results step, **Then** the overall result is Inconclusive and says
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
   field holds the text of a finding (shown in each rule as "Where the error is").
3. **Given** recognized fields, **When** the user adds a rule with several conditions joined by
   "and" or by "or", **Then** the sample reply shows which of its parts are findings and by which
   rule.
4. **Given** a rule, **When** the user tries to use a field that is not in the sample reply,
   **Then** the tool does not accept it and says that the field must occur in the sample reply.
5. **Given** a sample reply that is not valid JSON, **When** it is pasted, **Then** the tool
   shows the problem and where it is (line and column) under the box, keeps the text and changes
   nothing else.
6. **Given** nothing is loaded, **When** the user chooses "Load demo…" in the More menu, **Then** the
   demo is loaded at once, with no window, and the Judge step opens with its prompt, sample reply and
   rules; the tool asks first when something would be replaced. The Judge step has no example or
   welcome section.
7. **Given** a prompt with several variables, **When** the variables are listed, **Then** the last
   one is proposed as the judged text (the output the judge evaluates) and the user can mark another
   one instead.
8. **Given** the Judge step, **When** the user looks for its buttons, **Then** apart from the header
   ("More" menu and Help) there are only "Add rule" (with "Add condition" and "Remove" inside each
   rule) and the one action of the "what next" line; there is no "Save test project" of its own, no "Read
   sample reply" and no "Add test case".
9. **Given** a sample reply that holds only some of the values the judge can return, **When** the
   user looks at the "Values seen" and writes a condition, **Then** the column says the values are
   examples, the value box accepts any text and keeps it as typed, and a line beside the box says so.
10. **Given** a rule with `claims[].verdict` equals "aaa" and `claims[].text` equals "bbb", **When**
    the user presses "Add condition", **Then** the two typed values are kept, the new condition says
    "Condition 3: type a value" next to it, the rule is not shown as "Broken rule" and is marked as
    not used until every condition has a value, and the preview says so.
11. **Given** a started test run, **When** the user looks at the Judge, Test cases and Test run
    steps, **Then** "Add test case" is not in the "what next" line of any of them; it is a button
    above the table of cases on Test cases and on Test run (disabled at the limit of cases).

---

### User Story 3 - Keep clean base cases among the test cases (Priority: P1)

A judge author keeps several clean base cases on the Test cases step: complete inputs for the
judge, with a value for every variable and no errors. To add one they press "Add test case",
choose "Clean case", type a name and, if they like, pick another clean case in "Like case" as a model, copy the full prompt into their
own LLM and paste its answer back (a JSON they already have is added with "From JSON"). The tool
checks at once that the answer has the structure the judge needs and shows where it does not. When it is
right, "Save case" saves the case. Clean cases are listed in the one table of test cases, marked "Clean", and
the judge is expected to report nothing in them. The Judge step does not list them.

**Why this priority**: Clean cases are the base every injected error is made from, and the only
way to see whether the judge reports errors that are not there.

**Independent Test**: With a prompt that has two variables, add two clean cases through the
clean case window (one with "Like case" set to the other) and one with "From JSON", and
import three more from a CSV; confirm all five are listed in the table of test cases as "Clean" and are
saved in the test project file.

**Acceptance Scenarios**:

1. **Given** a judge prompt with variables, **When** the user chooses "Add test case" and then
   "Clean case", **Then** the window asks for a name, shows the full prompt
   for the LLM with "Copy prompt", and offers a box for the LLM's answer; there are no boxes for
   typing the field values.
2. **Given** another clean case picked in "Like case", **When** the prompt is shown,
   **Then** it contains the fields of the picked case as a model; with
   nothing picked, no other case is added.
3. **Given** an answer with a value for every variable, **When** it is pasted, **Then** it is
   checked at once, its fields are shown, and "Save case" adds the case to the table of
   test cases as "Clean".
4. **Given** an answer that is not JSON, lacks a variable or holds expected errors, **When** it is
   pasted, **Then** the problem and where it is (line and column, or the field path such as
   `fields.summary`) are shown under the box, the pasted text is kept, and "Save case" is
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

A user presses "Add test case" on the Test cases step and chooses "Case with errors". In
the test case window they may pick a clean case as the base, pick the errors they want from the
error catalog or type a new category, give each a difficulty and a short description, and copy one
ready prompt into their own LLM. They paste the LLM's JSON into one edit box (a JSON they already
have is added with "From JSON", which leads to the same edit box), the tool checks it as it
changes and shows where it is wrong, and under the box it lists the case's expected errors,
read-only. The user changes only the JSON; every change shows at once in the list. All of it is on
one page: "Save case" and "Close without saving" are always in the header (T233).

**Why this priority**: Test cases with known, deliberately injected errors are the core of the whole
product, and making them by hand is slow and error-prone.

**Independent Test**: In a test project with no test cases at all, press "Add test case", choose
"From JSON", paste a ready JSON of a case with errors and save it; then choose "Case with injected
errors", pick a base case,
pick two errors ("wrong-number", subtle, "wrong year"; "factual-error", obvious, "wrong place"),
copy the prompt into an LLM, paste its answer, read the list of both errors under the box,
change one fragment in the JSON and save; confirm the new case records both categories, their
fragments and its base case.

**Acceptance Scenarios**:

1. **Given** the Test cases step, **When** the user presses "Add test case", **Then** a window opens
   that fills the screen and offers "From JSON", "Clean case" and "Case with errors".
2. **Given** a test project with no clean case, **When** the user looks at the choice, **Then**
   all three choices are available; "Case with errors" works without a base case.
3. **Given** "Case with errors", **When** the user looks at the base, **Then** any clean
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
   `expected_errors[2].description` for a missing or wrong field), the text is kept, and "Save case"
   is disabled, with the reason beside it, until it is valid.
7. **Given** a valid JSON, **When** the user looks under the box, **Then** the case's expected
   errors are listed read-only (number, category, difficulty, fragment, description), on the same
   page, without a "Next" and with the fields shown without highlights until "Show the issue" (T284).
8. **Given** that list, **When** the user changes the JSON, **Then** the list shows the change at
   once; while the JSON is invalid no list is shown, the problems are under the box, and "Save case"
   is disabled.
9. **Given** an expected error whose passage is not in the case, **When** the list is shown,
   **Then** the error has no "Show the issue" and its side line says, small, "not found in the case";
   nothing else is said about it (the text is not checked against the list, T286).
10. **Given** a base case was picked and the injected version is identical to it, **When** the user
   saves, **Then** the case is saved like any other (T286).
11. **Given** a changed place that no expected error covers, or a fragment that does not occur in the
   text, **When** the user saves, **Then** the case is saved at once, with no question and no warning
   about the list (T286). A mistake in a fragment is seen on Test run, where the error is decided by hand.
12. **Given** the window, **When** the user presses "Close without saving", **Then** the
   window closes and nothing is added; when there is pasted or typed content, the tool asks first.
13. **Given** a pasted JSON with no expected errors, **When** the user saves it in this window,
   **Then** it is saved as a clean case and the window says so before saving.
14. **Given** "From JSON", **When** the user pastes a valid case JSON, **Then** the window shows
   only the box and the expected errors under it, and "Save case" saves it as a clean case when it
   has no expected errors (the list says "No expected errors: this will be saved as a clean case.")
   or as a case with injected errors when it has some; the window names the kind before saving.
15. **Given** any way of adding a case, **When** the window is open, **Then** its header holds only
   the title, the save button with the reason beside it while it is disabled, and "Close without saving"; the parts follow one another on one page, each in a frame; there is no "Next", no
   "Back" and no "Part N of 3".

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
   to the test project. It stays open until the user starts the test run (see User Story 11).
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
file on their own device and carries on later. There is one file, the test project. It holds the
judge set and the test cases and, once the test run has started, the test run: every prompt, reply
and decision made so far. "Save test project" is a button of the page header on every step. The
tool shows clearly whether there are changes not yet saved.

**Why this priority**: Building test cases and running dozens of prompts by hand takes time;
without a simple save the work would be lost when the page is closed.

**Independent Test**: Add 5 cases, start the test run, enter replies for 3 of them, save the test
project, close and reopen the tool, load the file with its test run, and confirm the cases, the 3
replies and their decisions are back and the remaining 2 cases can be run.

**Acceptance Scenarios**:

1. **Given** a judge set and at least one test case, **When** the user presses "Save test project",
   **Then** one file is produced containing the judge set, the test project name, all cases with
   their expected errors and base references, the active metric with its definition, the
   thresholds and, once it has started, the test run.
2. **Given** a saved test project file with no test run, **When** the user loads it later,
   **Then** the judge set and the test cases return with identical content, the test run has not
   started, and everything can be edited.
3. **Given** a test project file that holds a test run, **When** the user loads it, **Then** the
   tool asks "Load with the test run" or "Load the test project only". With the test run, the judge
   set, the test cases, every reply and every decision are restored, and the tool opens the Test
   run step with "Continue", which opens the first case that is not decided. With the test project
   only, no reply is loaded, the test run has not started and everything can be edited.
4. **Given** there are changes since the last save, **When** the user looks at the screen,
   **Then** the tool shows that there are unsaved changes, and the indicator clears after saving.
5. **Given** the user has unsaved work, **When** they load a file that would replace it, **Then**
   the tool warns that the current work will be replaced and offers to save it first.
6. **Given** a saved file that was damaged or edited by hand, **When** the user loads it,
   **Then** the tool reports every problem and does not replace the current work.
7. **Given** a test project saved once to a chosen file, **When** the user presses "Save test
   project" again, **Then** the same file is overwritten without a question; "Save test project
   as…" (in the More menu) asks for a new file. After "Load with the test run" saving goes to the
   loaded file. After "Load the test project only" the first save asks for a new file, so the loaded
   test run is never overwritten.
8. **Given** any step, **When** the user looks for "Save test project", **Then** it is a button of
   the page header with the name of its file under it, beside the indicator of unsaved changes, the
   "More" menu and Help; no other screen has a save button, and the warnings before work would be
   lost offer "Save test project first".

---

### User Story 7 - Run every test case by hand (Priority: P1)

After the test run has started, the Test run step shows all test cases in one list, with a short summary
of the judge being run (its version, the test project and the judged text) and a free-text box for the
model details. A button
at each case opens a window that shows the case as it was shown when it was made, without its JSON
(name, fields with no highlight until "Show the issue", the list of expected errors with "Show the
issue"), the judge prompt ready to copy and a box to paste the judge's JSON reply. The user copies
the prompt into their LLM, pastes the reply back, sees at once what the judge found (User Story 8)
and moves to the next case. Every prompt and reply is kept with its case.

**Why this priority**: This is the working loop the user repeats for every case; it has to be quick,
impossible to mix up and safe against losing work.

**Independent Test**: With a started test run of 5 cases, open each case's window, copy the prompt,
paste a reply, and confirm the list shows 5 of 5 replies and each case keeps its own prompt and
reply.

**Acceptance Scenarios**:

1. **Given** a started test run, **When** the user opens the Test run step, **Then** all cases are in
   one list with their name, kind, number of expected errors and status, and a short summary shows
   the judge version, the test project name and version and the judged text.
2. **Given** the list, **When** the user presses the button at a case, **Then** a window opens that
   fills the screen as one page of three parts (see the Clarifications, Owner review 2026-11-14,
   Case window of Test run): the fields of the case, the judged field on the right from 760 px up, with no
   highlight until "Show the issue"; a row with "Add
   finding", "Second opinion…", "Marked N of M" and the status; then, in two equal columns, "Judge
   reply" (the box for the reply, saved as soon as it is readable JSON, with "Paste reply" below it; once a reply is saved, the reply read-only, where each finding marks its whole JSON object with a line at the left and no label, UI redesign 2026-11-16) and the errors.
3. **Given** the window of a case, **When** the user presses "Next case" or "Previous case" (or the matching keys), **Then** the window shows that case at once, with its position
   ("case 7 of 20"), without going back to the list.
4. **Given** the judge's answer copied in the user's LLM, **When** the user presses "Paste reply", **Then** the reply is read from the clipboard and saved in one action, kept
   with the case together with the prompt that produced it, the progress count increases, and the
   differences appear below it.
5. **Given** a case that already has a reply, which is shown read-only, **When** the user changes it ("Change reply",
   edits the box and presses "Save reply", or presses "Paste reply"), **Then** the tool asks first, "Change the judge’s reply?", with "Cancel" as the
   primary button (T261); after "Change reply" the case is marked again from the new text.
6. **Given** a case with decisions set by hand or approved from an LLM opinion, **When** the user
   confirms the change, **Then** those decisions are removed, and the question says how many.
   **When** the user empties the box of a saved reply and presses "Save reply", **Then** the tool asks first, "Remove the
   judge’s reply?", naming the marks that are lost; after "Remove reply" the case is "Not run" again,
   with no reply, no decisions and no added findings, and "Cancel" keeps the reply (T291).
7. **Given** the browser refuses to let the tool read the clipboard, **When** the user presses
   "Paste reply", **Then** the tool says so and the user pastes with Ctrl+V into the
   box of a case without a reply, with the same effect: a reply that is readable JSON is saved at once, any other text with "Keep as text".
8. **Given** a test project whose test run has not started, **When** the user opens the Test run
   step, **Then** its actions are disabled, each with the reason "Start the test run first".
9. **Given** replies saved since the last "Save test project", **When** the user looks at the Test
   run step or the case window, **Then** their number is shown, "Save test project" is in the page header, and
   after every 25 such replies the tool reminds the user to save.
10. **Given** the Test run step, **When** the user writes the model details (for example the model name
   and its settings, over several lines), **Then** the text is kept with the result and shown in
   the report.

---

### User Story 8 - Resolve the differences right after each reply (Priority: P1)

As soon as a reply is saved, the tool reads it with the judge's reply mapping and error rules and
shows one list of items with their marks: each expected error the judge found is "Found", each one
it did not find is "Not found", and each finding that matches no expected error is an
additional finding for the user to mark "False positive" or "Genuine error". "Ignored" is
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

1. **Given** received replies, **When** the user looks at the Test run list, **Then** every case shows
   its status (Not run, Awaiting verification, Pass, Fail), the number still to decide is shown, and
   the user can show the cases that await verification first or only those.
2. **Given** a saved reply, **When** the case window shows it, **Then** the right column shows the
   received reply and one list of items: every expected error marked "Found", "Not found" or
   undecided (a partial match), and every additional finding, undecided until the user marks it;
   each item shows its reason.
3. **Given** an expected error that no finding points at, fully or partly, **When** the reply is
   read, **Then** it is marked "Not found" automatically if the case has no additional
   finding; if it has one, the expected error stays undecided with the reason "an additional
   finding may be this error in other words".
4. **Given** a finding that points at no expected error, **When** the reply is read, **Then** it is
   added to the list as an additional finding, and the user can mark it "False positive" or
   "Genuine error".
5. **Given** any item, **When** the user looks at its marks, **Then** "Ignored" is always among them.
6. **Given** that window, **When** the user presses "Next case" or "Previous case",
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
   marks it "Ignored", **Then** it is left out of every count and listed as ignored in the report.
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
line gives the overall result. Two more views give the analysis per category and difficulty and
the list of all test cases. Everything on the Results step is read-only, except the thresholds in
"Details". The result can be exported as an HTML report at any time; the test project file saved
with "Save test project" holds the same result as JSON.

**Why this priority**: The result is the reason the tool exists; a first-time reader must
understand it without reading documentation.

**Independent Test**: With a fully verified demo test run, open the three views, check the
counts against the cases by hand, export the HTML report and save the test project; confirm the HTML
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
7. **Given** cases that are not run or await verification, **When** the user exports the report,
   **Then** the report says how many cases are not decided yet, and it is not called provisional;
   the main action of the Results bar is "Export HTML report" whether or not every case is decided (T267).
8. **Given** the Results step, **When** the user looks for an export of the result as JSON, **Then**
   there is no separate "Export JSON" and no save action; the Help says that "Save test project"
   (or "Save test project as…" for a copy) writes the result as JSON (the step no longer
   has the card that said it, T267).

---

### User Story 10 - Get guidance while building the test project (Priority: P2)

While building the test project, the user sees help: a short description and an example for each
category, and live feedback on the test project being built, such as how many cases are clean and how
many have injected errors, whether the balance is poor, whether any text is duplicated, whether the test is big
enough for a reliable answer, and how far it is from the size limit.

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
   the user views it, **Then** the test-size summary shows what is missing and says that a reliable
   answer needs it and the result is Inconclusive until it is added.

---

### User Story 11 - Mix hand-made and loaded cases, then start the test run (Priority: P2)

A user can combine cases loaded from a file with cases prepared in the tool in one test project.
When satisfied, they press "Start test run": they see a summary, confirm, and from that moment the
judge prompt and the judged text are fixed. There is no way back. To test a changed prompt, they
load the test project file with "Load the test project only" (User Story 12).

**Why this priority**: Real work mixes both routes, and the start keeps every reply tied to the
prompt that produced it.

**Independent Test**: Load a 10-case file, prepare 2 more cases in the tool, start the test run,
and confirm the test project holds 12 cases and the judge prompt can no longer be edited.

**Acceptance Scenarios**:

1. **Given** a test project loaded from a file whose test run has not started, **When** the user
   prepares more cases in the tool, **Then** they join the same test project.
2. **Given** a test project ready to use, **When** the user presses "Start test run" at the top of
   the Test cases step, **Then** a summary (counts, balance, warnings) is shown and the test run
   starts only after confirmation.
3. **Given** the test run has not started, **When** the user opens the Test run step, **Then** its
   actions are shown disabled, each with the reason "Start the test run first" beside it.
4. **Given** the test run has started, **When** the user looks at the judge prompt or the judged
   text, **Then** both are locked, the reason is shown beside them, and "Load test project…" is
   offered as the way to test another prompt (with "Load the test project only").
5. **Given** the test run has started, **When** the user corrects an error rule, the reply mapping
   or a category, **Then** the change is made, automatic decisions are recomputed, decisions made by
   hand are kept, and the judge gets a new version (FR-075).
6. **Given** the user has unsaved cases, **When** they try to leave the page, **Then** the tool
   warns them.

---

### User Story 12 - Test another version of the judge on the same test cases (Priority: P2)

A user keeps test cases as a file with a name and a version, and uses the same cases to test a
changed judge prompt. They load the test project file with "Load the test project only": the test
cases, the rules and the categories come back without replies, and the test run has not started,
so the prompt can be changed. The first save asks for a new file, so the earlier test run is kept.
Each exported result names the judge version and the test cases version it was made with, so two
reports can be read against each other.

**Why this priority**: Improving a judge means changing its prompt and testing again on identical
cases. Showing two results side by side inside the tool (Compare) is deferred.

**Independent Test**: Test a judge, save and export the result, load the file with "Load the test
project only", change the prompt, start the test run, test again and export; confirm both reports
name the same test cases version and different judge versions, and the first file still holds its
test run.

**Acceptance Scenarios**:

1. **Given** a loaded test project, **When** the user views it, **Then** its name, version, case count
   and split between clean cases and cases with injected errors are visible.
2. **Given** a test project is saved and loaded again, **When** the two are compared, **Then** they are
   recognized as identical (same version).
3. **Given** a test project file that holds a test run, **When** the user loads it with "Load the
   test project only", **Then** the test cases, the rules, the reply mapping, the categories, the
   metric and the thresholds come back, no reply or decision is loaded, and the judge prompt can be
   edited; a changed prompt gets a new judge version.
4. **Given** a test project loaded with "Load the test project only", **When** the user saves,
   **Then** the first "Save test project" asks for a file, so the loaded file and its test run are
   never overwritten.
5. **Given** a test project used for one test run, **When** the user loads it with "Load the test
   project only", starts a new test run without changing the prompt, writes other model details and
   enters the replies of another LLM, **Then** the two files name the same judge version, test cases
   version, metric and thresholds, and differ only in the model details, the replies, the decisions
   and the results.

---

### User Story 13 - Reproduce and audit past results (Priority: P2)

A user opens any saved result file and can see exactly which judge (prompt, reply mapping and
error rules) and which test cases produced it, together with every prompt, reply and decision.

**Why this priority**: Traceability underpins trust in the results.

**Independent Test**: Save a test project with a test run and its results, reload the page, load the file with the test run, and confirm the
same numbers, judge version and test cases are shown.

**Acceptance Scenarios**:

1. **Given** a completed test run, **When** the user saves the test project, **Then** the file
   contains the results together with the judge set and the cases used.
2. **Given** a saved test project file with a test run, **When** it is loaded with the test run in
   a fresh session, **Then** the
   identical results, judge version and cases are displayed.
3. **Given** the same judge set, cases, replies and decisions, **When** results are recalculated,
   **Then** the numbers are identical.

---

### User Story 14 - Use my own error catalog for other kinds of judges (Priority: P3)

A user adds their own categories, each with a name and a short description, or pastes a category
list for another kind of judge, and
uses those categories when preparing test cases. The catalog is managed in the "Error categories"
section of the Test cases step, which shows how many test cases use each category and can be
collapsed, and is saved inside the test project file only. One test run tests one judge.

**Why this priority**: Different judges check different things; the ready examples may not fit,
but the product works without custom categories.

**Independent Test**: Add a category "tone-violation", use it for a prepared case, save the test project; confirm the category is in the saved file.

**Acceptance Scenarios**:

1. **Given** the user adds a category in the "Error categories" section, or types a new category
   name for a wanted error, **When** they prepare a case, **Then** the new category can be chosen.
2. **Given** a category used by expected errors in 3 test cases, **When** the user looks at it,
   **Then** it shows "3 test cases", and its "Remove" asks first: the 3 test cases use it, their
   expected errors stay and lose the category, and the test cases version changes (FR-015);
   renaming it instead changes it in all 3 cases and error analysis shows the new name.
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
"Open" to see it in full, read-only, and make a copy of it with "Export test cases" and "From JSON".

**Why this priority**: Useful for inspection, but the product works without it.

**Independent Test**: Load 500 cases, filter to "with injected errors and without a reply", and
confirm the lists and the count are correct; open one case, copy its JSON, paste it into a new
case and confirm the new case has the same fields and expected errors.

**Acceptance Scenarios**:

1. **Given** a large test project, **When** the user applies filters or search, **Then** the table
   shows only matching cases with a count, and the kind filter shows only clean cases or only cases
   with injected errors.
2. **Given** the user presses "Open" at a case, **When** the window opens, **Then** it shows the
   case read-only: its fields, with no highlight until "Show the issue" (T257), its expected errors with "Show the
   issue", and its composed prompt; nothing in it can be edited.
3. **Given** a case with errors, **When** the user opens "Add test case…" › "Case with errors" and chooses that case as the
   base (T262), **Then** its errors are copied into "Errors to prepare" and its own clean base is the base text; the
   prompt can be edited before it is copied, and "Rebuild prompt" asks before it replaces the edit.
4. **Given** an open case, **When** the user looks at its buttons, **Then** there is no "Clone", no "Recreate the test
   case", no "Show JSON" and no "Copy JSON"; a copy is made with "Export test cases" and "From JSON".
5. **Given** a row of either list, **When** the user looks at its actions, **Then** it shows "Open",
   "Rename" and "Remove"; all three stay enabled at all times; "Remove" of a case with a reply asks first.
7. **Given** any case, **When** the user presses "Edit expected errors" in its read-only view,
   **Then** the JSON of its expected errors opens for editing (FR-089); a change is saved with "Save expected errors", and
   the test cases version changes; for a case with a reply the tool asks first.
8. **Given** a started test run with replies, **When** the user adds a test case, **Then** it
   appears on Test run as Not run, and every earlier reply and decision is kept.
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
  broken and reported at the start of the test run.
- No rules, or a rule without a "Where the error is": allowed, with a warning that every case
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
- Duplicate case identifiers within one file, or an identifier already used in the test project: the first case keeps it, the others get a new identifier, and the import window says how many (FR-033).
- A file where only some cases have identifiers: the cases with a free identifier keep it, the others get a new one, and the import window says how many (FR-033).
- Identifier collision between a case made in the tool and a loaded case.
- Import is interrupted halfway: the previously loaded test project must remain intact.
- Empty text or text consisting only of spaces.
- A judge variable with no matching field in a case: filled with empty text and flagged with a
  warning; starting the test run is still allowed (FR-047).
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
- A pasted case identical to the base case picked for it: saved like any other (FR-044, T286).
- Injection that changes so much that the base case is not recognizable: allowed, with nothing said
  about the changed places (T286).
- Several expected errors in one case: allowed; each has its own category and fragment.
- A pasted case whose fragment is not in the text: saved at once; the error has no "Show the issue" and
  says "not found in the case" (T286).
- A JSON that becomes invalid while the user edits it: the list of expected errors is replaced by
  a line saying the JSON is not valid yet, and "Save case" is disabled, with the reason, until it is
  valid again (FR-085).
- A clean case picked in "Like case" is removed or renamed while the clean case view is open: the
  pick is cleared or shows the new name, and the prompt is rebuilt (FR-083).
- No clean case exists yet: "Case with errors" still works; the case is made without a
  base, and nothing is compared with a base (FR-040).
- A JSON with no expected errors pasted while making a case with injected errors: saved as a clean
  case, and the window says so before saving (FR-041).
- Removing a category that is in use: "Remove" asks first, and the expected errors keep their text and lose the category (FR-015). Removing a
  clean base case that other cases were made from: allowed, with the ordinary confirmation. Those cases keep their content and lose `base`; they are not marked "corrected" (FR-017, FR-025).
- Test project with only cases with injected errors or only clean cases: some measures cannot be
  computed, and the tool says so clearly.
- Starting the test run of an empty test project or of one with only one kind of case.
- Saving an empty test project: the tool explains there is nothing to save.
- Loading a saved file while there are unsaved changes.
- A case being made in the test case window but not yet kept with "Save case" or "Approve and
  close": the window covers the page and has no file action of its own, so nothing can be saved to
  a file while it is open; "Close without saving" with pasted or typed content asks first, and a
  file holds only kept cases.
- A saved case that turns out to be wrong: its text is not edited; the user makes it again
  ("Case with errors" started from it, or "From JSON"), corrects it, saves it and removes the original. Its expected
  errors are corrected with "Edit expected errors", which asks first when the case has a reply; one that
  should not count can also be marked "Ignored" on Test run (FR-053, FR-089).
- A case added after the first reply: it is Not run, so it is counted among the cases not decided yet until it is
  run and decided; the result and the report list it as added after the first reply (FR-075).

**Running, verifying and results**

- Some cases have no reply: results can be viewed as partial and are clearly labeled as such,
  with the number of cases still missing.
- Very small test projects: the tool states that the sample is too small for a reliable answer.
- A reply that is free text, partly JSON, or in an unexpected format: it is kept, the problem and
  where it is are shown under the reply box, nothing is marked automatically, and the user marks
  the items in the case window (FR-056).
- An additional finding that is an expected error in other words: the expected error was left
  undecided, because the case has an additional finding (FR-061); the user marks it "Found" and the
  finding "Ignored", so it is not counted twice.
- A reply that lacks a field one of the rules needs: the tool does not guess; the case awaits
  verification with the reason.
- The same case answered twice: the first change of a saved reply always asks first; after
  "Change reply" the new reply resets the case's decisions, and the question says how many set by
  hand or from an LLM opinion are removed (FR-056).
- A very large pasted reply.
- A pasted LLM opinion that is malformed or refers to another case: the problem is explained
  under the box with where it is, the pasted text is kept, and nothing is changed.
- A readable LLM opinion that classifies none of the items of the case and adds no finding: the second-opinion window
  says so and why for each item, "Apply opinion" stays disabled, and the case keeps its marks; it
  classifies only some: only those items change (FR-063).
- The browser refuses to let the tool read the clipboard: the tool says so and offers a box to
  paste into with Ctrl+V instead.
- The user exports the report while cases are not run or await verification: the report says
  how many cases are not decided yet (T267).
- A remembered file (the test project file) was moved or removed, or the browser
  withdrew permission: the tool says so, forgets it and asks for a file again; the work on the
  page is kept.
- A test project with a test run is loaded with "Load the test project only": the first "Save
  test project" asks for a file, so the loaded file and its test run are never overwritten.
- Every expected error of a case is ignored: its expected errors are left out of the counts; the
  case is still not a clean case, and its status follows only its additional findings (FR-064).
- A saved test project is loaded while another test run is in progress: the warning of FR-051 comes first ("Unsaved changes" when there are unsaved changes, otherwise "Replace the current work?"; T343).
- The page stops responding after many replies were entered: work since the last "Save test project"
  is lost, so the tool shows how many replies are not saved to a file and reminds the user to save
  after every 25 (FR-059).

## Requirements *(mandatory)*

### Functional Requirements

**Workflow and general rules**

- **FR-001**: The workflow MUST be presented as four steps in a fixed order, each on its own screen
  with one primary next action: (1) Judge: the judge set, that is the judge prompt with its
  variables and its judged text, the sample reply with its reply mapping and the error rules;
  (2) Test cases: the collapsible "Error categories" section (FR-015) and one table of all test
  cases, clean and with injected errors (FR-025, FR-087), adding cases in the test case window, ending with "Start test run"; (3) Test run:
  every case with its complete prompt to copy, a place to paste the received reply and, right after
  it, the marks of every expected error and additional finding, and saving the test project; (4)
  Results: the summary, the error analysis and the list of test cases, all read-only, and
  export. The user MUST be able
  to go back to an earlier step to look, and the current step and progress MUST always be visible.
  Each step MUST show one "what next" line at the top: one sentence that says what is still
  missing or what to do next, together with the one primary action. A step screen MUST NOT carry
  explanations longer than one sentence; they belong in Help and in short hints that open on demand
  next to the field they explain. There is no welcome section: when nothing is loaded the tool
  opens the Judge step with an empty judge prompt, its "what next" line says what is missing, and
  loading the demo or a test project is offered only in the "More" menu.
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
  unsaved changes, and MUST make saving the current work one clear action: "Save test project",
  a button of the page header at all times (FR-076).
- **FR-005**: All data (judge sets, error catalogs, test cases, results, metric definitions) MUST be
  loadable from and exportable to files, with clear errors for invalid or unsupported-version
  files. The check thresholds have no file of their own: they are saved in, and loaded with, the
  test project.
- **FR-006**: The tool MUST include built-in Help explaining how to use each part of the
  workflow, kept current with the features. Help MUST be written in plain, everyday language for a
  user without a statistics background: short sentences, a worked example for each measure and for
  the test size, and any technical term explained where it first appears. It MUST explain what one
  test case is and how many cases and errors a test needs; variables, the reply mapping and error
  rules; making clean cases; preparing cases with injected errors from
  their JSON, getting a case's JSON back with "Show JSON" and cloning; categories and "Start test run";
  the marks of Test run ("Found", "Not found", "False positive", "Genuine error", "Ignored");
  loading test cases
  from a file and loading demo data; the manual copy-paste workflow,
  including the second opinion from an LLM for one case; the one file (the test project, which
  holds the test run once it has started), loading it with or without the test run, the indicator
  of unsaved changes and "Continue"; judges that give only a verdict and are evaluated per
  case, with a worked example; and how to read and export the results, with
  examples that are valid for the current file formats.
- **FR-007**: The interface MUST be clear, responsive and accessible, with helpful empty and error
  states (UI redesign 2026-11-16; the look is set by FR-091). All colors MUST come from one set of tokens. The main
  palette is **Stone and forest green**: background `#F2F3ED`, surface `#FBFCF8`, text `#202720`,
  secondary text `#5F6A5E`, border `#D5DBD1`, accent `#315D48`. The accent is the one accent color
  (primary action, current step, focus). **Porcelain and navy** (background `#F2F5F8`, surface
  `#FCFDFF`, text `#202832`, secondary text `#5E6B7A`, border `#D6DFE8`, accent `#345D86`) is an
  accepted alternative kept only as a set of tokens; the interface has no theme switch. The dark
  scheme follows the system setting, with dark tokens derived from the forest green palette. Text
  MUST meet 4.5:1 contrast in both schemes. "Pass", "Awaiting verification" and "Fail" MUST each have
  their own color and also a word or an icon, so no state is told by color alone. This replaces the
  black and red scheme.
- **FR-008**: Every action MUST have a name that says what it does, and the same action MUST carry
  the same name wherever it appears. Names are in sentence case, a verb and a noun; a name ends with
  "…" when the button opens a dialog or a file picker (T245). Text pasted into a box that is checked
  as it changes (the sample reply, the LLM answer for a clean case, the JSON of a case) needs no
  action. Actions that keep something are named "Save ...". The main actions are:
  "More" menu (was "File", T246): "Load test project…" (for a file with a test run it asks "Load
  with the test run" or "Load the test project only"), "Save test project as…", "Import test
  cases…", "Export test cases…", "Load demo…" and "New test project".
  Judge: "Add rule" (with "Add condition" and "Remove" inside a rule); these and the one action of
  the "what next" line are the only buttons of the Judge step (FR-011, FR-088).
  Test cases: "Add categories", "Rename" and "Remove" in the "Error categories" section; "Add test case…" (above the list; Test run has the same button above its cases); "Open", "Rename" and "Remove" at
  each case; "Start test run" at the top of the step (FR-053); in the import window "Download example file".
  In the test case window when adding a case: "From JSON", "Clean case" and "Case with errors"; for
  "From JSON" "Save case" and "Close without saving"; for a clean case "Copy prompt", "Rebuild prompt" (once the prompt is edited, T262), "Save case" and
  "Close without saving"; for a case with errors "Add error" and "Remove" in the list of errors to
  prepare, "Copy prompt", "Rebuild prompt", "Save case" and "Close without saving". In the read-only view of a saved case
  ("Open"): "Previous case", "Next case", "Show the issue", "Show prompt", "Copy prompt"
  and "Edit expected errors".
  Test run: "Open" at each case; in its window "Previous case",
  "Next case", "Show the issue", "Copy prompt", "Show prompt", "Paste reply", "Keep as text" (for a text in the
  box that is not JSON), "Change reply" (in the question before a saved reply is changed, T261), the marks of an item ("Found", "Not found", "False positive", "Genuine error",
  "Ignored"), "No more findings" (only for a reply that cannot be read), "Add finding…", "Remove" (for
  a finding added by hand), "Second opinion…" (in its window "Copy prompt", "Apply opinion" and
  "Cancel"). Results: the views "Summary", "Error analysis" and "Test case
  list", and the action "Export HTML report…". Removing
  something (a rule, condition, category, error to prepare or test case) is always named "Remove".
  Available at any time, in the header: the indicator of unsaved changes, the "More" menu with
  "Load demo…" (the demo, loaded at once),
  "Load test project…", "Save test project as…", "Import test cases…", "Export test cases…" and
  "New test project"; and Help. "Save test project" is a button of the header, with the name of
  its file under it; "Save test project as…" is in the More menu (FR-076, T242).
  On every screen: "Explain" opens the explanation of a section, and "Continue" appears in the
  "what next" line. No action may duplicate another one under a different name. There is no Verify
  step, no Compare step, no result shelf, and no action that leads to them; "Modify", "Describe
  errors again", "Compare with base", "Use selected text as fragment", "Read sample reply", "Copy
  prompt for clean base cases", "Read clean base cases", "Read LLM answer", "Discard case", "Copy
  verification prompt", "Paste LLM opinion from clipboard", "Read LLM opinion" and "More actions"
  are not offered. To keep the screens light, a table row MUST show its actions as visible buttons,
  never in a menu of the row: Test cases "Open", "Rename" and "Remove" (FR-025);
  Test run and Results "Open". A click on the row also opens the case. In the case window of Test run the one
  action needed next ("Copy prompt", then "Paste reply", and nothing after it) MUST be the
  primary one, and for a reply that cannot be read "No more findings"; the actions for the whole
  case that are needed less often, "Add finding" and
  "Second opinion…", MUST be visible buttons in the row of part 2, never in a collapsed section
  or a menu, and the marks of single items stay visible. "Continue"
  (FR-073) is the action of the "what next" line after a file is loaded, and on the Test run step
  whenever a case is not run or awaits verification.


**Step 1: Judge**

- **FR-009**: The Judge step MUST hold one judge set: the judge prompt with its judged text
  (FR-010), the sample reply with its reply mapping (FR-011, FR-012), the error rules (FR-013,
  FR-014); the error catalog (FR-015, FR-016) and the clean base cases (FR-017, FR-082, FR-083) belong to the
  Test cases step. One
  test run MUST test one judge. Users MUST be able to provide the judge prompt by typing or
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
- **FR-012**: Each error rule that is about a list of the sample reply MUST have its own "Where the
  error is": one recognized text field of the items of that list, the words of the judged data that
  the judge is pointing at. The system proposes the most likely field (the one it proposes for the
  list) and the user confirms or changes it; the choice is shown in the rule only when the items have more than one text field to choose from (decided 2026-11-14: with one field there is nothing to choose); the Judge step has no separate choice per list. When
  two rules hold for the same item with different fields, the first rule in the list gives the text
  of the finding. A rule about the whole reply has none. The file keeps the proposal per list in
  `reply_mapping.finding_text` and a rule carries `finding_text` only when its field differs from it,
  so the judge version of a file without such a field does not change. Findings from a rule without
  such a field, and findings from rules that use no list (FR-014), cannot be matched to expected errors automatically and are decided by the user
  after the reply is saved (FR-060).
- **FR-013**: Users MUST be able to write error rules that say when the judge has reported an
  error. The system MUST NOT create, propose or change rules by itself. Each rule has a name and
  one or more conditions, and the user chooses whether all of its conditions must hold ("and") or
  any one of them ("or"); the number of conditions and of rules is not limited. A condition
  names one recognized field of the reply, a comparison (equals, does not equal, is greater
  than, is less than, is empty, is not empty) and, where needed, a value, which the user can
  type or pick from the values seen in the sample. The values seen are examples, not a closed
  list: the value is free text, kept as it is typed, and a short line beside the value box says so. Text is compared ignoring letter case. The
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
  MUST NOT guess; the case awaits verification with the reason (FR-061). A condition that still
  has no value (just added) is not an error of the rule: it is shown as unfinished next to that
  condition, the rule is not used until every condition has a value, and the preview and the
  readability warning say so; "Broken rule" is kept for a field that is not in the sample reply, a
  rule with no conditions and a rule that uses two lists.
- **FR-015**: The error catalog (the error categories of the test project, each with a name and an
  optional description, which also holds its examples) MUST be managed in one compact "Error
  categories" section on the Test cases step, which can be collapsed (FR-087); the Judge step has no
  catalog section. The section is a table with one row per category: its name, "Description &
  examples" (one multi-line text edited in the cell), the number of test cases that use it (a case
  counts once, however many of its expected errors have the category; the number is computed from
  the test cases) and the buttons "Rename" and "Remove" (T248). There is no "Example" button and no
  separate example text: a file written earlier with an `example` has it joined to the description
  when it is loaded ("… Example: …"), and the key is not written again. One button, "Add category",
  appends an editable row to the table (name, description and examples, "Add" and "Cancel"); the name
  is normalized to lower case with dashes, and an empty name or a name already in the catalog is
  refused in the row. A new name can also be typed where the category of an error to prepare is
  given (FR-024). "Rename" asks first and says, in plain text above the buttons (not small grey text), how many expected
  errors in how many test cases get the new name ("N expected errors in M test cases get the new name.", T294), that the
  test cases version changes and that the error analysis of Results uses the new name ("No test case uses this category." when unused); a new name already in the catalog is refused. "Remove" MUST be enabled for every category:
  a category that no test case uses is removed at once; for a category in use it asks first ("N
  test cases use it. Their expected errors stay and lose the category. The test cases version
  changes."), and after the user confirms, those expected errors (and the findings added by hand
  with that category) stay without a category. Renames and removals are allowed after the start of the test run;
  they change the test cases version, and the error analysis, the totals per category and the
  report are computed from the current categories. The system MUST NOT add, rename or remove
  categories by itself. It MUST show each category's description where the category is chosen. The
  judge does not have to use the catalog.
- **FR-016**: The error catalog has no file of its own and no "Load catalog" or "Export catalog"
  action. It belongs to the test project, not to the judge set, and is saved and loaded only inside
  the test project file (FR-020), together with the judge and the test cases. To reuse a catalog the
  user loads the test project that holds it, or loads an example (FR-019).
- **FR-017**: The Test cases step MUST let the user keep clean base cases in its table of test
  cases, with the kind "Clean" (FR-025); the Judge step does not list them. A clean base case has a name and a value
  for every variable of the judge prompt and no expected errors. Users MUST be able to add any number of them in the test case window
  ("Add test case", "Clean case", FR-083), and to open, rename and remove each one
  (FR-025). Every test case is independent once it is made, so the system MUST NOT refuse to remove a clean base case that cases with injected errors
  were made from: those cases keep their content and lose their `base`, and are not marked "corrected" (T283). Clean base cases show what correct data looks like; they
  MUST NOT be used in place of the error rules.
- **FR-018**: Removed (prototype v15 review): the prompt that asked the user's LLM for many clean
  base cases at once, with its count, topic and review of every proposed case, is not offered. A
  clean case is made one at a time (FR-083); many clean cases come in with "Import test cases"
  (FR-027).
- **FR-019**: The system MUST offer one ready starting point, the demo (FR-026), through the
  "Load demo…" item of the More menu. The item loads it at once, with no window, and opens the Judge
  step; the demo is loaded with its test run, without the load question. The tool MUST ask before
  replacing existing content, and the remembered file is forgotten (FR-076). There are no other examples, no starter of its own (Accuracy and Completeness as examples
  were removed, T243) and no separate "Load metric definition…": no metric is built in (Constitution VI): the test project file carries its metric in
  `metric.definition`, and loading the
  test project registers it (T243). The default metric file (Accuracy) is only what a new test project
  starts with; it is registered like any loaded file and a loaded file with the same id replaces it
  (T274). A file that names a metric which is not loaded, and carries no definition of it, is refused
  with a plain message. The judge, the catalog and the cases come from the file the user loads.
- **FR-020**: "Save test project" MUST write the judge set and the test cases to one file, at any
  time, whether or not the test run has started: the judge prompt with its judged text, the sample
  reply and reply mapping, the error rules, the error catalog, the test project
  name and every test case with its fields, expected errors, and base reference, together with the
  active metric (its id, parameters and definition) and the check rules in use (the
  thresholds). Once the test run has started it also holds the test run: replies, decisions,
  results and model details (FR-073). It saves as FR-076 describes. "Load test project" MUST restore all of
  it with identical content, including the active metric and the thresholds. For a file that
  holds a test run it MUST ask "Load with the test run" (the work comes back as saved, FR-073) or
  "Load the test project only" (no reply is loaded and the test run has not started, so the
  prompt can be changed, User Story 12). An
  invalid or incomplete file MUST be explained and MUST NOT replace the current work. There is no
  separate judge set file; the cases alone can be exported and imported (FR-050).
- **FR-021**: Other kinds of judges MUST be usable by typing or loading their prompt, writing
  their rules and typing or pasting their category list, without changing the rest of the tool.
  The check thresholds are changed in "Details" on Results and saved with the test project. The system MUST warn, on the Judge step
  and before the start of the test run, when replies cannot be read automatically (no sample reply, no rules, a
  broken rule, or a rule without a "Where the error is"), explaining that every case will
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
  number of expected errors, categories and any warnings. "Add test case" is above the table (and, after the start of the test run, above the table of cases on Test run), never in the "what next" line, and the
  user can search, sort and filter it, including by kind. Each row MUST show three buttons: "Open" (the read-only
  view, FR-086; a click on the row does the same), "Rename" (asks for the new
  name; a name another case has is refused, FR-079) and "Remove" (asks for confirmation, also for a base case in use, FR-017). There is no details panel and no menu in a row. All three buttons
  stay enabled at all times, also after the start of the test run and for a case with a reply; "Remove" of a case
  with a reply asks first, saying that its reply and its N decisions are removed with it and the results
  change. The fields of a saved case are never edited. The expected errors of any case can be
  corrected (FR-089). To change a field, make a new case with "From JSON" (FR-078) and remove the
  original.
- **FR-026**: The system MUST offer demo data as a fixed sample that is usable without
  regeneration: a judge set, test cases and replies, loaded
  from the "Load demo…" window
  (FR-019) in one clearly labeled choice as a test project with a started test run (the same state "Load with the test run" produces), so that the Test run and Results
  steps can be tried at once. The demo's variables are named after their content (`source_text`
  and `summary`, not `input` and `output`), so that the free choice of variables (FR-010) is
  visible.
- **FR-027**: Users MUST be able to import many test cases from a single CSV or JSON file in one
  action ("Import test cases", in the "More" menu). The system MUST validate the entire file before accepting it and present a summary:
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
  "Export test cases". "Export test cases" MUST
  always write JSON, with every case, clean ones included. When a case JSON is pasted to make a
  new case in the test case window: `id` is ignored (a new identifier is
  assigned); for a case with injected errors
  the base picked in the window is used, and a different `base` in the JSON is named in a note
  under the box; with "From JSON" (FR-090) the `base` of the JSON is used when it names an
  existing clean case. The check of fields concerns the keys under `fields`: a variable of the judge prompt
  with no value is a problem, while a key the prompt does not use is named as a warning, kept and
  never sent to the judge, as in an import (FR-029).
- **FR-032**: The system MUST reject a file with more than 500 cases, state the limit and the
  number found, and leave the currently loaded test project unchanged.
- **FR-033**: The system MUST use the case identifier supplied in a JSON file when present,
  otherwise (always for CSV) assign identifiers by row order and tell the user. A missing, repeated or already used identifier gets a new one, and the import window says how many; the file is not refused for it. It MUST assign a unique identifier to each
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
  something was pasted or typed). It first offers three choices, "From JSON", "Clean
  case" and "Case with errors", all always available, also when the test project has no
  test case yet. "From JSON" leads to the JSON box with the list of expected errors (FR-090); "Clean case" to the
  clean case view (FR-083); "Case with errors" to the five parts of FR-040, FR-041 and
  FR-085. Every one of them is one vertical page with the save button in the header (FR-085). There
  is no "Clone" (FR-078). The read-only view of a saved case ("Open", FR-086) and the
  case window of Test run (FR-055) show a case whose passages are highlighted by "Show the issue" (T257). The window replaces the former preparation window, the details panel of the Test cases
  step and every way of editing a saved case.
- **FR-039**: Users MUST be able to add, rename and remove cases, before and after the start of the test run. "Remove"
  of a case with a reply asks first (FR-025). Each change MUST update the test
  cases version. A saved case's fields are not edited (FR-025).
- **FR-040**: For a case with injected errors the window MUST first offer the base: any clean case,
  any case with errors, or none (the base is optional). Choosing a case with errors (T262) MUST fill the list of
  errors to prepare with its errors (category, difficulty or "left to the LLM", description; still editable) and use its own clean
  base, if it has one, as the base text, and the window says so ("The 2 errors of … are copied into Errors to prepare. The base text is …"). The window MUST then show the **list of errors to prepare**: one row per wanted error with its category (picked
  from the catalog, or typed as a new name in a text box, FR-024; its description is
  taken from the catalog and MUST NOT have to be typed again), its difficulty (obvious, subtle, or
  left to the LLM) and a short description of what should be wrong. The user MUST be able to add
  and remove rows ("Add error", "Remove"). From the base case and these rows the window MUST build
  one ready, universal prompt for the user's own LLM, shown in full with "Copy prompt" and rebuilt
  whenever a row or the base changes, until the user edits it: the prompt can be edited before it is copied (T262), an edited prompt
  is no longer rebuilt, and "Rebuild prompt" asks before it replaces the edit. It MUST contain the judge prompt with its judged text (so the
  LLM knows what the judge checks), every field of the base case when one is picked (without one,
  it asks the LLM to write the whole case, a value for every variable, with the errors in its
  judged text), the rows with each category's description (with its examples), the rules for realistic
  errors and exact-fragment quoting, and the answer format: one case in the case JSON layout
  (FR-031) with the judged text and one expected error per row, each with its exact fragment. The base, the rows and the
  prompt are parts 1 to 3 of one page; the rows are a table with the columns Category,
  Difficulty and Description, and "Remove" in each row (T249); there is no box for own instructions; the JSON box of FR-041 follows below (FR-085).
- **FR-041**: The window MUST then offer, below the prompt on the same page, one JSON box into which the user pastes the case JSON (the
  LLM's answer). The same box is used by "From JSON" (FR-090) for a JSON the user already has. The JSON MUST be
  checked as soon as it is pasted and whenever it changes (FR-084): it must be readable (the first
  complete JSON block, also inside other text or a code fence), hold exactly one case, have a value
  for every variable of the judge prompt, and give every expected error a description; the other
  keys are treated as FR-031 says. An expected error without a fragment
  (for example bias of the whole text) or without a category is allowed; its card says "No fragment":
  it cannot be matched automatically and is decided by hand on Test run (FR-061). Every problem and
  warning MUST be shown under the box with where it is. A JSON with no expected errors is valid
  here too: it is saved as a clean case, and the window says so before saving.
  "Save case" MUST be enabled only while the JSON is valid, and the expected errors it holds are
  listed read-only under the box (FR-085). The text of the case is not checked against its list of
  expected errors (T286). An
  answer whose number of expected errors differs from the list of errors to prepare is accepted
  with a note naming the difference. The tool MUST NOT have built-in rules that change text by
  themselves, and MUST make clear that what the LLM returns is a proposal to review, not a
  guaranteed result.
  An expected error MAY carry `source_fragment` (T250): the exact words of another field, the
  source, that the error contradicts. The prompt for the LLM asks for it, and tells the LLM to leave
  it out when no passage of another field corresponds. It is shown beside the fragment and is never
  used for matching; a `source_fragment` that is in no field of the case is a warning, not a problem.
- **FR-042**: Merged into FR-085: the review of a case before saving happens in the list of
  expected errors under its JSON (FR-085);
  "Compare with base", "Use selected text as fragment" and editing single expected errors are not
  offered.
- **FR-043**: The prompt that prepares errors MUST explain the two difficulty levels and ask the
  LLM to keep the difficulty given in the list, or to choose one where the row leaves it to the
  LLM. A difficulty is changed by changing it in the JSON.
- **FR-044**: When saving a case with injected errors, the system MUST record its base case when one
  was picked, and for each expected error the category and a description of what was changed, and
  MUST NOT reject a case identical to its base case (T286). The system MUST also record the exact fragment each error is at,
  when the JSON gives one, because automatic matching of the judge's findings uses it: for an error present in the text, the
  changed fragment of the judged text; for an omission, the fragment of another field that the
  judged text no longer covers. A new category in the JSON joins the catalog on saving (FR-024).

**Step 2: Test cases — prompts, feedback, saving and starting the test run**

- **FR-045**: The system MUST show live feedback on the test cases: counts of clean cases and of cases with injected errors,
  warnings for missing kinds (stating clearly that some measures cannot be computed without both
  kinds), flagged duplicate texts, and remaining capacity up to 500 cases.
- **FR-046**: The system MUST compute and show a test-size summary from the test project, updated on
  every change: total cases (one judge run each), clean cases, cases grouped by the number of
  injected errors (for example "10 cases with 2 errors"), and total injected errors. The totals of
  injected errors and clean cases MUST be shown against the fixed minimums (30 injected errors, 10
  clean cases) as met or missing N, with the plain statement that the system needs them to give a
  reliable answer (FR-068), so the user knows before running whether the answer can be other than
  Inconclusive. This count is taken from the test project and is a forecast; the minimum that decides
  the answer is counted from decided items (FR-068). The user never enters or calculates
  these numbers. When the judge is evaluated per case (FR-061), the summary MUST count cases with
  expected errors instead of injected errors and show them against the minimum of 30 cases with
  expected errors and 10 clean cases.
- **FR-047**: The system MUST compose the final prompt for each case from the judge prompt with the
  case's fields filled into the matching variables. The system MUST NOT add any text of its own
  to that prompt (no appended material, instructions, or format requirements); the prompt is
  used exactly as the user wrote it. When a case has no field for a variable in the prompt, the
  variable MUST be replaced with empty text and the case MUST be flagged with a warning naming
  the missing field, in the read-only view of the case, in its row and in the summary of "Start test run";
  this MUST NOT block the start.
- **FR-048**: Whenever a judge prompt and at least one case are present, the system MUST show, in
  the read-only view of a case (FR-086) and in the case window of Test run, the complete prompt that
  would be sent to the LLM for that case (FR-047), with "Copy prompt", including before the start of
  the test run.
- **FR-049**: Users MUST be able to combine cases prepared in the tool with cases imported from a
  file in one test project before the start of the test run.
- **FR-050**: "Export test cases" MUST write all cases of the test project (clean ones included, with
  their expected errors and base references) to a JSON file, at any time, whether or not the
  test run has started. The file holds only the cases: no judge, catalog, metric, thresholds or
  replies, and no record of whether the test run has started. It is an export, not a save: each
  export asks for a file name, no file is remembered for it, and it does not clear the indicator
  of unsaved changes (FR-051); the whole work is saved only as the test project (FR-020,
  FR-073). "Import test cases" (FR-027) reads the exported file back, adds its cases
  to the test project, also after the start of the test run (FR-053).
- **FR-051**: The system MUST show, in the header, whether there are unsaved changes, and MUST warn
  before a load, "New test project" or "Load demo…" would replace work that has unsaved changes,
  with three choices: "Save test project first", "Discard" and "Cancel". When there is work but
  nothing unsaved, the same three actions ask "Replace the current work?" instead (T343): the judge,
  the test cases and the test run in the app will be reset, and the user should save the test project
  first to keep them. The buttons are "Cancel" and, last and the only `primary`, the name of the
  action ("Load test project", "Load demo" or "New test project"). With unsaved changes only the
  warning above shows, never two dialogs. An empty project asks nothing. "Work" is any of: a judge
  prompt that is not blank, a test case, an error rule or catalog entry, a started test run, or a file
  that was loaded or saved. There is one indicator.
  Any change sets it, including a threshold changed in "Details" (FR-020, FR-069). "Save test
  project" or "Save test project as…" clears it, because the one file holds all the work (FR-076).
- **FR-052**: Users MUST be able to start the test run with "Start test run", a button at the top of
  the Test cases step, after seeing a summary of counts, balance and warnings. The summary MUST warn when replies cannot be read automatically (FR-021), when a
  rule is broken (FR-014), when a case lacks a field for a variable (FR-047), and when no expected error
  is marked subtle, because the result would then say nothing about subtle errors.
- **FR-053**: The test cases MUST stay open until the user starts the test run, whether they came
  from a file, were built in the tool, or both. Before the start, the Test run step MUST show its
  actions disabled, each with the reason "Start the test run first" beside it; entering replies is
  available only after the start. Once the test run has started, the system MUST keep the judge
  prompt and the judged text fixed. The Judge step shows them locked, with the reason "The test
  run has started, so the prompt is fixed. To test another prompt, load the test project with
  "Load the test project only"." and "Load test project…" beside it. There is no way back to
  before the start. Two things MAY still be corrected, because they describe how replies are read
  and judged, not what was sent to the judge: the reply mapping and the error rules. After such a
  change, automatic decisions MUST be recomputed, decisions made by hand MUST be kept, and the
  judge gets a new version (FR-075). Two changes to the test cases MAY also be made after the
  start, each giving a new test cases version: the expected errors of any case are corrected
  through its JSON (FR-089), and new test cases are added with "Add test case" (a button above the
  list of cases on Test cases and on Test run, disabled at the limit of cases, never in the "what
  next" line) or "Import test cases"; a new case starts as Not run, and the replies and decisions
  of the other cases are kept. For a case with a reply, correcting its expected errors asks first
  (FR-089); an expected error that should not count can also be marked "Ignored" on Test run
  (FR-062). A category may still be renamed (FR-015). After the start, a test case can still be
  renamed and removed (the test cases version changes); "Remove" of a case with a reply asks first
  (FR-025). Loading a test project replaces the current work; with unsaved changes the system MUST
  warn first (FR-051). "Import test cases" adds cases to the test project before and after the
  start.

**Step 3: Test run**

- **FR-054**: The Test run step MUST show all test cases in one list, each with its name, kind, number of
  expected errors, number of additional findings (the judge's findings that point at no expected
  error), number of findings added by hand, number of items to decide and status (Not run,
  Awaiting verification, Pass, Fail; the counts are 0 before the reply, T263), together with the
  progress (replies received and cases decided, out of all cases) and the number of items still to
  decide. The user MUST be able to show the cases that await verification first, or only those.
  Above the list the Test run step MUST show a short summary of the judge being run: the judge
  version, the test project name and version, and the judged text. The judge prompt and the error rules
  are not repeated there; they are on the Judge step.
- **FR-055**: Each case in the list MUST have an "Open" button that opens the **case window**. It
  MUST fill the screen and be one page of three numbered parts, from top to bottom. Part 1 shows
  the case, as the read-only view of FR-086 does: the kind and the base, then the fields in two
  columns from 760 px up, the judged field on the right and all other fields stacked on the left (one field takes the full
  width; below 760 px all fields are stacked and the judged field is last; UI redesign 2026-11-16),
  with no highlight until "Show the issue" points at an error (T257), then "Show prompt" (a dialog with
  the whole prompt and only "Close") and "Copy prompt". Each part is in a frame. Part 2 is one row: "Add finding", "Second
  opinion…", the meter "Marked N of M" and the status of the case. Before the reply is saved the two buttons are
  shown disabled, with "Paste the judge’s reply first" beside them (Principle VII, T290). Part 3 has two columns of the
  same width (stacked below 760 px). The left column, "Judge reply", holds, for a case without a reply, the box for the JSON reply with "Paste reply" below it, checked as the text changes (FR-084) with only the problems said ("This is
  not JSON" and its place, an empty or refused clipboard); a reply that is readable JSON is saved as soon as it is in the box. Once
  a reply is saved, the column shows it **read-only**, as it is kept (formatted when it is JSON, FR-084), not in a box (T293): each
  finding that an error rule made from the reply marks the **whole JSON object** that holds it, with a light background and a
  thin vertical line at the left of all its lines; the reply shows no "F1" label, rule name, category or description of an error,
  which stay in "Errors" (UI redesign 2026-11-16). "Show the issue", or pressing the block itself, marks the block
  strongly until another item is pointed at, and pressing a block marks its line on the right (a line is text, not a button); "Show the issue" still scrolls to the passage in
  part 1 and marks it there for about two seconds. A reply kept as text, and JSON that no rule turned into a finding, are shown
  without marks. "Change reply" turns the view into the box with "Save reply" and
  "Cancel": "Save reply" saves the edited text (asking first as FR-056 says, and an emptied box removes the reply) and returns to the
  read-only view; "Cancel" drops the edits. "Paste reply" saves at once and shows the read-only view, so a case still takes no more than three actions (SC-002). The right column, "Errors", lists
  the expected errors from the start, before any reply, with their description, fragment, category,
  difficulty and "Show the issue" but no marks (T264); once a reply is saved it lists
  the expected errors and the additional findings with their marks
  (FR-060 to FR-064); there is no separate list of the findings in the reply (T258). The window has no "More
  actions" section and no "Approve". The window header MUST hold "Previous case" and
  "Next case", always visible and also reachable from the keyboard, and the position of the case
  ("case 7 of 20"); "Save test project" is in the page header (FR-076). Moving to another case MUST NOT lose a reply
  that was typed but not saved (a text that is not JSON and was not kept with "Keep as text"): the system asks first.
- **FR-056**: Users MUST be able to enter the received reply for each case in one action with
  "Paste reply", which reads the clipboard and saves the reply, or by pasting or
  typing into the box: a reply that is readable JSON MUST be saved as soon as it is in the box,
  with no "Save reply" button. The reply is expected as the judge's JSON, but the system MUST
  keep any text: a text that is not readable JSON is not saved by itself; the box says "This is not
  JSON" and where the problem is (line and column), and "Keep as text" keeps the text as the
  reply. A reply that lacks a field a rule needs is readable JSON and is saved. For a saved reply
  that has a problem, the problem and where it is (line and column, or the field path) are shown under the box (FR-084),
  nothing is marked automatically, and the user marks the items by hand. An empty clipboard or box
  is explained and changes nothing. Every new reply MUST reset the case: its decisions, the
  findings added by hand included, are removed and the automatic marks are computed again from the new reply. A
  saved reply is changed with "Change reply", which opens the box with "Save reply" and "Cancel" (T293); typing saves
  nothing. A change of a saved reply (the edited text with "Save reply", or "Paste reply") MUST ask
  first (T261), "Change the judge’s reply?": the reply is what the judge returned and the results are
  counted from it; the case is marked again from the changed text, and the marks set by hand or from
  an opinion, named with their number, are removed. "Cancel" (the primary button) keeps the saved
  reply; "Change reply" in the question applies the change and returns to the read-only view. An emptied box
  with "Save reply" removes the reply (T291): it always asks first,
  "Remove the judge’s reply?", naming the marks that are lost; after "Remove reply" the case is "Not
  run" again, with no reply, no decisions and no added findings, and "Cancel" keeps the reply.
- **FR-057**: The system MUST keep, with every test case, the judge prompt that was composed for it
  and the reply that was received, and MUST include both in the saved test project file and in every
  exported result.
- **FR-058**: On the Test run step the user MUST be able to record **model details**: optional
  multi-line free text with the parameters of the LLM that ran the judge (for example the model
  name, temperature and other settings), in any form. The tool does not read or check it. It MUST
  be stored with the result and shown in the
  report, and the Test run step MUST remind the user to run every prompt in a new conversation, so that
  one case cannot influence another.
- **FR-059**: Replies are entered one case at a time. Exporting all prompts to one file and
  importing all replies from one file are not part of this version (see Assumptions). Because
  nothing is saved automatically (FR-004), the page header MUST offer "Save test project" at all times (FR-076); the Test run step and the case window of
  Test run have no save button of their own. The system MUST show in both how many replies were not saved
  since the last "Save test project" and remind the user after every 25 of them: in the case window with
  "25 replies are not saved to a file. Close the window and press Save test project at the top." (T242).

**Step 3: Test run — resolving the differences**

- **FR-060**: Right after a reply is saved, the case window MUST show **one list of items** with
  their marks: every expected error of the case, and every additional finding (a finding that
  points at no expected error), each undecided item with its reason, together with the decisions
  of FR-062 to FR-064. The marks are: for an expected error "Found", "Not found"
  or "Ignored"; for an additional finding "False positive", "Genuine error" or "Ignored". The two
  "Issue" marks count against the judge; "Ignored" leaves the item out of every count. "Previous
  test case" and "Next case" MUST move through the cases, and the user MUST be able to limit
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
  "Found", "Not found" or "Ignored", and an additional finding "False positive", "Real
  error" or "Ignored"; "Ignored" is always available. The user MUST be able to add additional findings
  by hand ("Add finding"), for example when the tool could not read the findings from the reply,
  each with its text and, optionally, a category (from the catalog, or a new name that joins it)
  and a difficulty (obvious or subtle), shown with the finding in the case window, the Test case
  list of Results and the report, and counted in the table of additional findings of FR-070. A finding added by hand MUST have "Remove", which removes it
  with its mark; a finding read from the reply MUST NOT have one. An item
  marked "Ignored" MUST be left out of every count and listed as ignored in the report. An
  additional finding marked "Genuine error" (a true error that was not planned) is counted on its own
  (FR-066); it MUST NOT be added to the expected errors of the case (T259, which undoes T253): it stays in "Additional errors", and
  Results › Summary MUST list every such finding with its case and **Open** under "Genuine errors the test cases missed", so the
  owner sees which test cases are not complete. The user MUST be able to
  change any mark, including an automatic one. A case has no note of its own in the case window:
  the note of the run is the "Model details" box of the Test run step (a note of a case in a loaded file
  is kept and shown in the report).
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
  answered item, its mark now and the mark it will get ("E1 undecided → Found", "A1 Genuine error →
  False positive (set by hand)") with the reason and fragment, and every new finding as
  "+ new finding “…” → Genuine error". "Apply opinion" adds each new finding as a finding added by
  hand (FR-062: with "Remove", and with its category and difficulty when the opinion gives them),
  marked with the source "LLM opinion, approved by the user". "Apply opinion" is the
  user's approval: it sets the mark of every answered item, including marks set by hand and marks
  from an earlier opinion, with the source "LLM opinion, approved by the user"; items the opinion
  does not answer keep their marks, and an undecided one gets the reason "The LLM opinion gave no
  answer for this item" (shown in the window only, not stored in the file). When the
  answer is not readable JSON, or is for another case, the problem and where it is are shown under the box and "Apply opinion" is disabled. When it is readable but
  classifies none of the items and adds no finding, the window says "The opinion classifies none of the N items of
  this case. Nothing will change.", names the reason for each item, and "Apply opinion" stays
  disabled. In every such case the pasted text is kept and nothing changes. Every mark can be
  changed by hand afterwards. There is no verification prompt for several cases at once and no
  approval of several cases in one action.
- **FR-064**: Every test case MUST have a status: Not run, Awaiting verification, Pass, or Fail. A
  case awaits verification while any of its items is undecided, and a case whose reply could not
  be read awaits verification until the user presses "No more findings", because the tool cannot
  know that the reply holds no further findings. It is Pass when every expected
  error that is not ignored is "Found" and no additional finding is marked "False
  positive", otherwise Fail. The user's decision MUST be authoritative, and every decision MUST show its source:
  automatic, set by hand, or an LLM opinion approved by the user.

**Step 4: Results**

- **FR-065**: The Results step MUST have three views: Summary, Error analysis, and Test case
  list. Summary is shown first. The Results step MUST be read-only: no reply, decision, expected
  error, rule or reply mapping can be changed there; changes are made on the Test run step or the
  Judge step. The only exception is the thresholds in "Details" (FR-069). Results MUST be computed
  from the cases that are decided; while any case is not run or awaits verification the number of
  such cases MUST be shown. There is no "provisional" or "final" result, because the test cases
  can change at any time (T267). The bar of the Results step says how many cases are decided, and
  how many are not yet; its main action is always "Export HTML report". The step has no section "Report and next version".
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
  that the system needs at least 30 injected errors and 10 clean cases to give a reliable answer.
  There is no combined score.
  For a judge evaluated per case the two case-level measures (FR-067) have thresholds of their
  own, with the same defaults (case detection rate at least 80%,
  clean-case false-positive rate at most 10%); only the thresholds of the measures in use apply and
  are shown in "Details". The minimum sample is then 30 cases with expected errors and 10 clean
  cases.
- **FR-069**: Thresholds and advanced statistics MUST NOT draw attention away from the counts.
  They MUST sit in a "Details" section at the top of the Summary view, above the counts, closed by
  default (T265): the two thresholds, each with a one-sentence plain-language explanation, which
  the user can change there, with the overall result updating at once (there is no "Load check
  settings", T266), and a sentence on how much data a rate needs (at least 30 expected errors and
  10 clean cases for the overall result; a group of fewer than 10 expected errors says little,
  T268); the
  95% confidence interval of each rate, with a "borderline" note when an interval includes its
  threshold; and, as information, the share of cases with at least one false positive and the
  same share for clean cases alone. The values used MUST be stored with the result and shown in
  the report.
- **FR-070**: The Error analysis view MUST show a breakdown per category and a breakdown per
  difficulty (obvious, subtle, not set): expected errors, found, missed and the detection rate,
  shown for every group whatever its size (T268). The view MUST
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
  status and the source of its decisions. Opening a case MUST show, as three numbered parts, the case with its full judge prompt, the
  received reply, and the errors with a summary line first and then the two groups of Test run (expected and additional errors, FR-062), read-only, with "Previous case" and "Next test
  case" and "Show the issue" for each error (T256); it MUST offer no action that changes the case.
- **FR-072**: Users MUST be able to export the result as an HTML report at any time ("Export HTML
  report"). The result as JSON is the test project file of FR-073; there is no separate "Export
  JSON". While any case is not run or awaits verification, the report MUST say how many cases are not
  decided yet (not run, awaiting verification); it is not called "provisional" (T267). The HTML report MUST contain the
  three views in the same order, be readable without the tool, and print cleanly to PDF from the
  browser. The report and the test project file MUST always contain the judge set (prompt,
  reply mapping, error rules, error catalog), the full final prompts with the real input data
  filled in, the expected errors, the received replies, every decision with its source, the
  ignored items, and the overall result with the values it was based on; there is no option to
  omit them. The Help MUST state that exported files contain the user's data.
- **FR-073**: "Save test project", a button of the page header on every step (FR-076), MUST save
  the whole work to one file on the user's device at any time, also while cases are not run or
  await verification. Once the test run has started, the file holds it: every prompt, reply and
  decision. The file is also the result as JSON (FR-072): its results part is empty until
  decisions exist. "Load test project…" MUST restore the judge set and the test cases and, with
  "Load with the test run", every prompt, reply and decision exactly as saved, so that the user can
  view the result or continue the work. One file is enough to see the result and generate the
  report. An invalid file MUST be explained and MUST NOT replace the current work. After a load the
  tool MUST open the first step with unfinished work, derived from the content of the file: Judge
  when there is no judge prompt, Test cases when the test run has not started, Test run when any
  case is not run or awaits verification, and Results when every case is decided. The "what next"
  line MUST then say how far the work is (for example "12 of 20 cases decided") and offer
  "Continue", which on the Test run step opens the first case that is not run or awaits
  verification. On the Results step the line has no "Continue" (FR-065, T267).
- **FR-074**: Removed (owner trial 2026-11-15, T289): "Run again with a new judge…" is not
  offered. A changed judge is tested by loading the test project with "Load the test project only"
  (FR-076, User Story 12): the test cases, rules and categories come back without replies, the
  prompt can be changed and gets a new judge version, and the first save asks for a new file, so
  the earlier test run is never overwritten.
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
- **FR-076**: The tool MUST work with one file on the user's device: the test project (FR-020),
  which holds the test run once it has started (FR-073). The Results step has no file of its own;
  it shows the result held in the test project and generates the HTML report (FR-072). "Load test
  project…" and "Save test project as…" MUST be in the header's "More" menu. "Save test project"
  MUST be a button of the page header on every step, with the name of its file (or "no file yet")
  under it; no other screen has a save button (T242). The system MUST remember, only for the page
  session, the file it last saved to or loaded through the file picker:
  - The first "Save test project" MUST ask for a file name and folder; every later one MUST
    overwrite that same file without asking for a file again.
  - "Save test project as…" MUST save to a new file, which then becomes the remembered one.
  - After "Load with the test run" through the file picker, saving goes to the loaded file; the
    browser may ask once for permission to write to it. After "Load the test project only" the
    loaded file is not remembered, so the first save asks for a new file and the loaded test run is
    never overwritten. A file dropped onto the page is loaded but not remembered.
  - When the remembered file can no longer be written (moved, removed, or permission withdrawn), the
    system MUST say so, forget it and ask for a file again; nothing is lost from the page.
  - "New test project" and "Load demo…" forget the file.
  The name of the remembered file MUST be shown under "Save test project" in the page header. The
  tool is not released, so files of the earlier evaluation format are not read.
- **FR-077**: To help the user check the data, the case windows MUST highlight text, and every
  highlight MUST carry a number or a word as well as its color (FR-007):
  - In the case window of Test run and in the read-only case views of Test cases and Results the fields
    show no highlight of their own (T257): "Show the issue" at an error highlights its passages for a
    moment, the fragment in the judged text (found word for word, otherwise the nearest match) with the
    number of the error and, once there is a reply, its state in words and a sign, and the words of the
    source when the error has them. The card of an expected error MUST NOT show the words of the judge's
    findings that match it (the line "Judge: “…” (matches)" is removed, T347); a finding that matches no expected error is an
    additional error. Pressing a block of a finding in Judge reply marks the card of the error it matches. There is no separate list of the findings in the reply. An expected error whose fragment is not found in
    the text is listed with the note "fragment not found". A reply that is not JSON, or a judge
    evaluated per case (FR-061), is shown without finding highlights and says so in one line.
  - In the read-only view (FR-086): "Show the issue" at an
    expected error highlights its passages and scrolls them into view (T257); an
    expected error whose passage is not in the case has no "Show the issue", and its side line says "not
    found in the case"; nothing else is marked (T286). In the window that adds a case (FR-085) the
    fields are shown with no highlight until "Show the issue" (T284).
  - A field with a problem in the import summary or in a case (a missing variable, a field too
    long, a case identical to another) is marked in the warning color with the word "missing",
    "too long" or "duplicate".
  Highlights never hide the text, never change it, and meet the contrast rules of FR-007 in both
  schemes.

- **FR-078**: There MUST be no "Clone" button, on the row of a case or in its read-only view (removed
  in the owner review of 2026-11-14). A copy of a case is made by hand: "Export test cases", then "From JSON" (FR-090) in a new case, where the user changes the name and the rest
  and presses "Save case"; the copy is an ordinary new case with no link to the original. A new
  clean case is made with "Clean case" and its "Like case" (FR-083), and a new case with injected
  errors with "Case with errors" (FR-040), neither of which needs a copy. The expected errors of a saved case are corrected with "Edit expected errors" (FR-089).

- **FR-079**: Test case names MUST be unique within a test project, compared without regard to case
  and surrounding spaces. When a case is added or renamed ("Rename" at its row), an empty
  name is allowed (the tool shows "Case N") but a used name is refused with the number of the case
  that has it. An import and a loaded test project that contain a duplicate name are kept, and
  every case involved shows a warning ("The name … is also used by case #N"), which is also counted
  by the filter "With warnings"; the user resolves it with "Rename". Names do not replace
  identifiers: files refer to cases by identifier.

- **FR-080**: Removed (T286, owner decision 2026-11-15): the text of a case is not checked against its list
  of expected errors. There is no check line ("Text and list agree"), no warning about a changed place that no
  expected error covers, no mark "not in the text", no refusal of a case identical to its base, and no
  question on "Save case" about the list. What stays: the JSON check (FR-084), the card's "No fragment", and the
  side line "not found in the case" of an error whose passage is not in the case (T251). A mistake in a
  fragment is seen on Test run.

- **FR-081**: Making and changing cases is reduced to these routes: "From JSON" (FR-090); "Clean
  case" (FR-083); "Case with errors", prepared with the user's LLM (FR-040, FR-041,
  FR-085); and "Import test cases" (FR-027). The list of expected errors of a case
  always comes as a whole from its JSON or from an imported or loaded file; there is no action
  that adds, removes or edits a single expected error, and no way to edit the text of a saved case.
  The former "Describe errors again", "Compare with base", "Use selected text as fragment", typing
  the fields of a clean case by hand, generating many clean cases at once, bulk preparation of
  errors and "Edit by hand" are not offered.

- **FR-082**: Removed (clarification of 2026-11-13): there is no "No error" mark, no "Not checked"
  state and no "Mark as No error". Any clean case can be the base of a case with injected errors,
  a base is optional, and "Case with errors" is always available (FR-038, FR-040).

- **FR-083**: "Clean case" MUST open the **clean case view**, one page from top to bottom: a field "Test case name" (T239) and
  the "Like case" choice (there is no "Comment" box, T249); the full prompt for the user's LLM with "Copy prompt"; the box for the LLM's
  answer; and, in the header, "Save case" with the reason beside it while it is disabled
  (next to "Close without saving"). The optional "Like case" choice lists the existing clean cases;
  the fields of the one picked are put into the prompt as a model. The prompt MUST be rebuilt when
  the pick changes, until the user edits it (T262: the prompt can be edited before it is copied, an edited prompt is no longer
  rebuilt, and "Rebuild prompt" asks before it replaces the edit), and MUST contain the judge prompt with its variables and its
  judged text, the error catalog (so the case contains none of its errors), the
  picked case if any, and the answer format:
  one clean case in the case JSON layout (FR-031) with a value for every variable and no expected
  errors. The answer MUST be checked as soon as it is pasted and whenever it changes (FR-084)
  against the structure the judge needs: one case, a non-empty value for every variable of the
  judge prompt, no expected errors, and no field over the length limit (FR-037); an answer with
  expected errors is a problem, and the note under the box points to "From JSON", which accepts
  it; a field the prompt does not use is named as a warning, and the other keys are treated as FR-031 says. When the answer is right, its fields are shown read-only and "Save case"
  is enabled: it saves the case under the typed name (or the answer's name when the box is empty)
  and closes the window. When it is wrong, "Save case" is disabled and
  the problems are shown under the box.

- **FR-084**: Wherever the user pastes text that the tool reads (the sample reply, the answer for a
  clean case, the JSON of a case, the judge's reply, an LLM opinion), every problem MUST be shown
  directly under the box together with where it is: the line and column for text that is not
  readable JSON (the judge's reply says "This is not JSON" first), and the path of the field (for example `fields.summary`, `expected_errors[2].description`)
  for a missing, unknown, empty or too long field. The pasted text MUST be kept, and nothing that
  was already saved is changed by a wrong paste.
  When the whole text of the box is valid JSON after a paste, the box MUST show it at once with new
  lines and an indent of 2 spaces (T292); text that is not valid JSON, and JSON inside a code fence or
  with other text around it, stays as pasted, so that the line and column of a problem point at the
  user's text. Typing is never reformatted. A judge's reply that is valid JSON is stored formatted (the
  same data, other spaces), whether it comes from the box or from "Paste reply"; the same data in other
  spaces counts as the reply already saved.

- **FR-085**: The test case window MUST be **one vertical page** for every way of adding a case (a
  clean case, "From JSON", "Edit expected errors" and a case with injected errors): the parts
  follow one another from top to bottom, there are no two columns and no "Next" or "Back", and the
  parts are numbered from 1 in each window. The header holds the title, the save button
  ("Save case", or "Save case" for a clean case) and "Close without saving", in that order; the
  reason MUST stand beside the save button while it is disabled ("Paste the answer
  of your LLM to save.", "Fix the problems listed under the JSON to save."). For a case with
  injected errors the parts are: (1) the base, (2) the errors to prepare, (3) the prompt, (4) the
  box for the LLM's JSON, (5) the **list of expected errors**. Part 5 shows the name, the kind and the
  base of the case ("Base: 4 (name)"), and the expected errors read-only (number,
  category, difficulty, fragment, description); there is no check of the text against the list (FR-080). Under the name, kind and base part 5 shows the fields of the case, with no highlight until the user presses
  **Show the issue** on an error (the shared error component, as in "Open" and on Test run, FR-086): the
  passages of that error are then marked and brought into view; an error whose passage is not in the case has no "Show the issue" (T284). The list MUST NOT be editable:
  the user changes the JSON, and every change MUST show at once in the list. While the JSON is
  invalid there is no list, only a line saying so, the problems are under the box (FR-084), and
  "Save case" is disabled. A JSON with no expected errors says "No expected errors: this will be
  saved as a clean case." "Save case" (enabled only while the JSON is valid; it asks nothing about the list) and "Close without saving" MUST be available at all times.

- **FR-086**: "Open" MUST show a saved case **read-only**, in its own layout (it is not part of
  the page of FR-085): name, fields with highlighted fragments, the list of expected errors with
  "Show the issue", "Show prompt" (a dialog with the whole composed prompt and only "Close")
  with "Copy prompt" (FR-048), with "Previous case" and "Next case". It does not show a
  reply: a reply belongs to Test run. Its sections are in frames. Nothing in it can be edited. There is
  no "Show JSON" and no "Copy JSON" (T238). "Show prompt" opens a dialog of about 90% of the screen in
  both directions. There is no "Recreate the test case" (T262): a similar case is made with "Add test case…" › "Case
  with errors", which can start from a case with errors (FR-040), or "Clean case" with "Like case" (FR-083). A case saved from those
  windows keeps the prompt that was in the box as `generation_prompt`, which is not part of the test cases version.
  The view MUST NOT offer "Clone" (FR-078); it offers, for every case, "Edit expected errors" (FR-089).

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
  hints open on demand. The step MUST NOT show a welcome section; saving is done with the buttons of the page header (FR-076).

- **FR-089**: The read-only view of every case, whether or not the test run has started and
  whether or not the case has a reply, MUST offer "Edit expected errors" (T254). It opens the standard large dialog with the JSON of the
  list of the expected errors of that case only, each with its `id`; the name, the base and the fields cannot change there (they are not in the JSON). The JSON is checked as
   it changes (FR-041, FR-084); there is no check of the text against the list (FR-080); "Save expected errors" is disabled with the reason beside it while there is a problem or nothing changed. An error that keeps its
  `id` and its words keeps its mark; an error without `id` is a new one and gets the next free identifier. Saving gives a new test cases version; after the first reply the
  case is marked "corrected". For a case with a reply "Save" asks first: the marks set by hand or by an opinion for the changed and removed errors are dropped, the case is marked again from
  the reply. The question names the dropped marks only when there are some ("2 marks you set … are dropped"); with none it says only that the case is marked again from the reply (T287).

- **FR-090**: "From JSON" MUST open the page of FR-085 with only the JSON box of FR-041 and the list of expected errors under it, for a case JSON the user
  already has (prepared elsewhere, or exported). The checks of FR-041 and
  FR-084 apply, except that the JSON may hold no expected errors; a `base` that names an existing
  clean case is used as the base, otherwise the case has none. The window names the kind the case
  will have: a clean case when it has no expected errors, a case with injected errors when it has at
  least one. "Save case" saves it as that kind.

- **FR-091**: The interface MUST look like a calm, plain work tool (UI redesign 2026-11-16). The look comes from type,
  alignment, spacing and proportion, not from decoration. Every color, space, radius and shadow MUST come from the
  tokens of FR-007 and the plan. The rules: surfaces are flat, with a thin border; a shadow is used only on dialogs and
  menus, and it is light. There are two corner radii, a small one for controls and a larger one for cards and dialogs,
  the same for every element of a kind. Spaces come from one scale in steps of 4 px. A page has at most three levels of
  heading, counted by their look: an h4 or h5 stays in the HTML but looks like an h3 or a small label; the name of the view and the current task are the most visible, and statuses and help text are smaller but
  meet 4.5:1. Buttons of the same size have the same height and gap. In one context only the main action is a primary
  button; the others are secondary. Colored surfaces and frames are few, so that prompts, JSON, errors and decisions get
  the attention. Gradients, gold accents, heavy shadows, large radii and large empty areas are not used.
- **FR-092**: The layout MUST work at four sizes: 1440 × 900, 1280 × 720, a tablet about 768 px wide and a phone 360
  to 430 px wide (UI redesign 2026-11-16). The page header is one compact row: the tool name and the name of the
  test project (`dataset.name`), the save indicator with the file name ("no file yet" before the first save), "Save
  test project", "More" and "Help". The four steps (Judge, Test cases, Test run,
  Results) are all visible on a wide screen and scroll sideways on a narrow one. The main content and the case window
  are at most 1600 px wide; paragraphs of text are at most about 72 characters wide; tables and JSON use the full
  width. Below 760 px every two-column layout becomes one column. A table that does not fit scrolls sideways in its
  own frame, never the page. Buttons, error messages, the save indicator and case names MUST never be cut off: they
  wrap. The page scrolls as a whole; a JSON box or a card has no scroll area of its own unless its function needs one
  (a long editor in a dialog). The header of the case window stays visible while the page scrolls. It holds the case
  name and number, "Previous case", the position ("case 7 of 20"), "Next case", the box "Only cases awaiting
  verification", the count of replies not saved to a file and "Close".
- **FR-093**: Each view MUST keep all its functions and show them in this order (UI redesign 2026-11-16):
  - **Judge**: the prompt and its variables, the choice of the judged text, the sample reply, the table of fields
    found, the rules with their conditions and the preview of findings. The rules and the preview are in one work area,
    so that a change of a rule is seen in the preview without scrolling at 1280 × 720.
  - **Test cases**: one table with its filters, search and row actions; "Error categories" is collapsed by default when
    the project has cases; "Add test case" keeps "From JSON", "Clean case" and "Case with errors". In the window of a
    case the order of work is: the form, the JSON editor, the preview and the list of expected errors; the editor
    grows with its text, so the user does not scroll a small box inside the page.
  - **Test run**: the table of cases uses the full width of the content, with its counts, its filters ("All cases",
    "Awaiting verification first", "Only awaiting verification"), "Add test case…" and the status of each case as a
    word with a symbol. The four counts of T263 stay apart.
  - **Case window**: the three parts of FR-055.
  - **Results**: "Summary", "Error analysis" and "Test case list" with their measures, statuses, thresholds, the HTML
    report and "Open". Numbers in tables are right-aligned, and the overall result is the most visible line.
  - **Dialogs**: the title, the context, the content or editor, the errors or preview, then the buttons ("Cancel"
    first, the main action last). In the load question of a test project with a test run the order is "Cancel", "Load
    the test project only", "Load with the test run", and "Load with the test run" is the main action. On a small
    screen the content scrolls inside the dialog and the buttons stay visible.
- **FR-094**: Every control MUST be usable from the keyboard, with a focus ring that is always visible and meets 3:1
  against its background, and every control and region MUST have a label that says what it is (UI redesign
  2026-11-16). Motion (scrolling to a passage, a strong mark that fades) MUST be instant when the user asks for reduced
  motion. A state (Pass, Awaiting verification, Fail, Not run, a mark of an error) MUST be shown by a word or an icon as
  well as a color.

### Key Entities

- **Test Project** (formerly "test set"; also replaces "dataset"): the user's whole test, saved and
  loaded as one file and used again for every run of the same test. It holds the judge set, the
  error catalog, the test cases with their name and version, the active metric with its parameters
  and the thresholds. Once the test run has started it also holds the test run: replies, decisions and model details.
- **Judge Set**: Everything on the Judge step, saved inside the test project file: the judge prompt,
  the sample reply with its reply mapping and the error rules. Has a version identity.
- **Judge Prompt**: The prompt under test, used exactly as written. Only the prompt comes from
  outside; everything else is built in the tool.
- **Judged Text**: The variable the user marks as the output the judge evaluates. Errors are
  always injected into it, and expected errors concern it.
- **Variable** (formerly "placeholder"): A name written as `{{name}}` in the judge prompt. Any
  name is allowed. Each variable is one field of every test case.
- **Reply Mapping**: The recognized structure of the judge's own JSON reply, taken from one
  sample reply: its fields with their paths, and per list the field a rule points at by default. It
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
  their content. Cases can be added, renamed and removed before the start of the test run; afterwards they
  can still be added, and a case without a reply can still be renamed and removed; a saved case's fields are never edited, and after the start only the
  expected errors of a case without a reply can be corrected.
- **Test Case**: One input to be judged, with a unique identifier, a name, one field per
  variable, zero or more expected errors, and, when it was made from a clean base case, a
  reference to it. Its name is unique within the test project (FR-079). The final prompt is derived from the judge prompt and the fields.
- **Expected Error**: What the judge should find in the judged text of a case: a category, an
  optional fragment, a description, and an optional difficulty (obvious or subtle).
- **Case JSON**: One test case written in the one JSON layout of FR-031 (name, fields, expected
  errors, and optionally base). It is what the user's LLM
  returns, what is pasted and edited when a case with injected errors is made, and what "Export
  test cases" writes. Until saved it is a
  proposal for the user to review.
- **Import Summary**: The report shown after reading a file or a pasted answer: counts, invalid
  rows with reasons, and the user's choice on how to proceed.
- **Test Cases Summary**: The overview shown while building and before the start of the test run: counts, balance,
  test size against its minimums, and warnings.
- **Received Reply**: The text the judge produced for one case, pasted by the user in any format
  and kept with the judge prompt that produced it.
- **Finding**: A part of the judge's reply (or the whole reply) for which at least one error rule
  holds; its text is the place it points at.
- **Additional Finding** (formerly "unexpected finding"): A finding that points at no expected
  error of the case. The user marks it "False positive", "Genuine error" or "Ignored". One added
  by hand may have a category and a difficulty, and can be removed.
- **Decision** (mark): What was settled for one expected error ("Found", "Not found",
  "Ignored") or one additional finding ("False positive", "Genuine error", "Ignored"), with its
  source: automatic, set by hand, or an LLM opinion approved by the user.
- **Verification Opinion**: An external LLM's JSON assessment of one case, with a short reason
  and a fragment for each item, pasted back by the user in the second-opinion window. It changes
  nothing until the user applies it after seeing the preview of every change; it then sets the
  marks of the items it answers.
- **Case Status**: Not run, Awaiting verification, Pass or Fail, derived from the decisions.
- **Test Run Result**: The counts and measures for one judge version on one test cases version,
  together with everything needed to reproduce it. Saved and loaded as one file.
- **Overall Result**: The one-line conclusion for the evaluated judge (Works, Does not work,
  Inconclusive), with the thresholds, the minimum sample and the reason it was based on.
- **Metric Definition**: A loadable file that describes one kind of judge evaluation: a complete
  starter judge set, the matching parameters and the measures computed from the counts. Thresholds
  are kept with the test project (FR-020, FR-069).

## Success Criteria *(mandatory)*

### Measurable Outcomes

**Evaluating a judge**

- **SC-001**: A first-time user can go from opening the tool with demo data to seeing the counts
  of found and missed errors, the two rates and the overall result in a single session of under
  15 minutes.
- **SC-002**: A user can run one test case (open its window or move to it, copy the prompt, paste
  the reply from the clipboard) with no more than 3 deliberate actions inside the tool.
- **SC-003**: 100% of saved test project files with a test run can be loaded in a fresh session and show identical
  numbers, judge version and test cases.
- **SC-004**: 100% of invalid files (test projects, test-case files) are
  rejected with a message that tells the user what to fix.
- **SC-005**: Adding a new measure requires only loading one definition file, with no change
  to any other part of the tool.
- **SC-006**: The tool is fully usable with no account, server or database, and no user data
  leaves the device unless exported.
- **SC-007**: Every test case shows an unambiguous status (Pass, Fail, Awaiting verification, Not run) in the test case list.
- **SC-008**: A result can be exported as an HTML report that a person without the tool can read, and the test project file that holds it as JSON can be loaded again with identical content.
- **SC-009**: 100% of test runs show exactly one overall result (Works, Does not work, or Inconclusive) together with the reason, on the Results step and in the report.
- **SC-010**: A first-time user can say how many expected errors the judge found and missed, and how many false positives it reported, within 30 seconds of opening the Results step.

**Setting up the judge**

- **SC-011**: 100% of the variables written as `{{name}}` in a judge prompt are detected, whatever
  their names, and no field is shown that the prompt does not use.
- **SC-012**: A user can go from a pasted sample reply to a working rule with two conditions in
  under 3 minutes, without reading documentation.
- **SC-013**: A test project saved and loaded again has identical content in 100% of cases: prompt,
  reply mapping, rules, catalog and test cases (clean base cases included).
- **SC-014**: 100% of rules that use a field missing from the sample reply are refused or marked
  as broken before the test run can start without a warning.

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
- **SC-021**: A first-time user can add a clean case (name, one copy of
  the prompt, one paste of the LLM's answer, "Save case") in under 2 minutes, not counting
  the time the LLM takes to answer.
- **SC-022**: A user can prepare a case with injected errors from a clean base case in under
  3 minutes, not counting the time the LLM takes, with a single copy and a single paste and no
  re-typing of the LLM's answer.
- **SC-023**: 100% of cases with injected errors carry a description of every expected error and,
  when a base case was picked, a reference to it, and in 100% of them every expected error without a
  category or a fragment says so on its card.
- **SC-024**: 100% of attempts to save an invalid case (empty text, an expected error without a
  description) are refused with a message the user can act on.
- **SC-025**: A user building a one-sided test project (only clean or only with injected errors) is warned in
  100% of cases before the start of the test run.
- **SC-026**: At least 90% of first-time users complete a small test project (5 cases, mixed) using
  only the in-tool help.

**Verifying and saving**

- **SC-027**: 100% of decisions shown in the results and the report carry their source
  (automatic, set by hand, or LLM opinion approved by the user).
- **SC-028**: No item counts in the results on the strength of an LLM opinion alone: in 100% of
  cases an opinion changes marks only when the user presses "Apply opinion" after its preview has
  listed every change.
- **SC-029**: A test run saved part-way and loaded in a later session has identical content in
  100% of cases, and the user can continue within 1 minute of choosing the file.
- **SC-030**: A user can move from one test case to the next on Test run, or in the read-only view of
  a case, with a single action. On a screen of 1280 x 720 pixels or larger the header of the window,
  the case name and the start of part 1 are in view without scrolling. The rest of the case (its
  data and prompt, or its reply and marks) is on the same page further down, and the header stays
  in view while the page scrolls (FR-092; UI redesign 2026-11-16).
- **SC-031**: A case with up to five expected errors can be read, with every expected error shown
  by "Show the issue", in the read-only view and the case window of Test run. "Show the issue" of
  each error scrolls the page to its passage, which is not hidden under the header. The list of
  expected errors has no scroll area of its own (FR-092; UI redesign 2026-11-16).
- **SC-032**: A user who has entered replies never has more than 25 replies unsaved to a file
  without having been reminded to save.
- **SC-033**: In the case window of Test run, for a case with up to five expected errors whose
  fragments occur in the judged text, 100% of the fragments can be shown with "Show the issue",
  every finding in a JSON reply is listed in "Errors" as matching, partly matching or matching no
  expected error, and 100% of those findings mark their whole JSON object in the reply, with no
  label in the reply (UI redesign 2026-11-16).

- **SC-034**: A case like a saved one is made in at most four actions besides changing its JSON ("Export test cases",
  "Add test case…", "From JSON", "Save case"), and no two test cases share a name unless an import or a
  loaded file made it so, in which case both cases show the warning.

- **SC-035**: Apart from choosing the wanted errors, a user makes a case with injected errors from a
  clean base case in at most three presses (the base, if any, "Copy prompt", "Save case")
  plus one paste.

- **SC-036**: In 100% of cases, the JSON that "Export test cases" writes, pasted into a new case of the same
  kind, gives a case with the same fields and expected errors, and with the same base when the
  same base case is picked.

- **SC-037**: 100% of problems in a pasted sample reply, clean case answer, case JSON or judge reply
  are shown under the box with their line and column or their field path, and the pasted text is
  never lost.

- **SC-038**: The Judge step shows no more than three kinds of button of its own ("Add rule", "Add
  condition", "Remove") plus the one action of the "what next" line; saving is done only with the two buttons of the page header.

- **SC-039**: In 100% of cases with a JSON reply, every expected error of the case has a mark or the
  reason it is undecided right after the reply is saved, and every finding that matches no expected
  error is in the list as an additional finding.

**UI redesign (2026-11-16)**

- **SC-040**: After the redesign, 100% of the steps, actions and labels of FR-008 are still present, with the same
  names, the same order of buttons and the same effects; the end-to-end scenarios pass with no change of what they check.
- **SC-041**: At 1440 × 900 the main content and the case window are wider than 1280 px, and at 1280 × 720, 768 px and
  360 px no page scrolls sideways; below 760 px every two-column layout is one column.
- **SC-042**: In the case window, at every size of FR-092, the header with "Previous case", the position, "Next case",
  the box "Only cases awaiting verification", the count of unsaved replies and "Close" stays visible while the page
  scrolls, and "Previous case" and "Next case" work from the keyboard.
- **SC-043**: For a JSON reply, 100% of the findings made by rules mark their whole JSON object (every line from its
  opening to its closing brace), and the reply shows no "F" label, rule name, category or error description.
- **SC-044**: A reply kept as text, and JSON that no rule turned into a finding, have no mark in 100% of cases.
- **SC-045**: In 100% of cases "Show the issue" scrolls to the passage in the fields of the case and marks the whole
  JSON object of the linked finding until another item is pointed at.
- **SC-046**: The JSON checks and their messages, the statuses, the decisions, the confirmations, "Second opinion…" and
  every number of Results are the same before and after the redesign for the demo and the example files.
- **SC-047**: Every control is reachable with Tab and shows a visible focus; 100% of text meets 4.5:1 in both schemes;
  tables and dialogs at 360 px show every column name, message and button without cutting text.

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
- Version 1 handles one judge and one test project per test run; batch management of many judges
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

- The results always show two overall measures: detection rate and false-positive rate. No
  metric is built in. A new test project starts with the default metric file, Accuracy (judge
  prompt, sample reply, reply mapping, error rules, error catalog and a few clean cases), which
  works like any metric the user loads; each metric is tested in its own test run; other kinds of
  judges (Completeness, Bias, Reliance and so on) are typed or loaded by the user. Further
  measures built from the same counts can be loaded from metric definition files; measures that
  need other inputs (agreement with human ratings, stability across repeated runs) are out of scope
  for this version.
- The default Accuracy file initially has the categories: factual-error, contradiction, wrong-number,
  unsupported-claim, and misattribution. Each category has a description and an example; exact sets
  are refined in planning.
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
  changed in the "Details" section of the Results step. The minimum
  test size (30 injected errors, 10 clean cases) is fixed in the tool.
- A result describes one judge prompt run on one model. The tool measures only the kinds of errors
  present in the test data: a high detection rate says nothing about kinds of errors that were
  never injected, and the Help says so.

**Test projects and files**

- Test cases reach the test project from files, from a ready example, or from the test case window;
  all routes build the same test project, whose judge prompt is editable until the test run starts and
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
  sessions. Saving to a file on the user's device is the only way to keep work. One file covers
  it, remembered and overwritten by "Save test project" (FR-076): the test project (the judge set
  with the test cases and, once it has started, the test run with every prompt, reply, decision and
  the results). The results have no file of their own; the HTML report is generated from the test
  run.
- Help requirements are unchanged by the review of prototype v7. Help content is updated together
  with the features it describes, before the first public release.
- Exported reports and result files are plain files on the user's device and may contain sensitive
  data from the user's test cases; protecting or sharing them is the user's responsibility.
