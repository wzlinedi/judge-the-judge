# Data Model: Judge the Judge

**Date**: 2026-11-11 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Entities, their fields, the rules that validate them, and how they change over a session. File
layouts are in [contracts/file-formats.md](./contracts/file-formats.md). "Derived" means computed
from other data and never stored as a source of truth.

## Overview

```text
Judge ──────────────┐
 └─ ReplyMapping    │
                    ├──> Evaluation (one page session)
Dataset ────────────┘      ├─ outputs      (case id → received output)
 ├─ ErrorCatalog           ├─ verdicts     (case id → verdict)
 │   └─ Label              ├─ opinions     (case id → verification opinion, a proposal)
 └─ Scenario (test case)   ├─ checks       (thresholds in use)
     └─ ExpectedError      └─ model note

Evaluation ──save──> Result (snapshot) ──> Shelf ──pick two──> Comparison
MetricDefinition ──registered in──> MetricRegistry ──starter fills──> Judge + ErrorCatalog
```

## Judge

The thing under test. Only the prompt comes from outside.

| Field | Type | Rules |
|---|---|---|
| `prompt` | text | Required, not empty. Used exactly as written (FR-040). |
| `reply_mapping` | ReplyMapping or none | Optional. Without it every case needs manual or LLM-assisted verification (FR-011). |
| placeholders | list of names, derived | Every `{{name}}` in the prompt; names use letters, digits, `-` and `_`. They decide which fields a scenario must have. |
| version | text, derived | Content hash of prompt and reply mapping (research.md, section 11). |

- A prompt with no placeholder is allowed but triggers a warning: every case would get the same
  prompt.
- The judge can be edited until the dataset is finalized; after that only through "change the
  judge, keep the cases" (FR-072), which gives it a new version.

## ReplyMapping

How to read the judge's own JSON reply.

| Field | Type | Rules |
|---|---|---|
| `list_path` | text | Dot-separated path to the list of parts; empty when the reply itself is the list. |
| `text_key` | text | Required. The entry holding a part's text. |
| `assessment_key` | text or none | When absent, every listed part is a problem. |
| `problem_values` | list of text | Required when `assessment_key` is set; compared without regard to case; `true` and `false` allowed. |
| `category_key` | text or none | Shown as information only; never required for a match. |
| `target_field` | text or none | The scenario field the findings point at; limits matching to expected errors in that field. |

## Dataset

A named collection of scenarios with its error catalog.

| Field | Type | Rules |
|---|---|---|
| `name` | text | Required; default "Untitled dataset". Not part of the version. |
| `error_catalog` | list of Label | Names unique after normalization. |
| `scenarios` | list of Scenario | At most 500 (FR-021). Identifiers unique. |
| version | text, derived | Content hash of scenarios and error catalog; changes with any edit (FR-023, FR-030). |
| finalized | yes/no, session only | Not stored in files: a loaded dataset is always open (FR-047). |
| unsaved changes | yes/no, session only | Set by any edit, cleared by saving (FR-048). |

**State transitions**

```text
(empty) ──add / load / paste──> Open ──finalize (after summary + confirm)──> Finalized
   ^                              │  ^                                          │
   └──── new evaluation ──────────┘  └──── load a saved file (always opens) ────┘
Finalized ──"change the judge, keep the cases"──> Finalized (same dataset, outputs cleared)
Finalized ──load a different judge or dataset / new evaluation──> Open (after warning + confirm)
```

- **Open**: scenarios and catalog can be added, edited, deleted; single prompts can be viewed and
  copied; prompt batch export and answer entry are not available (FR-050).
- **Finalized**: fields, identifiers and the judge prompt are fixed. Expected errors may still be
  edited (they are the reference); this changes the dataset version, recomputes automatic verdicts
  and keeps verdicts set by hand.
- Finalizing is refused for an empty dataset and requires every scenario to have a non-empty field
  for every placeholder of the judge prompt.

## Label (entry of the error catalog)

| Field | Type | Rules |
|---|---|---|
| `name` | text | Required. Normalized to lower case with dashes; unique. |
| `description` | text | Optional; shown as help (FR-012). |
| `example` | text | Optional. |

- A label typed on an expected error that is not in the catalog is normalized and added
  automatically, with a short confirmation.
- A label used by any expected error cannot be deleted (FR-010); the refusal lists the scenarios.

