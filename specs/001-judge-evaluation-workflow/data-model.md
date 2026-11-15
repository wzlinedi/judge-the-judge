# Data Model: Judge the Judge

**Date**: 2026-11-13 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Entities, their fields, the rules that validate them, and how they change over a session. File
layouts are in [contracts/file-formats.md](./contracts/file-formats.md). "Derived" means computed
from other data and never stored as a source of truth.

## Overview

```text
TestProject ──────────────────────┐
 ├─ JudgeSet                       │
 │   ├─ prompt ──> Variables       │
 │   ├─ sample reply ──> ReplyMapping (recognized fields, default finding text per list)
 │   └─ ErrorRule ── Condition     ├──> Evaluation (one page session)
 ├─ ErrorCatalog ── Category       │      ├─ replies     (case id → judge prompt + received reply)
 ├─ TestCases ── TestCase ─────────┘      ├─ decisions   (case id → what the user settled,
 │                └─ ExpectedError        │                incl. added findings)
 └─ metric, checks                        ├─ checks      (thresholds in use)
                                          └─ model note

reply ──rules──> Findings ──matching──> CaseReview ──+ decisions──> CaseStatus ──> Results
case JSON (pasted, LLM answer, Export test cases) ──check──> TestCase (new, or corrected expected errors)
MetricDefinition ──registered in──> MetricRegistry <──registered by── a loaded test project (metric.definition)
```

A clean base case is simply a clean test case (no expected errors): any clean case can be the
optional base of a case with injected errors (research.md, section 15; FR-082).

**Two files** (FR-076): the **test project** file holds the JudgeSet, the error catalog, the test
cases, the active metric and the checks (one test, used for every run); the **evaluation** file
holds all of that plus the replies, decisions, model note and results of one run. The word
"dataset" survives only as the key of the test cases block inside both files
(contracts/file-formats.md, section 1).

## JudgeSet

Everything on the Judge step. Saved and loaded inside the test project file, together with the
test cases (FR-009, FR-020); there is no separate judge set file.

| Field | Type | Rules |
|---|---|---|
| `prompt` | text | The judge prompt, used exactly as written (FR-047). May be empty while editing; needed before finalizing. |
| `sample_reply` | text | One reply of the judge, as pasted. Optional. |
| `reply_mapping` | ReplyMapping | Derived from the sample reply, plus the user's finding-text choices. |
| `error_rules` | list of ErrorRule | Written only by the user (FR-013). May be empty. |
| `error_catalog` | list of Category | Belongs to the test project; stored here for the file layout. Changed only by the user, on the Test cases step (FR-015). |
| variables | list of names, derived | Every `{{name}}` in the prompt, in order, without repeats (research.md, section 8). |
| `judged_text` | variable name | The variable that is the output the judge evaluates; errors are injected into it (FR-010). The last variable is proposed; when the named variable leaves the prompt, the last variable is proposed again and the user is told. Not part of the judge version. |
| version | text, derived | Content hash of prompt, finding-text choices and error rules (research.md, section 14). |
| counting mode | `per_expected_error` or `per_case`, derived | `per_case` when at least one usable rule exists and every rule uses only fields outside any list: the judge gives one verdict for the whole text (FR-061; research.md, section 29). Changes when the rules change. |

- A prompt with no variable is allowed but triggers a warning: nothing from the cases reaches it.
- Editable until the test cases are finalized. After that the prompt is fixed; the reply mapping and
  the error rules may still be corrected (FR-053), which changes the version. "Edit the judge and
  run again" (FR-074) reopens the prompt and clears replies and decisions.
- "Can replies be read automatically?" is derived: yes when a sample reply is set, at least one
  rule exists, no rule is broken, and every list used by a rule has a finding-text field. When
  not, a warning is shown on the Judge step and before finalizing (FR-021).

## ReplyMapping

The recognized structure of the judge's reply. It never says what an error is (FR-011).

| Field | Type | Rules |
|---|---|---|
| fields | list of ReplyField, derived from the sample reply | Recomputed whenever the sample changes and is readable; a sample that cannot be read keeps the fields of the last readable one and shows its line and column (FR-084, FR-088). |
| lists | list of paths, derived | Every list of objects in the sample, for example `claims[]`. |
| `finding_text` | list path → field path | Per list, the field a rule points at when it has none of its own: the tool's proposal, never edited by the user directly (the user chooses "Where the error is" in each rule, FR-012); may be unset. The field must belong to that list and hold text. |

