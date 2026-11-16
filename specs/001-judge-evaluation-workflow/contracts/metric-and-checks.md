# Contract: Metric Definitions and Check Rules

**Date**: 2026-11-11 | **Plan**: [../plan.md](../plan.md) | **Constitution**: Principle VI

A **metric** is one kind of judge evaluation, for example Accuracy (is every claim of the summary
supported by the source?) or Completeness (is every element of the source present in the summary?). Completeness is a
metric a user can load; the application does not include it.
A **measure** is a number computed from the results, for example the detection rate. A **check** is
a pass-or-fail rule on a measure.

- No metric is built in, and no code depends on one metric (constitution 3.0.0). The tool bundles
  one default metric file, `accuracy` (`src/core/metrics/builtin/accuracy.json`), which a new test
  project starts with. It is registered at start by the same route as a loaded file, and a loaded file
  with the same `id` replaces it (T274).
- A user loads further metrics at run time: a test project file carries its metric in
  `metric.definition` (FR-019, T243), and loading the file registers it. Loading one never requires a
  change to the core, the interface or the other metrics (SC-005). A file that names a metric which
  is not loaded, and carries no definition of it, is refused with a plain message.
- Definition files are data only. They cannot contain or trigger code.

## 1. Metric definition file

```json
{
  "format": "judge-the-judge-metric",
  "schema_version": 1,
  "id": "accuracy",
  "name": "Accuracy",
  "description": "Checks that every claim in the summary is supported by the source.",
  "limitations": "Measures only the kinds of errors injected into the test data.",
  "output_format": "A JSON object with a list of claims, each with its text and a verdict.",
  "judge_set": {
    "prompt": "…starter judge prompt with {{source_text}} and {{summary}}…",
    "judged_text": "summary",
    "sample_reply": "{\"claims\":[{\"text\":\"…\",\"verdict\":\"contradicted\",\"reason\":\"…\"}]}",
    "reply_mapping": { "finding_text": { "claims[]": "claims[].text" } },
    "error_rules": [
      { "name": "Contradicted or unsupported claim", "match": "any",
        "conditions": [
          { "field": "claims[].verdict", "comparison": "equals", "value": "contradicted" },
          { "field": "claims[].verdict", "comparison": "equals", "value": "unsupported" } ] }
    ],
    "error_catalog": [ { "name": "factual-error", "description": "…", "example": "…" } ],
    "clean_base_cases": [ { "name": "…", "fields": { "source_text": "…", "summary": "…" }, "expected_errors": [] } ]
  },
  "parameters": {
    "match_clear_share": { "default": 0.6, "description": "Share of the fragment's words a finding must contain to count as a clear match." },
    "match_partial_share": { "default": 0.3, "description": "Share above which a finding counts as a partial match." },
    "match_min_word_length": { "default": 4, "description": "Shorter words are ignored when comparing." }
  },
  "measures": [
    { "id": "detection_rate", "name": "Detection rate", "description": "Injected errors the judge found.",
      "operation": "ratio", "numerator": "expected_found", "denominator": "expected_total",
      "interval": "wilson95", "better": "higher" },
    { "id": "false_positive_rate", "name": "False-positive rate", "description": "Findings that are not errors, out of all findings.",
      "operation": "ratio", "numerator": "false_positives", "denominator": "findings_total",
      "interval": "wilson95", "better": "lower" }
  ]
}
```

### Required metadata (Principle VI)

| Key | Meaning |
|---|---|
| `id` | Unique in the registry: lower case, digits, dashes. Loading a file whose `id` is already registered is refused unless the user chooses to replace the earlier one; no definition is protected. |
| `name`, `description`, `limitations` | Shown in the tool, in Help and in reports. |
| `output_format` | Plain description of the judge reply this metric expects. |
| `judge_set` | A complete judge set in the `judge_set` layout of the test project file (file-formats.md, section 1), plus `clean_base_cases`: a list of cases in the case layout with no expected errors, which become the first test cases. The variables of its prompt are the required inputs of the metric. |
| `parameters` | Configurable values with defaults and descriptions. |
| `measures` | At least `detection_rate` and `false_positive_rate`, because the overall result rests on them. A definition may also list `case_detection_rate` and `clean_case_false_positive_rate`, but need not: the tool computes both whenever the judge is evaluated per case. |

### Operations the tool provides

| `operation` | Arguments | Result |
|---|---|---|
| `ratio` | `numerator`, `denominator`: counter names | A share from 0 to 1; "not available" when the denominator is 0 |
| `complement` | `of`: a measure id | 1 minus the value; "not available" when the value is |

`interval` may be `wilson95` on a `ratio`. `better` is `higher` or `lower`. There is no combined
score and no harmonic-mean operation in this version.

### Counters available to measures

`expected_total`, `expected_found`, `expected_missed`, `findings_total`, `false_positives`,
`real_errors`, `additional_total`, `subtle_total`, `subtle_found`, `cases_decided`,
`cases_with_false_positive`, `clean_cases_decided`, `clean_cases_with_false_positive`,
`defective_cases_decided`, `defective_cases_flagged`.

`defective_cases_decided` counts decided cases with at least one expected error that is not
ignored; `defective_cases_flagged` counts those of them the judge flagged (at least one expected
error found).

### A judge evaluated per case

When every error rule of the judge set uses only fields outside any list, the judge gives one
verdict for the whole text and is evaluated per case (spec FR-061, research.md section 29). The
overall result then rests on two case-level measures, which the tool computes in that mode for any
judge, with or without a loaded definition; a definition may list them but does not have to:

| Measure | Computed as |
|---|---|
| `case_detection_rate` | `ratio` of `defective_cases_flagged` to `defective_cases_decided`, `wilson95`, higher is better |
| `clean_case_false_positive_rate` | `ratio` of `clean_cases_with_false_positive` to `clean_cases_decided`, `wilson95`, lower is better |

The check rules hold rules for them as for any measure (section 2); the bundled default
gives them the same defaults as the per-error rates. Only the rules whose measure is in use apply:
in this mode the rules on `case_detection_rate` and `clean_case_false_positive_rate`, otherwise the
rules on `detection_rate` and `false_positive_rate`. Nothing in code maps one rule onto another.
The minimum test size counts cases with expected errors in place of expected errors.
`examples/metrics/bias-verdict-example.json` is the example of such a judge.

Measures that need other inputs (for example agreement with human ratings, or stability across
repeated runs) cannot be expressed in this version; the guide states this.

### Validation

- A loaded definition is validated against the schema and these rules: known operations and
  counters only; measure ids unique; `complement` points at an existing measure; the two required
  measures present; the judge set is valid by the rules of the `judge_set` layout; every rule uses only
  fields of the sample reply; every clean base case has a field for every variable of the prompt
  and no expected errors.
- An invalid file is rejected with a plain message naming the problem; already registered metrics
  are untouched.

### How a metric is used

1. A metric reaches the session in one of two ways. A new test project starts with the default
   metric file (Accuracy). A loaded test project file carries the definition of its metric.
2. The default metric file gives the starter `judge_set` (prompt, sample reply, finding text,
   rules, catalog) and `clean_base_cases` of a new test project. There is no window to choose a
   metric. A loaded definition with the same id replaces the default.
3. The active metric supplies the matching parameters and the list of measures. The two required
   measures appear in the Summary; any further measures appear only in "Details". When the user
   writes their own judge without an example, the default parameters and the two standard measures
   are used.
4. The test project file records the active metric's `id`, its parameters and, for a metric that
   is not the default file, its definition, and the check rules in use (file-formats.md, section 1).

## 2. Check rules (thresholds)

Since T266 and constitution 2.0.0 there is no file for the thresholds on their own: the rules below are saved in the `checks` of the test project file (file-formats.md, section 1). The JSON shows the shape of `checks`; its `format` and `schema_version` are the ones of the bundled default.

```json
{
  "format": "judge-the-judge-checks",
  "schema_version": 1,
  "rules": [
    { "measure": "detection_rate", "comparison": "at_least", "value": 0.8 },
    { "measure": "false_positive_rate", "comparison": "at_most", "value": 0.1 },
    { "measure": "case_detection_rate", "comparison": "at_least", "value": 0.8 },
    { "measure": "clean_case_false_positive_rate", "comparison": "at_most", "value": 0.1 }
  ]
}
```

- `comparison` is `at_least` or `at_most`; `value` is from 0 to 1.
- A rule applies only when its measure is in use for the current judge: the two per-error rates
  for a judge evaluated per expected error, the two case-level rates for a judge evaluated per case
  (section 1, "A judge evaluated per case"). Rules on measures not in use are kept and saved but do
  not count.
- The overall result is Works when every rule passes and Does not work when any fails (FR-068). A
  rule on a measure that is "not available" counts as passed for `false_positive_rate` (no
  findings means no false positives) and as failed for any other measure.
- The bundled default (`src/core/metrics/builtin/checks.default.json`) holds the four rules above
  and, in addition, the minimum test size. The tool reads both from this file: a new test project
  starts with the rules, and `MINIMUM_SAMPLE` is the minimum (T273); neither is written in code:

```json
"minimum_sample": { "expected_errors": 30, "clean_cases": 10 }
```

- The minimum test size is fixed by the spec; the tool uses the bundled value for the result it shows. The test run section of a test project file stores `minimum_sample` only so that its stored result can be recomputed on load (SC-003; file-formats.md, section 5).
- The two rules that apply are shown and editable in the collapsed "Details" section of the Summary
  view, the only thing that can be changed on the Results step (FR-069). There is no "Load check
  settings" (T266): the two defaults are edited there, and the separate checks file format, its
  schema and `examples/metrics/checks-example.json` were removed with the Help rows that named them (T269). The rules in use are stored in every test project file.
- Invalid rules in a loaded test project file (unknown measure, value out of range, unknown comparison) are rejected with a plain message and the rules in use stay unchanged.

## 3. Registry

- One registry holds all metric definitions for the session. The default metric file is registered
  at start; loaded ones when the user loads their file. Nothing is remembered after the page is
  closed.
- The interface reads the list of examples and the list of measures only from the registry and the
  active metric; no screen names a metric or measure in its own code.

## 4. Guide, example and contract tests

- `docs/how-to-add-a-metric.md`: a short guide in plain language, written so a non-developer can
  produce a definition with AI help.
- `examples/metrics/bias-example.json`: an example metric for a judge that reads a single text (one
  variable) and lists the biased sentences; `examples/metrics/bias-verdict-example.json`: the same
  judge giving only a verdict for the whole text, evaluated per case.
- A shared contract test suite runs against the default metric file (`accuracy`) and the two example files:
  schema-valid, validation rules pass, every measure computes on a fixed set of counters, the
  starter prompt composes with each of its clean base cases, and the starter rules give the
  expected findings on the definition's own sample reply.
- The guide, the example and Help quote the same files the tests validate (Principle VIII).
