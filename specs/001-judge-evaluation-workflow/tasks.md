---

description: "Task list for Judge the Judge"
---

# Tasks: Judge the Judge

**Input**: Design documents from `specs/001-judge-evaluation-workflow/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included and mandatory. Constitution Principle I (Test-First) is non-negotiable. Every
story phase starts with its end-to-end scenario and its unit, contract and component tests, all
written first and confirmed to fail; implementation tasks follow and name the tests they make
pass. No code is copied from `prototypes/`; behavior taken from prototype v17 is first written as
a test. Where v17 differs from the spec or the contracts, the spec wins.

**Revised 2026-11-13** after the reviews of prototypes v13 to v17 (/speckit-analyze remediation):
task numbers are kept; rewritten tasks keep their number, T126 is retired, and the new ones are
T066a and T203 to T217.

**Help**: Principle VIII. Every story phase ends with the Help section for what it built
(`src/ui/help/sections/`), with examples taken from `examples/`. Nothing is published until the
Help is complete (T195).

**Organization**: One phase per user story. All P1 stories come first, in the order of plan.md:
the MVP (US1), saving and continuing with the two files (US6), the Judge step (US2), the Test
cases step (US3, US14, US4, US5) and Run (US7, US8, US9). US14 (P3) sits among them because US4 chooses
categories from its catalog; its second part, judges evaluated per case, follows US9 because it
changes the Results views. The P2 and P3 stories follow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1 to US15, as numbered in spec.md)
- Every task names the file it creates or changes

## Path Conventions

Single project at the repository root (plan.md, Project Structure): `src/core`, `src/sources`,
`src/app`, `src/ui`, `examples/`, `docs/`, `scripts/`, `tests/{unit,contract,integration,e2e}`.
Component tests live under `tests/unit/ui/` and run in a simulated DOM. The browser features
(saving to a chosen file, reading the clipboard) are reached only through the ports in
`src/app/ports/`; unit, component and integration tests use their fakes, and end-to-end tests
install an in-memory save file with an init script and grant clipboard permission.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, toolchain, design tokens, removal of answered prototypes

- [X] T001 Create the folder skeleton of plan.md: `src/core/{model,schemas,io,judge,cases,generation,evaluation,metrics/builtin}`, `src/sources`, `src/app/{actions,ports}`, `src/ui/{steps/{judge,cases,run,results},windows/{test-case,case-window,second-opinion,load-example},help/sections,components/shell,styles}`, `examples/{demo,files,metrics}`, `docs/schemas`, `scripts/`, `tests/{unit/ui,unit/app,contract,integration,e2e}`
- [X] T002 Create `package.json` (name `judge-the-judge`, version `1.0.0`, `"type": "module"`) with scripts `test` (vitest run), `dev`, `build`, `preview`, `e2e` (playwright test), `lint`; runtime dependencies `preact`, `zod`, `papaparse`, `diff`; dev dependencies `typescript`, `vite`, `@preact/preset-vite`, `vitest`, `jsdom`, `@testing-library/preact`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `typescript-eslint`, `@types/papaparse`, `@types/diff`; run `npm install` so exact versions are pinned in `package-lock.json`
- [X] T003 Create `tsconfig.json`: `strict: true`, target and lib ES2022 plus DOM, `jsx: react-jsx`, `jsxImportSource: preact`, `moduleResolution: bundler`, `resolveJsonModule: true`, `noUncheckedIndexedAccess: true`
- [X] T004 Create `vite.config.ts`: `base: './'`, Preact preset, `define.__TOOL_VERSION__` from `package.json`; Vitest config inside it: environment `node` by default, `jsdom` for `tests/unit/ui/**`, include `tests/{unit,contract,integration}/**/*.test.{ts,tsx}`
- [X] T005 [P] Create `eslint.config.js` with typescript-eslint and a `no-restricted-imports` rule that forbids files in `src/core/**` from importing `src/ui`, `src/app` or `src/sources`
- [X] T006 [P] Create `playwright.config.ts`: web server `npm run build && npm run preview` (served on `localhost`, a secure context for the clipboard and the save file), two projects `chromium` and `msedge` (channel `msedge`) only (FR-003; research.md, section 26), default viewport 1280 x 720, test dir `tests/e2e`, clipboard read and write permissions granted
- [X] T007 [P] Create `index.html` (`lang="en"`, title "Judge the Judge") with a Content Security Policy meta tag `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'` (research.md, section 13; FR-002, FR-003); system fonts only, no inline `<style>` or `<script>`, no external resources
- [X] T008 [P] Create `src/ui/styles/tokens.css`, the single source of colors, spacing, type sizes, radii, shadows and motion, in black and red (FR-007; research.md, section 30): red is the one accent (primary action, current step, focus ring); the dark scheme has a black background, the light scheme a white or near-white one with black text; success, warning and error colors of their own; light values by default, dark values under `prefers-color-scheme: dark` and under `[data-theme="dark"]`, light under `[data-theme="light"]`; every text pair at least 4.5:1 in both schemes. Create `src/ui/styles/base.css` (resets, visible focus ring, tables scroll inside their own container, usable from 360 px, `prefers-reduced-motion` respected, and the rule that `.fail`, `.error` and `.pass` marks always carry a sign such as ✕ or ✓ besides their color) (Principle VII)
- [X] T009 [P] Update `.gitignore` with `node_modules/`, `dist/`, `test-results/`, `playwright-report/`
- [ ] T010 Delete the answered prototypes `prototypes/ui-prototype/` and `prototypes/ui-prototype-v6/` to `prototypes/ui-prototype-v16/` (those that exist); keep `prototypes/ui-prototype-v17/` as the reference and make sure its header states its question (Principle I; research.md, section 22)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, common file rules, variables and prompt composition, JSON extraction, versions,
the state store with the unsaved-work guard and the one unsaved flag, the two ports, the shell with
the header, the File menu and the "what next" line, and shared components

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests ⚠️ write first, confirm they fail

- [X] T011 [P] Write `tests/unit/core/boundary.test.ts`: fails when a file under `src/core/` imports from `src/ui`, `src/app` or `src/sources`, or uses `window`, `document`, `navigator`, `fetch`, `localStorage`, `Date.now`, `new Date()` or `Math.random`
- [X] T012 [P] Write `tests/unit/core/schemas/common.test.ts`: unknown `format` rejected naming what was found and what is supported; newer `schema_version` rejected; missing `format` rejected; unknown extra keys accepted and reported once as a note; Zod errors become plain sentences naming the place and what to fix (contracts/file-formats.md, Common rules)
- [X] T013 [P] Write `tests/unit/core/judge/variables.test.ts` for `findVariables` and `proposeJudgedText`: names in order without repeats; spaces ignored; case-sensitive; `{{Source text}}` and `{{kontekst-źródłowy}}` valid; `{{ }}` not a variable; no built-in names; the judged text is the current one while it is a variable, otherwise the last variable with a note (FR-010, SC-011)
- [X] T014 [P] Write `tests/unit/core/judge/compose.test.ts` for `composePrompt`: every occurrence replaced; a variable with no field becomes empty text and is reported; field text containing `{{other}}` is not scanned again; nothing is added (FR-047)
- [X] T015 [P] Write `tests/unit/core/judge/extract-json.test.ts` for `extractJson`: whole text, code fence, the text from the first `{` or `[` to the last `}` or `]`; braces inside strings; a list at top level; a broken outer JSON is reported with its line and column in the whole text and never read as an inner object; "not readable" for free text (research.md, section 9; FR-084)
- [X] T016 [P] Write `tests/unit/core/hash.test.ts`: 12 hexadecimal characters of SHA-256 over canonical JSON (keys sorted, line endings normalized); `judgeVersion` changes with prompt, finding-text choices or rules and not with the sample reply, catalog or judged text; `testCasesVersion` depends on cases in order (fields, expected errors, names, bases) and not on the test project name (research.md, section 14; FR-034, FR-039)
- [X] T017 [P] Write `tests/unit/app/store.test.ts`: actions return the next state without changing the old one; any change sets the one unsaved flag, including a threshold change and loaded check settings; a successful "Save evaluation" clears it and resets the count of replies since save; a successful "Save test project" clears it only while no reply exists and otherwise leaves it set and returns the message that replies are kept only by "Save evaluation"; the guard asks before "Load test project", "Load evaluation", "Load example…", "Start new evaluation" and "Edit the judge and run again" with **Save evaluation first**, **Discard** and **Cancel**; replacing a reply whose case has decisions with source `manual` or `llm-approved` asks separately with their number (FR-004, FR-051, FR-056)
- [X] T018 [P] Write `tests/unit/app/ports.test.ts` against the fakes and the browser adapters (with stubbed `showSaveFilePicker`, `showOpenFilePicker`, file handles and `navigator.clipboard`): `SaveTarget.save` asks for a file the first time and overwrites it later; `saveAs` always asks; `useLoaded` makes a picked file current and asks for write permission once on the first save; a refused permission or a cancelled dialog returns "cancelled" and keeps the current file; a write that fails because the file was moved, removed or its permission withdrawn returns "file no longer writable" and forgets the file; `forget` drops it; `ClipboardReader.readText` returns text, "empty", "refused" or "not available" (research.md, section 25; FR-056, FR-076)
- [X] T019 [P] Write `tests/unit/ui/labels.test.ts`: every action name of FR-008 exists exactly once in `src/ui/labels.ts`, including **Load test project**, **Save test project**, **Save test project as**, **Save evaluation**, **Save evaluation as**, **Save evaluation first**, **Discard**, **Import test cases**, **Export test cases**, **Load example…**, **Load metric definition…**, **Edit test cases**, **Continue**, **Explain**, **File**, **Add test case**, **Paste JSON**, **Clean case**, **Case with injected errors**, **Approve and close**, **Save case**, **Close without saving**, **Open**, **Clone**, **Rename**, **Show JSON**, **Copy JSON**, **Show in text**, **Correct expected errors**, **Paste reply from clipboard**, **Save reply**, **Add finding**, **Second opinion…**, **Apply opinion**, **Approve**; no two keys share a label; removal is always "Remove"; no label is "Save judge set", "Load judge set", "Save test set", "Load demo data", "Read sample reply", "Modify", "More actions", "Read LLM answer", "Read LLM opinion", "Paste LLM opinion from clipboard", "Copy verification prompt", "Use selected text as fragment", "Describe errors again", "Compare with base", "Export JSON", "Approve all proposals", or names Verify, Compare or a shelf
- [X] T020 [P] Write `tests/unit/ui/shell.test.tsx`: the header shows the tool name, four numbered steps Judge, Test cases, Run, Results and Help, the one indicator ("Nothing to save yet", "Unsaved changes", or "All changes saved" with the file name) and a **File** menu with **Load evaluation**, **Load test project**, **Save test project**, **Save test project as**, **Import test cases**, **Export test cases**, **Load example…** and **Start new evaluation** and the remembered test project file name ("no file chosen yet" before the first save); the header holds no **Save evaluation** (FR-076, SC-038); the menu opens and closes with the keyboard and Escape; **Load example…** opens a window with Accuracy, Completeness, the demo and **Load metric definition…**; the "what next" line under the steps shows one sentence, an optional second line and exactly one primary button, and there is no welcome section; an unavailable step shows one sentence and a button; the footer shows the tool version and that data stays on this device; with `showSaveFilePicker` or `navigator.clipboard.readText` missing, a notice says the tool supports Chrome and Edge (FR-001, FR-003, FR-008, FR-051, FR-076, FR-088)
- [X] T021 [P] Write `tests/unit/ui/components.test.tsx`: `Dialog` (native `<dialog>`, traps and returns focus, Escape closes, action row pinned to the bottom when the content scrolls), `CaseWindowFrame` (fills the screen, header never scrolls with Previous, Next, position and Close, Alt + Left/Right, first and last disable a button, two columns that scroll on their own and stack below 760 px), `NextBar` (sentence, second line, one primary action), `JsonBox` (a box checked as it changes, problems with line and column or field path under it, the text kept), `Explain` (a small control that opens one explanation on demand), `StatusMark` (Pass, Fail, Awaiting verification and Not run each with a word and a sign, never color alone), `EmptyState`, `CopyButton`, `FilePicker` (picker and drag and drop; a dropped file is read but not remembered), `download`; no component is a "More actions" menu (FR-008, FR-084)

### Implementation

- [X] T022 Write the types in `src/core/model/index.ts` as data-model.md: `JudgeSet` (with `judged_text` and `error_catalog`), `ReplyMapping`, `ErrorRule` (`match: "all" | "any"`), `Condition` (`comparison` one of `equals`, `not_equals`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`; `value` required except for the two "empty" comparisons), `Category`, `TestCases` (with `finalized`; stored under the key `dataset`), `TestCase` (with `changed_after_first_reply?: "added" | "corrected"`), `ExpectedError` (`id`, `description`, `category?`, `fragment?`, `difficulty?: "obvious" | "subtle"`, and no field), `CaseJsonCheck`, `Evaluation` (with `model_note`, `metric` and `checks`), `TestProject` (judge set, test cases, metric, checks; no replies), `Reply`, `CaseDecisions` (with `added_findings` carrying `category?`, `difficulty?`, `from_opinion?`), `Decision` (`source: "manual" | "llm-approved"`), `VerificationOpinion` (with `new`), `OpinionPlan`, `CheckConfiguration`, `CountingMode` (`"per_expected_error" | "per_case"`), `ReadResult<T>` (FR-022)
- [X] T023 Implement `src/core/schemas/common.ts` and `src/core/schemas/messages.ts` to pass T012 (FR-005)
- [X] T024 [P] Implement `src/core/judge/variables.ts` (`findVariables`, `proposeJudgedText`) to pass T013
- [X] T025 [P] Implement `src/core/judge/compose.ts` to pass T014
- [X] T026 [P] Implement `src/core/judge/extract-json.ts` to pass T015
- [X] T027 Implement `src/core/hash.ts`, `src/core/judge/version.ts` and `src/core/cases/version.ts` to pass T016
- [X] T028 Implement `src/app/store.ts` (one state object; named actions; derived values never stored; the one unsaved flag with the rules of T017; count of replies since the last "Save evaluation") and `src/app/guard.ts` (guard; `beforeunload` only while unsaved) to pass T017
- [X] T029 Implement `src/app/ports/save-target.ts` (browser adapter on the File System Access API: JSON type, suggested name from the test project name, writable stream, `requestPermission` with `readwrite`), `src/app/ports/clipboard-reader.ts` (calls `navigator.clipboard.readText()` inside the click handler) and `src/app/ports/fakes.ts` (in-memory save file and clipboard) to pass T018; one `SaveTarget` instance per file kind, test project and evaluation
- [X] T030 Implement `src/ui/labels.ts` to pass T019 (FR-008)
- [X] T031 Implement `src/ui/components/shell/Header.tsx` (with `SaveState.tsx` for the indicator and `FileMenu.tsx`; no save button), `StepBar.tsx`, `NextBar.tsx` (the "what next" line, filled per step by a `nextAction(state)` selector in `src/app/selectors.ts`), `StepGate.tsx`, `BrowserNotice.tsx`, `Footer.tsx`, `src/ui/windows/load-example/LoadExampleWindow.tsx`, `src/ui/App.tsx` and `src/main.tsx` to pass T020; **Start new evaluation** asks first and forgets both remembered files (FR-001, FR-008, FR-076)
- [X] T032 Implement `src/ui/components/Dialog.tsx`, `CaseWindowFrame.tsx` (shared by the case window of Run, the read-only case view and the test case window, research.md section 20), `JsonBox.tsx`, `Explain.tsx`, `StatusMark.tsx`, `EmptyState.tsx`, `ErrorMessage.tsx`, `CopyButton.tsx`, `FilePicker.tsx` and `download.ts` to pass T021

**Checkpoint**: `npm test` and `npm run build` pass; the empty shell opens in black and red with
four steps, Help, the header and the "what next" line

---

## Phase 3: User Story 1 - Evaluate one judge end to end (Priority: P1) 🎯 MVP

**Goal**: Read the judge's replies, apply the rules, match findings, decide what is clear, let the
user decide the rest in the case window of Run, and show the counts, two rates and the overall
result, proven on the fixed demo data.

**Independent Test**: quickstart.md V1.

### Tests for User Story 1 ⚠️ write first, confirm they fail

- [X] T033 [US1] Write `tests/e2e/v1-demo.spec.ts` implementing quickstart.md V1 (fails until the phase is done)
- [X] T034 [P] [US1] Write `tests/unit/core/judge/fields.test.ts` for `recognizeFields` and `proposeFindingText`: path notation (`overall.ok`, `claims[].verdict`, `[].text`); kinds; "up to eight distinct values seen in the sample"; lists of objects and nested lists; a key with a dot or brackets reported; unreadable sample; proposal order `text`, `claim`, `statement`, `element`, `sentence`, `part`, `quote`, else longest average text; "The field must belong to that list and hold text" (FR-011, FR-012)
- [X] T035 [P] [US1] Write `tests/unit/core/judge/rules.test.ts` for `evaluateCondition` and `validateRules`: text ignores letter case and surrounding spaces; `true`/`false` match booleans; numbers compared as numbers; `greater_than`/`less_than` with a non-number is unknown; `is_empty` for null, empty text, empty list; absent field unknown; `any`/`all` with unknown as research.md section 9; broken for an unknown field, two lists (an enclosing list counts) or no conditions (FR-013, FR-014)
- [X] T036 [P] [US1] Write `tests/unit/core/judge/findings.test.ts` for `findFindings` and `previewRules`: per-item findings keyed `claims[]#<position>` with text and all rule names; whole-reply finding `reply` with no text; fields outside a list read once; unknown fields as the reason; unreadable reply; broken rules not applied
- [X] T037 [P] [US1] Write `tests/unit/core/evaluation/match.test.ts` for `matchLevel`: normalization; containment clear; hits ≥ 2 and share ≥ 0.6 clear; hits ≥ 1 and share ≥ 0.3 partial; a number missing from the finding turns clear into partial; Polish text; parameters override defaults (research.md, section 10)
- [X] T038 [P] [US1] Write `tests/unit/core/evaluation/review.test.ts` for `reviewCase` in `per_expected_error` mode: found on a clear match; several findings on one error are all correct; no fragment or partial best match leaves it undecided with a reason; missed automatically only when the reply was read, no rule was unknown and no additional finding exists; additional findings never decided; unreadable reply needs approval; with rules on list items, a whole-reply finding is an additional finding and is never matched (FR-061)
- [X] T039 [P] [US1] Write `tests/unit/core/evaluation/decisions-status.test.ts` for `applyDecisions` and `caseStatus`: stored decisions override; `missed` moves partial findings to additional findings; orphan decisions returned separately; Not run, Awaiting verification, Pass, Fail as FR-064; a real error does not fail a case; all expected errors ignored (FR-062, FR-064)
- [X] T040 [P] [US1] Write `tests/unit/core/evaluation/counting.test.ts` for `countAll`, `wilson`, `computeMeasures`, `overallResult` in `per_expected_error` mode: counters only from Pass and Fail cases; ignored items only in the ignored counters; `findings_total` = correct + `real_errors` + `false_positives`; splits per category, difficulty and rule; "counts only" below 10; Wilson against known values; false-positive rate "not available" at 0 findings and its check passes; Inconclusive reasons (any case not decided, < 30 decided expected errors, < 10 decided clean cases); Works / Does not work; borderline notes; provisional flag (FR-065 to FR-068)
- [X] T041 [P] [US1] Write `tests/unit/core/metrics/registry.test.ts`: `createRegistry` holds `accuracy`; `ratio` ("not available" at denominator 0) and `complement`; `at_least` / `at_most`; `checks.default.json` holds detection ≥ 0.8, false positives ≤ 0.1, case detection ≥ 0.8, clean-case false positives ≤ 0.1 and `minimum_sample` 30 and 10; only rules whose measure is in use count
- [X] T042 [P] [US1] Write `tests/contract/evaluation-file.test.ts`: round trip identical; `format` `judge-the-judge-evaluation`, `schema_version` 1; holds `judge_set` with `judged_text` and `error_catalog`, versions, `rules_corrected_after_replies`, `model_note`, `metric` (id and parameters), `dataset` (the test cases) with `finalized` and `changed_after_first_reply`, replies, decisions with `added_findings` (`category`, `difficulty`, `from_opinion`), `checks`, `minimum_sample`, `results` with `evaluated_per`, `counted_per_before_correction`, `additional_per_category` and `additional_per_difficulty`; no `proposals` written, and an old `proposals` key ignored with a note; recomputing uses the stored parameters; `results` empty until something is decided; a test project file is refused with a message naming "Load test project"; an invalid file returns problems (contracts/file-formats.md, section 5)
- [X] T043 [P] [US1] Write `tests/integration/demo.test.ts`: the demo loads finalized with 20 cases and 20 replies; `computeResults` equals `examples/demo/expected-results.json`; the demo contains a missed error, a false positive, a real error, a partial match, a fenced reply and an unreadable reply; variables `source_text` and `summary`, judged text `summary` (FR-026)
- [X] T044 [P] [US1] Write `tests/unit/ui/run-decide.test.tsx`: the Run list shows status per case with `StatusMark` and "awaiting verification first"; the case window with a reply shows the reply box holding the reply, each expected error with **Found** / **Issue: missed** / **Ignore** and its source, each additional finding with **Issue: false positive** / **Real error** / **Ignore** and its rule, the reason for anything undecided, and **Approve** as the primary button while the case awaits verification; every expected error has a mark or the reason it is undecided right after the reply is saved (SC-039); a decision takes effect at once (FR-054, FR-060, FR-062, FR-064)
- [X] T045 [P] [US1] Write `tests/unit/ui/summary.test.tsx`: three count groups first, ignored count when not zero, the two rates with counts, one line of overall result with reasons, test size against "at least 30 injected errors and 10 clean cases", provisional notice with counts; exactly one overall result with its reason; on Results the "what next" line says the result is provisional while cases are undecided and offers **Export HTML report** when all are decided (FR-065 to FR-068, SC-009)

### Implementation for User Story 1

- [X] T046 [P] [US1] Implement `src/core/judge/fields.ts` to pass T034
- [X] T047 [P] [US1] Implement `src/core/judge/rules.ts` to pass T035
- [X] T048 [US1] Implement `src/core/judge/findings.ts` to pass T036
- [X] T049 [P] [US1] Implement `src/core/evaluation/match.ts` to pass T037
- [X] T050 [US1] Implement `src/core/evaluation/review.ts` (`reviewCase(testCase, findings, parameters, mode)`, `per_expected_error` branch) to pass T038
- [X] T051 [US1] Implement `src/core/evaluation/decisions.ts` and `src/core/evaluation/status.ts` to pass T039
- [X] T052 [P] [US1] Implement `src/core/evaluation/wilson.ts` to pass the Wilson part of T040
- [X] T053 [US1] Implement `src/core/metrics/operations.ts`, `registry.ts`, `checks.ts`, `src/core/metrics/builtin/accuracy.json` (prompt with `{{source_text}}` and `{{summary}}`, judged text `summary`, parameters 0.6 / 0.3 / 4, the two measures with `wilson95`, `clean_base_cases`, and the categories factual-error, contradiction, wrong-number, unsupported-claim and misattribution, each with a description and an example) and `checks.default.json` to pass T041
- [X] T054 [US1] Implement `src/core/evaluation/counters.ts`, `measures.ts`, `overall.ts` and `results.ts` (`per_expected_error` mode) to pass T040
- [X] T055 [US1] Implement `src/core/schemas/judge-set.ts` (the `judge_set` layout with `error_catalog`; `prompt` is required, every other key may be absent or empty), `src/core/schemas/test-case.ts` (at most 500 cases; each field at most 100,000 characters; `description` required; a `field` key on an expected error ignored and noted; `changed_after_first_reply`), `src/core/schemas/evaluation.ts` and `src/core/io/evaluation-file.ts` to pass T042 (FR-075, Principle V)
- [X] T056 [US1] Create `examples/demo/` (`evaluation.json`: finalized, 10 clean book-summary cases and 10 made from them with 3 injected errors each in `summary`, half obvious and half subtle, 20 replies covering T043 and no decisions, and a ready opinion for each case that awaits verification; `test-project.json`: the same judge, catalog, cases, metric and checks with no replies; `expected-results.json`), produced by `scripts/make-demo.ts`, to pass T043 (research.md, section 23)
- [X] T057 [US1] Implement `src/app/selectors.ts` (derived per case and overall, and `nextAction` for Run and Results) and `src/app/actions/evaluation.ts` (`loadExample` for the demo behind the guard, forgetting both remembered files) (FR-026)
- [X] T058 [US1] Implement `src/ui/steps/run/RunStep.tsx` (list with `StatusMark`, items to decide, "awaiting verification first", **Open**, the **Evaluation file** card with **Save evaluation** and **Save evaluation as**) and `src/ui/windows/case-window/DecidePane.tsx` (right column with a reply: marks, **Approve**) inside `src/ui/windows/case-window/CaseWindow.tsx` to pass T044
- [X] T059 [US1] Implement `src/ui/steps/results/ResultsStep.tsx` (tabs Summary, Error analysis, Test case list; provisional notice) and `src/ui/steps/results/SummaryView.tsx` to pass T045
- [X] T060 [US1] Wire the demo into `src/ui/windows/load-example/LoadExampleWindow.tsx` (**Load example…** in the File menu) so T033 passes
- [X] T061 [US1] Write the Help sections "What the tool does", "How big a test needs to be", "The four steps", "Examples and demo data" and "Reading the results" in `src/ui/help/sections/` (FR-006)

**Checkpoint**: The demo can be loaded, decided on Run and read on Results; this is the MVP

**Done 2026-11-13.** Known gaps that later phases close: **Export HTML report** is shown disabled until
T156 (US9); in **Load example…** only the demo works, Accuracy and Completeness arrive with their
phases; the Error analysis and Test case list tabs are placeholders until US9; `reviewCase` and
`countAll` throw for the per-case mode until US14 part 2 (T-numbers of Phase 13); the reply box on
Run is read-only until US7; the demo files are produced by `npm run demo` (its `test-project.json` now
goes through `writeTestProject`). The end-to-end tests run
with `PW_CHANNEL=chrome npx playwright test --project=chromium` where Playwright's own browsers
are not installed.

---

## Phase 4: User Story 6 - Save the work and continue later (Priority: P1)

**Goal**: The two files of FR-076, the test project (File menu) and the evaluation (**Save
evaluation** on Run), each to its own remembered file; the three-choice warning before replacing
work; one unsaved indicator; after a load the tool opens
the first step with unfinished work and offers **Continue**. Placed right after the MVP so every
later phase can be tested from a saved file.

**Independent Test**: quickstart.md V9 steps 1, 4 and 6, and V5 steps 3 and 4.

### Tests for User Story 6 ⚠️

- [X] T062 [US6] Write `tests/e2e/v9-save-continue.spec.ts` implementing quickstart.md V9 steps 1, 4 and 6, with the in-memory save file
- [X] T063 [P] [US6] Write `tests/contract/test-project-file.test.ts`: `format` `judge-the-judge-test-project`, `schema_version` 1; holds `judge_set` (with `judged_text` and `error_catalog`), `dataset` (the test cases: name, version, `finalized`, all cases with `changed_after_first_reply` when set), `metric` (id and parameters) and `checks`, and no replies, decisions, results or `model_note`; round trip identical with the same judge and test cases versions; `finalized` restored as saved; a `minimum_sample` is never written; an evaluation file is refused with a message naming "Load evaluation"; `judged_text` absent or unknown falls back to the last variable with a note; a rule on a missing field loads as broken and is reported; an unregistered metric keeps its stored parameters and the user is told (contracts/file-formats.md, section 1; FR-020, SC-013)
- [X] T064 [P] [US6] Write `tests/unit/core/evaluation/resume.test.ts` for `resumePoint`: Judge with no prompt; Test cases when not finalized; Run when any case is not run or awaits verification, with the case **Continue** opens (first awaiting verification, else first not run); Results when every case is decided (FR-073)
- [X] T065 [P] [US6] Write `tests/integration/save-continue.test.ts` with the port fakes: an evaluation saved before finalizing, part-way through Run and after deciding loads back identical (open or finalized), and opens the step of `resumePoint`; the first "Save evaluation" asks for a file and the second overwrites it; "Save evaluation as" asks; a test project saved after finalizing comes back finalized with its metric and thresholds and no replies, starts a new evaluation and opens Run; "Load test project" forgets the evaluation file and "Load evaluation" forgets the test project file; "Start new evaluation" and "Load example…" forget both; an unwritable remembered file is explained and forgotten and nothing in the page is lost; an invalid file leaves the current work unchanged (FR-020, FR-051, FR-073, FR-076, SC-029)
- [X] T066 [P] [US6] Write `tests/unit/ui/run-save.test.tsx`: **Save evaluation** and **Save evaluation as** appear only on the Run step (with the remembered evaluation file name) and in the header of the Run case window, and on no other step (FR-076, SC-038); the indicator turns to "All changes saved" with the file name after **Save evaluation**; after **Save test project** with replies it stays on and the message says replies are kept only by **Save evaluation**; the File menu shows the remembered test project file name; an invalid file shows a message and changes nothing; after a load the "what next" line says how far the work is ("12 of 20 cases decided") and offers **Continue**, which opens the right case window; on Run and on Results the line offers **Continue** whenever a case is not run or awaits verification
- [X] T066a [P] [US6] Write `tests/unit/ui/replace-warning.test.tsx`: **Load test project**, **Load evaluation**, **Load example…**, **Start new evaluation** and **Edit the judge and run again** ask with **Save evaluation first** (saves, then continues), **Discard** and **Cancel** when there are unsaved changes, and ask nothing otherwise; leaving the page with unsaved changes triggers the browser's warning (FR-004, FR-051)

### Implementation for User Story 6

- [X] T067 [P] [US6] Implement `src/core/schemas/test-project.ts` and `src/core/io/test-project-file.ts` (`readTestProject`, `writeTestProject`) to pass T063
- [X] T068 [P] [US6] Implement `src/core/evaluation/resume.ts` (`resumePoint`) to pass T064
- [X] T069 [US6] Implement `saveEvaluation`, `saveEvaluationAs`, `loadEvaluation`, `saveTestProject`, `saveTestProjectAs`, `loadTestProject` and `continueWork` in `src/app/actions/files.ts`, using the two `SaveTarget` ports and the forgetting rules of FR-076, to pass T065 (FR-004, FR-020, FR-051, FR-073)
- [X] T070 [US6] Wire the load actions and the test project save actions into `src/ui/components/shell/FileMenu.tsx` and `SaveState.tsx`, **Save evaluation** and **Save evaluation as** into `src/ui/steps/run/RunStep.tsx` and the header of `src/ui/windows/case-window/CaseWindow.tsx`, the three-choice warning into `src/app/guard.ts`, and **Continue** into `NextBar.tsx`, to pass T066, T066a and T062
- [X] T071 [US6] Write the Help sections "Files: the test project and the evaluation" (what each holds, the indicator, "… as", running the same test project again with another LLM) and "Privacy and saving" (Chrome and Edge, the permission prompt, save often) in `src/ui/help/sections/`

**Done 2026-11-14.** US6 is complete. Known gaps: **Import test cases** and **Export test cases** in the
File menu stay inert until US5, and **Edit the judge and run again** (the fifth guarded action) arrives
with US12; the guard itself already covers it. A new port, `FileOpener`, lets the load actions pick a file
(`tests/helpers/memory-files.ts` is its in-memory stand-in for the e2e tests).

---

## Phase 5: User Story 2 - Set up the judge and say what counts as an error (Priority: P1)

**Goal**: The Judge step: prompt with variables, judged text and version, sample reply with fields
and finding text read as it changes, rule editor with preview, the two ready examples in **Load
example…**. The judge set is saved inside the test project (Phase 4).

**Independent Test**: quickstart.md V2.

### Tests for User Story 2 ⚠️

- [X] T072 [US2] Write `tests/e2e/v2-judge.spec.ts` implementing quickstart.md V2 (saved with **Save test project**, loaded with **Load test project**)
- [X] T073 [P] [US2] Write `tests/unit/ui/judge-step.test.tsx`: the step has no welcome section and no buttons of its own besides **Add rule**, **Add condition** and **Remove** (SC-038); variables listed live, no-variable warning, the judged-text choice with the last variable proposed; the sample reply is read as soon as it is pasted or changed, a problem is shown under the box with its line and column, the text is kept and the fields of the last readable sample stay (FR-084, FR-088, SC-037); fields table; finding-text choice per list; "Add rule" offers only recognized fields; a missing field is refused; preview names rules; broken rule marked; readability warning; explanations sit behind **Explain**, and no paragraph longer than one sentence is on the step; there is no error catalog and no clean case section; the "what next" line names what is still missing (prompt, a variable, sample reply, a rule) and offers **Next: Test cases** once nothing is missing; after finalizing it says the prompt is fixed (FR-001, FR-010 to FR-014, FR-021, FR-053)

### Implementation for User Story 2

- [X] T074 [P] [US2] Create `src/core/metrics/builtin/completeness.json` (judged text `summary`; categories missing-information, missing-step, omitted-requirement, partial-answer and missing-caveat, each with a description and an example; prompt, sample reply, finding text, rules, a few `clean_base_cases`) and register it so `listExamples` returns Accuracy and Completeness (FR-019)
- [X] T075 [US2] Implement `src/app/actions/judge.ts`: `setPrompt`, `setJudgedText`, `setSampleReply` (read as it changes), `setFindingText`, rule actions, `loadExample` for Accuracy and Completeness (asks before replacing; starts a new test project with its judge, catalog and clean cases; sets the active metric and its parameters) (FR-009, FR-019, FR-021, FR-053, FR-088)
- [X] T076 [US2] Implement `src/ui/steps/judge/PromptSection.tsx` (editor, variables, judged-text choice, version) and add Accuracy and Completeness to `src/ui/windows/load-example/LoadExampleWindow.tsx`
- [X] T077 [US2] Implement `src/ui/steps/judge/SampleReplySection.tsx` (on `JsonBox`), `RulesSection.tsx` and `RulePreview.tsx`
- [X] T078 [US2] Implement `src/ui/steps/judge/JudgeStep.tsx` with the empty state, the readability warning, the **Explain** controls and the Judge `nextAction`, to pass T073 and T072
- [X] T079 [US2] Write the Help sections "Variables and the judged text" and "Sample reply, fields and error rules" (with the literal `{{` limit) in `src/ui/help/sections/`

**Done 2026-11-14.** US2 is complete (the actions are in `src/app/actions/judge.ts`, the step in
`src/ui/steps/judge/`). Notes: **Next: Test cases** stays disabled only while the prompt or a variable is
missing; a missing sample reply or rule is named in the sentence and the step can still be left, because
FR-021 allows judging by hand. The Test cases step is still a placeholder until US3.

---

## Phase 6: User Story 3 - Keep clean base cases among the test cases (Priority: P1)

**Goal**: The one case JSON check, the clean case view, and the Test cases table with **Open**,
**Clone**, **Rename** and **Remove** as buttons. A clean case is any test case with no expected
errors; there is no clean case section on the Judge step.

**Independent Test**: quickstart.md V3.

### Tests for User Story 3 ⚠️

- [X] T080 [US3] Write `tests/e2e/v3-clean-cases.spec.ts` implementing quickstart.md V3 (clean cases made with **Clean case** and imported from a CSV; the table and its row buttons)
- [X] T081 [P] [US3] Write `tests/unit/core/generation/clean-case-prompt.test.ts` for `cleanCasePrompt`: one clean case in the case JSON layout with `"expected_errors": []`; the judge prompt with its variables and judged text; the catalog with descriptions (so the case contains none of its errors); the comment as written; the fields of the **Like case** as a model when one is picked; rebuilt when the comment or the pick changes (FR-083)
- [X] T082 [P] [US3] Write `tests/unit/core/cases/case-json.test.ts` for `checkCaseJson`: the JSON found as the whole text, a code fence, or first `{`/`[` to last `}`/`]`; not readable JSON reported with line and column in the whole text; exactly one case (`{"cases":[one]}` and `[one]` accepted, more refused pointing to **Import test cases**); a missing, empty or too long `fields.<variable>` is a problem with its path; an unused field a warning; a missing `expected_errors[i].description` a problem; a missing fragment or category a warning; an unknown category a note (added on save); a taken name a problem; `id` ignored; `base` per mode (paste: kept when it names a clean case; inject: the window's base wins with a note); identical to base refused; in `clean` mode expected errors are a problem pointing to **Paste JSON**; in `correct` mode a change to the name or fields is a problem; the kind the case will have (FR-031, FR-041, FR-083, FR-084, FR-089, FR-090, SC-023, SC-024, SC-037, FR-044)
- [X] T083 [P] [US3] Write `tests/unit/core/cases/validate-case.test.ts`: refused with no non-empty field or an expected error without description; field above 100,000 characters refused stating the limit; warning above 30,000; warnings for a variable with no field, a field that matches no variable, a fragment not in the judged text (for an omission: in no other field), unknown category, unknown base, identical to its base; a name used by another case, compared without regard to case (FR-037, FR-047, FR-079)
- [X] T084 [P] [US3] Write `tests/unit/core/cases/case-actions.test.ts`: `assignIdentifiers` (next free number; `e1`, `e2` …); `canChangeCase` refuses **Rename**, **Remove** and **Correct expected errors** for a case with a reply after finalizing ("This case has a reply") and **Remove** for a base still in use, listing its cases; `caseToJson` writes `name`, `base` only when set, `fields` and `expected_errors` without `id`, and `checkCaseJson` of its output gives the same fields and expected errors (SC-036); a clone keeps no link to its original (FR-017, FR-025, FR-033, FR-039, FR-078)
- [X] T085 [P] [US3] Write `tests/unit/ui/cases-table.test.tsx`: one table below **Error categories**, columns of FR-025 with Kind "Clean" / "Injected errors" (and "added after first reply" / "corrected after first reply" when set), **Add test case** above it; at each row **Open**, **Clone**, **Rename** and **Remove** as visible buttons, no menu and no details panel; a click on the row opens the read-only view; **Rename** refuses a taken name; **Remove** of a base case refused with the list of cases; after finalizing **Open**, **Clone** and **Add test case** stay enabled and **Rename** and **Remove** are disabled with "This case has a reply" for a case with a reply; the "what next" line offers **Add test case** with no cases and **Finalize test cases** otherwise (FR-001, FR-008, FR-025, FR-039, FR-053, SC-034)
- [X] T215 [P] [US3] Write `tests/unit/ui/test-case-window-base.test.tsx`: **Add test case** offers **Paste JSON**, **Clean case** and **Case with injected errors**, all always enabled, also with no cases; **Close without saving** is always shown and asks first when something was typed; **Paste JSON**: one `JsonBox`, **Next** enabled only when valid, the window names the kind the case will have, **Save case** in the header enabled only when valid; **Open** (also a click on a row) shows the case read-only (fields, expected errors list) with **Previous test case** / **Next test case** and the position, and **Clone**, which opens **Paste JSON** filled with the case JSON and the name "… (copy)" (FR-038, FR-078, FR-086, FR-090)
- [X] T204 [P] [US3] Write `tests/unit/ui/clean-case-view.test.tsx`: Name, Comment and **Like case** (existing clean cases); the prompt rebuilt when the comment or the pick changes, with **Copy prompt**; the answer checked as it changes with line and column or field path; when valid, its fields shown read-only and **Approve and close** enabled, saving under the typed name (or the answer's) and closing; an answer with expected errors is a problem pointing to **Paste JSON**; a taken name is a problem (FR-083, FR-084, SC-021)

### Implementation for User Story 3

- [X] T086 [P] [US3] Implement `src/core/generation/clean-case-prompt.ts` to pass T081
- [X] T087 [P] [US3] Implement `src/core/cases/case-json.ts` (`checkCaseJson`, `caseToJson`) to pass T082
- [X] T088 [P] [US3] Implement `src/core/cases/validate.ts` to pass T083
- [X] T089 [US3] Implement `src/core/cases/identifiers.ts` and `src/core/cases/case-actions.ts` (`canChangeCase`, `markLate`) to pass T084 and T203
- [X] T090 [US3] Implement `src/app/actions/cases.ts` (`saveCaseFromJson`, `renameCase`, `removeCase`, `cloneCase` (opens Paste JSON filled with the case's JSON and "… (copy)"), `correctExpectedErrors`; one list of cases; every change updates the test cases version and marks cases added or corrected after the first reply) (FR-017, FR-023, FR-025, FR-039, FR-053, FR-078, FR-089)
- [X] T092 [US3] Implement `src/ui/steps/cases/CasesStep.tsx` and `src/ui/steps/cases/CasesTable.tsx` (row buttons **Open**, **Clone**, **Rename**, **Remove**; the Test cases `nextAction`) to pass T085 and T080 (FR-023, FR-025)
- [X] T216 [US3] Implement `src/ui/windows/test-case/TestCaseWindow.tsx` (on `CaseWindowFrame`), `AddChoice.tsx`, `CaseJsonView.tsx` (Paste JSON) and `CaseReadOnly.tsx` (fields, expected errors list, Previous/Next, **Clone**), and open them from `CasesTable.tsx` and **Add test case**, to pass T215, T085 and T080 (FR-038, FR-078, FR-086, FR-090)
- [X] T091 [US3] Implement `src/ui/windows/test-case/CleanCaseView.tsx` (Name, Comment, **Like case**, the prompt with **Copy prompt**, the answer on `JsonBox`, the fields read-only when valid, **Approve and close**) inside the window of T216, to pass T204
- [X] T093 [US3] Write the Help section "Adding test cases" (the two kinds, Paste JSON, Clean case, the case JSON layout, Open, Show JSON, Clone, Rename, Remove) in `src/ui/help/sections/`

**Done 2026-11-14.** US3 is complete, with `markLate` and its test (T203, listed under US4) done early
because T089 needs them. Notes: **Case with injected errors** opens a short view that points to **Paste
JSON** until US4 builds its three parts; the case view after **Next** shows the fields with numbered
fragments and the list of expected errors, and US4 adds **Show in text** and the agreement line of FR-080
to it. The "Error categories" section above the table is US14 (Phase 7); search, sort and filter of the
table are US15.

---

## Phase 7: User Story 14 (part 1) - Use my own error catalog for other kinds of judges (Priority: P3)

**Goal**: The collapsible "Error categories" section of the Test cases step (add, rename, remove
while unused, uses per category), and loading metric definitions at run time (Principle VI).
Placed here because US4 chooses categories from it.

**Independent Test**: quickstart.md V12 steps 1 and 2.

### Tests for User Story 14 ⚠️

- [X] T094 [US14] Write `tests/e2e/v12-catalog-and-metric.spec.ts` implementing quickstart.md V12 steps 1 and 2: a new example appears with no other change (SC-005)
- [X] T095 [P] [US14] Write `tests/unit/core/cases/catalog.test.ts`: "lower case with dashes"; pasted `name`, `name - description`, `name: description`, `name | description`; present names skipped and reported; `categoryUses` counts test cases (a case once); `canRemoveCategory` refuses while a case uses the category with the sentence of FR-015 (and the "It can be renamed." form after finalizing when every such case has a reply); `renameCategory` applies to every expected error and refuses a taken name (FR-015)
- [X] T096 [P] [US14] Write `tests/contract/catalog-in-test-project.test.ts`: the catalog is saved and loaded as `judge_set.error_catalog` of the test project and the evaluation; there is no catalog file of its own, and a file with `format` `judge-the-judge-error-catalog` is refused naming what is supported (contracts/file-formats.md, section 1 and the format table; FR-016)
- [X] T097 [P] [US14] Write `tests/contract/metric-contract.test.ts`, the shared suite over `accuracy.json`, `completeness.json`, `examples/metrics/bias-example.json` and `examples/metrics/bias-verdict-example.json`: schema-valid; operations `ratio` and `complement` only; known counters, including `defective_cases_decided` and `defective_cases_flagged`; unique ids; the two required measures; a valid `judge_set` whose `judged_text` is a variable; rules use only sample fields; `clean_base_cases` complete with no expected errors; every measure computes; the prompt composes with each clean case; the rules give the expected findings on the sample; an invalid definition leaves the registry unchanged; built-in ids cannot be replaced
- [X] T098 [P] [US14] Write `tests/unit/ui/error-categories.test.tsx`: the "Error categories" section is first on the Test cases step and not on the Judge step; it collapses and expands by a click on its heading and from the keyboard; open while there are no test cases, collapsed when a test project with cases is loaded, the state kept for the page session; collapsed, the heading says "N categories"; each category shows description and example (editable), "Used by N test cases", **Rename** and **Remove** (disabled with the reason while used); **Add category** for one per line (FR-015, FR-087)

### Implementation for User Story 14

- [X] T099 [P] [US14] Implement `src/core/cases/catalog.ts` to pass T095
- [X] T100 [P] [US14] Make `src/core/schemas/judge-set.ts` carry `error_catalog` and refuse the retired catalog format to pass T096
- [X] T101 [P] [US14] Implement `src/core/schemas/metric.ts`, `src/core/io/metric-file.ts`, the replace rule in `src/core/metrics/registry.ts`, `examples/metrics/bias-example.json` (one variable `text`, the judged text; lists the biased sentences) and `examples/metrics/bias-verdict-example.json` (one variable `text`; the reply is `{"biased": true|false, "kind": "…", "reason": "…"}`; one rule on `biased` outside any list; a few clean cases; it may list `case_detection_rate` and `clean_case_false_positive_rate`) to pass T097
- [X] T102 [US14] Implement `src/app/actions/catalog.ts` (`addCategories`, also used for a new name typed for an error to prepare, an added finding or in a saved case JSON; `renameCategory`; `removeCategory`) and `loadMetricDefinition` in `src/app/actions/judge.ts` (FR-015, FR-024)
- [X] T103 [US14] Implement `src/ui/steps/cases/ErrorCategoriesSection.tsx` on the Test cases step and add **Load metric definition…** to `src/ui/windows/load-example/LoadExampleWindow.tsx` to pass T098 and T094
- [X] T104 [P] [US14] Write `docs/how-to-add-a-metric.md` for a non-developer, quoting `examples/metrics/bias-example.json` and `bias-verdict-example.json`, listing operations and counters, explaining that a judge whose rules use only fields outside any list is evaluated per case, and stating that graded ratings and measures needing other inputs cannot be expressed in this version
- [X] T105 [US14] Write the Help sections "Error categories" and "Metrics and check settings" in `src/ui/help/sections/`

**Done 2026-11-14.** US14 part 1 is complete. Notes: the session registry lives in `src/app/metrics.ts`
(a module-level value, reset by tests); T100 needed no code, because the catalog already travels as
`judge_set.error_catalog` and a retired catalog file is refused by the format check, which T096 now
guards; the example `checks-example.json` exists for **Load check settings** (US9). Typing a new
category name for an error to prepare (FR-024) arrives with US4; today a new category joins the
catalog through a pasted case.

---

## Phase 8: User Story 4 - Prepare a test case with injected errors (Priority: P1)

**Goal**: The test case window: **Paste JSON**, **Case with injected errors** in three parts, the
case view with **Show in text** and the check line, the read-only **Open** with **Show JSON**,
**Clone** and **Correct expected errors**. A saved case is never edited.

**Independent Test**: quickstart.md V4.

### Tests for User Story 4 ⚠️

- [X] T106 [US4] Write `tests/e2e/v4-test-case-window.spec.ts` implementing quickstart.md V4: **Paste JSON**, **Case with injected errors** through all three parts (one copy and one paste), **Clone** then **Save case**, **Open** with **Show JSON** and **Show in text**, and **Correct expected errors** after finalizing; five expected errors visible without scrolling at 1280 x 720 (SC-022 to SC-024, SC-031, SC-034 to SC-036)
- [X] T107 [P] [US4] Write `tests/unit/core/generation/inject-errors-prompt.test.ts` for `injectErrorsPrompt`: ONE case in the case JSON layout; with a base, its fields and the judged text the errors go into; without one, the whole case; one expected error per row with the category's description and example, difficulty (or left to the LLM) and what should be wrong; exact-fragment and omission rules; own instructions first; rebuilt when a row or the base changes (FR-040, FR-043)
- [X] T108 [P] [US4] Write `tests/unit/core/cases/text-list-check.test.ts` for `textListCheck(testCase, base, judgedText)`: changed places against the base not covered by an expected error (with their text for highlighting, only with a base); expected errors whose fragment is not in the judged text (nor, for an omission, in another field); identical to base; errors with no fragment or no category as a note; two 100,000-character fields within one second (FR-080)
- [X] T109 [P] [US4] Extend `tests/unit/core/cases/case-json.test.ts` with the `inject` mode: the base picked in the window wins and a different `base` is named in a note; an answer whose number of expected errors differs from the errors to prepare is accepted with a note; a JSON with no expected errors is accepted and saved as a clean case, said before saving (FR-041)
- [X] T110 [P] [US4] Write `tests/unit/ui/test-case-window.test.tsx` (the choice, **Close without saving** and **Paste JSON** are covered by T215): **Case with injected errors** part 1 (optional base with its fields, errors to prepare with **Add error** and **Remove**, a new category typed joins the catalog, own instructions, the prompt with **Copy prompt**, **Next**), part 2 (the JSON box, **Back**), part 3 (the case read-only with the check line, numbered highlights and "not in list", the expected errors read-only with **Show in text**, the editable source JSON, live updates, "Out of date" while invalid); **Save case** in every part, enabled only when valid, asks with a mismatch of FR-080; no **Modify**, **Edit by hand**, **Use selected text as fragment**, **Describe errors again**, **Compare with base** or field editing; the window has no save action for the two files (FR-038, FR-040, FR-041, FR-080, FR-081, FR-085, FR-090, SC-035)
- [X] T203 [P] [US4] Write `tests/unit/core/cases/mark-late.test.ts` for `markLate` and `canChangeCase` after finalizing: a case added, cloned or imported after the first reply is "added"; a case whose expected errors are corrected is "corrected" (an added one stays "added"); before the first reply nothing is marked; the marks travel in the test project and evaluation files (FR-053)
- [X] T205 [P] [US4] Write `tests/unit/ui/inject-window.test.tsx`: part 1 with no clean case at all (base optional); part 2 **Next** disabled while invalid; part 3 every change in the JSON shows at once in the fields and the list; **Show in text** highlights and scrolls to the fragment, also for an omission in another field, and is disabled with "not in the text" when not found; saving with "changed place not in list" or "not in the text" asks first; a JSON with zero expected errors is saved as clean and the window says so (FR-040, FR-041, FR-080, FR-085, SC-022, SC-035)
- [X] T206 [P] [US4] Write `tests/unit/ui/case-highlights.test.tsx`: in the case view, the read-only view and the case window of Run, the fragments of up to five expected errors that occur in the judged text are highlighted with their numbers (E1 … E5), colour always paired with a number and a word; after a reply the marks say found, missed, undecided or ignored, and findings are marked matching, partly matching or matching no expected error (FR-077, SC-033)
- [X] T207 [P] [US4] Write `tests/unit/ui/case-readonly.test.tsx`: **Open** shows the case read-only with **Previous test case** / **Next test case** and the position; nothing can be edited; **Show JSON** shows `caseToJson` with **Copy JSON**; **Clone** opens **Paste JSON** filled with the JSON and the name "… (copy)" made unique, and **Save case** adds a new case with no link to the original (FR-078, FR-086, SC-034, SC-036)
- [X] T208 [P] [US4] Write `tests/unit/ui/correct-expected-errors.test.tsx`: offered in the read-only view only after finalizing and only for a case without a reply (the view says why otherwise); opens the case view with the case JSON; a change to the name or fields is a problem; saving changes only the expected errors, gives a new test cases version and marks the case "corrected after first reply" when replies exist (FR-089)

### Implementation for User Story 4

- [X] T111 [P] [US4] Implement `src/core/generation/inject-errors-prompt.ts` to pass T107
- [X] T112 [P] [US4] Implement `src/core/cases/text-list-check.ts` (jsdiff for the changed places) to pass T108
- [X] T113 [US4] Extend `src/core/cases/case-json.ts` with the `inject` mode to pass T109
- [X] T114 [US4] Implement `src/app/actions/test-case-window.ts`: modes choose, paste, clean, inject (parts 1 to 3), view and correct; the case JSON and its last valid state; the errors to prepare and the rebuilt prompt; **Save case** through `saveCaseFromJson` (new identifier, new categories added, name made when empty, a JSON with no expected errors saved as clean, asks with a mismatch of FR-080, refuses identical-to-base); **Approve and close** for a clean case; **Close without saving** asks when something was typed; the pasted JSON is not part of the state until saved (FR-038, FR-040, FR-041, FR-053, FR-083, FR-085, FR-089, FR-090, FR-044, SC-023)
- [X] T115 [US4] Extend the window of T216 with `InjectPrepare.tsx`, **Back** in `CaseJsonView.tsx`, `CaseView.tsx` (fields with numbered highlights and the check line; the expected errors read-only with **Show in text**; the editable source JSON) and, in `CaseReadOnly.tsx`, **Show JSON** with **Copy JSON**, **Correct expected errors**, the composed prompt with **Copy prompt** and the reply if any to pass T110, T205 to T208 and T106 (FR-048)
- [X] T116 [US4] Extend the Help section "Adding test cases" with "Case with injected errors", **Show in text**, the check line and **Correct expected errors** in `src/ui/help/sections/`

**Done 2026-11-14.** US4 is complete. Notes: `inject` mode of `checkCaseJson` (T113) already existed from
Phase 6; T109 only added tests for it. Window state lives in the components, the pure parts in
`src/app/actions/test-case-window.ts` (draft rows, prompt, `listCheckOf`, `mismatchLines`). Instead of
`CaseJsonView.tsx` and `CaseView.tsx` the existing `JsonCaseView.tsx` carries parts 2 and 3 (the case view is its
second stage), with `InjectPrepare.tsx`, `InjectWindow.tsx`, `SaveCaseButton.tsx` (the question of FR-080) and
`CaseData.tsx` (fields, check line, list with **Show in text**). Highlights are shared by the case view, the
read-only view and the Run window through `MarkedFields.tsx`; `ReviewedCase` now carries its `findings` and
`markFindings` gives the words for the reply (FR-077). A new category typed for an error to prepare joins the
catalog when the case is saved. **Finalize test cases** still has no action (US11, Phase 15), so the e2e test of
**Correct expected errors** uses the demo, which loads finalized.

---

## Phase 9: User Story 5 - Import many test cases from a file and export them (Priority: P1)

**Goal**: **Import test cases** (JSON, or the shortened CSV of clean cases) that adds cases after a
full summary, also after finalizing; **Export test cases**; the example file. The cases are saved
with the test project (Phase 4).

**Independent Test**: quickstart.md V5 steps 1 and 2.

### Tests for User Story 5 ⚠️

- [X] T117 [US5] Write `tests/e2e/v5-load-file.spec.ts` implementing quickstart.md V5 (all steps) with **Import test cases**, including a 100-case file whose summary appears within 5 seconds (SC-015) and **Export test cases**
- [X] T118 [P] [US5] Write `tests/unit/core/io/decode.test.ts`: UTF-8 with and without byte order mark; Windows-1250 fallback reported; any line endings
- [X] T119 [P] [US5] Write `tests/contract/test-cases-export.test.ts`: **Export test cases** writes `format` `judge-the-judge-test-cases` with every case, clean ones included, without the catalog or `finalized`; importing it into an empty test project gives identical content and an identical version (FR-050, SC-019)
- [X] T120 [P] [US5] Write `tests/contract/test-cases-csv.test.ts`: the shortened CSV of FR-031 (`name` and `field:<variable>` columns; every row a clean case; any other column ignored and named); header names case-insensitive except after `field:`; commas, quotes, line breaks, Polish characters; more than 500 cases in the test project after the import rejected stating the limit and the number found; field above 100,000 an invalid row; row numbers and reasons; unmatched columns and missing variables reported; an empty file, a file with only a header and a file with one case; a failed or cancelled import changes nothing (FR-027, FR-028 to FR-032, FR-037, SC-016, SC-017)
- [X] T121 [P] [US5] Write `tests/contract/test-cases-json.test.ts`: `format` `judge-the-judge-test-cases` read with the case rules of contracts/file-formats.md section 3; a test project file is read through its `dataset.cases`; error ids assigned; identifiers already used get new ones and `base` follows them; a name already used is kept and both cases warn (FR-020, FR-027, FR-079, SC-019)
- [X] T122 [P] [US5] Write `tests/unit/core/io/example-csv.test.ts`: `name` and one `field:` column per variable, two clean cases, byte order mark, `field:field_1` with a note when there are no variables; imports back without problems (FR-030)
- [X] T123 [P] [US5] Write `tests/unit/ui/import-summary.test.tsx`: **Import test cases** in the File menu opens the import panel with **Download example file** (explained behind **Explain**); the summary shows counts (clean, with injected errors), invalid rows with position and reason, unmatched fields, missing variables, missing categories with the choice to add them, encoding, new identifiers and names used twice; **Import test cases** adds the valid cases to those already here; **Cancel** changes nothing (FR-027, FR-028 to FR-030)
- [X] T124 [P] [US5] Write `tests/integration/import-adds-cases.test.ts`: importing into a test project that already has cases adds the valid ones and keeps the existing ones; importing after finalizing adds them too, they start as Not run, the replies and decisions of the other cases are kept, the test cases version changes, and once replies exist they are marked "added after first reply" (FR-053)

### Implementation for User Story 5

- [X] T125 [P] [US5] Implement `src/core/io/decode.ts` to pass T118
- [ ] T126 [P] [US5] Retired (FR-031 since the review of prototype v14): the shortened CSV has no expected-error column, so there is no one-line convention to implement. Nothing to build; the number is kept so that references stay valid.
- [X] T127 [US5] Implement `src/core/schemas/test-cases.ts`, `src/core/cases/validate-test-cases.ts` and `src/core/io/test-cases-json.ts` (`readTestCasesJson`, `writeTestCases`) to pass T119 and T121
- [X] T128 [US5] Implement `src/core/io/test-cases-csv.ts` (Papa Parse) to pass T120
- [X] T129 [P] [US5] Implement `src/core/io/example-csv.ts` to pass T122, and create `examples/files/test-cases-example.csv`, `examples/files/test-cases-example.json` and `examples/files/case-example.json`
- [X] T130 [US5] Implement `src/app/actions/test-cases-file.ts` (`importTestCases` with summary, valid rows added or cancel, categories by consent, nothing changed on cancel or failure, allowed after finalizing with `markLate`; `exportTestCases`; `downloadExampleFile`) to pass T124 (FR-027 to FR-029, FR-050, FR-053)
- [X] T131 [US5] Implement `src/ui/steps/cases/ImportPanel.tsx` and `ImportSummaryDialog.tsx` (its **Import test cases** button is the confirming primary button), and **Import test cases** / **Export test cases** in `FileMenu.tsx`, to pass T123 and T117 (FR-030)
- [X] T132 [US5] Write the Help section "Importing test cases from a file" with the CSV example from `examples/files/`

**Done 2026-11-14.** US5 is complete. Notes: `Ports` gained `exportTarget` (a save target that asks for a name each
time and is forgotten at once) and `FileOpener.open` takes a kind (`import` accepts CSV and JSON and returns the
bytes, so `decodeBytes` can fall back to Windows-1250). `planImport` (`validate-test-cases.ts`) is the one place
that decides what is valid; the summary and `applyImport` only show and apply it. Missing categories are added by
the **Import test cases** button itself, after the summary names them (no extra checkbox). Row numbers of a CSV
count the header as row 1 and keep blank lines. `examples/files/test-cases-example.csv` is written by
`npm run examples`; a test pins it to `exampleCsv`. Step 5 of V5 (thresholds, **Edit test cases**) belongs to
US9 and US11.

---

## Phase 10: User Story 7 - Run every test case by hand (Priority: P1)

**Goal**: The judge summary and model details, **Save evaluation** on Run, the always-visible
reply box and pasting replies from the clipboard in the case window with the action needed next as
the primary one, and the protection of long manual work.

**Independent Test**: quickstart.md V6.

### Tests for User Story 7 ⚠️

- [X] T133 [US7] Write `tests/e2e/v6-run.spec.ts` implementing quickstart.md V6 with the clipboard of the browser context (1280 x 720 without page scrolling; no more than three actions per case: **Open** or **Next test case**, **Copy prompt**, **Paste reply from clipboard**; reminder at 25 unsaved replies) (SC-002, SC-030, SC-032)
- [X] T134 [P] [US7] Write `tests/unit/sources/pasted-reply.test.ts`: the adapter implements `JudgeReplySource` and returns a `ReplyBatch`; an empty reply is a problem; any other text is accepted; a very large reply is accepted (FR-056)
- [X] T135 [P] [US7] Write `tests/unit/app/attach-replies.test.ts`: stores reply with its composed prompt; refused before finalizing; a new reply resets the case (decisions and added findings removed, automatic decisions recomputed); `replaceNeedsQuestion` is true only when the case has decisions with source `manual` or `llm-approved` and says how many; the same reply again changes nothing; records `reply_judge_version` on the first reply; increases the count of replies since save; the reminder is due at every 25 (FR-053, FR-056, FR-057, FR-059)
- [X] T136 [P] [US7] Write `tests/unit/ui/run-step.test.tsx`: one summary line (judge version, test project name, test cases version, judged text) with no prompt or rules text; the multi-line **Model details** box keeps its lines; the **Evaluation file** card with **Save evaluation** and **Save evaluation as**; the "what next" line with progress, the new-conversation reminder and **Continue**; "N replies not saved to a file"; reminder after 25 with **Save evaluation** in it; the case window without a reply shows "Judge's reply" with the four steps, **Copy prompt** as the primary button until it has been pressed for this case and then **Paste reply from clipboard**, and below them the reply box, always visible, with **Save reply**; with a reply the box holds it and **Save reply** with changed text replaces it; the box is checked as it changes with line and column; no section of the window is collapsed and there is no "More actions"; an empty clipboard is explained and changes nothing; a refused or unavailable clipboard points to the box; replacing asks only as `replaceNeedsQuestion` says; the window header holds **Save evaluation**, **Save evaluation as** and the unsaved count; moving or closing with a changed reply asks; not-finalized state (FR-054 to FR-059 incl. FR-058, FR-084)
- [X] T211 [P] [US7] Write `tests/unit/ui/reply-box.test.tsx`: the reply box is always visible in the case window, without and with a reply; it is checked as it changes ("Readable JSON", or line and column); **Save reply** is the primary button while the text differs from the saved reply; saving a changed reply replaces it after `replaceNeedsQuestion`; a non-JSON reply is saved and kept with the problem shown, nothing is marked automatically and the case needs **Approve** (FR-055, FR-056, FR-084, SC-037)

### Implementation for User Story 7

- [X] T137 [P] [US7] Implement `src/sources/types.ts` and `src/sources/pasted-reply.ts` to pass T134
- [X] T138 [US7] Implement `src/app/actions/replies.ts` (`attachReplies`, `replaceNeedsQuestion`, `pasteReplyFromClipboard` through the `ClipboardReader` port, `saveReply`, `setModelDetails`) to pass T135
- [X] T139 [US7] Implement `src/ui/steps/run/JudgeSummary.tsx`, `src/ui/steps/run/SaveReminder.tsx` and `src/ui/windows/case-window/ReplyPane.tsx` (the always-visible reply box on `JsonBox`, with the draft kept per case), and extend `RunStep.tsx` and `CaseWindow.tsx` (its left column reuses the fields view of `CaseView.tsx` from T115: numbered highlights E1…E5, after a reply marked found, missed, undecided or ignored, findings marked matching, partly matching or matching no expected error, and the expected errors with **Show in text**), to pass T136, T211, T206 (case window of Run; FR-077, SC-033) and T133; no bulk prompt export or reply import (FR-059)
- [X] T140 [US7] Write the Help sections "Working by hand: copy, run, paste" and "Pasting replies from the clipboard, and replacing a reply" in `src/ui/help/sections/`

**Done 2026-11-14.** US7 is complete. `attachReplies` stays pure: it takes the judge version as an
option (the hash is asynchronous) and a `confirmReplace` flag; `saveReply` and `pasteReplyFromClipboard` are the
asynchronous wrappers the interface calls. `replaceNeedsQuestion` counts marks and added findings with the source
`manual` or `llm-approved` (an approval alone is not counted). The reminder is due from 25 replies not saved to a
file and stays until **Save evaluation**; a replaced reply counts like a new one. **Copy prompt** is only in the
four steps of the right column (not repeated under the prompt on the left), so each button name is unique in the
window; the primary action of the window is one of **Copy prompt**, **Paste reply from clipboard**, **Save reply**
(a changed text) or **Approve**. Moving or closing with a changed reply asks (Cancel or Discard reply). The Run
"what next" line got a second note with the new-conversation reminder. The e2e spec was written together with the
code and passed on its first run; the unit tests were confirmed failing first.

---

## Phase 11: User Story 8 - Resolve the differences right after each reply (Priority: P1)

**Goal**: Ignore, **Add finding** with optional category and difficulty and **Remove**, notes,
the **Second opinion** window with its preview and **Apply opinion**, approval, the "only
awaiting verification" filter, corrections after replies; every action a visible button.

**Independent Test**: quickstart.md V7.

### Tests for User Story 8 ⚠️

- [X] T141 [US8] Write `tests/e2e/v7-deciding.spec.ts` implementing quickstart.md V7
- [X] T142 [P] [US8] Write `tests/unit/core/generation/verification-prompt.test.ts`: one case only; its identifier, fields, numbered expected errors, numbered additional findings, the reply; the fixed JSON opinion with reason and fragment; own changes first (FR-063)
- [X] T143 [P] [US8] Write `tests/unit/core/evaluation/opinions.test.ts`: `readOpinion(text, caseId)` accepts the wrapped object, the bare object and a list with exactly one opinion; refuses a list of several, an opinion for another case and a JSON that cannot be read (line and column), with the reason; `additional` entries with `text` and no valid `index` read as `new` (FR-063)
- [X] T144 [P] [US8] Write `tests/integration/corrections.test.ts`: after replies, correcting a rule, the mapping or an expected error recomputes automatic decisions, keeps decisions by hand, lists orphaned decisions in one note, changes the judge version and keeps `reply_judge_version` (FR-053)
- [X] T145 [P] [US8] Write `tests/unit/ui/decide-actions.test.tsx`: marks on single items stay visible; **Ignore** on every item; under the list, always visible and never in a collapsed section: **Add finding** (text, optional category from the catalog or a new name that joins it, optional difficulty), **Note** and **Second opinion…**; a finding added by hand or by an opinion shows its category and difficulty and has **Remove**, a finding read from the reply has none; **Add finding** for an unreadable reply with the note that the case needs **Approve**; sources "automatic", "set by hand", "LLM opinion, approved by the user"; no second-opinion card on the Run step and no approval of several cases; "only cases awaiting verification" in the window (FR-008, FR-055, FR-060, FR-062 to FR-064, SC-027)
- [X] T212 [P] [US8] Write `tests/unit/core/evaluation/opinion-plan.test.ts` for `opinionPlan` and `applyOpinion`: an item is answered only with `found` or `real` as true or false; per answered item the current mark and source and the new mark, flagged when it replaces a mark set by hand; answers that agree are "no change"; new findings with text, real, optional category and difficulty; unanswered items with the reason; "classifies none" when nothing is answered and nothing added, and then it cannot be applied; applying sets the answered marks (hand-set ones included) with `llm-approved`, adds the new findings as added findings with `from_opinion`, marks unanswered undecided items "no answer" and sets `approved` (FR-063, SC-028)
- [X] T213 [P] [US8] Write `tests/unit/ui/second-opinion-window.test.tsx`: **Second opinion…** opens a dialog for that case with the line "The LLM checks N expected errors and M additional findings of this case", the prompt read-only with **Copy prompt**, one box, the preview ("E1 undecided → Found", "replaces a mark set by hand", "+ new finding", "No answer"), **Apply opinion** and **Cancel**; **Apply opinion** disabled while empty, unreadable (line and column), for another case, or when it classifies none ("The opinion classifies none of the N items of this case. Nothing will change." with the reason per item); the pasted text is kept; after applying the window closes and the marks show the source "LLM opinion, approved by the user"; **Cancel** changes nothing (FR-063)
- [X] T214 [P] [US8] Write `tests/unit/core/evaluation/additional-by-category.test.ts`: `countAll` counts additional findings that are not ignored per category and per difficulty as real errors and false positives, with "(no category)" and "(not set)"; the counts are written to the evaluation file and recomputed identically on load (FR-062, FR-070); make it pass in `src/core/evaluation/counters.ts` together with T154

### Implementation for User Story 8

- [X] T146 [P] [US8] Implement `src/core/generation/verification-prompt.ts` to pass T142
- [X] T147 [P] [US8] Implement `src/core/io/opinions.ts` (`readOpinion`) and `src/core/evaluation/opinions.ts` (`opinionPlan`, `applyOpinion`) to pass T143 and T212
- [X] T148 [US8] Implement `src/app/actions/decide.ts` (`decide`, `ignore`, `addFinding`, `removeFinding`, `setNote`, `approve`, `openSecondOpinion`, `applyOpinion`, `correctRules`) to pass T144
- [X] T149 [US8] Implement the list actions in `src/ui/windows/case-window/DecidePane.tsx` and `src/ui/windows/second-opinion/SecondOpinionWindow.tsx` (on `Dialog`: the line of what is checked, the prompt with **Copy prompt**, one box on `JsonBox`, the preview, **Apply opinion** and **Cancel** pinned at the bottom) to pass T145, T213 and T141
- [X] T217 [US8] Add the additional findings per category and per difficulty (real errors and false positives, with "(no category)" and "(not set)") to `src/core/evaluation/counters.ts` and `results.ts`, and write them as `additional_per_category` and `additional_per_difficulty` in `src/core/io/evaluation-file.ts`, to pass T214 (FR-062, FR-070)
- [X] T150 [US8] Write the Help section "Marking after each reply: Add finding, Remove, the second opinion and Ignore" in `src/ui/help/sections/`

**Done 2026-11-14.** US8 is complete. The marks, **Ignore**, sources and the "only cases awaiting verification"
box existed from earlier phases; this phase added **Add finding**, **Remove**, **Note**, **Second opinion…** and the
corrections. T214 and T217 were already met by `counters.ts` and the evaluation file (their test file was added
now). A finding added by hand starts as a real error (`AddedFinding` always has a state) and the Help says to press
the mark that fits. `opinionPlan(testCase, effective, opinion)` and `applyOpinion(decisions, plan)` are pure; a new
category named in a finding or an opinion joins the catalog in `applyOpinionTo`. An applied opinion also sets
`approved`. `correctRules` names the decisions that a correction left without an item in one sentence (only the
newly orphaned ones); the judge version changes by itself, `reply_judge_version` is kept. The source labels now read
"Set by hand" and "LLM opinion, approved by the user" as the spec words them. The prompt of the second opinion lists
every item (not only the undecided ones). The e2e spec passed on its first run; the unit tests were confirmed
failing first.

---

## Phase 12: User Story 9 - Read the results and export them (Priority: P1)

**Goal**: Details with thresholds and check settings, Error analysis, Test case list with the
read-only case view, and the HTML report at any time. Results changes nothing but the thresholds.

**Independent Test**: the three views, the report read without the tool, quickstart.md V9 steps
2 and 3 and V12 step 3.

### Tests for User Story 9 ⚠️

- [X] T151 [US9] Write `tests/e2e/us9-results.spec.ts`: three views, the read-only case view with **Previous test case** and **Next test case**, the report exported while cases are undecided (marked provisional) and again when all are decided, the report opened on its own and printed to PDF (SC-008), and quickstart.md V12 step 3
- [X] T152 [P] [US9] Write `tests/contract/checks-file.test.ts`: `format` `judge-the-judge-checks`; `at_least` / `at_most`; values 0 to 1; unknown measure, comparison or range rejected with the rules unchanged; `minimum_sample` ignored and reported as fixed (FR-069)
- [X] T153 [P] [US9] Write `tests/contract/html-report.test.ts`: self-contained, no `<script>`, no external resources; order of contracts/file-formats.md section 8 including model details, judged text and the cases added or corrected after the first reply; every prompt, expected error, reply, decision with source, added finding with category and difficulty, and ignored item; Error analysis with additional findings per category and difficulty; "Provisional" with the number of undecided cases when cases are not run or await verification; `<script>` in a value escaped; details expanded in print (FR-072)
- [X] T154 [P] [US9] Write `tests/unit/ui/results-views.test.tsx`: Details collapsed by default with thresholds, **Load check settings**, intervals, both borderline notes, the two informational shares; the thresholds are the only controls that change data; Error analysis per category, difficulty and rule, and additional findings per category and difficulty with "(no category)" and "(not set)", counts only (FR-070); the notice of cases added or corrected after the first reply; Test case list with the category and difficulty of added findings and **Open** opening the read-only case view with no control that changes the case and **Open on Run**; **Export HTML report** and **Edit the judge and run again** in the "Report and next version" card; no **Export JSON**; states of contracts/ui-flow.md (FR-065, FR-069 to FR-072 incl. FR-071, SC-007)

### Implementation for User Story 9

- [X] T155 [P] [US9] Implement `src/core/schemas/checks.ts`, `src/core/io/checks-file.ts` and `examples/metrics/checks-example.json` to pass T152
- [X] T156 [P] [US9] Implement `src/core/io/html-report.ts` (`buildHtmlReport`) to pass T153 Include the table of additional findings per category and difficulty in Error analysis (T153).
- [X] T157 [US9] Implement `src/ui/steps/results/DetailsSection.tsx`, `ErrorAnalysisView.tsx` (with the table of additional findings per category and difficulty), `CaseListView.tsx`, `src/ui/windows/case-window/ReadOnlyCaseView.tsx` (on `CaseWindowFrame`) and `src/app/actions/export.ts`, and the "Report and next version" card in `ResultsStep.tsx`, to pass T154 and T151
- [X] T158 [US9] Write the Help sections "Overall result and thresholds" and "Exporting the report, and what provisional means" (with the check settings example from `examples/metrics/`) in `src/ui/help/sections/`

**Checkpoint**: All P1 stories work end to end on a real judge

**Done 2026-11-14.** US9 is complete (the Phase 12 checkpoint: all P1 stories now work end to end). The check rules
reader is `readChecks(text, knownMeasures)`; the known measures are the two per-error ones, the two case-level ones
and those of the active metric, a measure may have one rule only, and `minimum_sample` is ignored with a note.
`examples/metrics/checks-example.json` already existed. The report is built by `buildHtmlReport(evaluation, results,
reviewed, meta)` and downloaded by the page (`Export HTML report` has no file picker); its details are `<details>`
that print expanded through `::details-content` (checked in Chrome with `emulateMedia('print')`). The tables of the
Error analysis come from `core/evaluation/analysis.ts`, shared by the view and the report, and the wording of sources
and states from `core/evaluation/source-labels.ts`. **Export HTML report** is in the "what next" line when the result is
final and in the "Report and next version" card while it is provisional, so the name is never on two buttons.
**Edit the judge and run again** is not on the card yet: it arrives with US12 (T185). The Error analysis counts per
expected error only; its per-case form arrives with US14 part 2 (T169). A race in `CaseWindowFrame` was fixed on the
way: Alt + Left or Right pressed right after a move acted on the case that had just been left (the key handler now
reads the latest handlers from a ref).

---

## Phase 13: User Story 14 (part 2) - Judges evaluated per case (Priority: P3)

**Goal**: A judge whose every rule uses only fields outside any list gives one verdict for the
whole text and is evaluated per case: automatic decisions per case, case counts, two case-level
rates, Error analysis by case, a case-level test size, and a note when a correction switches the
way of counting (FR-061, FR-066 to FR-070, FR-075; research.md, section 29).

**Independent Test**: quickstart.md V12 step 4.

### Tests for User Story 14 (part 2) ⚠️

- [X] T159 [US14] Write `tests/e2e/v12-verdict-judge.spec.ts` implementing quickstart.md V12 step 4 with `examples/metrics/bias-verdict-example.json`
- [X] T160 [P] [US14] Write `tests/unit/core/judge/counting-mode.test.ts` for `countingMode(rules)`: `per_case` when at least one usable rule exists and every rule uses only fields outside any list; `per_expected_error` with any rule on a list item, with no rules, or with only broken rules
- [X] T161 [P] [US14] Extend `tests/unit/core/evaluation/review.test.ts` with `per_case` mode: a flagged reply makes every expected error found (also one without a fragment) with source automatic; an unflagged one makes every expected error missed; a field a rule needs is missing: undecided with the reason; on a clean case a flag is an additional finding left to the user and no flag gives Pass; the review says whether the text was flagged
- [X] T162 [P] [US14] Extend `tests/unit/core/evaluation/counting.test.ts` with `per_case` mode: `defective_cases_decided` (decided cases with at least one expected error not ignored) and `defective_cases_flagged`; a case whose expected errors are all ignored is left out; `case_detection_rate` and `clean_case_false_positive_rate` with Wilson intervals; only the check rules on these two measures apply (no rule is mapped onto another); Inconclusive below 30 decided cases with errors or 10 decided clean cases; the first reason says the judge was evaluated per case; category and difficulty groups count cases (a case once in each category and difficulty its errors have) with counts only
- [X] T163 [P] [US14] Write `tests/integration/counting-switch.test.ts`: after replies, a rule correction that changes the counting mode records `counted_per_before_correction`, and Results, the evaluation file and the report name the way used before and after; recomputing a loaded file in either mode gives identical numbers (FR-075, SC-003)
- [X] T164 [P] [US14] Write `tests/unit/ui/results-per-case.test.tsx`: the Judge step notes that the judge is evaluated per case; the case window says so and whether the text was flagged; the Summary says so in one sentence, counts cases (cases with errors: flagged, not flagged; clean cases: flagged wrongly, not flagged) and shows no per-error counts; the two rates are named "Case detection rate" and "Clean-case false-positive rate"; Error analysis counts cases with counts only and one sentence why; the test size counts cases with errors and clean cases; "Details" shows the two case-level thresholds (FR-061, FR-066, FR-067, FR-068, FR-069, FR-070)

### Implementation for User Story 14 (part 2)

- [X] T165 [P] [US14] Implement `src/core/judge/counting-mode.ts` (`countingMode`) to pass T160
- [X] T166 [US14] Add the `per_case` branch to `src/core/evaluation/review.ts` to pass T161
- [X] T167 [US14] Add the `per_case` counters, the two case-level measures, the case groups and the case-level minimum to `src/core/evaluation/counters.ts`, `measures.ts`, `overall.ts` and `results.ts`, and the counters to the registry's known counters in `src/core/metrics/operations.ts`, to pass T162
- [X] T168 [US14] Record `evaluated_per` and `counted_per_before_correction` in `src/core/evaluation/results.ts` and `src/core/io/evaluation-file.ts`, and show the switch note in `ResultsStep.tsx` and `src/core/io/html-report.ts`, to pass T163
- [X] T169 [US14] Show the per-case mode in `src/ui/steps/judge/RulePreview.tsx`, `src/ui/windows/case-window/DecidePane.tsx`, `SummaryView.tsx`, `ErrorAnalysisView.tsx`, the test size in `ResultsStep.tsx`, and the case-level rates and counts in `src/core/io/html-report.ts`, to pass T164 and T159
- [X] T170 [US14] Write the Help section "Judges that give only a verdict (for example bias: yes or no)" with the worked example (30 biased texts, 27 flagged: 90%; 10 neutral, 1 flagged: 10%) and what is not covered (graded answers, checking a returned number) in `src/ui/help/sections/`

**Done 2026-11-14.** US14 part 2 is complete. `countingMode(rules, sample?)` moved to `src/core/judge/counting-mode.ts`
and now ignores broken rules when it has the sample reply; `countingModeOf(judgeSet)` is what the results use. The review
per case decides a whole case from the flag (`flagged` on `CaseReview`); on a clean case the whole-reply finding is the
additional finding with the key `reply`. In `per_case` mode `countAll` still computes the per-error counters (every error of
a flagged case is found) but the interface shows only the case counters, and adds `case_per_category` and
`case_per_difficulty`. To name a switch of the way of counting the evaluation stores `reply_counted_per` (a new optional key of
the evaluation file, set with the first reply); `counted_per_before_correction` is derived from it. The demo files were
regenerated (`npm run demo`) because the counters gained two keys. **Quickstart V12 step 4:** "add cases with expected errors,
finalize" is not walked through in the e2e spec, because **Finalize test cases** is built in US11 (Phase 15); the spec loads a
finalized test project written by the test instead.

---

## Phase 14: User Story 10 - Get guidance while building the test project (Priority: P2)

**Independent Test**: only cases with injected errors warn; a duplicate text is flagged.

- [X] T171 [US10] Write `tests/e2e/us10-guidance.spec.ts` covering the acceptance scenarios of User Story 10
- [X] T172 [P] [US10] Write `tests/unit/core/cases/feedback.test.ts`: counts; a missing kind warns that some measures cannot be computed; "Two cases whose fields are all identical are flagged as duplicates"; remaining capacity to 500; cases grouped by number of errors; totals against 30 and 10 as met or "missing N"; for a judge evaluated per case, cases with expected errors counted against 30 instead of injected errors; no subtle error warned (FR-045, FR-046)
- [X] T173 [P] [US10] Write `tests/unit/ui/test-project-card.test.tsx`: name, test cases version, counts, test-size summary with its sentence, warnings, capacity; adding beyond 500 refused; category description and example shown where a category is chosen; no unsaved indicator of its own (the header has the one indicator)
- [X] T174 [US10] Implement `src/core/cases/feedback.ts` to pass T172
- [X] T175 [US10] Implement `src/ui/steps/cases/TestProjectCard.tsx` and the category hint in `src/ui/windows/test-case/InjectPrepare.tsx` to pass T173 and T171

**Done 2026-11-14.** US10 is complete. `testProjectFeedback` (`src/core/cases/feedback.ts`) gives the counts, the groups by
number of errors, the test size against 30 and 10 (cases with expected errors for a judge evaluated per case), the warnings
(a missing kind with the measure that cannot be computed, no subtle error, duplicates) and the capacity. Two cases are
duplicates when their fields are all identical (same names, same texts); the table says "Identical fields to case N" in the
Warnings cell of each. The card also lists the readability warnings of the Judge step. The card sits between the error
categories and the table. The 500 limit: **Add test case** is disabled at the limit with the reason in the card, and
`saveCaseFromJson` refuses with a message (a clone or a pasted JSON reaches it too); the import already refused by count.
The category's description and example show under the Category select of every error row.

---

## Phase 15: User Story 11 - Mix hand-made and loaded cases, then finalize (Priority: P2)

**Independent Test**: 10 imported + 2 added cases finalize into 12 cases whose input is fixed; a
13th can still be added; before the first reply "Edit test cases" opens them again.

- [X] T176 [US11] Write `tests/e2e/us11-finalize.spec.ts` covering User Story 11, including the browser warning when leaving with unsaved cases (FR-004) and **Edit test cases** before the first reply
- [X] T177 [P] [US11] Write `tests/unit/core/cases/finalize.test.ts`: finalizing is refused for empty test cases or an empty judge prompt; warnings for one kind only, replies not readable automatically, a broken rule, a case without a field for a variable, no subtle error, test size below the minimum (FR-052, SC-014, SC-025)
- [X] T178 [P] [US11] Write `tests/integration/finalize-flow.test.ts`: imported and added cases join one test project; after finalizing the prompt, judged text, fields and identifiers are fixed; cases may still be added, cloned and imported; a case without a reply may be renamed, removed or have its expected errors corrected, a case with a reply may not; the mapping and rules may be corrected; replies only after finalizing; "Edit test cases" is allowed only while no reply exists, opens the test cases and the prompt again, loses nothing and keeps both remembered files; after the first reply it is not offered (FR-039, FR-049, FR-053, FR-076, FR-089)
- [X] T179 [US11] Implement `src/core/cases/finalize.ts` to pass T177
- [X] T180 [US11] Implement `src/app/actions/finalize.ts` (`finalize`, `editTestCases`) to pass T178
- [X] T181 [US11] Implement `src/ui/steps/cases/FinalizeDialog.tsx`, **Finalize test cases**, **Edit test cases** and, after finalizing, **Add test case** in the "what next" line of Test cases, Judge and Run, and the finalized states of the Judge step, the table and the test case window, to pass T176
- [X] T182 [US11] Write the Help section "Finalizing, and editing before the first reply" in `src/ui/help/sections/`

Done 2026-11-14. US11 is complete. `finalizeSummary` (`src/core/cases/finalize.ts`) refuses only an empty test project or an empty
judge prompt; every other finding is a warning (one kind only, replies not readable, a broken rule, no error rule, a case without a
field for a variable, no subtle error, duplicates, test size below the minimum), each once and in a fixed order. `finalize` and
`editTestCases` (`src/app/actions/finalize.ts`): finalizing sets the one unsaved flag; **Edit test cases** is allowed only while
finalized with no reply, keeps both remembered files, and from Run or Results returns to Test cases. The "what next" line gained
quieter buttons beside the primary action (`others`): after finalizing, **Add test case** on Judge and Run (Test cases already has it
above its table, so it is not repeated there) and **Edit test cases** while no reply exists. `FinalizeDialog` shows the counts,
the balance, the test size (`TestSize`, shared with the card) and every warning before a confirmation; the card says the test
cases are finalized. The leave-the-page warning (FR-004) was already in place and is now covered by an e2e test. Help has the
section "Finalizing, and editing before the first reply"; it names **Edit the judge and run again**, which arrives with Phase 16.

---

## Phase 16: User Story 12 - Test another version of the judge (Priority: P2)

**Independent Test**: quickstart.md V10.

- [ ] T183 [US12] Write `tests/e2e/v10-rerun.spec.ts` implementing quickstart.md V10 steps 1 and 2 (another judge version; the same test project with another LLM)
- [ ] T184 [P] [US12] Write `tests/integration/edit-judge-run-again.test.ts`: keeps the cases; clears replies, decisions and `reply_judge_version`; prompt editable until the first new reply; new judge version; asks first with **Save evaluation first**, **Discard** and **Cancel** when there are unsaved changes; forgets both remembered files, so the next "Save test project" and "Save evaluation" each ask for a file; loading the first run's test project again and entering other model details and replies gives an evaluation with the same judge version, test cases version, metric and thresholds (FR-020, FR-034, FR-051, FR-074, FR-076)
- [ ] T185 [US12] Implement `src/app/actions/rerun.ts` to pass T184, and add **Edit the judge and run again** to `ResultsStep.tsx` to pass T183
- [ ] T186 [US12] Extend the Help section "Files: the test project and the evaluation" with "Testing another version of the judge" and "Running the same test with another LLM" in `src/ui/help/sections/`

---

## Phase 17: User Story 13 - Reproduce and audit past results (Priority: P2)

**Independent Test**: quickstart.md V8 and V9 steps 2 and 3.

- [ ] T187 [US13] Write `tests/e2e/v8-corrections.spec.ts` (quickstart.md V8) and `tests/e2e/v9-reproduce.spec.ts` (V9 steps 2, 3 and 5)
- [ ] T188 [P] [US13] Write `tests/unit/core/evaluation/recompute.test.ts`: identical inputs give identical numbers with the stored metric parameters; a differing stored `results` is reported with both; `rules_corrected_after_replies` exactly when the two judge versions differ (FR-075, SC-003)
- [ ] T189 [US13] Implement `src/core/evaluation/recompute.ts` to pass T188 and call it from `loadEvaluation`
- [ ] T190 [US13] Show in `ResultsStep.tsx` and in the report header (`src/core/io/html-report.ts`) the note that rules or mapping were corrected after replies, naming both versions, the list of cases added or corrected after the first reply, and the note when recomputed numbers differ, to pass T187

---

## Phase 18: User Story 15 - Browse a large test project (Priority: P3)

**Independent Test**: 500 cases filtered to "injected errors and without a reply".

- [ ] T191 [US15] Write `tests/e2e/fixtures/make-500-cases.ts` and `tests/e2e/us15-large-test-project.spec.ts`: 500 cases load, list, filter and sort without freezing more than 2 seconds (FR-036, SC-018)
- [ ] T192 [P] [US15] Write `tests/unit/app/case-filter.test.ts`: search in name and fields; filters by kind (clean, injected errors), with warnings, with a reply, without a reply, combinable; sorting; count
- [ ] T193 [US15] Implement `src/app/case-filter.ts` to pass T192, and add search, filters, sorting and the count to `CasesTable.tsx` to pass T191 (FR-025)

---

## Phase 19: Polish & Cross-Cutting Concerns

- [ ] T194 [P] Write `tests/contract/help-examples.test.ts`: every file example shown in Help is read from `examples/` and loads with its reader without problems (Principle VIII)
- [ ] T195 Review `src/ui/help/HelpScreen.tsx` and every section in `src/ui/help/sections/` against contracts/ui-flow.md (Help) and FR-006, including the interval caveat of research.md section 7, the two files, **Continue**, judges evaluated per case, the supported browsers and the note that exported files contain the user's data; the Help is complete before T200
- [ ] T196 [P] Write `scripts/generate-json-schemas.ts` (run by `npm run build`) and `tests/contract/json-schemas.test.ts` checking `docs/schemas/*.schema.json` are up to date, including `test-project.schema.json` and `case.schema.json` (the case JSON of contracts/file-formats.md, section 2)
- [ ] T197 [P] Write `tests/e2e/v11-invalid-files.spec.ts` implementing quickstart.md V11, including a test project given to **Load evaluation** and an evaluation given to **Load test project** (SC-004, SC-017)
- [ ] T198 [P] Write `tests/e2e/v13-privacy-a11y.spec.ts` implementing quickstart.md V13 in Chrome and Edge: no request with user data; axe-core in light and dark schemes, the second-opinion and Load example windows included; every text pair at least 4.5:1; red accent on black (dark) or near-white (light); every error and "Fail" carries a word or a sign; exactly one primary action in each step's "what next" line besides **Save evaluation** on Run and the confirming button of an open window (**Save case**, **Approve and close**, **Apply opinion**, **Import test cases**, **Approve**); keyboard only; 360 px; the browser notice (SC-006, FR-007, Principle VII)
- [ ] T199 Fix every accessibility, contrast and layout problem found by T198 across `src/ui/`
- [ ] T200 Create `.github/workflows/deploy.yml` (on push to `main`: `npm ci`, `npm test`, `npm run build`, `npm run e2e`, publish `dist/` to GitHub Pages over HTTPS), only after T195 (research.md, section 21; Principles II and VIII)
- [ ] T201 Run every scenario of `specs/001-judge-evaluation-workflow/quickstart.md` and the performance checks against `npm run preview` in Chrome and Edge, record gaps as new tasks here, and ask the owner to try V1, V3, V4, V5 and V10 as a first-time user to check SC-001, SC-010, SC-012, SC-020, SC-021, SC-022 and SC-026
- [ ] T202 Delete `prototypes/ui-prototype-v17/` once T201 shows the production tool covers its flows (research.md, section 22)

---

## Dependencies & Execution Order

- **Setup → Foundational → US1 (MVP)**. Everything else needs the MVP.
- **US6** after US1. From here on every story can be tested from a saved evaluation or test project.
- **US2 → US3 → US14 (part 1) → US4** (the window needs the case JSON check and categories). **US5**
  after US3.
- **US7 → US8 → US9** after US6; testable on the demo or a saved file, so they do not wait for
  US5 or US11. T139 (US7) reuses `CaseView.tsx` from T115 (US4), so the case window of Run gets its
  highlights and **Show in text** after US4.
- The test case window is built in US3 (T216) and extended in US4 (T115).
- **US14 (part 2)** after US9 and US14 (part 1): it changes review, counting and the Results views.
- **US10, US15** after US5; **US11** after US4 and US5. **US12** after US9 and US11. **US13** after
  US6 and US8.
- **Polish** last; T200 (publishing) only after T195 (Help complete); T202
  last of all.
- Within a phase: the end-to-end test first, then the other tests, then core, actions, components;
  each implementation task names the tests it makes pass.

```text
Setup → Foundational → US1 → US6 ─┬→ US2 → US3 ─┬→ US14a → US4 ─┐
                                  │              └→ US5 ─┬→ US10 │
                                  │                      ├→ US15 │
                                  │                      └→ US11 ←┘ → US12
                                  └→ US7* → US8 → US9 ─┬→ US13
                                                       ├→ US14b (also after US14a)
                                                       └→ (US12)
→ Polish
```

\* T139 (US7) also needs T115 (US4): the case window of Run reuses `CaseView.tsx`. The rest of US7
can start after US6.

## Parallel Execution Examples

```text
Foundational tests: T011–T021 together; then T024, T025, T026 together
US1 tests:          T034–T045 together (after T033); core T046, T047, T049, T052 together
US6 tests:          T063–T066 together (after T062); core T067 and T068 together
US3 tests:          T081–T085, T204 and T215 together (after T080)
US4 tests:          T107–T110 and T203, T205–T208 together (after T106); core T111 and T112 together
US5 tests:          T118–T124 together (after T117); core T125, T126, T129 together
US7 tests:          T134–T136 and T211 together (after T133)
US8 tests:          T142–T145 and T212–T214 together (after T141); core T146 and T147 together, then T217
US14b tests:        T160–T164 together (after T159)
Across stories (after US6): A: US2 → US3 → US14a → US4    B: US7 → US8 → US9 → US14b    C: US5 → US10 → US15
```

## Implementation Strategy

1. **MVP**: Setup, Foundational, US1. Stop and validate: quickstart.md V1 passes on the demo. This
   is a local milestone; nothing is published while the Help is incomplete (Principle VIII).
2. **Keep the work**: US6, the test project and the evaluation with **Continue**, so every later step
   can be saved and resumed.
3. **The owner's own judge**: US2, US3, US14 (part 1), US4, US5, then US7, US8, US9: the whole P1
   flow.
4. **Other kinds of judges**: US14 (part 2), judges that give only a verdict, evaluated per case.
5. **P2 and P3**: US10, US11, US12, US13, US15.
6. **Polish**: Help review, schemas, invalid files, privacy, accessibility and contrast, publishing,
   removal of prototype v17.

Each increment ends with its end-to-end scenario passing and its Help section written. Commit after
each task or logical group.