**ReplyField** (derived): `path` (for example `claims[].verdict`), kind (text, number, true/false,
empty), up to eight distinct values seen in the sample, and the list it belongs to (or none).

## ErrorRule and Condition

| Field | Type | Rules |
|---|---|---|
| `name` | text | Required; shown wherever a finding is shown. |
| `match` | `all` or `any` | Whether all conditions must hold or any one of them. |
| `conditions` | list of Condition | At least one for the rule to be used. No upper limit. |
| `finding_text` | field path, optional | "Where the error is" (FR-012): the text field of the items of the rule's list that a finding of this rule points at. Written only when it differs from the field `reply_mapping.finding_text` names for that list; absent otherwise, so the judge version of a file without it does not change. Dropped when the sample no longer has the field or the rule moves to another list. When two rules hold for one item, the first rule gives the text. |

| Condition field | Type | Rules |
|---|---|---|
| `field` | path | Must be a field recognized in the sample reply. |
| `comparison` | `equals`, `not_equals`, `greater_than`, `less_than`, `is_empty`, `is_not_empty` | |
| `value` | text | Required except for the two "empty" comparisons. Picked from the values seen or typed. |

- All list fields of one rule belong to the same list; fields outside any list may be mixed in
  (FR-014).
- A rule is **broken** when a condition names a field that the current sample reply does not
  contain, or when it uses two lists. A broken rule is shown as such, is not applied, and is
  reported before finalizing.
- Evaluation is three-valued (holds, does not hold, unknown); see research.md, section 9.

## Category (entry of the error catalog)

| Field | Type | Rules |
|---|---|---|
| `name` | text | Required. Normalized to lower case with dashes; unique. |
| `description` | text | Optional; holds the examples too; shown where a category is chosen (FR-015). |
| `example` | text | Read only (files written before T248): joined to `description` on load ("… Example: …") and not written again. |

- Added only by the user: with **Add category** (one editable row) in the "Error categories"
  section of the Test cases step; typed as a new name where the
  category of an error to prepare, or of an added finding, is given (FR-024, FR-062); named in a
  saved case JSON (the window says so); or, with explicit consent, when an imported test-case file
  uses unknown categories (FR-029). There is no catalog file of its own.
- Uses (derived): the number of test cases that have at least one expected error with the
  category; a case counts once (FR-015).
- Rename applies to every expected error that uses the category, also after finalizing, and
  changes the test cases version. Remove works for every category (T248): at once when no test case
  uses it; otherwise after a question, and then the expected errors that used it stay without a
  category (the test cases version changes; after the first reply the changed cases are marked
  "corrected"), and so do the findings added by hand.

## TestCases (stored under the key `dataset`)

The named collection of test cases of a test project.

| Field | Type | Rules |
|---|---|---|
| `name` | text | Required; default "Untitled test cases". Not part of the version. |
| `cases` | list of TestCase | At most 500 (FR-032). Identifiers unique. Clean cases are listed first. |
| version | text, derived | Content hash of the cases; changes with any edit (FR-034, FR-039). |
| finalized | yes/no | Kept in the test project file and the evaluation file and restored as saved (FR-020). "Import test cases" adds cases before and after finalizing (FR-053). |

**State transitions**

```text
(empty) ──add / import──> Open ──finalize (after summary + confirm)──> Finalized
   ^                                ^                                           │
   └──── New evaluation ──────┴──── "Reopen test cases" (no reply yet) ─────┘
Finalized ──add / import──> Finalized (new cases start Not run; "added after first reply"
                                    when replies exist; new test cases version)
Finalized ──rename / remove a case without a reply, or correct its expected errors──> Finalized
                                    (new test cases version; "corrected after first reply" when
                                    replies exist)
Finalized ──"Run again with a new judge…"──> Finalized (same cases, replies and decisions cleared,
                                              prompt editable until the first reply is saved)
any ──"Load test project"──> the saved state (open or finalized), with no replies (after warning)
any ──"Load evaluation" / "Load demo…"──> exactly the saved state (open or finalized)
```

