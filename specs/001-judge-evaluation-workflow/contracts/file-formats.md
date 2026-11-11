# Contract: File Formats

**Date**: 2026-11-11 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

Everything the tool reads or writes. These layouts are the contract for the schemas in
`src/core/schemas`, the JSON Schema files published in `docs/schemas/`, the templates in
`examples/templates/`, and the Help examples.

## Common rules

- Every JSON file the tool writes is an object with `format` (which kind of file) and
  `schema_version` (a whole number, starting at 1).
- A file with an unknown `format`, or a `schema_version` newer than the tool knows, is rejected with
  a message that names what was found and what is supported; nothing is changed (FR-005).
- Older schema versions are upgraded on load when a later version of the tool introduces one.
- Text is UTF-8. Line endings of any convention are accepted.
- Unknown extra keys are ignored on load and reported once as a note, so a hand-edited file is not
  rejected for a harmless addition.
- A load never partly applies: validation runs on the whole file first (FR-016, FR-017).

| `format` | Purpose | Read | Written |
|---|---|---|---|
| `judge-the-judge-judge` | Judge prompt and reply mapping | yes | yes |
| `judge-the-judge-dataset` | Dataset with error catalog | yes | yes |
| (CSV, no `format`) | Dataset as a spreadsheet | yes | template only |
| `judge-the-judge-prompts` | Batch of composed prompts | no | yes |
| `judge-the-judge-answers` | Batch of judge outputs | yes | no |
| `judge-the-judge-result` | One saved evaluation result | yes | yes |
| `judge-the-judge-metric` | Metric definition | yes | example only |
| `judge-the-judge-checks` | Check configuration | yes | yes |
| (HTML) | Report for people | no | yes |

## 1. Judge file

```json
{
  "format": "judge-the-judge-judge",
  "schema_version": 1,
  "prompt": "Compare the OUTPUT with the INPUT...\n\nINPUT:\n{{input}}\n\nOUTPUT:\n{{output}}",
  "reply_mapping": {
    "list_path": "claims",
    "text_key": "text",
    "assessment_key": "verdict",
    "problem_values": ["contradicted", "unsupported"],
    "category_key": null,
    "target_field": "output"
  }
}
```

- `reply_mapping` may be `null`.
- A plain text file (`.txt`, `.md`) is also accepted as a judge: its whole content becomes the
  prompt and the current reply mapping is kept.
- An invalid file changes nothing and the message says what is wrong (User Story 2).

## 2. Dataset file (JSON)

```json
{
  "format": "judge-the-judge-dataset",
  "schema_version": 1,
  "name": "Book summaries, set A",
  "error_catalog": [
    { "name": "wrong-number", "description": "A number differs from the source.", "example": "1920 instead of 1930" }
  ],
  "scenarios": [
    {
      "id": "1",
      "name": "Chapter 3, clean",
      "fields": { "input": "…source text…", "output": "…summary…" },
      "expected_errors": []
    },
    {
      "id": "2",
      "name": "Chapter 3, wrong year",
      "base": "1",
      "fields": { "input": "…source text…", "output": "…summary with the changed year…" },
      "expected_errors": [
        {
          "field": "output",
          "label": "wrong-number",
          "fragment": "left the town in 1920",
          "description": "The source says 1930.",
          "difficulty": "subtle",
          "original": "left the town in 1930"
        }
      ]
    }
  ]
}
```

Rules (see data-model.md for the full list):

- `scenarios[].fields` and `scenarios[].expected_errors` are required; `expected_errors` may be
  empty. Each expected error requires `description`; other keys are optional.
- `id` must be present on all scenarios or on none; duplicates make those rows invalid.
- At most 500 scenarios; each field at most 100,000 characters.
- The same file is used for "Save dataset", "Export dataset" and loading (FR-046, FR-047). It never
  records whether the dataset was finalized.
- The same scenario objects are what the generation prompts ask an LLM to return (section 9).

## 3. Dataset file (CSV)

One row per scenario. Header names are matched without regard to case.

| Column | Required | Content |
|---|---|---|
| `id` | all rows or none | Scenario identifier |
| `name` | no | Scenario name |
| `base` | no | Identifier of the scenario it was made from |
| `field:<name>` | at least one | One column per input field, for example `field:input`, `field:output` |
| `text` | alternative | A single field. It fills the judge prompt's only placeholder when there is exactly one; otherwise a field named `text` |
| `expected_errors` | no | Zero or more errors in the one-line convention, separated by ` ;; ` |

**One-line convention** for an expected error (also accepted wherever errors are typed or pasted,
FR-034):

```text
field | label | "fragment" | description
field | label | "fragment" | description | subtle
```

- Parts are separated by `|`. `field`, `label` and `fragment` may be empty; `description` is
  required. The optional fifth part is `obvious` or `subtle`.
- The fragment is in double quotes; a quote inside it is written twice (`""`); a `|` inside the
  quotes is part of the fragment.

Example:

