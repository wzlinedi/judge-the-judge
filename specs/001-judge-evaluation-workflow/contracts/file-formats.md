# Contract: File Formats

**Date**: 2026-11-13 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

Everything the tool reads or writes. These layouts are the contract for the schemas in
`src/core/schemas`, the JSON Schema files published in `docs/schemas/`, the example files in
`examples/`, and the Help examples. Prototype v17 (`prototypes/ui-prototype-v17`) writes these
layouts; where it differs, this contract wins. The build puts `examples/`, `docs/schemas/` and
`docs/how-to-add-a-metric.md` on the published site at the same paths, so a user of the site can
open the files the Help names (T220).

## Common rules

- Every JSON file the tool writes is an object with `format` (which kind of file) and
  `schema_version` (a whole number, starting at 1).
- A file with an unknown `format`, or a `schema_version` newer than the tool knows, is rejected with
  a message that names what was found and what is supported; nothing is changed (FR-005).
- Older schema versions are upgraded on load when a later version of the tool introduces one.
- Text is UTF-8. Line endings of any convention are accepted.
- Unknown extra keys are ignored on load and reported once as a note, so a hand-edited file is not
  rejected for a harmless addition.
- A load never partly applies: validation runs on the whole file first (FR-027, FR-028).
- Wherever the user pastes text that the tool reads, a problem is reported with where it is: the
  line and column for text that is not readable JSON, or the field path (`fields.summary`,
  `expected_errors[2].description`) for a missing, unknown, empty or too long field (FR-084).

| `format` | Purpose | Read | Written |
|---|---|---|---|
| `judge-the-judge-test-project` | The whole work: the judge set, the error catalog, all test cases, the active metric, the thresholds and, once it has started, the test run with its results | yes | yes |
| `judge-the-judge-test-cases` | Test cases alone: "Import test cases" and "Export test cases" | yes | yes |
| (CSV, no `format`) | Clean cases as a spreadsheet ("Import test cases") | yes | example only |
| `judge-the-judge-metric` | Metric definition | yes | example only |
| `judge-the-judge-checks` | Check configuration | yes | example only |
| (HTML) | Report for people | no | yes |

The user works with one file of their own: the test project (section 1). There is no separate
judge set file, no error catalog file (the catalog lives in the test project since the review of
prototype v14), no prompt batch, no answer batch and no separate result file in this version.
The evaluation file (`judge-the-judge-evaluation`) of earlier builds is gone (T289). The tool is
not released, so such a file is not read: it gets the message for an unknown `format`.

## 1. Test project file

One format for "Save test project", "Save test project as…", "Load test project…" and the demo of
"Load demo…" (FR-020, FR-073, FR-076). It holds the whole work: the judge set, the error catalog,
the test cases, the active metric, the thresholds and, once the test run has started, the
`test_run` section (section 5). It is also the result as JSON; there is no separate "Export JSON"
(FR-072).

```json
{
  "format": "judge-the-judge-test-project",
  "schema_version": 2,
  "tool_version": "1.0.0",
  "judge_set": {
    "prompt": "You are a strict fact-checker...\n\nSOURCE:\n{{source_text}}\n\nSUMMARY:\n{{summary}}",
    "judged_text": "summary",
    "sample_reply": "{\"claims\":[{\"text\":\"…\",\"verdict\":\"contradicted\",\"reason\":\"…\"}]}",
    "reply_mapping": {
      "finding_text": { "claims[]": "claims[].text" }
    },
    "error_rules": [
      {
        "name": "Contradicted or unsupported claim",
        "match": "any",
        "finding_text": "claims[].reason",
        "conditions": [
          { "field": "claims[].verdict", "comparison": "equals", "value": "contradicted" },
          { "field": "claims[].verdict", "comparison": "equals", "value": "unsupported" }
        ]
      }
    ],
    "error_catalog": [
      { "name": "wrong-number", "description": "A number or date that does not match the facts.", "example": "1920 instead of 1930" }
    ]
  },
  "dataset": {
    "name": "Book summaries, set A",
    "version": "3fa9c2d41b07",
    "cases": [
      { "id": "1", "name": "Lalka", "fields": { "source_text": "…", "summary": "…" }, "expected_errors": [] }
    ]
  },
  "metric": { "id": "accuracy", "parameters": { "match_clear_share": 0.6, "match_partial_share": 0.3, "match_min_word_length": 4 } },
  "checks": { "rules": [
    { "measure": "detection_rate", "comparison": "at_least", "value": 0.8 },
    { "measure": "false_positive_rate", "comparison": "at_most", "value": 0.1 },
    { "measure": "case_detection_rate", "comparison": "at_least", "value": 0.8 },
    { "measure": "clean_case_false_positive_rate", "comparison": "at_most", "value": 0.1 } ] },
  "test_run": { "saved": "2026-11-13T10:15:00Z", "replies": { }, "decisions": { }, "results": { } }
}
```

