# Contract: Core Library and Judge Reply Source

**Date**: 2026-11-13 | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

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
| `findVariables(prompt)` | Names of all `{{name}}` variables, in order, without repeats; any name, no built-in names (research.md, section 8). |
| `proposeJudgedText(variables, current)` | The variable to use as the judged text: `current` when it is still a variable, otherwise the last variable; says when it changed (FR-010). |
| `composePrompt(prompt, testCase)` | The prompt with each variable replaced by the case's field of that name. Adds nothing. Reports variables with no field. Field text is inserted literally. |
| `extractJson(text)` | The JSON in a text: the whole text, the content of a code fence, or the text from the first `{` or `[` to the last `}` or `]`; or "not readable" with the line and column in the whole text (FR-084). Never reads an inner part of a broken JSON as the answer. Used for judge replies, the sample reply and every pasted LLM answer. |
| `recognizeFields(sampleReply)` | The fields of a sample reply with path, kind and values seen, and its lists; or the reason the sample cannot be read, with line and column. Called whenever the sample changes; there is no read action (FR-088). |
| `proposeFindingText(recognized)` | Per list, the proposed field holding the text of a finding. |
| `validateRules(rules, recognized)` | Per rule: usable, or broken with the reason (unknown field, two lists, no conditions). |
| `evaluateCondition(condition, value)` | Holds, does not hold, or unknown (research.md, section 9). |
| `findFindings(replyText, rules, findingText)` | Whether the reply could be read; the findings with key, text and rule names; the fields that made a rule unknown. |
| `previewRules(sampleReply, rules, findingText)` | For the Judge step: every part of the sample with "finding (rule names)" or "no finding". |
| `countingMode(rules)` | `per_case` when there is at least one usable rule and every rule uses only fields outside any list (the judge gives one verdict for the whole text), otherwise `per_expected_error` (FR-061; research.md, section 29). |
| `judgeVersion(judgeSet)` | Asynchronous. Content version of prompt, finding-text choices and rules. |

## Test cases (`core/cases`)

| Function | Behavior |
|---|---|
| `validateCase(testCase, context)` | Problems and warnings for one case: no non-empty field, missing description, field too long, unknown category, unknown base, no field for a variable, field that matches no variable. A fragment that is in no field and a case identical to its base are not reported (T286). |
| `validateTestCases(cases, context)` | All case problems plus duplicate identifiers, mixed identifiers, size limit. |
| `assignIdentifiers(cases, existing)` | Identifiers for cases that have none, never colliding with existing ones; identifiers for expected errors inside each case. |
| `normalizeCategory(text)` | Lower case with dashes. |
| `addCategoriesFromText(catalog, pastedList)` | Catalog with pasted categories added; reports those skipped as already present. Accepts `name`, `name - description`, `name: description`, `name | description`. |
| `categoryUses(catalog, cases)` | Per category the number of test cases that use it (a case counts once) (FR-015). |
| `canRemoveCategory(catalog, cases, replies, started, name)` | Allowed, or refused with the one-sentence reason of FR-015 ("Used by N test cases. Remove those test cases first, or rename the category." or, after the start of the test run when every such case has a reply, "… It can be renamed."). `started` is true when the test run has started (T288). |
| `renameCategory(catalog, cases, from, to)` | Catalog and cases with the new name in every expected error; refused when the new name exists. |
| `canChangeCase(cases, replies, started, id, action)` | For **Rename**, **Remove** and **Edit expected errors**: always allowed today (FR-025, FR-039, FR-089): a base in use may be removed, the cases made from it lose `base` (T283), and a case with a reply may be edited. `checkExpectedErrorsJson`, `expectedErrorsToJson`, `planExpectedErrors` (core) and `saveExpectedErrors` (app) are "Edit expected errors", T254. |
| `checkCaseJson(text, context)` | file-formats.md, section 2. `context` = mode (`paste`, `clean`, `inject`, `correct`), variables, judged text, catalog, existing cases, picked base, number of errors to prepare, and the original case for `correct`. Returns problems (with line and column or field path), warnings, notes, the kind the case will have, and the case when valid (FR-031, FR-041, FR-083, FR-084, FR-089, FR-090). |
| `caseToJson(testCase)` | The case JSON of "Export test cases" and "Edit expected errors" (no `id`; `base` only when set; `source_fragment` after `fragment` when the error has one, T250); `checkCaseJson` of its output gives the same fields and expected errors (SC-036). |
| `markLate(case, hasReplies, change)` | Sets `changed_after_first_reply` to `added` or `corrected` when replies exist (FR-053). |
| `testCasesFeedback(cases)` | Clean and injected-errors counts, missing kinds, duplicate texts, remaining capacity. |
| `testSizeForecast(cases, minimumSample)` | Totals, grouping by number of expected errors, and met or missing for each minimum. |
| `startSummary(cases, judgeSet)` | Everything shown before "Start test run" (T288, FR-052), with all warnings, and whether the start is allowed (refused for no test cases or an empty judge prompt). Was `finalizeSummary`. |
| `testCasesVersion(cases)` | Asynchronous. Content version. |