- **Open**: cases can be added, renamed and removed; the catalog and judge set can be
  edited; composed prompts can be viewed and copied; replies cannot be entered (FR-053). A saved
  case is never edited: it is changed by copying its JSON into a new case, changing it and removing the
  original (FR-025, FR-086); there is no "Clone" (FR-078).
- **Finalized**: the judge prompt and the fields and identifiers of every case are fixed. While no
  reply exists, "Reopen test cases" returns to Open without losing anything (FR-053). Cases may still
  be added and imported; a case without a reply may be renamed, removed or have its
  expected errors corrected through its JSON (FR-089); a case with a reply is not changed (an
  expected error that should not count is marked "Ignored" on Run). The reply mapping and the error
  rules may still be corrected; automatic results are recomputed and decisions made by hand are
  kept.
- Finalizing is refused for empty test cases or an empty judge prompt. Everything else (one kind of
  case only, replies not readable automatically, a broken rule, a case with no field for a
  variable, no subtle error, test size below the minimum) is a warning in the summary (FR-052).

## TestCase

| Field | Type | Rules |
|---|---|---|
| `id` | text | Unique in the test project. From the file when every case has one; otherwise assigned by order (`1`, `2`, …) and reported. A mix of with and without is rejected. Cases made in the tool get the next free number (FR-033). |
| `name` | text | Unique in the test project, compared without regard to case (FR-079); a case JSON with an empty name gets one made from its base and number of errors. A name used twice by an import or a loaded file is kept and both cases show the warning. |
| `base` | text or none | Optional. Identifier of the clean case it was made from (FR-022). Must name an existing clean case, otherwise a warning. A case made from a copied JSON keeps it only when that JSON names it; there is no link to an original (FR-078). |
| `changed_after_first_reply` | `added`, `corrected` or none | Set when the case is added, or its expected errors are corrected, after the first reply of the run; shown in the tables, on Results and in the report (FR-053). |
| `generation_prompt` | text or none | The prompt the case was made with, written when it is saved from "Clean case" or "Case with errors"; "Open" offers it as "Recreate the test case". Not part of the test cases version (T238). |
| `fields` | name → text | One per variable of the judge prompt. At least one non-empty field (FR-037). Each at most 100,000 characters; warning above 30,000. |
| `expected_errors` | list of ExpectedError | Empty list means a clean case. |
| kind | "Clean" or "Injected errors", derived | From whether `expected_errors` is empty. |
| final prompt | text, derived | The judge prompt with each variable replaced by the field of that name; nothing else added. |
| warnings | list, derived | No field for a variable; a field that matches no variable (kept, not used); fragment not found word for word in the judged text (or, for an omission, in another field); unknown category; unknown base; a changed place covered by no expected error; no change compared with the base; very long field. |

- A clean case cannot be removed while other cases name it as their base; the refusal lists them
  (FR-017).
- Two cases whose fields are all identical are flagged as duplicates (FR-045).
- A case with injected errors must differ from its base in at least one field (FR-044).
- Before a case with injected errors is saved, the check line of FR-080 compares text and list:
  changed places not covered, expected errors not in the text, identical to base (refused), no
  fragment or category (note).
- A case is made only from a case JSON (contracts/file-formats.md, section 2), checked as it
  changes; its fields are never edited after saving (FR-081).

## ExpectedError

| Field | Type | Rules |
|---|---|---|
| `id` | text | Unique inside the case (for example `e1`); assigned by the tool when absent. Decisions refer to it (research.md, section 16). |
| `description` | text | Required (FR-037). What is wrong and why; for an injected error, what was changed. |
| `category` | text | Optional. A name from the error catalog. |
| `fragment` | text | Optional. Exact words of the judged text where the error is; for an omission, words of another field that the judged text no longer covers (FR-044). Without it the error cannot be matched automatically (FR-061). |
| `source_fragment` | text | Optional (T250). Exact words of another field (the source) that the error contradicts; shown beside `fragment` and highlighted by "Show the issue". Never used for matching. A text that is in no field is a warning. Part of the test cases version only for an error that has it. |
| `difficulty` | "obvious", "subtle" or none | Optional (FR-043). |

An expected error has no field of its own: it always concerns the judged text (FR-022). A `field`
key found in a file is ignored and reported once.

## Evaluation (the working session)

Holds one test project and everything received and decided for it. Exists in memory;
written whole to the evaluation file (FR-073).