- The key `dataset` is the block of **test cases** of the test project (its name, the test cases
  version and the cases). The word "dataset" is not used in the interface or the Help; the key
  keeps its name so that files stay stable.
- `judge_set` is the **judge set** layout, used in this file and in a metric definition
  (metric-and-checks.md). The error catalog belongs to the test project; it is stored as
  `judge_set.error_catalog` so that a metric definition can carry a starter catalog in the same
  layout.
- `dataset.cases` has the case layout of section 3.
- `test_run` is present once "Start test run" was pressed, also before the first reply; its
  layout is section 5. Its presence is the only record that the test run has started: there is no
  `finalized` key. A file without it loads with the test run not started (FR-053).
- `metric` and `checks` are restored on load, so every test run of one test project counts the
  same way. `metric.definition` is optional: for a metric that is not built in it holds `name`,
  `description`, `limitations`, `output_format`, `parameters` and `measures` (the layout of the
  metric file without `judge_set`), is checked like a metric file (a problem names its path, for
  example `metric.definition.measures[0].operation`), and loading the file registers the metric for
  the session (T243); it replaces a loaded metric with the same id, the default Accuracy file
  included (T274). A file that names a
  metric which is not loaded and carries no definition of it is refused with a plain message
  (T274). `checks` has the layout of the check configuration (metric-and-checks.md, section 2)
  without `format`; the fixed minimum test size is not stored at the top level (see
  `test_run.minimum_sample`).
- **Loading** (FR-020, FR-051, FR-073, FR-076), in this order:
  1. When there are unsaved changes, the unsaved-work question ("Save test project first",
     "Discard", "Cancel").
  2. The file picker (or a file dropped onto the page).
  3. The whole file is validated, the `test_run` section included. An invalid file is explained
     and changes nothing.
  4. When the file has a `test_run` section, a question with "Load with the test run", "Load the
     test project only" and "Cancel". Cancel changes nothing. A file without it loads at once.
  5. The file is applied, and the tool opens the first step with unfinished work.
- **"Load with the test run"** restores everything exactly as saved. A file opened through the
  picker becomes the remembered file, so the next save overwrites it.
- **"Load the test project only"** restores the judge set, the error catalog, the test cases, the
  metric and the thresholds, and drops the whole `test_run` section: replies, decisions (the
  "Ignored" marks and added findings included), model details and results. It also drops
  `changed_after_first_reply` from every case, because the run it refers to is gone. The test run
  has not started, so the prompt can be changed. The loaded file is not remembered: the first save
  asks for a new file, and the loaded test run is never overwritten (FR-074, FR-076).
- **"Load demo…"** loads the demo with its test run and does not ask.
- **Version 1** (written before T289) is upgraded on load: its `dataset.finalized` is dropped and
  the file loads with the test run not started, with a note. A version 1 file never holds a test
  run.

Rules for `judge_set`:

- `prompt` is required. Every other key may be absent or empty.
- `judged_text` names one variable of the prompt: the output the judge evaluates, into which errors
  are injected (FR-010). When it is absent or names no variable, the last variable is used and the
  user is told.
- `sample_reply` is kept as text, exactly as pasted. The recognized fields are not stored; they are
  recomputed from the sample.