## Files and pasted text (`core/io`)

Every reader returns either the parsed value with notes, or a list of problems. Every writer
returns text.

| Function | Behavior |
|---|---|
| `readTestProject(text, isMetricLoaded)` / `writeTestProject(project, results, meta)` | file-formats.md, sections 1 and 5 (T289): the judge set with the error catalog, the test cases (key `dataset`), the active metric, the check rules and, when the test run has started, the `test_run` section (replies, decisions with sources, added findings with category, difficulty and `from_opinion`, model details, versions, `minimum_sample` and results). Upgrades a version 1 file (drops `dataset.finalized`, with a note). Ignores an old `proposals` key with a note. The reader returns `{ project, hasTestRun, toolVersion, testCasesVersion, stored }`: `hasTestRun` lets the load ask its question, and `stored` (saved, judge version, minimum test size, results) is what `recompute` compares with. `meta` is `{ now, toolVersion, judgeVersion, testCasesVersion }`: the core has no clock and hashing is asynchronous, so the caller passes them in. A file with the format `judge-the-judge-evaluation` gets the message for an unknown `format`. |
| `withoutTestRun(project)` | "Load the test project only" (T289): the same test project with no test run and no `changed_after_first_reply` on any case. |
| `readTestCasesJson(text, variables, catalog, existingCases)` / `writeTestCases(cases, name)` | Section 3, for "Import test cases" (adds; new identifiers for taken ones, `base` remapped; taken names kept with a warning) and "Export test cases"; also reads the cases of a test project file. Returns an import summary. |
| `readTestCasesCsv(text, variables, catalog)` | Section 4: every row a clean case. Returns an import summary with valid cases and invalid rows. |
| `decodeBytes(bytes)` | Text and the encoding used (UTF-8, or Windows-1250 as fallback). |
| `exampleCsv(variables)` | The file of "Download example file", built from the current variables (FR-030). |
| `readOpinion(text, caseId)` | Section 7: the verification opinion for one case; refuses a list of several opinions and an opinion for another case, and a JSON that cannot be read (line and column), with the reason. |
| `readMetricDefinition(text)` / `readCheckConfiguration(text)` | metric-and-checks.md. The tool no longer reads a check configuration from the Results step (T266); the reader goes with its format in T225. |
| `buildHtmlReport(project, results, now, toolVersion)` | Section 8: one self-contained HTML document as text, every value escaped; says at the top how many cases are not decided yet (not run, awaiting verification) when there are any; no "provisional" mark (T267). |

## Prompts for the user's LLM (`core/generation`)