## Scenario (test case)

| Field | Type | Rules |
|---|---|---|
| `id` | text | Unique in the dataset. From the file when every scenario has one; otherwise assigned by order (`1`, `2`, …) and reported. A mix of with and without is rejected (edge case). Hand-made scenarios get the next free number (FR-029). |
| `name` | text | Optional; shown as "Case <id>" when empty. |
| `base` | text or none | Identifier of the clean scenario this variant was made from (FR-035). Must exist in the dataset, otherwise a warning. |
| `fields` | name → text | At least one non-empty field (FR-028). Each at most 100,000 characters; warning above 30,000. |
| `expected_errors` | list of ExpectedError | Empty list means a clean scenario. |
| kind | "clean" or "defective", derived | From whether `expected_errors` is empty. |
| final prompt | text, derived | Judge prompt with each `{{name}}` replaced by the field of that name; nothing else added. |

- Two scenarios whose fields are all identical are flagged as duplicates (FR-043). A variant and
  its base share the input but differ in the output, so they are not duplicates.
- Fields not named by any placeholder are kept and shown, with a note that the judge will not see
  them.

## ExpectedError

| Field | Type | Rules |
|---|---|---|
| `description` | text | Required (FR-028). What is wrong and why. |
| `field` | text | Optional; default `output`. Must name a field of the scenario. For an omission it names the input field (FR-038). |
| `label` | text | Optional free text; normalized; added to the catalog when new. |
| `fragment` | text | Optional. Exact words in `field` where the error is. Without it the error cannot be matched automatically (FR-060). A warning is shown when it does not occur word for word in the field (FR-035). |
| `difficulty` | "obvious", "subtle" or none | Optional (FR-036). |
| `original` | text | Optional. The words that stood there before the change; this is the injection record, together with `description` and the scenario's `base`. |

## Evaluation (the working session)

Holds one judge, one dataset and everything received and decided for them. Exists only in memory.

| Field | Type | Rules |
|---|---|---|
| `judge`, `dataset` | as above | One of each (spec, Assumptions). |
| `outputs` | case id → text | Any format, never rejected for its format (FR-053). Empty text is not an output. |
| `verdicts` | case id → Verdict | Only for cases with an output. |
| `opinions` | case id → VerificationOpinion | Proposals awaiting approval (FR-062). |
| `checks` | CheckConfiguration | Thresholds in use; defaults from the bundled configuration. |
| `model_note` | text | Optional free text: which model and settings ran the judge (FR-052). |

### Case status (derived)

```text
Not run ──output received──> matching ──clear result──> Pass / Fail  (source: automatic)
                                │
                                └──unclear or unreadable──> Awaiting verification
Awaiting verification ──user sets marks──> Pass / Fail  (source: set by hand)
Awaiting verification ──LLM opinion pasted──> Awaiting verification (proposal shown)
                      ──user approves──> Pass / Fail  (source: LLM opinion, approved by the user)
Pass / Fail ──user changes marks──> Pass / Fail  (source: set by hand)
any ──output replaced──> matching again (a hand-set verdict is dropped only after confirmation)
```

## Verdict

| Field | Type | Rules |
|---|---|---|
| `found` | list of yes/no | One entry per expected error, in order. |
| `false_alarms` | whole number ≥ 0 | Findings confirmed as matching no expected error. |
| `findings_total` | whole number ≥ 0 | Parts the mapping marks as problems; when the reply is unreadable, found count plus `false_alarms`. |
| `source` | "automatic", "manual", "llm-approved" | Shown in the results table and report. |
| `note` | text | Optional. |
| outcome | Pass or Fail, derived | Pass only when every `found` is yes and `false_alarms` is 0. |

- Turning an unexpected finding into a real error adds an ExpectedError to the scenario (allowed
  after finalizing), marks it found, and lowers `false_alarms` by one.

## MatchResult (derived, per case with an output)

| Field | Meaning |
|---|---|
| readable | Whether the reply could be read through the mapping. |
| parts, findings | All parts of the reply; those assessed as problems. |
| per expected error | Clear match, partial match, or no match, with the matching findings. |
| unexpected findings | Findings with no clear or partial match to any expected error. |
| clear | True when nothing is partial, no expected error lacks a fragment, and there are no unexpected findings. Only then is an automatic verdict set. |
| reasons | Plain sentences explaining why the case awaits verification. |