| Field | Type | Rules |
|---|---|---|
| `judge_set`, test cases (`dataset`), error catalog | as above | One of each. |
| `replies` | case id → Reply | Only after finalizing. |
| `decisions` | case id → CaseDecisions | Only for cases with a reply. |
| `checks` | CheckConfiguration | Thresholds in use; defaults from the bundled configuration, or restored from a loaded test project or evaluation. |
| `model_note` | text | Optional multi-line free text, shown as "Model details": the model and the settings that ran the judge, in any form; never read or checked (FR-058). |
| save files | two file handles, not stored | One for the test project and one for the evaluation (FR-076): chosen by the first "Save …" or by "Save … as", or the file opened by the matching load through the picker (not a dropped file). Held in memory only (research.md, section 25). "Load test project" forgets the evaluation file; "Load evaluation" forgets the test project file; "New evaluation", "Load demo…" and "Run again with a new judge…" forget both; "Reopen test cases" keeps both. |
| unsaved changes | yes/no, not stored | One flag (FR-051): set by any change; cleared by "Save evaluation", and by "Save test project" while no reply exists. |
| `metric` | id, parameters and, for a metric that is not built in, its definition | The active metric and the matching parameters in use; written (with `definition`) to the test project file and the evaluation file so a result can be reproduced (Principle V). |
| reply draft | case id → text, not stored | Text changed in the always-visible reply box and not yet saved; moving or closing asks first (FR-055). |
| replies since save | number, derived, not stored | Replies saved since the last "Save evaluation"; shown on Run and in the case window, with a reminder every 25 (FR-059). |
| `reply_judge_version` | text | The judge version when the first reply was saved; cleared when replies are cleared (research.md, section 14). |

**Reply**: `prompt` (the composed judge prompt at the moment the reply was saved) and `reply` (text
of any format, never rejected for its format, not empty) (FR-056, FR-057). It arrives from
"Paste reply" or from the always-visible box (a readable JSON is saved as soon as it is in the box; any
other text with "Keep as text"); all have the same effect. The box is checked as it changes (line and column). Saving a new reply for a case resets
it: its decisions, the added findings included, are removed and the automatic part is computed
again. The tool asks first, saying how many will be removed, only when the case has
decisions with source `manual` or `llm-approved`; with automatic results only it replaces the
reply without asking.

The Results step changes nothing but the thresholds (`checks`); there is no closed state (research.md,
section 27).

## Findings (derived, per case with a reply)

| Field | Meaning |
|---|---|
| readable | Whether a JSON block was found and rules exist. When not, the reason. |
| findings | One per list item (or per reply) for which at least one rule holds: `key` (list path and position, or `reply`), `text` (from the finding-text field; empty when unset or for a whole-reply finding), `rules` (names of the rules that hold). |
| unknown | Fields that were missing or could not be compared, so that a rule could not be evaluated. |

## CaseReview (derived: automatic result for one case)

Built from the case, its findings and the matching rule (research.md, sections 10 and 11).

| Part | Content |
|---|---|
| per expected error | Automatic state: `found`, `missed` or undecided; the findings attached to it (clear or partial); the reason when undecided. |
| additional findings | Findings that match no expected error (or have no text). Always undecided automatically. |
| needs approval | True when the reply could not be read: the user must confirm the case after marking it by hand. |

## CaseDecisions (stored: what the user settled)

| Field | Type | Rules |
|---|---|---|
| `expected` | expected error id → Decision | State `found`, `missed` or `ignored`. |
| `additional` | finding key → Decision | State `real_error`, `false_positive` or `ignored`. A `real_error` (Genuine error) stays an additional finding; nothing is added to the case (T259). |
| `added_findings` | list | Findings added with "Add finding", or by an applied LLM opinion (`from_opinion`): `text`, optional `category` (a catalog name; a new one joins the catalog) and `difficulty` (`obvious` or `subtle`), and a Decision. The only findings with "Remove" (FR-062). |
| `approved` | yes/no | Set by "No more findings" (formerly "Approve") and by "Apply opinion"; required when the reply could not be read. |
| no answer | item → yes, not stored | Items an applied opinion did not answer and that were undecided; their reason becomes "The LLM opinion gave no answer for this item" (FR-063). |
| `note` | text | Optional. Not written by the case window any more (T231); a file that holds it is read, kept and shown in the report and the read-only view. |

