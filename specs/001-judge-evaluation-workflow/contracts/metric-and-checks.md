# Contract: Metric Definitions and Check Configuration

**Date**: 2026-11-11 | **Plan**: [../plan.md](../plan.md) | **Constitution**: Principle VI

A **metric** is one kind of judge evaluation, for example Accuracy (is every claim of the output
supported by the input?) or Completeness (is every element of the input present in the output?).
A **measure** is a number computed from the results, for example the detection rate. A **check** is
a pass-or-fail rule on a measure.

- Exactly two metrics are built in: `accuracy` and `completeness`. They are ordinary definition
  files bundled with the tool (`src/core/metrics/builtin/`) and registered at start.
- A user loads further metrics from a file at run time. Loading one never requires a change to the
  core, the interface or the other metrics (SC-005).
- Definition files are data only. They cannot contain or trigger code.

## 1. Metric definition file

```json
{
  "format": "judge-the-judge-metric",
  "schema_version": 1,
  "id": "accuracy",
  "name": "Accuracy",
  "description": "Checks that every claim in the output is supported by the input.",
  "limitations": "Measures only the kinds of errors injected into the test data.",
  "required_fields": ["input", "output"],
  "output_format": "A JSON object with a list of claims, each with its text and a verdict.",
  "judge": {
    "prompt": "…starter judge prompt with {{input}} and {{output}}…",
    "reply_mapping": {
      "list_path": "claims",
      "text_key": "text",
      "assessment_key": "verdict",
      "problem_values": ["contradicted", "unsupported"],
      "category_key": null,
      "target_field": "output"
    }
  },
  "error_catalog": [
    { "name": "factual-error", "description": "…", "example": "…" }
  ],
  "parameters": {
    "match_clear_share": { "default": 0.6, "description": "Share of the fragment's words a finding must contain to count as a clear match." },
    "match_partial_share": { "default": 0.3, "description": "Share above which a finding counts as a partial match." },
    "match_min_word_length": { "default": 4, "description": "Shorter words are ignored when comparing." }
  },
  "measures": [
    { "id": "detection_rate", "name": "Detection rate", "description": "Injected errors the judge found.",
      "operation": "ratio", "numerator": "expected_found", "denominator": "expected_total",
      "interval": "wilson95", "better": "higher" },
    { "id": "false_alarm_rate", "name": "False-alarm rate", "description": "Findings that point at no injected error.",
      "operation": "ratio", "numerator": "false_alarms", "denominator": "findings_total",
      "interval": "wilson95", "better": "lower" },
    { "id": "combined_score", "name": "Combined score", "description": "One summary of both measures.",
      "operation": "harmonic_mean", "of": ["detection_rate", { "operation": "complement", "of": "false_alarm_rate" }],
      "better": "higher" }
  ]
}
```

### Required metadata (Principle VI)

| Key | Meaning |
|---|---|
| `id` | Unique in the registry: lower case, digits, dashes. Loading a file whose `id` is already registered is refused unless the user chooses to replace a previously loaded one; built-in metrics cannot be replaced. |
| `name`, `description`, `limitations` | Shown in the tool, in Help and in reports. |
| `required_fields` | The scenario fields this metric's judge needs; new scenarios start with them. |
| `output_format` | Plain description of the judge reply this metric expects. |
| `parameters` | Configurable values with defaults and descriptions. |
| `measures` | At least `detection_rate` and `false_alarm_rate`, because the final answer rests on them. |

### Operations the tool provides

| `operation` | Arguments | Result |
|---|---|---|
| `ratio` | `numerator`, `denominator`: counter names | A share from 0 to 1; "not available" when the denominator is 0 |
| `complement` | `of`: a measure id or nested operation | 1 minus the value |
| `harmonic_mean` | `of`: two or more measure ids or nested operations | Harmonic mean; "not available" when any part is |

`interval` may be `wilson95` on a `ratio`. `better` is `higher` or `lower` and drives the "worse"
marking in comparisons.

### Counters available to measures

`expected_total`, `expected_found`, `findings_total`, `false_alarms`, `cases_judged`,
`cases_with_false_alarm`, `clean_cases_judged`, `clean_cases_with_false_alarm`.

Measures that need other inputs (for example agreement with human ratings, or stability across
repeated runs) cannot be expressed in this version; the guide states this.

### Validation

- A loaded definition is validated against the schema and these rules: known operations and
  counters only, measure ids unique, references point at existing measures with no cycles, the two
  required measures present, the judge prompt uses exactly the `required_fields` as placeholders.
- An invalid file is rejected with a plain message naming the problem; already registered metrics
  are untouched.

### How a metric is used

1. On the Judge step each registered metric appears as a starter ("Populate for accuracy",
   "Populate for completeness", and one per loaded definition).
2. Choosing a starter fills the judge prompt and reply mapping and the dataset's error catalog,
   after asking before replacing existing content, and makes that metric the active one.
3. The active metric supplies the matching parameters and the list of measures for the Results
   step, the report and comparisons. When the user types their own prompt without a starter, the
   default parameters and the three standard measures are used.
4. A result file records the active metric's `id` and its parameters.

## 2. Check configuration file

```json
{
  "format": "judge-the-judge-checks",
  "schema_version": 1,
  "rules": [
    { "measure": "detection_rate", "comparison": "at_least", "value": 0.8 },
    { "measure": "false_alarm_rate", "comparison": "at_most", "value": 0.1 }
  ]
}
```

- `comparison` is `at_least` or `at_most`; `value` is from 0 to 1.
- The final answer is Works when every rule passes and Does not work when any fails (FR-067). A
  rule on a measure that is "not available" counts as passed for `false_alarm_rate` (no findings
  means no false alarms) and as failed for any other measure.
- The bundled default (`src/core/metrics/builtin/checks.default.json`) holds the two rules above
  and, in addition, the minimum test size:

```json
"minimum_sample": { "expected_errors": 30, "clean_scenarios": 10 }
```

- The minimum test size is fixed by the spec. A loaded check configuration that contains
  `minimum_sample` is accepted, but that key is ignored and the user is told so.
- The two default rules are shown and editable in the collapsed "Evaluation settings" section of
  the Results step; a loaded configuration replaces them; the current rules can be saved as a file.
- An invalid configuration (unknown measure, value out of range, unknown comparison) is rejected
  with a plain message and the rules in use stay unchanged.

## 3. Registry

- One registry holds all metric definitions for the session. Built-in definitions are registered
  at start; loaded ones when the user loads their file. Nothing is remembered after the page is
  closed.
- The interface reads the list of starters and the list of measures only from the registry and the
  active metric; no screen names a metric or measure in its own code.

## 4. Guide, example and contract tests

- `docs/how-to-add-a-metric.md`: a short guide in plain language, written so a non-developer can
  produce a definition with AI help.
- `examples/metrics/bias-example.json`: an example metric for an output-only judge (one field,
  `output`), and `examples/metrics/checks-example.json`.
- A shared contract test suite runs against `accuracy`, `completeness` and the example file:
  schema-valid, validation rules pass, every measure computes on a fixed set of counters, the
  starter prompt composes with a scenario that has the required fields, and the starter reply
  mapping reads a sample reply kept beside each definition in the tests.
- The guide, the example and Help quote the same files the tests validate (Principle VIII).