Matching rule: research.md, section 8.

## VerificationOpinion

An external LLM's assessment of one case, pasted by the user. A proposal until approved.

| Field | Type | Rules |
|---|---|---|
| `case_id` | text | Must match a case with an output. |
| `expected` | list | Per expected error: `index`, `found` yes/no, `finding` (text), `reason`. |
| `unexpected` | list | Each with `finding` and `reason`. |

## Counters and measures (derived)

Computed only from cases that have a verdict.

| Counter | Meaning |
|---|---|
| `expected_total`, `expected_found` | Expected errors in judged cases; those marked found. |
| `findings_total`, `false_alarms` | Sum of the verdict fields over judged cases. |
| `cases_judged`, `cases_pending`, `cases_not_run` | By status. |
| `cases_with_false_alarm`, `clean_cases_judged`, `clean_cases_with_false_alarm` | For the informational shares (FR-063). |
| per label, per difficulty | `expected_total` and `expected_found` split by label and by difficulty (FR-064). |

| Measure | Definition |
|---|---|
| Detection rate | `expected_found / expected_total`, with a 95% interval. |
| False-alarm rate | `false_alarms / findings_total`, with a 95% interval; "not available" when `findings_total` is 0. |
| Combined score | Harmonic mean of detection rate and (1 − false-alarm rate); not available when either part is. |
| Per label, per difficulty | Detection rate with interval; counts only when fewer than 10 expected errors. |

All measures are labeled "provisional" while `cases_pending` is above 0.

## TestSizeSummary (derived from the dataset)

Total scenarios, clean scenarios, scenarios grouped by number of expected errors, total expected
errors, and for the two fixed minimums (30 expected errors, 10 clean scenarios) whether each is met
or how many are missing (FR-044). Shown while building the dataset and with the results.

## FinalAnswer (derived)

| Answer | When |
|---|---|
| Inconclusive | Any case is Not run or Awaiting verification, or expected errors < 30, or clean scenarios < 10. The reason lists what is missing. |
| Works | Otherwise, when every check passes (by default detection ≥ 80% and false alarms ≤ 10%). |
| Does not work | Otherwise, when any check fails. The reason names it. |

A "borderline" note is added for each measure whose interval contains its threshold.

## Result (saved snapshot)

Everything needed to reproduce and audit one evaluation (FR-074).

| Field | Content |
|---|---|
| `label`, `created` | User-editable name; date and time. |
| `tool_version` | Version of the tool that produced it. |
| `judge` | Prompt, reply mapping, version. |
| `model_note` | As entered on the Run step. |
| `dataset` | The complete dataset with its name and version. |
| `outputs`, `verdicts` | Complete. |
| `checks`, `minimum_sample` | The values the final answer was based on. |
| `summary` | Counters, measures and the final answer at the time of saving. |

- On import the summary is recomputed from the stored data; if it differs from the stored summary
  (for example a newer tool version changed a rule), the tool says so and shows both (Principle V).

## Shelf and Comparison

- **Shelf**: the session's list of Results (saved here or imported). Each entry shows label, judge
  version, dataset version, date and headline measures. Not kept after the page is closed.
- **Comparison** (derived from two Results): the three headline measures side by side; per
  measure "worse" when the newer value is worse, "clearly worse" when the two intervals do not
  overlap; a warning when the dataset versions differ.

## MetricDefinition and CheckConfiguration

Defined in [contracts/metric-and-checks.md](./contracts/metric-and-checks.md). A MetricDefinition
supplies a starter judge (prompt and reply mapping), a starter error catalog, matching parameters
and the list of measures. A CheckConfiguration supplies the thresholds. The MetricRegistry holds
the two built-in definitions and any loaded during the session.

## Batches and summaries

| Entity | Content |
|---|---|
| ImportSummary | For a file or pasted block: total, clean and defective counts, invalid rows with position and reason, warnings, and the user's choice (import valid rows, or cancel). A cancelled or failed import changes nothing (FR-017). |
| PromptBatch | Dataset name and version, judge version, and one composed prompt per selected case with its identifier (FR-055, FR-059). |
| AnswerBatch | Optional dataset version and a list of case identifier plus output text (FR-056). |
| AnswerImportSummary | Accepted, rejected with reasons, unmatched, duplicate and still-missing counts; the keep-or-replace choice for overlaps (FR-057, FR-058). |
