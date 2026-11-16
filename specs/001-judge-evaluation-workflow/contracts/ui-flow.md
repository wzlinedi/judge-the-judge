# Contract: Screens and Flow

**Date**: 2026-11-13, layout updated 2026-11-16 | **Plan**: [../plan.md](../plan.md) | **Spec**: FR-001, FR-007, FR-008, Principle VII

What each screen is for, its one primary action, when it is available, and the states it must
design for. Action names in **bold** are fixed by FR-008 and are used exactly as written; all
interface text is English. Prototype v17 (`prototypes/ui-prototype-v17`) shows this flow; where
it differs from this contract or the spec, the spec wins. Supported browsers: current Google
Chrome and Microsoft Edge (FR-003).

## Shell

- **The standard large dialog** (T247): about 90% of the screen in both directions, the content
  scrolling inside it, its buttons in a bar at the bottom. Every "Show prompt",
  "Second opinion…" and "Edit expected errors" use it. A short question keeps the small dialog.

- A header with the tool name and, on the same line, **Save test project**, the
  **More** menu and **Help** (T246); under it the four numbered steps as a progress bar. The **More**
  menu always opens inside the screen (it is aligned to the right edge of its button and scrolls when
  it is taller than the screen).
  The current step and how far the user has got are always visible.
- **The header holds the one save button** (FR-076, T242, T289). It shows the one indicator of
  unsaved changes ("Unsaved changes", or "All changes saved · books.json" with the file name, or
  "no file yet" before the first save; FR-051, FR-092), **Save test project** (since the UI redesign
  of 2026-11-16 the file name is in the indicator, not under the button), and a **More** menu holding
  **Load test project…**, **Save test project as…**, **Import test cases…**, **Export test
  cases…**, **Load demo…** and **New test project**. No other screen has a save button.
- **Load demo…** loads the demo (a test project of book summaries with a test run in progress) at
  once, with its test run, with no window and no load question, and opens the Judge step (FR-019). There is no list of examples and no **Load metric definition…**: a metric
  that is not built in travels in `metric.definition` of the test project file
  (FR-008, FR-019, FR-026).
- **Saving the one file** (FR-076): the first **Save test project** asks for a file name and
  folder; later ones overwrite that file without asking; **Save test project as…** picks a new
  file. After **Load with the test run** through the picker, saving goes to the loaded file (the
  browser may ask once for permission to write). After **Load the test project only** the loaded
  file is not remembered, so the first save asks for a new file and the loaded test run is never
  overwritten. A file dropped onto the page is not remembered. **New test project** and **Load
  demo…** forget the file. The test project file alone is enough to show Results and generate the
  report.
- **The indicator** clears after **Save test project** and **Save test project as…** (FR-051).
- **Replacing work** (FR-051): before a load, **New test project** and **Load demo…**, when there
  are unsaved changes, one warning offers **Save test project first**, **Discard** and **Cancel**.
  Leaving or reloading the page with unsaved changes triggers the browser's own warning.
- **The load question** (FR-020, T289): after the file is picked and validated, a file with a
  test run asks, in a small dialog "Load test project", **Load with the test run** (the work comes
  back as saved), **Load the test project only** (no replies, decisions or model details; the
  test run has not started, so the prompt can be changed; the file is not remembered) and
  **Cancel** (nothing changes). A file without a test run loads at once. A dropped file gets the
  same question.
- **The "what next" line** (FR-001) sits under the steps on every step: one sentence saying what
  is still missing or what to do next, an optional second line with counts, and the one primary
  action of the step. There is no welcome section. Explanations longer than one sentence are not
  on step screens; each section has a small **Explain** control that opens its explanation on
  demand.
- **After a load** (**Load test project…**, but not **Load demo…**, which opens Judge) the tool
  opens the first step with unfinished work: Judge with no prompt, Test cases when the test run has
  not started, Test run when any case is not run or awaits verification, otherwise Results. The
  "what next" line says how far the work is ("12 of 20 cases decided") and offers **Continue**,
  which on Test run opens the
  first case awaiting verification, else the first case without a reply (FR-073); on Results there
  is no **Continue** (FR-065, T267).
- **No menus in rows or windows** (FR-008): a table row shows its actions as visible buttons, and
  no window holds a "More actions" section.
- After **Start test run**, the "what next" line of Judge and Test cases says what is fixed and
  what can still be changed. There is no way back to before the start (FR-053, T288).
- A footer with the tool version and the statement that data stays on this device.