**Decision**: `state` and `source`: `manual` (set by hand) or `llm-approved` (an LLM opinion the
user applied with "Apply opinion"). Automatic results are not stored; their source is shown as
`automatic`. The states are shown as "Found", "Not found", "Ignored", "False positive"
and "Genuine error".

- The effective state of an item is the stored decision when there is one, otherwise the automatic
  state.
- "Apply opinion" in the second-opinion window (FR-063) sets the decision of every item the opinion
  answers, decisions set by hand included, with source `llm-approved`, adds its new findings to
  `added_findings`, and sets `approved`. The window shows every change before it is applied. The
  user can change any of them afterwards; a changed one becomes `manual`. There are no stored
  proposals.
- When an expected error is decided `missed`, findings that only partly resembled it move to the
  additional findings and need their own decision.

### Case status (derived)

```text
Not run ──reply saved──> reading + matching
   everything settled automatically ───────────────────────────> Pass / Fail
   something undecided, or reply not readable ─> Awaiting verification
Awaiting verification ──user decides the items (and approves an unreadable reply)──> Pass / Fail
Awaiting verification ──"Apply opinion"──> Pass / Fail, or Awaiting while an unanswered item
                                          stays undecided
Pass / Fail ──user changes a decision──> Pass / Fail, or back to Awaiting if set to undecided
any ──new reply saved──> decisions and added findings removed, reading + matching again
any ──expected errors, mapping or rules corrected──> automatic part recomputed, decisions kept
```

- **Pass**: every expected error that is not ignored is found, and no additional finding is a
  false positive. **Fail** otherwise (FR-064). A confirmed real error does not fail a case.

## VerificationOpinion

An external LLM's assessment of one case, pasted into the second-opinion window. It changes nothing
until the user presses "Apply opinion" after the preview of every change.

| Field | Type | Rules |
|---|---|---|
| `id` | text | Must be the case whose window it was pasted into; an opinion for another case is refused with the reason (FR-063). |
| `expected` | list | Per expected error: `index` (position in the verification prompt, from 1), `found` yes/no, `reason`, `fragment` (the words of the data or reply it rests on). |
| `additional` | list | Per additional finding: `index` (as numbered in the verification prompt); `real` yes/no; `reason`; `fragment`. An entry with `text` and no valid `index` is read as a new finding. |
| `new` | list | Findings the reply contains that are not in the list: `text`, `real` yes/no, `reason`, `fragment`, optional `category` and `difficulty`. |

- An item is answered only when its entry has `found` or `real` as true or false. An opinion that
  answers no item and adds no finding cannot be applied; the window names the reason per item.

## Counters and measures (derived)

Computed only from cases whose status is Pass or Fail. Ignored items are left out of every counter
except the two "ignored" ones.

| Counter | Meaning |
|---|---|
| `expected_total`, `expected_found`, `expected_missed` | Expected errors in decided cases, by effective state. |
| `additional_total`, `real_errors`, `false_positives` | Additional findings in decided cases, by decision. |
| `findings_total` | Correct findings + `real_errors` + `false_positives` (research.md, section 11). |
| `subtle_total`, `subtle_found`, `subtle_missed` | Expected errors marked subtle. |
| `ignored_expected`, `ignored_additional` | Shown as a separate count (FR-066). |
| `cases_decided`, `cases_awaiting`, `cases_not_run` | By status. |
| `clean_cases_decided`, `cases_with_false_positive`, `clean_cases_with_false_positive` | For the minimum sample and the informational shares (FR-069). |
| `defective_cases_decided`, `defective_cases_flagged` | Decided cases with at least one expected error not ignored; those of them with at least one expected error found. Used when the judge is evaluated per case. |
| per category, per difficulty | `expected_total` and `expected_found` split by category and by difficulty (FR-070). |
| per rule | `real_errors` and `false_positives` split by the rule that produced the finding. |
| additional per category, per difficulty | `real_errors` and `false_positives` of additional findings split by their category and difficulty, with "(no category)" and "(not set)"; counts only (FR-070). |

| Measure | Definition |
|---|---|
| Detection rate | `expected_found / expected_total`. |
| False-positive rate | `false_positives / findings_total`; "not available" when `findings_total` is 0. |
| Per category, per difficulty | Detection rate; counts only when fewer than 10 expected errors. |