- Field paths: keys joined by dots, `[]` after a key for "each item of this list"
  (`overall.ok`, `claims[].verdict`, `[].text`). See research.md, section 9.
- `match` is `all` or `any`. `comparison` is one of `equals`, `not_equals`, `greater_than`,
  `less_than`, `is_empty`, `is_not_empty`; `value` is text and is omitted for the two "empty"
  comparisons.
- `error_catalog[]`: `name` is required and normalized to lower case with dashes; `description`
  is optional and holds the examples too. A file written before T248 may have `example`: it is
  joined to `description` when the file is loaded and is not written again.
- A rule that names a field the sample reply does not contain loads as a broken rule and is
  reported; the file is not rejected for it.
- `match` decides nothing about how the judge is counted; the shape of the rules does: when every
  rule uses only fields outside any list, the judge is evaluated per case (FR-061, research.md,
  section 29).
- An invalid file changes nothing and the message says what is wrong (FR-020).

## 2. Case JSON (one test case)

The one layout of a single test case (FR-031). It is what the user's LLM is asked to return (the
clean case view, FR-083, and part 1 of a case with injected errors, FR-040), what is pasted with
"From JSON" (FR-090) and in part 2 of a case with injected errors (FR-041), what "Export test cases"
gives back (FR-086), and what "Edit expected errors"
edits (FR-089).

```json
{
  "name": "Lalka + 2 errors",
  "base": "1",
  "fields": { "source_text": "…source…", "summary": "…summary with the changed year…" },
  "expected_errors": [
    {
      "category": "wrong-number",
      "fragment": "published as a book in 1887",
      "description": "The source says 1890.",
      "difficulty": "subtle"
    }
  ]
}
```

- The JSON is found in the pasted text as the whole text, the content of a code fence, or the
  text from the first `{` or `[` to the last `}` or `]`. A JSON that cannot be read is reported
  with its line and column in the whole pasted text, never with a part of it read as the case.
- Exactly one case. Also accepted: `{"cases": [ one case ]}` and `[ one case ]`; more than one
  case is a problem that points to "Import test cases".
- `fields` must hold a non-empty text for every variable of the judge prompt (`fields.<variable>`),
  each at most 100,000 characters. A key that is not a variable is a warning: it is kept and never
  sent to the judge.
- `expected_errors` is a list and may be empty. Each item requires `description`; `fragment`,
  `source_fragment`, `category` and `difficulty` (`obvious` or `subtle`) are optional. A missing
  fragment or category is a warning (decided by hand on Test run, not grouped). `source_fragment`
  (T250) is the exact words of another field, the source, that the error contradicts (for example
  `"fragment": "the whale that took his arm"` with `"source_fragment": "lost his leg to a white
  whale"`); the tool shows the two side by side and never matches with it; when it is in no field
  of the case that is a warning. A category not in the catalog is added to it
  when the case is saved, and the window says so.
- `name` must be unique in the test project (FR-079); empty means a name is made from the base and
  the number of errors. `id` is ignored: the case gets a new identifier when saved.
- `base`: with "From JSON" it is used when it names a clean case of the test project (by
  identifier or exact name), otherwise the case has none and a note says so. In a case with
  injected errors the base picked in the window wins and a different `base` is named in a note.
  A case with expected errors identical to its base is refused (FR-080).
- "Export test cases" writes `name`, `base` (only when there is one), `fields` and `expected_errors`
  (without `id`), so that the JSON pasted into a new case gives the same fields and expected
  errors (SC-036).
- "Edit expected errors" edits the list `expected_errors` alone, each error with its `id`; the name and the fields are not in it. An
  `id` that is not an error of the case is not kept (the error is a new one).

## 3. Test-case file (JSON) and the stored case layout

The layout of the cases inside the test project (section 1) and the file of "Export test cases".
"Import test cases" reads it and **adds** its cases to the test project, also after the start of
the test run (FR-027, FR-053). A test project file given to "Import test cases" is read the same
way, using its `dataset.cases`; its `test_run` section is not read.