| Step | Available when | Primary action in the "what next" line |
|---|---|---|
| 1 Judge | Always | **Next: Test cases** once the judge is complete; **Continue** after the start |
| 2 Test cases | Always (useful once the prompt has variables) | **Start test run** before the start (T288: the "what next" line sits at the top of the step; disabled while there are no cases, with a sentence pointing to **Add test case** above the list); **Continue** after it |
| 3 Test run | Always; before the start its actions are disabled with the reason "Start the test run first" | **Continue** (opens the next case to work on); **Next: Results** when all are decided |
| 4 Results | Always; before the first reply it says that nothing is run yet | **Export HTML report** (no **Continue**, T267; no other action, T289) |

The user can always go back to an earlier step to look. A step that is not yet available shows one
sentence saying what is needed first and a button that leads there. There is no Verify step, no
Compare step and no result shelf.

## Step 1: Judge

- **Purpose**: say what is being tested and how its replies are read. Everything here is the
  judge set, saved inside the test project file.
- **Buttons of the step** (FR-088, SC-038): **Add rule** (with **Add condition** and **Remove**
  inside each rule) and the one action of the "what next" line. After the start of the test run,
  also **Load test project…** in the lock notice of the prompt (FR-053). Nothing else.
- **Sections, in order**:
  1. **Judge prompt**: the editor; under it the detected variables, a choice of the variable that
     is the **judged text** (the last one proposed, FR-010), and the judge version.
  2. **Sample reply and its fields**: a box for one reply, read as soon as it is pasted or
     changed (no read button); a problem is shown under the box with its line and column, and the
     fields of the last readable sample stay. Then a table of fields (path, kind, values seen) with a
     line saying that the values are examples from the sample, not a closed list. There is no choice
     of the text of a finding here: it is made in each rule (T232).
  3. **Error rules**: **Add rule**; per rule its name, "all of these hold" or "any of these
     holds", and conditions (field from the recognized list, comparison, value as free text with the
     values seen offered as suggestions and a line beside the box: "Any value; it is kept as you type
     it"), each removable with **Remove**; a condition just added without a value shows "Condition N:
     type a value" beside it and the rule says it is not used until every condition has a value; for a
     rule about a list, **Where the error is in rule N**: a choice of the text field of the items of
     that list, proposed automatically and changeable, shown only when the items have more than one text field to choose from (a rule about the whole reply has none); under the rules a live preview of which parts
     of the sample are findings and by which rule; while no rule is usable the preview still lists the parts of the sample as "No finding" and says for each rule why it is not used (no value yet, or broken with the reason), never a bare "no rule can be used". When every rule uses only fields outside any
     list, a note says that the judge is evaluated per case (FR-061).
- There is no error catalog and no clean case section on this step.
- **States**: empty (the "what next" line names what is missing; examples are loaded from the
  More menu); prompt with no variables (warning); judged-text variable removed (the last variable
  proposed again, with a note); sample that cannot be read (line and column, text kept, fields
  unchanged); broken rule (marked, with the missing field named; a condition without a value yet is
  "unfinished", not broken); replies not readable
  automatically (warning naming what is missing); invalid file (message, nothing replaced); after
  the start of the test run (prompt and judged text locked, with the reason "The test run has
  started, so the prompt is fixed. To test another prompt, load the test project with "Load the
  test project only"." and **Load test project…** beside it; sample, finding text and rules still
  editable; FR-053, T288).

## Step 2: Test cases