```csv
id,name,base,field:input,field:output,expected_errors
1,Chapter 3 clean,,"…source…","…summary…",
2,Chapter 3 wrong year,1,"…source…","…summary…","output | wrong-number | ""left the town in 1920"" | The source says 1930. | subtle"
```

- Cells may contain commas, quotes, line breaks and non-English characters (FR-019).
- Encoding: UTF-8 with or without a byte order mark; if the bytes are not valid UTF-8, Windows-1250
  is tried and the user is told.
- A CSV carries no dataset name or error catalog: the name defaults to the file name, and labels
  used in the rows are added to the catalog.
- Every problem is reported with its row number and reason; the user imports the valid rows or
  cancels.

## 4. Prompt batch (written)

```json
{
  "format": "judge-the-judge-prompts",
  "schema_version": 1,
  "dataset": { "name": "Book summaries, set A", "version": "3fa9c2d41b07" },
  "judge_version": "9b1e77a0c4d2",
  "prompts": [
    { "id": "1", "name": "Chapter 3, clean", "prompt": "…complete composed prompt…" }
  ]
}
```

- Contains all cases or only those without an output, as the user chooses (FR-055).
- Available only after the dataset is finalized.

## 5. Answer batch (read)

```json
{
  "format": "judge-the-judge-answers",
  "schema_version": 1,
  "dataset_version": "3fa9c2d41b07",
  "answers": [
    { "id": "1", "output": "{\"claims\": [ … ]}" }
  ]
}
```

- Also accepted: a bare list `[{ "id": "1", "output": "…" }, …]`, from a file or pasted as one
  block.
- `output` is text of any format. When it is a JSON object or list instead of text, it is turned
  into text as is. An empty output is rejected for that entry only.
- `dataset_version` is optional; when present and different from the loaded dataset, a warning is
  shown before anything is attached (FR-059).
- Entries are matched by `id` only. The import summary lists accepted, rejected (with reason),
  unmatched, duplicate and still-missing entries; several answers for one case in the same batch are
  reported as a conflict and none of them is used (User Story 9).

## 6. Result file

```json
{
  "format": "judge-the-judge-result",
  "schema_version": 1,
  "tool_version": "1.0.0",
  "label": "prompt v2, shorter",
  "created": "2026-11-11T10:15:00Z",
  "judge": { "prompt": "…", "reply_mapping": { }, "version": "9b1e77a0c4d2" },
  "model_note": "model X, temperature 0",
  "dataset": { "name": "…", "version": "3fa9c2d41b07", "error_catalog": [ ], "scenarios": [ ] },
  "outputs": { "1": "…received output…" },
  "verdicts": {
    "2": { "found": [true], "false_alarms": 0, "findings_total": 1, "source": "automatic", "note": "" }
  },
  "checks": { "rules": [ ] },
  "minimum_sample": { "expected_errors": 30, "clean_scenarios": 10 },
  "summary": {
    "counters": { },
    "measures": { },
    "final_answer": { "answer": "Works", "reasons": [ ], "borderline": [ ] }
  }
}
```

- Always complete: full prompts can be recomposed from the stored judge and dataset, and outputs
  and verdicts are stored in full; there is no option to leave anything out (FR-069).
- On import the summary is recomputed and compared with the stored one; a difference is reported.
- Importing adds the result to the shelf; it does not replace the working evaluation.

## 7. Metric definition and 8. Check configuration

See [metric-and-checks.md](./metric-and-checks.md).

## 9. Pasted replies from the user's LLM

**Scenarios** (generation prompts, steps 1 and 2, and the per-scenario prompt). Accepted in the
paste area on the Test cases step, with or without Markdown code fences:

```json
{ "scenarios": [ { "name": "…", "base": "…", "fields": { }, "expected_errors": [ ] } ] }
```

- Also accepted: a bare list of scenarios, a single scenario object, or lines in the one-line
  convention (these add expected errors to the selected scenario).
- `base` may be the identifier or the exact name of an existing scenario.
- Processed exactly like a file import: validation, summary, review of each scenario, and the
  base-versus-variant check (FR-033, FR-035). Rejected text stays in the box.

**Verification opinion** (FR-062):

```json
{
  "case_id": "2",
  "expected": [ { "index": 1, "found": true, "finding": "…", "reason": "…" } ],
  "unexpected": [ { "finding": "…", "reason": "…" } ]
}
```

- Also accepted: a list of such objects, or `{ "opinions": [ … ] }`, for the "all cases awaiting
  verification" prompt.
- `index` counts the case's expected errors from 1, in the order the verification prompt listed
  them.
- A malformed opinion is kept in the box with an explanation; a valid one becomes a proposal on its
  case and never a verdict by itself.

## 10. HTML report (written)

- One self-contained file: inline styles, no scripts, no external resources.
- Order: title and label; summary (final answer with reasons, thresholds and minimum test size,
  test-size summary, the two measures with intervals and the combined score, per-label and
  per-difficulty breakdown, model note, judge and dataset versions, tool version, date); table of
  all cases; details per case (complete prompt, expected errors, received output, verdict with its
  source).
- Every value is escaped. Details are collapsible on screen and expanded in print (FR-069).