```json
{
  "format": "judge-the-judge-test-cases",
  "schema_version": 1,
  "name": "Book summaries, set A",
  "cases": [
    {
      "id": "1",
      "name": "Lalka",
      "fields": { "source_text": "…source…", "summary": "…summary…" },
      "expected_errors": []
    },
    {
      "id": "11",
      "name": "Lalka + wrong-number",
      "base": "1",
      "changed_after_first_reply": "added",
      "fields": { "source_text": "…source…", "summary": "…summary with the changed year…" },
      "expected_errors": [
        {
          "id": "e1",
          "category": "wrong-number",
          "fragment": "published as a book in 1887",
          "description": "The source says 1890.",
          "difficulty": "subtle"
        }
      ]
    }
  ]
}
```

Rules (see data-model.md for the full list):

- `cases[].fields` and `cases[].expected_errors` are required; `expected_errors` may be empty. Each
  expected error requires `description`; `category`, `fragment`, `source_fragment` and `difficulty` are optional. An
  expected error without `id` gets one on load. Expected errors have no `field`: they concern the
  judged text; a `field` key is ignored and reported once.
- `id` must be present on all cases or on none; duplicates make those entries invalid. On import,
  an identifier already used in the test project is replaced by a new one and the import summary
  says how many; `base` references inside the file follow the new identifiers.
- A name already used in the test project is kept on import and both cases show the warning
  (FR-079, SC-034).
- `generation_prompt` (optional text) is the prompt a case was made with, written when it is saved
  from "Clean case" or "Case with errors" (the prompt in the box, as the user may have edited it, T262). It is not part of
  the test cases version, and a case pasted as JSON, imported or from the demo has none (T238).
- `changed_after_first_reply` is `added` or `corrected` for a case added, or whose expected errors
  were corrected, after the first reply of the test run was entered (FR-053); it is absent
  otherwise. The Results step and the report list these cases. "Load the test project only" drops
  it.
- There is no `cloned_from`: a copy made by hand keeps no link to its original (FR-078).
- At most 500 cases in the test project after the import; each field at most 100,000 characters.
- The file contains all cases, clean ones included, and carries no error catalog: categories are
  referred to by name. Categories that are not in the catalog are named in the import summary and
  added only if the user agrees (FR-029).
- "Export test cases" writes this file (FR-050). It never records whether the test run has
  started.

## 4. Test-case file (CSV)

The shortened CSV of FR-031: every row becomes a **clean case**. Header names are matched without
regard to case, except the variable names after `field:`, which are matched exactly.

| Column | Required | Content |
|---|---|---|
| `name` | no | Case name |
| `field:<variable name>` | at least one | One column per variable of the judge prompt, for example `field:source_text`, `field:summary` |

Example (this is also what "Download example file" in the import window produces, with the
variables of the current judge prompt as its `field:` columns, FR-030):

```csv
name,field:source_text,field:summary
"First clean case","Correct text for source_text","Correct text for summary"
"Second clean case","Another correct text for source_text","Another correct text for summary"
```

- The CSV has no columns for identifiers, base cases or expected errors; any other column is
  ignored and named in the import summary. Cases with expected errors are imported as JSON
  (section 3).
- Cells may contain commas, quotes, line breaks and non-English characters (FR-027).
- Encoding: UTF-8 with or without a byte order mark; if the bytes are not valid UTF-8,
  Windows-1250 is tried and the user is told. The example file is written with a byte order mark.
- A `field:` column that matches no variable is kept but not used, and a variable with no column
  is filled with empty text; both are said in the summary (FR-029).
- Every problem is reported with its row number and reason; the user imports the valid rows or
  cancels.
- When the judge prompt has no variables yet, the example file uses `field:field_1` and says so.

## 5. The test run section of the test project file

The key `test_run` of the test project file (section 1). It replaces the evaluation file of
earlier builds (T289; research.md, section 32). "Start test run" creates it empty; "Save test
project" writes it whole. It is never written to a file of its own.