- **Purpose**: build the test data and start the test run.
- **Sections, in order** (FR-087):
  1. **Error categories**, collapsible by a click on its heading (also from the keyboard). Open
     while the test project has no test cases; collapsed when a test project with cases is loaded
     or the step is first opened with cases; collapsed, its heading says "N categories"; the state
     the user chooses is kept for the page session. A table, one row per category: **Name**,
     **Description & examples** (one multi-line text edited in the cell; it takes the room that is
     left), **Used by** (the number of test cases, computed from the cases), then **Rename** (asks
     first, in plain text above the buttons: "N expected errors in M test cases get the new name", the test cases version changes and the error
     analysis of Results uses the new name (T294); also after the start) and **Remove** (always enabled,
     T248: at once when unused; for a category in use a small dialog "Remove category" says "N test
     cases use it. Their expected errors stay and lose the category. The test cases version
     changes." with **Cancel** and **Remove**). There is no **Example** button. Below the table:
     **Add category**, which appends one editable row (name, description and examples, **Add**,
     **Cancel**); an empty or a taken name is refused in the row (FR-015).
  2. **Test project card**: name, test cases version; counts (cases, with injected errors, clean,
     with a reply); the **test-size summary** with the sentence that at least 30 injected errors
     and 10 clean cases are needed for a reliable answer; warnings (one kind of case only,
     duplicates, replies not readable automatically, no subtle errors).
  3. **One table of all test cases**, with **Add test case** above it: identifier, name, kind
     ("Clean" or "Injected errors", with "added after first reply" or "corrected after first
     reply" when it applies), base, number of expected errors, categories, warnings, and at each
     row **Open**, **Rename** and **Remove** as buttons; a click on the row also opens
     the case. Search, filter (all kinds, clean, injected errors, with warnings, with a reply,
     without a reply) and sorting. There is no details panel and no row menu (FR-025).
- **Import summary** (after **Import test cases** in the More menu, with **Download example file**
  in its panel): found, clean, with injected errors, invalid rows with position and reason, fields
  that match no variable, variables with no field, categories missing from the catalog with a
  choice to add them; then **Import test cases** (adds the cases to those already here, also after
  the start) or **Cancel** (FR-027 to FR-030, FR-053).
- **Start test run** (FR-052, T288): a summary dialog named "Start the test run?" (counts, balance,
  test size, all warnings) and a confirmation in it that says the judge prompt and the judged text
  are then fixed, with no way back; its buttons are **Cancel** and **Start test run**. After the
  start, the test project card says "The test run has started: the judge prompt and the fields of
  every case are fixed."
- **States**: no cases yet (points to **Add test case**, the More menu and the Judge step); 500-case
  limit reached; text too long; identifier collision on import (new identifiers, said in the
  summary); name used twice (both cases show the warning); test run started (**Add test case**
  above the list and **Import test cases** stay available and new cases start as Not run; **Rename** and
  **Remove** stay enabled for every case (**Remove** of a case with a reply asks first and says its
  reply and decisions go with it); there is no way back to before the start).

### Window: the test case window

Opened by **Add test case** and **Open** (FR-038, FR-083, FR-085, FR-086, FR-089,
FR-090). It fills the screen, has a header that never scrolls and two columns that scroll on
their own. While something is being added, the header always shows **Close without saving**,
which asks first when something was pasted or typed.

- **Add test case** first offers three choices, all always available: **From JSON**, **Clean
  case** and **Case with errors**.
- **One vertical page** (FR-085): every way of adding a case is one page from top to bottom; there
  are no two columns, no **Next**, no **Back** and no "Part N of 3". The header holds only the
  title, the save button with the reason beside it while it is disabled, and **Close without saving** (Escape too); there is no bottom bar. Each part is in a frame, labels are in a left column and fields on the right, and the description of the category stands under the whole error row. The parts are numbered from 1 in each window.
- **From JSON** (FR-090): 1. the box for a case JSON (file-formats.md, section 2), checked as it
  changes, with problems under it (line and column, or field path), and **Test case name** above it (see below); 2. the expected errors,
  read-only. The window names the kind the case will have (clean without expected errors, injected
  errors with at least one); a JSON with no expected errors says "No expected errors: this will be
  saved as a clean case." **Save case** is in the header. There is no **Clone**: a copy is made with **Export test cases** and this window; a similar case with **Case with errors**, which can start from a case with errors (T262). A case saved from **Clean case** or **Case with errors** keeps the prompt in its box as `generation_prompt`.
- **Test case name** (T239), the first field of part 1 in every way of adding a case (not in **Edit expected errors**, where the name cannot change): filled with "Case N", N being the identifier the case will get; a name in the pasted JSON replaces it while the user has not typed in the field; what the user typed wins over the JSON.
- **Clean case** (FR-083): 1. **Test case name** (see below), and an optional **Like case**
  (an existing clean case whose fields go into the prompt as a model); 2. the prompt for the
  user's LLM, editable (T262), with **Copy prompt** and, once it is edited, **Rebuild prompt** (asks first; an edited prompt is no longer rebuilt); 3. the box for the LLM's answer, checked as it changes. When
  valid its fields are shown read-only and **Save case** (in the header, primary) saves and
  closes; an answer with expected errors is a problem that points to **From JSON**.
- **Case with errors**, five parts (FR-040, FR-041, FR-085):
  1. **Test case name** (see below) and the **Base case**: the optional base with its fields: a clean case, or a case with errors (T262), whose errors are then copied into part 2 and whose own clean base is the base text, said in a line under the choice; or none.
  2. **Errors to prepare**: a table in the form of the categories table (T249), one row per error,
     with the columns **Category** (from the catalog or typed as a new name; the description of the
     category under it), **Difficulty** (obvious / subtle / left to the LLM) and **Description**
     (what should be wrong), and **Remove** in each row; below it **Add error**. There is no box for
     own instructions.
  3. **Ask your LLM**: the prompt, editable (T262), with **Copy prompt** and, once it is edited, **Rebuild prompt** (asks "Rebuild the prompt?" first); an edited prompt is no longer rebuilt when parts 1 and 2 change.
  4. **Paste its answer**: the box for the JSON, checked as it changes (problems with line and column or field path).
  5. **Expected errors**: the name, kind and base ("Base: 4 (name)"), the fields of the case with no highlight, and the
     expected errors read-only (number, category, difficulty, fragment, description). **Show the issue** on an
     error marks its passages in the fields and brings them into view (T284); it is missing for an error whose passage
     is not in the case, whose side line says "not found in the case". There is no check of the text against the list (FR-080
     is removed, T286). While the JSON is invalid the list is replaced by a line saying so.
  **Save case** is in the header, enabled only while the JSON is valid; it asks nothing about the list.
- **Open** (FR-086): the case read-only (its own layout; the fields show no highlight until **Show the issue**, T257), with **Previous test
  case**, **Next case** and the position ("case 7 of 20") in the header (Alt + Left/Right do
  the same), no **Recreate the test case** (T262), no **Show JSON** or **Copy JSON**, and, on every case, **Edit expected errors**; also **Show prompt** (a dialog of about 90% of the screen with
  the whole composed prompt and only **Close**) with **Copy prompt**. No reply is shown (a reply belongs to Test run).
  Sections are in frames. A saved case is never edited.
- **Edit expected errors** (FR-089, T254): the standard large dialog with the JSON of the list of the expected errors of the case
  only (with their `id`), checked as it changes, with **Cancel** and **Save expected errors** at the bottom; **Save expected errors** is disabled with the reason beside it
  ("Fix the problems listed under the JSON to save." or "Change the JSON to save."). A case with a reply asks first
  ("Save the expected errors?": the marks of the changed and removed errors are dropped, the case is marked again from the reply, the
  test cases version changes); a case without a reply saves at once. Saving closes the dialog.
- **States**: malformed JSON (line and column, text kept); missing variable, empty field, missing
  description (field path); nothing pasted yet; name taken; test
  project full; JSON with no expected errors in a case with injected errors (saved as clean, the
  window says so); unsaved paste when closing (asks first). The window has no save action for
  the file: the test project is saved after it is closed.

## Step 3: Test run

- **Purpose**: get the judge's reply for every case and settle what it found. The step was named
  "Run" before T289.
- **Content, in order**:
  - **The judge being run**: one short summary line (judge version, test project name, test cases
    version, judged text), with no prompt or rules text; the **Model details** box (multi-line
    free text, FR-058).
  - **Progress**: replies received and cases decided out of all cases; the number of items still
    to decide; "N replies not saved to a file".
  - **One list of all cases**, with **Add test case** above it (disabled at the limit of cases; the
    "what next" line has no such button): identifier, name, kind (with "added after first reply" when it
    applies), four counts side by side (T263): **Expected errors**, **Additional findings** (the judge's
    findings that point at no expected error), **Added by hand** (with **Add finding** or an
    applied opinion) and **Items to decide**, each 0 before the reply; status (Not run, Awaiting
    verification, Pass, Fail, each with a word and a sign, never color alone), and **Open**; a choice "all
    cases" / "awaiting verification first" / "only awaiting verification".
- **Reminder**: after every 25 replies saved since the last "Save test project", a message asks
  the user to save, with **Save test project** in it.
- **States**: test run not started (the step shows its content with every action disabled, each
  with the reason "Start the test run first" beside it, FR-053); all cases decided (points to
  Results).

### Window: the case window of Test run

Opened by **Open** (FR-055, FR-060).

- **Fills the screen.** A header that never scrolls holds, in this order (FR-092, UI redesign
  2026-11-16): the case name with its identifier, **Previous case**, the position ("case 7 of 20"),
  **Next case**, the checkbox "only cases awaiting verification", "N not saved" (with the reminder
  from 25: "Close the window and press Save test project at the top"), **Close**. The names of the
  items do not change.
  Alt + Left and Alt + Right do the same as the two buttons. The status is in part 2.
- **One vertical page of three numbered parts** (the same page layout as the test case window;
  Owner review 2026-11-14, Case window of Run). The page scrolls as a whole.

| Part | Content |
|---|---|
| **1. Case** | Kind and base; the fields of the case in two columns from 760 px, the judged field on the right and the others stacked on the left (one field takes the full width; below 760 px the judged field comes last), with no highlight until **Show the issue** (T257), which highlights the passages of that error for a moment with its number (and, after a reply, found, missed, undecided or ignored); then **Show prompt** (a dialog with the whole prompt and only **Close**) and **Copy prompt** (primary until pressed). |
| **2. Marking** | One row: **Add finding** (text, optional category, optional difficulty), **Second opinion…**, the meter "Marked N of M" and the status of the case (Awaiting verification, Pass, Fail). **Without a reply** the two buttons are disabled with the reason "Paste the judge’s reply first" beside them (T290); the meter is not shown. There is no **Approve**. |
| **3. Judge reply and errors** | Two columns of the same width (stacked below 760 px). **Left, "Judge reply"**: for a case without a reply the box, checked as it changes with line and column, and **Paste reply** below it (primary once **Copy prompt** was pressed); a reply that is readable JSON is saved as soon as it is in the box (typed or pasted); text that is not JSON shows "This is not JSON" with the line and column, and **Keep as text** (primary) keeps it. For a case with a saved reply (T293) the reply is shown **read-only**, as it is kept (formatted when it is JSON, T292), not in a box: each JSON object that an error rule turned into a finding, found by `locateFinding` (`src/core/judge/locate-finding.ts`), has a light background and a thin line at its left, from its opening to its closing brace, with no label, rule name, category or description (T311; UI redesign 2026-11-16, FR-055); a reply kept as text and JSON that no rule read have no mark. Pressing a marked object marks its finding on the right, and pressing a finding on the right, or **Show the issue**, scrolls to its object and marks it strongly until another item is pointed at. Under the view: **Change reply** and **Paste reply**. **Change reply** turns the view into the box with **Save reply** (primary) and **Cancel**: typing saves nothing; **Save reply** asks "Change the judge’s reply?" when the text changed (an emptied box asks "Remove the judge’s reply?", T291) and then returns to the read-only view; **Cancel** drops the edits. **Paste reply** over a saved reply asks the same question and then saves at once. **Right, "Errors"**: without a reply the expected errors of the case at once, each by the shared error component with **Show the issue** but with no marks and no "Judge: …" line, and the line "The judge’s findings and the marks appear when its reply is saved." ("No expected errors." for a clean case; T264); with a reply, for a reply that cannot be read the message with the reason and, next to it, **No more findings** (primary while the case awaits verification; it confirms that the findings added by hand are all); for a judge evaluated per case one line saying so; two groups (T252), each item shown by the shared error component (below): **Expected errors**, each with the words of the judge that match it ("F1 · Judge: “…” (matches)" or "(partly matches)", T258, T293) and its marks (**Found**, **Not found**, **Ignored**), the reason for anything undecided and the source of every mark; **Additional errors**, each with its marks (**Genuine error**, **False positive**, **Ignored**; a finding with no text has no passage and no **Show the issue**); a finding added by hand or by an applied opinion shows its category and difficulty and has **Remove**. There is no list "Findings in the reply" (T258). |

- **The shared error component** (T251) shows an error the same way in Test cases (Open and the
  windows for adding a case), in Test run and in Results: its number (E1 …) for an expected error, what is
  wrong, a quiet line with the category, the difficulty and the rule, then one line per side with
  the name of the field before the passage: the words of the source first (`source_fragment`, looked
  for in the fields other than the judged text), then the words of the judged text (`fragment`, or
  the text of a finding of the judge). The names are those of the fields of the case, so they follow
  the variables and the judged text set on Judge. A passage that is in no field says "not found in
  the case". **Show the issue** is offered when a passage is in the case: it scrolls to the fields,
  puts the focus on the passage of the judged text and highlights both passages strongly for a
  moment.
- A decision made in the window takes effect at once and the window stays open.
- **Genuine error** (T259) leaves the finding in "Additional errors"; nothing is added to the expected errors of the case. Results › Summary lists every genuine error with its case and **Open** ("Genuine errors the test cases missed"); adding one to the case is done with Test cases › Open › Edit expected errors.
- A new reply resets the case: its decisions, the added findings included, are removed and the
  automatic marks are computed again (FR-056). Running one case takes three actions: **Open** or
  **Next case**, **Copy prompt**, **Paste reply** (SC-002).
- **States**: first or last case (the matching button is disabled); changed but unsaved reply in
  the box when moving or closing (asks first); empty clipboard (says so, nothing changes);
  clipboard not readable (says so and points to the box); a change of a saved reply
  (**Save reply** after **Change reply**, or **Paste reply**) asks "Change the judge’s reply?", naming the marks set by hand or from an opinion that are removed; **Cancel** keeps the reply,
  **Change reply** applies the change and returns to the read-only view (T261, T293); an emptied box asks "Remove the judge’s reply?" and, on **Remove reply**, makes the case Not run again (T291);
  reply that cannot be read (kept, line and column shown, nothing marked automatically, the case
  needs **No more findings** after the findings are added by hand).

### Window: Second opinion

Opened by **Second opinion…** in the case window of a case with a reply (FR-063). A dialog, not a
collapsed section, for that case only.

- One line: "The LLM checks N expected errors and M additional findings of this case."
- **1 · Prompt for your LLM**: the verification prompt, read-only, with **Copy prompt**.
- **2 · Paste your LLM's answer**: one box, checked as it changes.
- **3 · What will change**: a preview of every change: "E1 undecided → Found" with the LLM's reason
  and fragment, "replaces a mark set by hand" when it does, "+ new finding “…” → Genuine error" for a
  finding the reply contains that is not in the list, "no change" for answers that agree with the
  current mark, and "No answer" for items the opinion does not answer.
- **Apply opinion** (primary) and **Cancel**, pinned to the bottom of the dialog. Applying sets the
  marks of every answered item (marks set by hand included) with the source "LLM opinion,
  approved by the user", adds the new findings as added findings with **Remove**, gives an
  unanswered undecided item the reason "The LLM opinion gave no answer for this item", and
  approves the case. Every mark can still be changed by hand afterwards.
- **States**: nothing pasted (Apply disabled); not readable JSON (line and column; Apply
  disabled); opinion for another case or with several opinions (refused with the reason); readable
  but classifies none of the items and adds no finding ("The opinion classifies none of the N items
  of this case. Nothing will change.", with the reason per item; Apply disabled); partial (only the
  answered items change); agrees with every mark (nothing to apply). In every refused state the
  pasted text is kept and nothing changes.

### Window: read-only case view of Results

Opened by **Open** in the Test case list (FR-071). The same frame as the case window of Test run
(header with **Previous case**, **Next case**, position, name, **Close**, **Open on Test run**), and
the same page: three numbered parts, one below the other, each in a frame, nothing editable (T256):
1. Case (the fields, highlighted only by **Show the issue** (T257), and, below them, the complete judge prompt in a read-only box; no buttons),
2. Judge reply (read-only, with the note when the file has one), 3. Errors: first one summary line ("3 expected: 2 found, 1 not found ·
Additional: 2 false positive"), then the two groups **Expected errors** and **Additional errors**, each item shown by the shared error
component (both passages, the state in words, the source of the mark) with **Show the issue**. The status of the case is in the header, and the
part "Result" with "Marked N of M" is gone. It offers no action that changes the case (marks are changed on Test run), and **Open on Test run**
leads to the case window.

## Step 4: Results

- **Purpose**: answer "does this judge work?" with numbers anyone can read, and let the user
  review everything without changing it by accident.
- The "what next" line says how many cases are decided ("27 of 30 cases decided", and "· 3 not
  decided yet" when some are not); there is no "final" or "provisional" result, because the test
  cases can change at any time (T267). Its primary action is always **Export HTML report**; there
  is no **Continue** here and no **Run again with a new judge…** (T289).
- **Read-only**: nothing on this step changes a reply, decision, expected error, rule or mapping.
  The only exception is the thresholds in **Details** (FR-065, FR-069). There is no closing step.
- **Notices** above the views: rules
  or mapping corrected after replies; the cases added or corrected after the first reply (FR-053).
- **Three views**, as tabs in this order:
  1. **Summary**: a collapsed **Details** section at the top (T265: the thresholds with
     one-sentence explanations and one sentence on how much data a rate needs (T268), the 95%
     intervals, the borderline notes, further measures of a loaded metric; there is no **Load
     check settings**, T266); then, when cases are not decided, "3 cases are not decided yet (1 not
     run, 2 awaiting verification)."; then three groups of counts (expected errors: total, found, missed; additional
     findings: total, genuine errors, false positives; subtle errors: total, found, missed), and the
     ignored count when not zero; then the two rates with their counts; then one line of overall
     result with its reasons; then the test size against the minimum.
     **For a judge evaluated per case** (FR-061, FR-066, FR-067): one sentence says so; the counts
     are cases; the two rates are the case detection rate and the clean-case false-positive rate,
     and **Details** shows their two thresholds. When a correction of the rules switched the way
     of counting, a notice says which way was used before and after (FR-075).
  2. **Error analysis**: per category and per difficulty (expected, found, missed and the detection rate of every group, whatever its size, T268); additional findings per category and per difficulty (genuine errors, false positives;
     counts only, with "(no category)" and "(not set)"); additional findings per error rule. For a
     judge evaluated per case, cases are counted once in each category and difficulty their errors
     have, as flagged or not flagged, with counts only and one sentence saying why (FR-070).
  3. **Test case list**: every case with expected errors, what the judge reported (with the
     category and difficulty of added findings), status and sources of decisions, and **Open** to
     see it in the read-only case view.
- **Actions** (both in the "what next" line; there is no card "Report and next version", T267):
  **Export HTML report**, available at any time; while cases are not run or await verification
  the report says how many are not decided yet. A changed judge is tested on the same test cases
  by **Load test project…** with **Load the test project only** (FR-074). The Help says that the
  result as JSON is the test project file of **Save test project**.
- **States**: nothing run yet; partial results; no findings at all (false-positive rate not
  available); sample below the minimum; a test project loaded with its test run whose recomputed
  numbers differ from the stored ones.

## Help

- **Purpose**: explain every part of the tool in plain language (FR-006, Principle VIII).
- **Sections**: what the tool does and what one test case is; how many cases and errors a test
  needs, with a worked example; the four steps; the manual copy-and-paste workflow; variables and
  the judged text; the sample reply, field paths and error rules, with examples; the error
  categories; adding test cases (From JSON, Clean case, Case with errors, the case JSON
  layout, Open, Edit expected errors); importing test cases from a file;
  pasting replies and what happens when a reply is replaced; marking after each reply, Add finding
  and Remove, the second opinion window and "Ignored"; **Start test run** and what it fixes; the
  one file (the test project, with its test run once started), the indicator of unsaved changes,
  "… as", the load question (**Load with the test run**, **Load the test project only** to test a
  changed judge on the same cases) and **Continue**; judges that give only a verdict and are evaluated per case, with
  a worked example; each count and rate with a worked example and its limitations; the overall
  result and thresholds; exporting, and what the cases not decided yet mean for the numbers; files and their formats, with
  examples; examples and demo data; metrics and thresholds; the supported browsers (Chrome and
  Edge); privacy (nothing is stored or sent; exported files contain your data).
- Examples are the files in `examples/`, the same ones the contract tests validate.
- Each section is written together with the feature it describes (Principle VIII); the Help is
  complete before the first public release.

## Layout of each view (UI redesign, 2026-11-16)

Where things sit at the four sizes of FR-092: wide (1440 × 900 and 1280 × 720), tablet (about 768
px) and phone (360 to 430 px). The values (widths, the 760 px breakpoint, tokens) are in
research.md, section 33. The names, the actions and their order are those of the sections above;
this section changes none of them.

**Every view**

- The page scrolls as a whole. A box or a card has no scroll area of its own, except a table that is
  too wide (it scrolls sideways in its own frame) and the content of a dialog.
- The main content and the case window are at most 1600 px wide and centered. Paragraphs of text are
  at most about 72 characters wide. Tables, JSON and prompts use the full width.
- From 760 px up a view may use two columns; below 760 px every view is one column, in the order of
  the DOM.
- Buttons, error messages, the save indicator and case names wrap; they are never cut off.

**Header** (one compact row, then the steps)

| Size | Layout |
|---|---|
| Wide | Row 1: tool name, the name of the test project (`dataset.name`), the save indicator with the file name (or "no file yet"), **Save test project**, **More**, **Help** at the right. Row 2: the four steps, all visible. |
| Tablet | The same; row 1 wraps after the name of the test project when it does not fit. |
| Phone | Row 1 wraps: tool name and the name of the test project, then the indicator and the three buttons. Row 2: the steps in one line that scrolls sideways; the current step is scrolled into view. |

Under the header, on every step: the "what next" line (a plain surface with a thin border, its
sentence at most 72 characters wide, its one primary button at the right, or under the sentence on a
phone).

**Step 1: Judge** (FR-093)

1. The prompt and its detected variables, then the choice of the judged text.
2. The sample reply, then the table of fields found.
3. One work area: the rules on the left and the preview of findings on the right from 760 px. The
   preview stays in view while the user scrolls the rules (it is sticky), so a change of a rule shows
   in the preview without scrolling at 1280 × 720. Below 760 px the preview follows the rules.

**Step 2: Test cases** (FR-093)

1. The "what next" line with **Start test run** (before the start).
2. The table of test cases over the full width, with its filters, search and the buttons of each row.
3. "Error categories", collapsed by default when the project has cases.
4. The test case window: the form, the JSON editor (it grows with its text), the preview, the list of
   expected errors, one under the other; the two columns of the case view follow the case window
   rules below.

**Step 3: Test run** (FR-093)

- The table of cases over the full content width, with its filters ("All cases", "Awaiting
  verification first", "Only awaiting verification") and **Add test case…** above it.
- The status of each case is a word with a sign. The four counts of T263 stay in four columns. On a
  phone the table scrolls sideways in its frame; the page does not.

**Case window of Test run** (FR-055, FR-092)

| Size | Layout |
|---|---|
| Wide | The header in one row, in the order given in "Window: the case window of Test run". Part 1: the fields in two columns, the judged field on the right. Part 2: one row. Part 3: "Judge reply" on the left and "Errors" on the right, the same width. The three parts are one page with one scroll; the header stays in view. |
| Tablet (768 px) | The same two columns, narrower; the header wraps when needed, in the same order. |
| Phone | The header wraps naturally in the order above, with **Close** last; the order on screen is the order of Tab (no CSS `order`). Part 1: the fields one under the other, the judged field last. Part 3: "Judge reply", then "Errors". |

**Judge reply** (FR-055)

- Each JSON object that an error rule turned into a finding has a light background and a thin line
  at its left, from its opening to its closing brace. There is no label, rule name, category or
  description.
- The object of the item pointed at (a finding pressed on the right, or **Show the issue**) is marked
  strongly: a stronger background and a wider accent line. It stays so until another item is pointed
  at, the case changes or the window closes.
- A reply kept as text and JSON that no rule read have no mark.
- The reply has no scroll area of its own: it grows with its text, and the page scrolls. The same
  holds for the base case shown in "Case with errors".

**Step 4: Results** (FR-093)

- "Summary" first, with the overall result as the most visible line on the page (the largest text,
  with its sign). Then "Error analysis" and "Test case list".
- Numbers in tables are right-aligned, with digits of the same width.
- **Export HTML report** is the one primary action, in the "what next" line.

**Dialogs** (FR-093)

- From top to bottom: the title, the context (one sentence), the content or editor, the errors or the
  preview, then the bar of buttons: **Cancel** (or **Close**) first, the main action last, at the
  right.
- The content scrolls inside the dialog; the title and the bar of buttons stay in view, also at 360
  px.
- The standard large dialog keeps about 90% of the screen; a short question keeps the small dialog.

## Rules for every screen (Principle VII)

- One obvious primary action per step, in the "what next" line; the only other primary-colored
  controls are the confirming button of a window the user
  has opened and must answer (**Save case**, **Save case**, **Apply opinion**, **Import
  test cases** in the import summary, **No more findings** in the case window of a reply that
  cannot be read). Inside a window, the action
  needed next is the primary one.
- Action names follow FR-008: taking text from the clipboard is "Paste … from clipboard", keeping
  something is "Save …", removing is "Remove"; the same action has the same name everywhere. Text
  pasted into a box is read as it changes, with no "Read …" button.
- All colors, spacing, type sizes, radii and shadows come from `tokens.css`; no one-off values
  (FR-091; values in research.md, section 33).
- Stone and forest green (FR-007, UI redesign 2026-11-16; this replaces the black-and-red scheme):
  the forest green accent is the one accent color (primary action, current step, links, focus). The
  light scheme has a light stone background; the dark scheme is derived from the same green. Light
  and dark follow the system setting and there is no switch in the tool; every text pair meets
  4.5:1 in both. Porcelain and navy exists only as a set of tokens.
- Every state carries a word or a sign as well as its color: "✓ Pass", "… Awaiting verification",
  "✕ Fail", "– Not run", and the marks of errors (FR-094). Because the accent is green, green alone
  never means "Pass".
- Flat surfaces with a thin border; a light shadow only on dialogs and menus; two corner radii;
  at most three levels of heading; one primary button per context (FR-091).
- Everything works with the keyboard alone; focus is visible; windows trap and return focus; status
  is never shown by color alone.
- Usable from 360 px wide; wide tables scroll inside their own container. The layout of each view at
  the four sizes is in "Layout of each view" below (FR-092, FR-093).
- Every empty and error state is a designed message with a suggested next step.
- Long operations (loading a large file) show progress and never freeze the page for more than two
  seconds.
