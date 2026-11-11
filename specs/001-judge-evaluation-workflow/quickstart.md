# Quickstart: Judge the Judge

**Date**: 2026-11-11 | **Plan**: [plan.md](./plan.md)

How to run the tool locally and the scenarios that prove it works end to end. Formats are in
[contracts/file-formats.md](./contracts/file-formats.md); screens are in
[contracts/ui-flow.md](./contracts/ui-flow.md).

## Prerequisites

- Node.js, current long-term-support release (includes npm). It is not yet installed on the
  development machine.
- A modern browser.
- For scenarios that use a real judge: any LLM chat tool. The mock data needs none.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies (first time only). |
| `npm test` | Runs unit, contract and integration tests. No browser needed. |
| `npm run dev` | Starts the tool locally with live reload. |
| `npm run build` | Produces the static site in `dist/`. |
| `npm run preview` | Serves `dist/` locally, as a static host would. |
| `npm run e2e` | Runs the end-to-end and accessibility checks against the built site. |

Opening `dist/` from any static file server, in any subfolder, must work without configuration.

## Validation scenarios

Each scenario is also an end-to-end test. Expected numbers for the mock data are stored in
`examples/mock/expected-result.json` and asserted by the tests.

### V1. First run with mock data (SC-001, User Stories 1 and 11)

1. Open the tool. Step 1 shows an empty state offering mock data.
2. Load mock data: the Accuracy judge, a 20-scenario dataset (10 clean, 10 with 3 errors each) and
   the mock answers.
3. Finalize the dataset and open Results.

**Expected**: a final answer with its reason at the top; detection rate and false-alarm rate with
counts and intervals; the test-size summary showing 30 of 30 errors and 10 of 10 clean scenarios;
cases in every status the mock set is built to show (Pass, Fail, Awaiting verification). After
verifying the awaiting cases by hand, the answer is no longer "provisional" and matches the
expected result file. Whole flow in under 15 minutes for a first-time user.

### V2. Judge from scratch (User Story 2)

1. Type a prompt with `{{input}}` and `{{output}}`. Paste one sample reply and propose a mapping.
2. Confirm the mapping, save the judge, reload the page, load the saved file.

**Expected**: placeholders are listed; the preview marks the right parts as findings; the reloaded
judge is identical, with the same version.

### V3. Build a dataset by hand and with an LLM (User Stories 4, 5, 7, 12, 13)

1. Add one clean scenario by hand. Try to save an expected error without a description.
2. Copy the "clean scenarios" prompt, run it in an LLM, paste the answer, review, accept.
3. Copy the "add errors" prompt, paste the answer, review the side-by-side differences.
4. Save the dataset, reload the page, load the file, continue editing, then finalize.

**Expected**: the missing description is refused with a clear message; pasted scenarios pass
through the summary and review; uncovered changes and missing fragments are flagged; the test-size
summary updates and says what is missing; the reloaded dataset is identical and open; finalizing
shows the summary and warnings and then locks the inputs.

### V4. Bulk loop (SC-011, User Stories 6, 8, 9, 10)

1. Load the CSV template after adding rows, including one invalid row and Polish characters.
2. Import the valid rows, finalize, export all prompts.
3. Import an answer batch containing a malformed entry, an unknown identifier and a duplicate.

**Expected**: the invalid row is listed with its position and reason; the prompt batch has one
prompt per case with identifiers and the dataset version; the answer summary shows accepted,
rejected, unmatched, duplicate and missing counts; at most six deliberate actions in the tool for
the whole loop.

### V5. Verification with an LLM opinion (User Story 1, scenario 8)

1. For a case awaiting verification, copy the verification prompt, run it, paste the opinion.
2. Review and approve.

**Expected**: the opinion appears as a proposal marked as coming from an LLM; the case stays
awaiting until approved; afterwards the verdict's source reads "LLM opinion, approved by the user".

### V6. Compare two judge versions (SC-002, User Story 15)

1. Save the result from V1. Choose "Change the judge, keep the cases", edit the prompt, import a
   second mock answer batch, save the second result.
2. Open Compare and pick both.

**Expected**: the three measures side by side; worsening marked "worse" or "clearly worse"; no
dataset warning. Comparing with a result from a different dataset shows the like-for-like warning.

### V7. Reproduce a result (SC-003, SC-008, User Story 16)

1. Export a result as JSON and as an HTML report. Reload the page. Import the JSON.
2. Open the HTML report in a browser without the tool and print it to PDF.

**Expected**: identical numbers, judge version and dataset version after import; the report opens
with the summary, contains every prompt, expected error, output and verdict, and prints cleanly.

### V8. Invalid and unsupported files (SC-004, SC-012, SC-013)

Load in turn: a broken JSON file, a dataset with 501 scenarios, a file with a newer
`schema_version`, a CSV with mixed identifiers, a dataset with a 100,001-character field, a metric
definition with an unknown operation.

**Expected**: each is rejected with a message that says what to fix; the data already loaded is
unchanged every time.

### V9. Another metric from a file (SC-005, User Story 17)

1. Load `examples/metrics/bias-example.json` on the Judge step and choose its starter.
2. Add a custom label on the Test cases step and try to delete a label that is in use.

**Expected**: a new starter appears without any other change; scenarios have a single `output`
field; the custom label is saved with the dataset; deleting a used label is refused with the list
of scenarios that use it.

### V10. Privacy, accessibility, layout (SC-006, Principle VII)

1. Run the tool with the network inspector open and complete V1.
2. Repeat key screens at 360 px width, in dark scheme, and with the keyboard only.

**Expected**: no network request carries user data (the Content Security Policy blocks all
connections); nothing remains after the page is closed; automated accessibility checks pass in
light and dark schemes; every action is reachable by keyboard.

## Performance checks

- A generated 500-scenario dataset loads, lists, filters and pages without the interface freezing
  for more than 2 seconds (SC-014).
- A 100-scenario file shows its import summary within seconds of being chosen (SC-010).