```json
"test_run": {
  "saved": "2026-11-13T10:15:00Z",
  "judge_version": "9b1e77a0c4d2",
  "reply_judge_version": "9b1e77a0c4d2",
  "rules_corrected_after_replies": false,
  "model_note": "model X\ntemperature 0\nmax tokens 4000",
  "replies": {
    "11": { "prompt": "…complete composed prompt…", "reply": "…received reply…" }
  },
  "decisions": {
    "11": {
      "expected": { "e2": { "state": "missed", "source": "manual" } },
      "additional": { "claims[]#3": { "state": "false_positive", "source": "llm-approved" } },
      "added_findings": [
        { "text": "The planet is called Earth", "category": "factual-error", "difficulty": "obvious", "state": "real_error", "source": "manual" },
        { "text": "…a finding the LLM saw in the reply…", "from_opinion": true, "state": "false_positive", "source": "llm-approved" }
      ],
      "approved": false,
      "note": ""
    }
  },
  "minimum_sample": { "expected_errors": 30, "clean_cases": 10 },
  "results": {
    "evaluated_per": "expected_error",
    "counted_per_before_correction": null,
    "counters": {
      "per_category": { }, "per_difficulty": { }, "per_rule": { },
      "additional_per_category": { "factual-error": { "real": 1, "fp": 0 }, "(no category)": { "real": 0, "fp": 2 } },
      "additional_per_difficulty": { "obvious": { "real": 1, "fp": 0 }, "(not set)": { "real": 0, "fp": 2 } }
    },
    "measures": { },
    "overall": { "result": "Does not work", "reasons": [ ], "borderline": [ ] },
    "cases": {
      "11": {
        "status": "Fail",
        "expected": [ { "id": "e1", "state": "found", "source": "automatic" }, { "id": "e2", "state": "missed", "source": "manual" } ],
        "additional": [ { "key": "claims[]#3", "text": "…", "rules": ["…"], "state": "false_positive", "source": "llm-approved" } ]
      }
    }
  }
}
```

- Together with the rest of the file it is always complete: the judge set, every case, every
  composed prompt and reply, every decision with its source, ignored items, thresholds and
  versions; there is no option to leave anything out (FR-072).
- `replies`, `decisions` and `results` are empty objects until the first reply; the section is
  still written, so a started test run stays started after save and load.
- `state` is one of `found`, `missed` ("Not found"), `ignored`, `real_error`,
  `false_positive` ("False positive"); `source` is `automatic`, `manual` (set by hand) or
  `llm-approved` (an LLM opinion applied by the user with "Apply opinion", FR-063).
- `promoted_to`, written by an earlier build (T253, undone by T259), is dropped when the file is read; the file loads.
- `added_findings` are the findings added by hand ("Add finding") or by an applied LLM opinion
  (`from_opinion: true`), in their order; each may carry `category` and `difficulty` (FR-062).
  They are the only findings with "Remove". A new reply removes them with the other decisions
  (FR-056).
- There are no stored LLM proposals: an opinion changes nothing until it is applied, and once
  applied it is stored only as decisions. An older file with a `proposals` key loads; the key is
  ignored and reported once.
- `results` is empty until something is decided. On load it is recomputed from the stored data and
  compared with the stored one; a difference is reported and both are shown.
- `results.counters.additional_per_category` and `additional_per_difficulty` count the additional
  findings that are not ignored, as `real` and `fp`, with `(no category)` and `(not set)` for
  findings without them (FR-070).
- `rules_corrected_after_replies` is true when `judge_version` differs from `reply_judge_version`
  (FR-075).
- The `metric` and `checks` at the top level of the file are the ones the results were computed
  with; on load they are used for recomputing, so the same file always gives the same numbers
  (Principle V). One file is enough to see the result and generate the report (FR-073).
- `minimum_sample` records the fixed minimum test size the stored result was computed with, so
  that it can be recomputed on load (SC-003). The tool always uses the bundled value for the
  result it shows.
- `results.evaluated_per` is `expected_error` or `case` (FR-061, FR-067).
  `counted_per_before_correction` names the earlier way when a correction of the rules after
  replies changed it, and is `null` otherwise (FR-075). In `case` mode the counters include
  `defective_cases_decided`, `defective_cases_flagged`, `clean_cases_decided` and
  `clean_cases_with_false_positive`, and `measures` holds `case_detection_rate` and
  `clean_case_false_positive_rate` in place of the two per-error rates.