| Function | Behavior |
|---|---|
| `cleanCasePrompt(judgeSet, likeCase)` | Asks for ONE clean case in the case JSON layout with `"expected_errors": []`: the judge prompt with its variables and judged text, the catalog (so the case contains none of its errors), and the fields of the **Like case** as a model when one is picked (FR-083). |
| `injectErrorsPrompt({ judgeSet, base, errors })` | Asks for ONE case in the case JSON layout: with a base, its fields with the errors written into the judged text; without one, the whole case. One expected error per row (category with its description, difficulty or left to the LLM, what should be wrong), exact fragments (FR-040, FR-043). |
| `verificationPrompt(project, caseId)` | For one case with a reply: its identifier, fields, numbered expected errors, numbered additional findings, the received reply, and the fixed JSON opinion to return, including `new` for findings not in the list with optional category and difficulty (FR-063). |

All three state the reply format of file-formats.md (sections 2 and 7) and are rebuilt whenever
their inputs change.

## Evaluation (`core/evaluation`)

| Function | Behavior |
|---|---|
| `matchLevel(findingText, fragment, parameters)` | Clear, partial or none (research.md, section 10). |
| `reviewCase(testCase, findings, parameters, mode)` | The automatic result for one case: per expected error its state, attached findings and reason; the additional findings; whether approval is needed (research.md, section 11). In `per_case` mode a flagged reply makes every expected error found and an unflagged one makes every expected error missed; on a clean case the whole-reply finding is an additional finding; the review says whether the text was flagged. |
| `genuineErrors(reviewed)` | T259: the findings marked Genuine error in the decided cases, each with its case (`caseId`, `caseName`, `text`), in the order of the cases; Results lists them. |
| `applyDecisions(review, decisions)` | The effective state and source of every item, with partly matching findings moved to additional findings when their expected error was decided missed; decisions whose target no longer exists are returned separately. |
| `caseStatus(effective)` | Not run, Awaiting verification, Pass or Fail (FR-064). |
| `opinionPlan(testCase, review, decisions, opinion)` | The preview of FR-063: per answered item its current mark and source and the new mark, with reason and fragment, flagged when it replaces a mark set by hand; new findings; unanswered items with the reason; notes; and whether it can be applied ("classifies none" when no item is answered and no finding added). |
| `applyOpinion(decisions, plan)` | Decisions with source `llm-approved` for every answered item (marks set by hand included), new findings added to `added_findings` with `from_opinion`, unanswered undecided items marked "no answer", and `approved` set. |
| `addFinding(decisions, text, category, difficulty)` / `removeFinding(decisions, index)` | Add or remove a finding of `added_findings`; only those can be removed (FR-062). |
| `countAll(project, mode)` | All counters, overall and per category, difficulty and rule, and additional findings per category and difficulty (FR-070). In `per_case` mode also `defective_cases_decided` and `defective_cases_flagged`, and the category and difficulty groups count cases (a case once in each category and difficulty its errors have) with counts only (FR-066, FR-070). |
| `wilson(successes, total)` | Lower and upper bound of the 95% interval, or none when total is 0. |
| `computeMeasures(counters, metric)` | Every measure of the active metric, with intervals; `provisional` in the results only means that some cases are not decided (`undecided > 0`) and is never shown as a word (T267). |
| `overallResult(counters, measures, checks, minimumSample, mode)` | Works, Does not work or Inconclusive, with reasons and borderline notes (FR-068). In `per_case` mode the check rules apply to the two case-level rates and the minimum counts cases with errors; the first reason says the judge was evaluated per case. |
| `computeResults(project, metric)` | Everything the Results step and the files show, in one value, including the way of counting and, when a correction of the rules changed it after replies, the way used before (FR-075). |
| `recompute(storedFile)` | The results recalculated from a test project file loaded with its test run, and any differences from the stored results. |
| `resumePoint(project)` | The first step with unfinished work (Judge, Test cases, Test run, Results) and, on Test run, the case **Continue** opens: the first awaiting verification, else the first not run (FR-073). Test cases while the test run has not started. |

## Metrics (`core/metrics`)

