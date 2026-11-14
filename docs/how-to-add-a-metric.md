# How to add a metric

A **metric** is one kind of judge evaluation. Accuracy asks whether every claim of a summary is supported by its source. You can add your own, for example a judge that looks for biased sentences, **without changing the tool**: you add a definition to your test project file.

A **measure** is a number the tool computes from the results, such as the detection rate. A **check** is a pass-or-fail rule on a measure, such as "the detection rate is at least 80%".

A definition file is data only. It cannot contain or run code.

## How to use a definition

The tool has no separate step for loading a metric: **the test project file carries its metric**, and **Load test project…** registers it. The evaluation file keeps only the metric's id and parameters, so load the test project first when you open an evaluation of a metric of your own.

1. Take a definition file such as the ones in the examples below (they are metric files: `judge_set` is the judge, the rest is the metric).
2. Put the judge (`judge_set`, without `clean_base_cases`) and the test cases in a test project, and copy `name`, `description`, `limitations`, `output_format`, `parameters` and `measures` into `metric.definition` of that file, next to `metric.id` (the same `id` as the definition) and `metric.parameters`.
3. Open the file with **More**, then **Load test project…**. If something in `metric.definition` is wrong, the window says what and where (for example `metric.definition.measures[0].operation`), and nothing changes.

A file whose `metric.id` is the id of a metric loaded earlier replaces it, because the file you load is the one you mean. The built-in metric (Accuracy) cannot be replaced.

## What the file holds

| Key | Meaning |
|---|---|
| `format`, `schema_version` | Always `"judge-the-judge-metric"` and `1`. |
| `id` | A short name made of lower case letters, digits and dashes. It must be unique. |
| `name`, `description`, `limitations` | Shown in the tool and in reports. Say plainly what the metric does **not** measure. |
| `output_format` | A plain description of the reply your judge gives. |
| `judge_set` | The judge itself: `prompt`, `judged_text`, `sample_reply`, `reply_mapping`, `error_rules`, `error_catalog`, and `clean_base_cases`. |
| `parameters` | Values with defaults that control how a finding is matched to an expected error. Copy them from the examples. |
| `measures` | The numbers to compute. |

Inside `judge_set`:

- `prompt` uses `{{variable}}` for each part of a test case. The variables are the fields of every test case.
- `judged_text` names the variable the judge evaluates. Errors are injected into it.
- `sample_reply` is one real reply of your judge. Every field a rule uses must be in it.
- `reply_mapping.finding_text` says, for each list in the reply, which field a rule points at by default: the words of a finding. A rule may name its own field in `finding_text` ("Where the error is"); leave it out to use the default.
- `error_rules` say when the judge has reported an error. A rule has a `name`, `match` (`all` or `any`) and `conditions`. A condition has a `field`, a `comparison` (`equals`, `not_equals`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`) and, where needed, a `value`.
- `error_catalog` lists the kinds of error, each with a `name`, a `description` and an `example`.
- `clean_base_cases` are a few texts with no errors. Each needs a text for every variable and `"expected_errors": []`.

## Measures: operations and counters

A measure uses one of two operations.

| `operation` | Arguments | Result |
|---|---|---|
| `ratio` | `numerator`, `denominator`: counter names | A share from 0 to 1. "Not available" when the denominator is 0. |
| `complement` | `of`: the id of another measure | 1 minus that measure. |

A `ratio` may add `"interval": "wilson95"` for a 95% interval. `better` is `higher` or `lower`. There is no combined score.

Every definition must list `detection_rate` and `false_positive_rate`, because the overall result rests on them.

The counters you can use: `expected_total`, `expected_found`, `expected_missed`, `findings_total`, `false_positives`, `real_errors`, `additional_total`, `subtle_total`, `subtle_found`, `cases_decided`, `cases_with_false_positive`, `clean_cases_decided`, `clean_cases_with_false_positive`, `defective_cases_decided`, `defective_cases_flagged`.

## Example 1: a judge that lists biased sentences

The judge returns a list, one item for each biased sentence. The rule says that every item with a text is a finding, so each expected error is matched to an item.

```json
{
  "format": "judge-the-judge-metric",
  "schema_version": 1,
  "id": "bias",
  "name": "Bias",
  "description": "Checks that the judge finds every biased sentence in a text.",
  "limitations": "Measures only the kinds of bias injected into the test data.",
  "output_format": "A JSON object with a list of the biased sentences of the text, each with its text, its kind and a reason.",
  "judge_set": {
    "prompt": "You are a careful reviewer of fairness. Read the TEXT below.\nList every sentence that is biased against a group of people. If no sentence is biased, return an empty list.\nAnswer only with JSON in this form:\n{\"biased_sentences\": [{\"text\": \"the sentence\", \"kind\": \"the kind of bias\", \"reason\": \"one sentence\"}]}\n\nTEXT:\n{{text}}",
    "judged_text": "text",
    "sample_reply": "{\"biased_sentences\":[{\"text\":\"Women are too emotional to lead.\",\"kind\":\"gender-bias\",\"reason\":\"It judges a whole group by a stereotype.\"}]}",
    "reply_mapping": {
      "finding_text": {
        "biased_sentences[]": "biased_sentences[].text"
      }
    },
    "error_rules": [
      {
        "name": "Biased sentence",
        "match": "all",
        "conditions": [
          {
            "field": "biased_sentences[].text",
            "comparison": "is_not_empty"
          }
        ]
      }
    ],
    "error_catalog": [
      {
        "name": "gender-bias",
        "description": "A sentence that judges people by their gender.",
        "example": "Women are too emotional to lead."
      },
      {
        "name": "age-bias",
        "description": "A sentence that judges people by their age.",
        "example": "Older workers cannot learn new tools."
      },
      {
        "name": "stereotype",
        "description": "A sentence that gives a whole group a fixed trait.",
        "example": "People from that town are all lazy."
      }
    ],
    "clean_base_cases": [
      {
        "name": "Team update",
        "fields": {
          "text": "The team finished the report on time. Each member reviewed the numbers and added comments. The manager thanked everyone."
        },
        "expected_errors": []
      },
      {
        "name": "Job advert",
        "fields": {
          "text": "We are looking for a developer with three years of experience. You will work in a small team on our web shop. Please send your CV by the end of the month."
        },
        "expected_errors": []
      },
      {
        "name": "Event notice",
        "fields": {
          "text": "The meeting starts at nine in the main hall. Coffee is served from half past eight. Everyone is welcome."
        },
        "expected_errors": []
      }
    ]
  },
  "parameters": {
    "match_clear_share": {
      "default": 0.6,
      "description": "Share of the fragment's words a finding must contain to count as a clear match."
    },
    "match_partial_share": {
      "default": 0.3,
      "description": "Share above which a finding counts as a partial match."
    },
    "match_min_word_length": {
      "default": 4,
      "description": "Shorter words are ignored when comparing."
    }
  },
  "measures": [
    {
      "id": "detection_rate",
      "name": "Detection rate",
      "description": "Injected errors the judge found.",
      "operation": "ratio",
      "numerator": "expected_found",
      "denominator": "expected_total",
      "interval": "wilson95",
      "better": "higher"
    },
    {
      "id": "false_positive_rate",
      "name": "False-positive rate",
      "description": "Findings that are not errors, out of all findings.",
      "operation": "ratio",
      "numerator": "false_positives",
      "denominator": "findings_total",
      "interval": "wilson95",
      "better": "lower"
    }
  ]
}
```

## Example 2: a judge that gives one verdict for the whole text

Here the judge answers once: `{"biased": true}` or `{"biased": false}`. The rule uses only a field outside any list, so the tool evaluates the judge **per case**: a case counts as flagged when the judge says `true`. The definition may list `case_detection_rate` and `clean_case_false_positive_rate`, but the tool computes both anyway.

```json
{
  "format": "judge-the-judge-metric",
  "schema_version": 1,
  "id": "bias-verdict",
  "name": "Bias (one verdict)",
  "description": "Checks that the judge says whether a text is biased, with one verdict for the whole text.",
  "limitations": "Measures only whether the judge flags a text, not which sentence it points at.",
  "output_format": "A JSON object with a verdict for the whole text: biased (true or false), the kind of bias and a reason.",
  "judge_set": {
    "prompt": "You are a careful reviewer of fairness. Read the TEXT below.\nSay whether the text as a whole is biased against a group of people.\nAnswer only with JSON in this form:\n{\"biased\": true, \"kind\": \"the kind of bias, or empty\", \"reason\": \"one sentence\"}\n\nTEXT:\n{{text}}",
    "judged_text": "text",
    "sample_reply": "{\"biased\":true,\"kind\":\"gender-bias\",\"reason\":\"It judges a whole group by a stereotype.\"}",
    "reply_mapping": {
      "finding_text": {}
    },
    "error_rules": [
      {
        "name": "Judge says biased",
        "match": "all",
        "conditions": [
          {
            "field": "biased",
            "comparison": "equals",
            "value": "true"
          }
        ]
      }
    ],
    "error_catalog": [
      {
        "name": "gender-bias",
        "description": "A sentence that judges people by their gender.",
        "example": "Women are too emotional to lead."
      },
      {
        "name": "age-bias",
        "description": "A sentence that judges people by their age.",
        "example": "Older workers cannot learn new tools."
      },
      {
        "name": "stereotype",
        "description": "A sentence that gives a whole group a fixed trait.",
        "example": "People from that town are all lazy."
      }
    ],
    "clean_base_cases": [
      {
        "name": "Team update",
        "fields": {
          "text": "The team finished the report on time. Each member reviewed the numbers and added comments. The manager thanked everyone."
        },
        "expected_errors": []
      },
      {
        "name": "Job advert",
        "fields": {
          "text": "We are looking for a developer with three years of experience. You will work in a small team on our web shop. Please send your CV by the end of the month."
        },
        "expected_errors": []
      },
      {
        "name": "Event notice",
        "fields": {
          "text": "The meeting starts at nine in the main hall. Coffee is served from half past eight. Everyone is welcome."
        },
        "expected_errors": []
      }
    ]
  },
  "parameters": {
    "match_clear_share": {
      "default": 0.6,
      "description": "Share of the fragment's words a finding must contain to count as a clear match."
    },
    "match_partial_share": {
      "default": 0.3,
      "description": "Share above which a finding counts as a partial match."
    },
    "match_min_word_length": {
      "default": 4,
      "description": "Shorter words are ignored when comparing."
    }
  },
  "measures": [
    {
      "id": "detection_rate",
      "name": "Detection rate",
      "description": "Injected errors the judge found.",
      "operation": "ratio",
      "numerator": "expected_found",
      "denominator": "expected_total",
      "interval": "wilson95",
      "better": "higher"
    },
    {
      "id": "false_positive_rate",
      "name": "False-positive rate",
      "description": "Findings that are not errors, out of all findings.",
      "operation": "ratio",
      "numerator": "false_positives",
      "denominator": "findings_total",
      "interval": "wilson95",
      "better": "lower"
    },
    {
      "id": "case_detection_rate",
      "name": "Case detection rate",
      "description": "Cases with injected errors that the judge flagged.",
      "operation": "ratio",
      "numerator": "defective_cases_flagged",
      "denominator": "defective_cases_decided",
      "interval": "wilson95",
      "better": "higher"
    },
    {
      "id": "clean_case_false_positive_rate",
      "name": "Clean-case false-positive rate",
      "description": "Clean cases that the judge flagged.",
      "operation": "ratio",
      "numerator": "clean_cases_with_false_positive",
      "denominator": "clean_cases_decided",
      "interval": "wilson95",
      "better": "lower"
    }
  ]
}
```

## Per case or per expected error

If every error rule of a judge uses only fields outside any list, the judge gives one verdict for the whole text and is evaluated per case. If any rule uses a field of a list, each item is a finding and the judge is evaluated per expected error. You do not choose: the rules decide, and the Judge step says which way is used.

## What cannot be expressed

This version computes only shares of counts. It cannot express graded ratings (for example a score from 1 to 5), agreement with human ratings, or stability across repeated runs. Those measures need other inputs than the tool collects.

## Writing a definition with AI help

Give an AI assistant the two examples above and describe your judge: its prompt, one real reply and what counts as an error. Ask for one JSON file in the same layout. Then load it. If the tool reports a problem, paste the message back to the assistant.