- `model_note` is free text of any length and any number of lines; the tool never reads it.
- "Load with the test run" restores this section exactly (FR-073); "Load the test project only"
  drops it (section 1). "Save test project" writes the whole file to one chosen file and
  overwrites it on later saves (research.md, sections 25 and 32; FR-076).

## 6. Metric definition and check configuration

See [metric-and-checks.md](./metric-and-checks.md).

## 7. Pasted answers from the user's LLM

Every pasted answer is found in the pasted text as in section 2 (whole text, code fence, or first
`{` or `[` to last `}` or `]`), is checked as soon as it is pasted and whenever it changes, and
stays in its box when it cannot be used (FR-084). Text read from the clipboard ("Paste … from
clipboard") is treated exactly like text pasted into a box.

- **Clean case** (clean case view, FR-083): one case JSON (section 2) with `"expected_errors": []`.
  An answer with expected errors is a problem that points to "From JSON".
- **Case with errors** (part 2 of the test case window, FR-041): one case JSON (section 2)
  with one expected error per error to prepare; a different number is accepted with a note.
- **Judge reply** (case window of Test run, FR-056): any text is kept; when it is not readable JSON the
  line and column are shown under the box and nothing is marked automatically.

**Verification opinion for one case** (the second-opinion window, "Second opinion…", FR-063):

```json
{
  "opinion": {
    "id": "11",
    "expected": [ { "index": 1, "found": true, "reason": "…", "fragment": "…" } ],
    "additional": [ { "index": 1, "real": false, "reason": "…", "fragment": "…" } ],
    "new": [ { "text": "…a finding not in the list…", "real": true, "reason": "…", "fragment": "…", "category": "factual-error", "difficulty": "obvious" } ]
  }
}
```

- Also accepted: the bare opinion object, or `{"opinions": [ … ]}` and a bare list with exactly
  one opinion. A list with more than one opinion is refused: the opinion is asked for one case at
  a time. An `additional` entry with `text` and no valid `index` is read as a `new` finding.
- `id` must be the case of the window; an opinion for another case is refused with the reason and
  nothing changes.
- `expected[].index` and `additional[].index` count from 1 in the order the verification prompt
  listed the expected errors and the additional findings of that case. An item is answered only
  when its entry has `found` (expected) or `real` (additional) as `true` or `false`.
- `new[]` requires `text` and `real`; `category` and `difficulty` are optional.
- The window shows a preview of every change before anything is applied. "Apply opinion" sets the
  marks of all answered items, marks set by hand included, with source `llm-approved`; adds each
  new finding as an added finding with `from_opinion: true`; leaves unanswered items as they are,
  an undecided one with the reason "The LLM opinion gave no answer for this item"; and approves
  the case. An opinion that answers no item and adds no finding cannot be applied, and the window
  names the reason for each item.

## 8. HTML report (written)

- One self-contained file: inline styles, no scripts, no external resources.
- Order: title, test project name and test cases version, judge version, model details (all
  lines, as written), tool version and date, the number of cases not decided yet (not run,
  awaiting verification) when there are any, with no "provisional" mark (T267), the "rules corrected after replies" note when
  it applies, and the list of cases added or corrected after the first reply when there are any;
  then **1. Summary** (expected errors with found and missed; additional findings with real errors
  and false positives; subtle errors with found and missed; ignored items; the two rates, or for a
  judge evaluated per case the case counts and the two case-level rates with the sentence that
  says so; the overall result with reasons, thresholds and minimum test size; intervals);
  **2. Error analysis** (per category, per difficulty, per rule, and additional findings per
  category and per difficulty); **3. Test case list** (per case: complete prompt, expected
  errors, received reply, status, every decision with its source, the category and difficulty of
  added findings); then the judge set (prompt, judged text, rules, finding text, catalog).
- Every value is escaped. Details are collapsible on screen and expanded in print (FR-072).