| Function | Behavior |
|---|---|
| `createRegistry(builtIns)` | A registry holding the built-in definitions. |
| `register(registry, definition)` | A new registry including the definition, or the reason it was refused. |
| `listExamples(registry)` | What the "Load demo…" window offers, besides the demo. |
| `evaluateMeasure(measure, counters, computed)` | The value of one declarative measure. |
| `evaluateChecks(measures, checks)` | Pass or fail per rule. |

## Judge reply source (`src/sources`)

The one interface through which judge replies reach the test run (Principle III).

```text
JudgeReplySource
  id, label
  collect(request) → asynchronous → ReplyBatch

ReplyBatch
  items      list of { case_id, reply }
  problems   list of entries that could not be read, with reasons
```

| Adapter | `request` | Used by |
|---|---|---|
| Pasted reply | one case identifier and the text read from the clipboard or typed into the always-visible box | The case window of Test run ("Paste reply", the box, "Keep as text") |

- The application passes every `ReplyBatch` to one function, `attachReplies(project, batch,
  replaceChoice)`, which matches by identifier, stores each reply together with the prompt composed
  for its case, resets a case whose reply is replaced (its decisions, the added findings included, are removed),
  records the judge version when the first reply arrives, and reruns reading and matching for the
  affected cases. `replaceNeedsQuestion(project, caseId)` says whether replacing must ask first:
  only when the case has decisions with source `manual` or `llm-approved`, and how many (FR-056).
- This version ships one adapter. A later adapter that reads many replies from a file, or one that
  calls an LLM, implements the same interface and returns the same `ReplyBatch`; nothing in
  `core/evaluation` changes.

## Application state (`src/app`)

Not part of the core, but its contract with the interface is fixed here so the two can be built in
parallel.

- One state object (see data-model.md, TestProject, plus the metric registry, the current step, the
  open window with its case, the reply drafts, the open state of the "Error categories" section,
  and the "unsaved changes" flag) and a set of named actions. Actions
  call core functions and return the next state; components never change data directly.
- Derived values (variables, judged text, recognized fields, findings, case reviews, statuses,
  counters, measures, overall result, feedback, versions) are recomputed from state and never
  stored in it.
- The state counts the replies saved since the last "Save test project"; the interface shows the
  number and reminds the user after every 25 (FR-059). Nothing is written to browser storage.
- One "unsaved changes" flag (FR-051): set by any change; cleared by a successful "Save test
  project" or "Save test project as…" (T289). A case JSON being
  pasted in the test case window is not part of the state until "Save case" or "Approve and
  close"; the window has no file save action, and **Close without saving** asks first when
  something was typed. An opinion in the second-opinion window changes nothing until "Apply
  opinion".
- "Start test run" (FR-052, T288) is an action allowed while the test run has not started, there
  is at least one test case and the judge prompt is not empty. It creates an empty test run; there
  is no action that undoes it. Before it, the actions of the Test run step are refused with the
  reason "Start the test run first" (FR-053).
- The unsaved-work guard asks before any action that would discard unsaved work, with **Save
  test project first**, **Discard** and **Cancel**: "Load test project…" over existing work,
  "Load demo…" and "New test project" (FR-051). The load question of a file with a test run
  ("Load with the test run", "Load the test project only", "Cancel") comes after it and after
  the file is validated (file-formats.md, section 1). Replacing a reply whose case has decisions set by hand or from an applied opinion asks
  separately, saying how many will be removed (FR-056).
- **Ports** (`src/app/ports/`, research.md sections 25 and 32): one `SaveTarget`, for the test
  project file (`save`, `saveAs`, `useLoaded`, `forget`, with the results "saved", "cancelled"
  and "file no longer writable"); "Load with the test run" through the picker calls `useLoaded`;
  "Load the test project only", a dropped file, "New test project" and "Load demo…" call
  `forget` (FR-076); and
  `ClipboardReader` (`readText`, with the results text, "empty", "refused" and "not available").
  Each has a browser adapter and a fake used by unit, component and integration tests; actions
  receive them as arguments and never call browser APIs themselves.
