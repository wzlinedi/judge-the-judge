# Contract: Screens and Flow

**Date**: 2026-11-11 | **Plan**: [../plan.md](../plan.md) | **Spec**: FR-001, FR-007, Principle VII

What each screen is for, its one primary action, when it is available, and the states it must
design for. Wording of labels is indicative; all interface text is English.

## Shell

- A header with the tool name, the four numbered steps as a progress bar, and links to **Compare**
  and **Help**. The current step and how far the user has got are always visible.
- A footer with the tool version and the statement that data stays on this device.
- A "work not exported" indicator with a single **Export** action for the current work (FR-004).
- Leaving or reloading the page with unexported work triggers the browser's warning.

| Step | Available when | Primary action |
|---|---|---|
| 1 Judge | Always | **Next: test cases** (needs a non-empty prompt) |
| 2 Test cases | A judge prompt exists | **Finalize dataset** |
| 3 Run | Dataset finalized | **Next: results** |
| 4 Results | Dataset finalized | **Save result** |

The user can always go back to an earlier step to look. A step that is not yet available is
visible but disabled, with one sentence saying what is needed first.

## Step 1: Judge

- **Purpose**: say what is being tested.
- **Content**: starters from the metric registry ("Populate for accuracy", "Populate for
  completeness", loaded metrics); the prompt editor with its placeholders listed underneath; load
  and save judge file; the reply mapping section: paste one sample reply, **Propose mapping**, a
  preview of which parts would be findings, confirm or correct; an action that inserts a ready JSON
  reply block for prompts that ask for no JSON; **Load metric definition**.
- **States**: empty (explains the two ways to start, offers mock data); no placeholder in the
  prompt (warning); no mapping (warning that every case will need manual or LLM-assisted
  verification); invalid judge file (message, nothing replaced); locked after finalizing (read-only,
  with "Change the judge, keep the cases").

## Step 2: Test cases

- **Purpose**: build the test data and finalize it.
- **Layout**: a list of scenarios with search, filters (clean, defective, flagged), sorting and
  paging at 50 per page; beside it the selected scenario.
- **Always visible**: dataset name, version, unsaved-changes indicator; live feedback (clean and
  defective counts, warnings, duplicates, remaining capacity); the **test-size summary** with the
  sentence that at least 30 injected errors and 10 clean scenarios are needed for a final answer;
  the error catalog (view, add, paste a list, descriptions and examples); the paste area for the
  LLM's answer.
- **Ways to add scenarios**: **Add by hand** (name, fields from the judge's placeholders, expected
  errors with field, label, fragment, description, difficulty); **Generate with your LLM** in two
  steps (clean scenarios first, then errors), each showing a pre-filled prompt with options, an
  "own changes" box and a copy action; **Load file** (CSV or JSON) with templates to download;
  **Load mock data**.
- **Import and paste review**: a summary (found, clean, defective, invalid rows with position and
  reason) and a review of each scenario, with the original and the variant side by side, changed
  words highlighted, and warnings for uncovered changes and missing fragments; accept, edit or
  discard each; import valid rows or cancel.
- **Selected scenario**: its data and expected errors (editable while open); two collapsible prompt
  areas, each with a copy action: the prompt for generating test data from this scenario (collapsed
  by default) and the complete final prompt for the judge.
- **Finalize**: a summary dialog (counts, balance, test size, warnings about no reply mapping, no
  subtle errors, one-sided dataset) and a confirmation.
- **States**: empty dataset; 500-case limit reached; text too long; identifier collision; pasted
  answer malformed (explained, text kept); finalized (inputs read-only, expected errors still
  editable, "Start new evaluation" offered).

## Step 3: Run

- **Purpose**: get the judge's output for every case.
- **Content**: a reminder to run each prompt in a new conversation; an optional field for the model
  and settings used; progress (answered of total); a case navigator; for the chosen case its name,
  data and expected errors, the complete prompt with **Copy**, and a box to paste the output with
  **Accept**; **Export prompts** (all or only unanswered) and **Import answers** (file or pasted
  block).
- **Answer import summary**: accepted, rejected with reasons, unmatched, duplicates, still missing;
  a warning when the batch names a different dataset version; one keep-or-replace choice for cases
  that already have an output.
- **States**: not finalized (asks to finalize first); case already answered (replace asks for
  confirmation); all answered (points to Results).

## Step 4: Results

- **Purpose**: answer "does this judge work?" and let the user verify.
- **Order on screen**:
  1. **Final answer** (Works, Does not work, Inconclusive) with a one-line reason.
  2. **The two measures** with counts, target and pass mark, 95% interval and any "borderline"
     note; the combined score beside them, labeled as a summary; "provisional" while cases await
     verification, with their number.
  3. **Test size**: cases, clean cases, cases by number of errors, and each total against its
     minimum.
  4. **Evaluation settings** (collapsed): the two thresholds, each with a one-sentence explanation;
     load and save check configuration.
  5. **Breakdown** per label and per difficulty; the informational shares of cases with a false
     alarm.
  6. **Case table**: name, kind, status, expected errors and how many were found, unexpected
     findings, output received, source of the verdict, reported categories; filters by status, with
     "needs review" first.
  7. **Case detail** for the selected row: the full prompt, expected errors, the received output
     with its parts and findings marked, the reasons it awaits verification, and **manual
     verification**: mark each expected error found or not; for each unexpected finding confirm it
     as a false alarm or add it as a real error; **Copy verification prompt**, paste the LLM's
     opinion, review the proposal, **Approve**.
- **Actions**: **Save result** (to the shelf, with an editable label), **Export result (JSON)**,
  **Export report (HTML)**, **Copy verification prompt for all awaiting cases**, **Approve all
  proposals**, **Change the judge, keep the cases**.
- **States**: nothing run yet; partial results; no findings at all (false-alarm rate not
  available); sample below the minimum; opinion malformed (explained, text kept).

## Compare

- **Purpose**: see whether a changed judge got better or worse.
- **Content**: the shelf (label, judge version, dataset version, date, headline measures; rename,
  export, remove, import a result file); pick any two; the measures side by side with "worse" and
  "clearly worse" marks; a warning when the dataset versions differ.
- **States**: empty shelf; one result only; imported result whose recomputed numbers differ from the
  stored ones.

## Help

- **Purpose**: explain every part of the tool in plain language (FR-006, Principle VIII).
- **Sections**: what the tool does and what one test case is; how many cases and errors a test
  needs, with a worked example; the four steps; writing cases by hand and generating them with an
  LLM; the bulk loop (template, import, prompt export, answer import); the reply mapping; verdicts
  and verification, including the LLM opinion; each measure with a worked example and its
  limitations; the final answer and thresholds; comparing results; files and their formats, with
  examples; metrics and check configuration; privacy (nothing is stored or sent; exported files
  contain your data).
- Examples are the files in `examples/`, the same ones the contract tests validate.

## Rules for every screen (Principle VII)

- One obvious primary action; secondary actions look secondary.
- All colors, spacing, type sizes and radii come from `tokens.css`; no one-off values.
- Light and dark schemes follow the system setting; contrast meets WCAG AA in both.
- Everything works with the keyboard alone; focus is visible; dialogs trap and return focus; status
  is never shown by color alone.
- Usable from 360 px wide; wide tables scroll inside their own container.
- Every empty and error state is a designed message with a suggested next step.
- Long operations (loading a large file) show progress and never freeze the page for more than two
  seconds.