**Per case** (counting mode `per_case`, FR-061, FR-066, FR-067, FR-070): in a case with a reply,
a flagged reply makes every expected error found and an unflagged one makes every expected error
missed, each with source `automatic`; on a clean case a flag is an additional finding decided by
the user. The Summary counts cases instead of errors (cases with errors: flagged, not flagged;
clean cases: flagged wrongly, not flagged); the two measures are the **case detection rate**
(`defective_cases_flagged / defective_cases_decided`) and the **clean-case false-positive rate**
(`clean_cases_with_false_positive / clean_cases_decided`); the category and difficulty groups count
cases (a case once in each category and difficulty its errors have) and show counts only.

Both rates carry a 95% interval that is shown only in "Details". Everything is labeled
"provisional" while `cases_awaiting` or `cases_not_run` is above 0, on screen and in both exported
files. There is no combined score.

## TestSizeSummary (derived)

Total cases, clean cases, cases grouped by number of expected errors, total expected errors, and for
the two fixed minimums (30 expected errors, 10 clean cases) whether each is met or how many are
missing. On the Test cases step it is computed from the test cases as a forecast (FR-046); on the
Results step from decided, not ignored items (FR-068).

## OverallResult (derived)

| Result | When |
|---|---|
| Inconclusive | Any case is Not run or Awaiting verification, or decided expected errors < 30 (per case: decided cases with errors < 30), or decided clean cases < 10. The reason lists what is missing. |
| Works | Otherwise, when every check passes (by default detection ≥ 80% and false positives ≤ 10%). |
| Does not work | Otherwise, when any check fails. The reason names it. |

A "borderline" note, shown in "Details", is added for each rate whose interval contains its
threshold.

## Evaluation file content (saved snapshot)

Everything needed to continue, reproduce and audit one evaluation (FR-072, FR-073, FR-075).

| Field | Content |
|---|---|
| `tool_version`, `saved` | Version of the tool; date and time. |
| `judge_set` | Prompt, sample reply, reply mapping, error rules, error catalog. |
| `judge_version`, `reply_judge_version`, `rules_corrected_after_replies` | See research.md, section 14. |
| `dataset` | The test cases: name, version, finalized, all cases. |
| `model_note` | As entered on the Run step ("Model details"). |
| `metric` | The active metric's `id` and the matching parameters used. |
| `replies`, `decisions` | Complete, the added findings included. |
| `checks`, `minimum_sample` | The values the overall result is based on. |
| `results` | The way of counting (`evaluated_per`, and the earlier way when a correction changed it, FR-075), counters, measures, the overall result with reasons, and per case its status and effective states with sources. Empty until something is decided. |

- On load the results are recomputed from the stored data; if they differ from the stored results
  (for example a newer tool version changed a rule), the tool says so and shows both (Principle V).

## Test project file content (saved snapshot)

The same test for every run (FR-020): `judge_set` (with the error catalog), `dataset` (the test
cases: name, version, finalized, all cases), `metric` (id and parameters) and `checks`. No replies,
decisions, results or model note. Loading it starts a new Evaluation with these and no
replies, and opens the first step with unfinished work.

## MetricDefinition and CheckConfiguration

Defined in [contracts/metric-and-checks.md](./contracts/metric-and-checks.md). A MetricDefinition
supplies a complete starter judge set, matching parameters and the list of measures. A
CheckConfiguration supplies the thresholds. The MetricRegistry holds the two built-in definitions
and any carried by a loaded test project during the session (T243).

## Summaries shown before something is accepted

| Entity | Content |
|---|---|
| ImportSummary | For a test-case file: total, clean and injected-errors counts, invalid rows with position and reason, fields that match no variable, variables with no field, categories missing from the catalog, and the user's choice (import the valid rows, or cancel; add the categories, or cancel). Imported cases are added to those already here. A cancelled or failed import changes nothing (FR-027 to FR-029). |
| CaseJsonCheck | For a pasted case JSON (From JSON, Clean case, Case with errors, Edit expected errors): problems with line and column or field path, warnings, notes, the kind the case will have, and its last valid state (FR-041, FR-084). |
| OpinionPreview | For a pasted verification opinion: every change with the current and the new mark, new findings, unanswered items, and whether it can be applied (FR-063). |
| FinalizeSummary | Counts, balance, test-size forecast and all warnings, and whether finalizing is allowed (FR-052). |
