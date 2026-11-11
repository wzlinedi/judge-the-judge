# Contract: Core Library and Judge Output Source

**Date**: 2026-11-11 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

The public surface of `src/core`. These functions are the unit under test for Principle I and the
boundary required by Principle III.

## Rules for the whole core

- No access to the DOM, the network, timers, the clock or random numbers. A date or a tool version
  is passed in as an argument.
- Functions are pure: the same arguments give the same result, and arguments are never changed.
  The only asynchronous functions are the two that compute content versions (they use Web Crypto).
- Anything that can fail on user data returns a value describing the problems (a list of plain
  messages with a position), and does not throw. Throwing is reserved for programming errors.
- `src/core` imports nothing from `src/ui`, `src/app` or `src/sources`. A lint rule and a test
  enforce this.

Names below describe behavior; exact TypeScript signatures are written with their tests.

## Judge (`core/judge`)

| Function | Behavior |
|---|---|
| `findPlaceholders(prompt)` | Names of all `{{name}}` placeholders, in order, without repeats. |
| `composePrompt(judge, scenario)` | The prompt with each placeholder replaced by the scenario's field of that name. Adds nothing. Reports placeholders with no field. Text of a field is inserted literally, even if it contains `{{…}}`. |
| `extractJson(text)` | The JSON value in a reply after removing code fences and surrounding prose, or "not JSON". |
| `readReply(text, mapping)` | The parts of a reply and which of them are findings, or "unreadable" with the reason. |
| `proposeMapping(sampleReply)` | A proposed mapping with the list of parts it would treat as findings, or an explanation of why none could be proposed. |
| `judgeVersion(judge)` | Asynchronous. Content version of prompt and mapping. |

## Dataset (`core/dataset`)

| Function | Behavior |
|---|---|
| `validateScenario(scenario, context)` | Problems and warnings for one scenario: empty fields, missing description, field too long, fragment not in its field, unknown base, missing field for a placeholder. |
| `validateDataset(dataset, context)` | All scenario problems plus duplicate identifiers, mixed identifiers, size limit. |
| `assignIdentifiers(scenarios, existing)` | Identifiers for scenarios that have none, never colliding with existing ones. |
| `normalizeLabel(text)` | Lower case with dashes. |
| `addLabelsFromText(catalog, pastedList)` | Catalog with pasted labels added; reports those skipped as already present. Accepts `name`, `name - description`, `name: description`, `name | description`. |
| `datasetFeedback(dataset)` | Clean and defective counts, missing kinds, duplicate texts, remaining capacity. |
| `testSizeSummary(dataset, minimumSample)` | Totals, grouping by number of expected errors, and met or missing for each minimum. |
| `compareWithBase(variant, base)` | Word-level differences per field, changed places covered by no expected error, fragments not found word for word. |
| `finalizeSummary(dataset, judge)` | Everything shown before finalizing, including the warnings about no reply mapping and no subtle errors, and whether finalizing is allowed. |
| `datasetVersion(dataset)` | Asynchronous. Content version. |

## Files and pasted text (`core/io`)

Every reader returns either the parsed value with notes, or a list of problems. Every writer
returns text.

| Function | Behavior |
|---|---|
| `readJudgeFile(text, fileName)` / `writeJudgeFile(judge)` | Section 1 of file-formats.md, including plain text prompts. |
| `readDatasetJson(text)` / `writeDatasetJson(dataset)` | Section 2. |
| `readDatasetCsv(text, judge)` | Section 3. Returns an import summary with valid scenarios and invalid rows. |
| `decodeBytes(bytes)` | Text and the encoding used (UTF-8, or Windows-1250 as fallback). |
| `parseExpectedErrorLine(line)` / `formatExpectedErrorLine(error)` | The one-line convention, both directions. |
| `readPastedScenarios(text, dataset)` | Section 9: scenario JSON in any accepted shape, or one-line convention lines. Returns an import summary. |
| `writePromptBatch(evaluation, which)` | Section 4; `which` is all cases or only those without an output. |
| `readAnswerBatch(text)` | Section 5. |
| `readOpinions(text)` | Section 9: one or many verification opinions. |
| `writeResultFile(result)` / `readResultFile(text)` | Section 6. |
| `readMetricDefinition(text)` / `readCheckConfiguration(text)` / `writeCheckConfiguration(checks)` | metric-and-checks.md. |
| `buildHtmlReport(result)` | Section 10: one self-contained HTML document as text, every value escaped. |
| `datasetTemplateCsv()` / `datasetTemplateJson()` | The downloadable templates with instructions and an example (FR-018). |

## Prompts for the user's LLM (`core/generation`)

| Function | Behavior |
|---|---|
| `cleanScenariosPrompt(judge, catalog, options)` | Step 1: asks for a number of clean scenarios, optionally on a topic. |
| `addErrorsPrompt(judge, catalog, cleanScenarios, options)` | Step 2: asks for variants with errors (variants per scenario, errors per variant, share of subtle errors), spreading catalog categories evenly, returning `base` and exact fragments. |
| `scenarioPrompt(judge, catalog, scenario, goal, options)` | Per-scenario prompt with a goal: add a defect, another variant with the same defect, or a corrected clean version. |
| `verificationPrompt(evaluation, caseIds)` | For one case or all cases awaiting verification: fields, expected errors, received output, and the fixed JSON opinion to return. |

All four include the user's "own changes" text with priority when given, and state the reply
format from file-formats.md section 9. They are pre-filled from the judge prompt, the error catalog
with descriptions and examples, and the scenario fields with their roles.

## Evaluation (`core/evaluation`)

| Function | Behavior |
|---|---|
| `matchLevel(findingText, fragment, parameters)` | Clear, partial or none (research.md, section 8). |
| `matchCase(scenario, output, mapping, parameters)` | A MatchResult. |
| `automaticVerdict(matchResult)` | A verdict with source "automatic" when the match is clear, otherwise none. |
| `caseStatus(scenario, output, verdict)` | Not run, Awaiting verification, Pass or Fail. |
| `verdictFromMarks(scenario, marks)` | A verdict with source "manual" from the user's marks. |
| `proposalFromOpinion(scenario, opinion)` | Marks proposed by a verification opinion, with its reasons. |
| `countAll(evaluation)` | All counters, overall and per label and difficulty. |
| `wilson(successes, total)` | Lower and upper bound of the 95% interval, or none when total is 0. |
| `computeMeasures(counters, metric)` | Every measure of the active metric, with intervals and the "provisional" flag. |
| `finalAnswer(evaluation, measures, checks, minimumSample)` | Works, Does not work or Inconclusive, with reasons and borderline notes. |
| `buildResult(evaluation, label, now, toolVersion)` | A Result snapshot. |
| `recompute(result)` | The summary recalculated from a stored result, and any differences from the stored summary. |
| `compareResults(older, newer)` | Side-by-side measures with "worse" and "clearly worse" marks and the like-for-like warning. |

## Metrics (`core/metrics`)

| Function | Behavior |
|---|---|
| `createRegistry(builtIns)` | A registry holding the built-in definitions. |
| `register(registry, definition)` | A new registry including the definition, or the reason it was refused. |
| `listStarters(registry)` | What the Judge step shows as starters. |
| `evaluateMeasure(measure, counters, computed)` | The value of one declarative measure. |
| `evaluateChecks(measures, checks)` | Pass or fail per rule. |

## Judge output source (`src/sources`)

The one interface through which judge outputs reach an evaluation (Principle III).

```text
JudgeOutputSource
  id, label
  collect(request) → asynchronous → OutputBatch

OutputBatch
  dataset_version   optional
  items             list of { case_id, output }
  problems          list of entries that could not be read, with reasons
```

| Adapter | `request` | Used by |
|---|---|---|
| Pasted output | one case identifier and the pasted text | Run step, one case at a time |
| Batch | text of a file or pasted block | Run step, "Import answers" |

- The application passes every `OutputBatch` to one function, `attachOutputs(evaluation, batch,
  overlapChoice)`, which matches by identifier, reports unmatched, duplicate and conflicting
  entries, applies the keep-or-replace choice, and reruns matching for the affected cases.
- A future adapter that calls an LLM would implement the same interface and return the same
  `OutputBatch`; nothing in `core/evaluation` would change.

## Application state (`src/app`)

Not part of the core, but its contract with the interface is fixed here so the two can be built in
parallel.

- One state object (see data-model.md, Evaluation, plus shelf, registry, current step, and the
  "work not exported" flag) and a set of named actions. Actions call core functions and return the
  next state; components never call core functions that change data directly.
- Derived values (statuses, measures, final answer, feedback, versions) are recomputed from state
  and never stored in it.
- The unsaved-work guard asks before any action that would discard a dataset with unsaved changes,
  outputs, or unexported results (FR-004, FR-048, FR-050, FR-073).
