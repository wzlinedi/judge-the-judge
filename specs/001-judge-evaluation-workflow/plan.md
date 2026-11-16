# Implementation Plan: Judge the Judge

**Branch**: `001-judge-evaluation-workflow` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-judge-evaluation-workflow/spec.md`, as revised
after the reviews of prototypes v7 to v12. Updated on 2026-11-12 for the review of v9 (four
steps, the test case window, the judged text), then for the review of v10 (Chrome and Edge only,
pasting from the clipboard, the second opinion per case, saving to one chosen file, a read-only
Results step; a closing step was considered and dropped) and the findings of both consistency
analyses, then for the reviews of v11 and v12 (two files, the test set and the evaluation, with all
file actions in the header; a black-and-red interface with one "what next" line per step,
"Continue" after a load and fewer buttons; judges that give one verdict for the whole text,
evaluated per case). Updated on 2026-11-13 for the reviews of v13 to v17: one user file named the
**test project** (the word "dataset" and "test set" are gone from the interface); the error
catalog as a collapsible "Error categories" section of the Test cases step; no clean-case section
on the Judge step and no welcome section; every test case made from one **case JSON** (From JSON,
Clean case, Case with errors in three parts), never edited after saving, with a
read-only **Open** and **Edit expected errors**; adding and importing
after finalizing; "Save evaluation" only on Run; on Run an always-visible reply box,
**Add finding** with optional category and difficulty and **Remove**, and the second opinion as its
own window with a preview and **Apply opinion**. Prototype v17 is now the reference. Updated on
2026-11-15 for the owner trial (T288, T289): one file, the test project, which holds the test run
once it has started; **Start test run** in place of finalizing, with no way back; the load question
**Load with the test run** or **Load the test project only** in place of "Run again with a new
judge…"; the step "Run" is named "Test run". Updated on 2026-11-16 for the UI redesign (slice 10;
research.md, section 33): a calm look in stone and forest green, a wider layout at four screen sizes,
and the whole JSON object marked in Judge reply until the next pointing. The redesign changes no
data, no file format, no action and no label.

## Summary

Judge the Judge is a static, single-page web tool that tells a judge author whether an
LLM-as-judge prompt can be trusted. The user brings only the judge prompt. In the tool they say how
to read the judge's replies (a sample reply and their own error rules), keep their error
categories, make clean test cases and test cases with deliberately injected, recorded errors
(each prepared with their own LLM or pasted as one case JSON), copy each composed prompt into their
own LLM by hand, paste the reply back from the clipboard, settle the differences right after each
reply, and read the result:
how many expected errors were found and missed, how many additional findings were false positives,
and one line of overall result (Works, Does not work, Inconclusive). A judge that only gives a
verdict for the whole text (for example "biased: yes or no") is evaluated per case.

Technical approach: a TypeScript application built with Vite into plain static files. All
evaluation logic lives in a pure core library with no browser dependency (variables and prompt
composition, recognizing the fields of a reply, error rules, matching findings to expected errors,
decisions, measures, overall result, file formats). A thin Preact interface presents the four steps
(Judge, Test cases, Test run, Results) and Help. Nothing is stored between sessions and nothing
leaves the device: work is saved and restored only through one file with a versioned schema, the
test project, written to one file the user chose. It holds the test run once it has started; the
same test cases are run with a changed judge or another LLM by loading the file without its test
run (research.md, section 32).

## Technical Context

**Language/Version**: TypeScript (current stable, `strict` mode), compiled to ES2022

**Primary Dependencies**: Vite (build and dev server), Preact (interface), Zod (file schemas and
validation), Papa Parse (CSV reading). Exact versions
are pinned in the lockfile when the project is set up. See [research.md](./research.md) for why each
one is needed.

**Storage**: None. State lives in memory for the page session; users save and load JSON and CSV
files on their own device. "Save test project" writes to one file the user chose (File System
Access API), remembered in memory only and overwritten by later saves; the HTML report and "Export test cases" are downloads. There is no results file. No `localStorage`, IndexedDB,
cookies, or server (research.md, section 25).

**Testing**: Vitest for core logic, contract tests and component tests; Playwright with axe-core
for end-to-end and accessibility checks against the built site, in Chromium and Edge. The save
file and the clipboard sit behind two ports with fakes, so every test can replace them (research.md,
sections 6 and 25).

**Target Platform**: Static site for any static host served over HTTPS (GitHub Pages first),
used in current Google Chrome and Microsoft Edge only (FR-003; research.md, section 26), at phone
and desktop widths. Other browsers get a notice. SC-030 and SC-031 set what the case window shows
at 1280 x 720 pixels; since the UI redesign the window scrolls as one page with a header that stays
(FR-092), and SC-030 and SC-031 were reworded for it (Clarifications 2026-11-16).

**Project Type**: Single-project static web application (no backend).

**Performance Goals**: A 100-case file loads and shows its summary within 5 seconds (SC-015); a
500-case test project never blocks the interface for more than 2 seconds (SC-018); decisions and results
recalculate after any change without visible delay.

**Constraints**: Works offline after load; no network requests with user data (enforced by a
Content Security Policy with `connect-src 'none'`); at most 500 cases per test project and 100,000
characters per field; WCAG AA contrast, full keyboard operation, light and dark schemes; all text in
English; the tool never calls an LLM (FR-002). Clipboard reading and the save file need a secure
context (HTTPS or `localhost`) and a click by the user.

**Scale/Scope**: One user, one judge and one test project at a time; 94 numbered functional
requirements, of which 89 are active (FR-018, FR-074 and FR-082 removed, FR-035 and FR-042 merged), 15
user stories, 47 success criteria; five screens (four steps and Help), three windows on one frame
(the test case window; the case window of Test run; the read-only case view of Results) and two
small dialogs (Second opinion; the load question of a test project with a test run); six JSON,
CSV or HTML file formats (test project, test cases as JSON and as CSV, metric,
report; the check rules have no file of their own since T269) and the pasted layouts of
contracts/file-formats.md.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Every production module is preceded by failing tests; nothing is imported from `prototypes/`; prototype logic is re-derived from tests | PASS: core is a pure library tested with Vitest; tasks will pair each implementation task with a preceding test task; every phase starts with its end-to-end scenario and its tests; the save file and the clipboard are reached only through two ports with fakes, so the actions that use them are tested first like any other; prototype v17 is reference only. The first prototype and v6 to v16 have answered their questions and are removed in the setup tasks; v17 is removed when the production tool reaches parity |
| II. Static-First, Hosting-Ready | Builds to plain files; deployable from the first release; no secrets; manual stage 1 | PASS: Vite static build with relative paths, GitHub Pages workflow (HTTPS, as the clipboard and the save file need), no keys, every prompt is copied and every reply pasted by hand, now in one click from the clipboard (FR-002, FR-056, FR-059) |
| III. Separated Core and Pluggable Judge Source | Core independent of the interface; one interface for the source of judge replies | PASS: `src/core` has no DOM access; `JudgeReplySource` has one adapter in this version (a reply pasted for one case). A batch-file adapter and a live LLM adapter can be added later without touching evaluation code |
| IV. Portable File-Based Data | Open formats with documented, versioned schemas and validating loaders; no hidden state; mock data | PASS: six JSON, CSV or HTML formats (test project, test cases as JSON and as CSV, metric, report; the thresholds are saved in and loaded with the test project file, with no file of their own) plus the one case JSON layout, each JSON format with `format` and `schema_version`, defined once as schemas and published as JSON Schema; the whole state is rebuilt from one test project file, and the same file loaded with "Load the test project only" rebuilds the same test (judge, catalog, cases, metric, thresholds) for a new test run (T289); the schema version of the test project becomes 2 and version 1 is upgraded on load; a fixed demo set doubles as test fixtures; the chosen save file is a file on the user's device, not browser storage. **Note**: constitution 3.1.1 (PATCH, 2026-11-15) drops "and evaluation" from Principle IV, because the evaluation file no longer exists; the rule itself is unchanged |
| V. Transparent and Reproducible | Same inputs give the same results; each result records what produced it | PASS: evaluation functions are pure and deterministic; the counting mode follows from the rules and is recorded, and a change of it is named; the test run section of the test project file stores the judge version (the judge set is in the same file), the judge version in force when replies were received, the model note, the test cases version, the cases added or corrected after the first reply, the tool version and the thresholds; on load the results are recomputed and any difference is reported; a report made while cases are undecided says how many are not decided yet (T267) |
| VI. Extensible Metrics and Configurable Checks | One metric contract and registry; declarative definition files; checks in configuration; guide, example, contract tests | PASS: see [contracts/metric-and-checks.md](./contracts/metric-and-checks.md). No metric is built in (constitution 3.0.0): Accuracy is the default metric file that a new test project starts with, registered like any loaded file and replaceable by one with the same id; every other metric loads from a file at run time, and a file that names a metric which is not loaded is refused (T274). Thresholds are bundled defaults, read from `checks.default.json` (T273), editable in Results › Details, and travel in the test project file (constitution 2.0.0; since T266 there is no file of their own; since T289 there is no evaluation file). Judges evaluated per case use two built-in case-level measures from two added counters, with no change to the contract's operations. The minimum test size (30 errors, 10 clean cases) is data in the bundled default configuration, but the spec fixes it, so a loaded configuration cannot change it |
| VII. Modern, Clear UI | One purpose and one next action per screen; shared design tokens; responsive, accessible, light and dark; designed empty and error states | PASS: four-step flow with one "what next" line and one primary action each (FR-001); a fixed list of action names, every row and window action a visible button with no "More actions" menu (FR-008); a single token stylesheet with the black-and-red scheme in light and dark, red never the only sign of an error (FR-007, research.md section 30), replaced on 2026-11-16 by stone and forest green in light and dark (research.md, section 33), every status with a word or sign; axe-core and contrast checks in end-to-end tests; designed states for an empty or refused clipboard, an unwritable save file and an empty start |
| VIII. Living Help | Help inside the application, plain language, examples valid against the schemas | PASS: Help is a screen of the application; its examples are the same files that the contract tests validate, so they cannot drift. Each phase writes the Help section of the feature it builds (including pasting from the clipboard, the second opinion per case, the one file with its load question and **Start test run** (T225, T289), "Continue", judges evaluated per case and the supported browsers), and nothing is published before the Help is complete (constitution 3.0.0: the Help may be updated in one pass after an owner trial, T225, and must be complete before the next public release) |
| Constraints | English everywhere; simplest solution; no data to third parties | PASS: three runtime dependencies (Preact, Zod, Papa Parse) plus Vite as the build tool, each justified in research.md; the clipboard and the save file use built-in browser features, with no new dependency; a Content Security Policy blocks all outgoing connections. This revision removes more than it adds: no Compare, no result shelf, no batch files, no combined score |

**Result**: no violations. Complexity Tracking stays empty.

**Post-design re-check (after Phase 1)**: PASS. The data model and contracts introduce no server,
no stored state, and no code-carrying metric or rule files: an error rule is data (field,
comparison, value), evaluated by operations the tool provides. The technology stack is unchanged
from the one recorded in the constitution since version 1.5.0. Re-checked after the review of v10:
the two browser features sit behind ports outside the core (Principle III), and narrowing the browsers to Chrome and Edge conflicts with no
principle. Re-checked after the reviews of v11 and v12: two files instead of three reduce the state
to explain (Principle IV); the counting mode is derived from data the user wrote, not from a hidden
setting (Principles IV and V); the per-case measures need no code in metric files (Principle VI);
light and dark schemes both remain (Principle VII). Re-checked on 2026-11-13 after the reviews of
v13 to v17: one case JSON layout for every way of adding a case adds no file format (Principle
IV); the cases added or corrected after the first reply, the added findings with category and
difficulty, and an applied LLM opinion are all stored in the evaluation file and recomputed on load
(Principles IV and V); an LLM opinion still changes nothing until the user applies it after a
preview of every change (Principle V, SC-028); the second opinion and **Load demo…** are two
small dialogs, and every action of a row or window is a visible button (Principle VII); prototypes
v13 to v16 answered their questions and join the setup removal (Principle I). Re-checked on
2026-11-15 after the owner trial (T288, T289): one file instead of two reduces the state to
explain again, and the whole state is still rebuilt from one file (Principle IV); the test run
section keeps every reply, decision and version, and is recomputed on load (Principle V); the lock
after **Start test run** is visible, with its reason and the way to test another prompt (Principle
VII); the Help is updated in the one pass of T225, before any release (Principle VIII). The only
finding was the stale file name in Principle IV, fixed by constitution 3.1.1. Re-checked on
2026-11-16 for the UI redesign (slice 10), before and after the design: every color, space, radius
and shadow stays in `tokens.css` (Principle VII); light and dark both remain, and every text pair is
4.5:1 with the ratios computed in research.md, section 33 (Principle VII); the redesign changes no
data, file or schema (Principle IV) and no result (Principle V); every change starts with a failing
test, and the one end-to-end test that checks the old red accent is rewritten before the tokens
change (Principle I); no file of the Help changes now, and the Help is brought up to date in the one
pass of T225 and T269 before any release (Principle VIII). No finding.

## Project Structure

### Documentation (this feature)

```text
specs/001-judge-evaluation-workflow/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and their reasons
├── data-model.md        # Phase 1: entities, rules, state transitions
├── quickstart.md        # Phase 1: how to run and validate the tool
├── contracts/
│   ├── file-formats.md        # The file formats (test project with its test run, ...), the case JSON and the paste formats
│   ├── metric-and-checks.md   # Metric definition contract and check rules
│   ├── core-api.md            # Public functions of the core library and the judge reply source
│   └── ui-flow.md             # Screens, windows, action names, gating, states
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── core/                    # Pure TypeScript, no DOM, no network
│   ├── hash.ts              # Content versions (SHA-256 through Web Crypto)
│   ├── model/               # Types: judge set, rule, case, expected error, decision, test project, test run
│   ├── schemas/             # Zod schemas, plain-language error messages, schema versions
│   ├── io/                  # JSON and CSV reading and writing, one-line convention,
│   │                        # test project (with its test run), test cases (import, export), HTML report
│   ├── judge/               # Variables, prompt composition, reading JSON out of a reply,
│   │                        # recognizing fields and paths, error rules, findings
│   ├── cases/               # Case JSON check, validation, identifiers, names, content version,
│   │                        # live feedback, test-size summary, text-and-list check, categories
│   ├── generation/          # Prompts for a clean case, for a case with injected errors and for
│   │                        # verification; the opinion plan
│   ├── evaluation/          # Counting mode, matching, decisions, case status, counters,
│   │                        # intervals, measures, overall result, resume point
│   └── metrics/             # Metric contract, registry, operations, checks,
│       └── builtin/         # accuracy.json (the default metric file), checks.default.json
├── sources/                 # JudgeReplySource adapters: pasted reply (others later)
├── app/                     # Session state, actions, unsaved-work guard
│   └── ports/               # SaveTarget (the test project file) and ClipboardReader:
│                            # browser adapters and test fakes
├── ui/
│   ├── labels.ts            # The action names of FR-008, used by every component
│   ├── steps/               # judge/, cases/, run/ (the Test run step), results/
│   ├── windows/             # test-case/ (From JSON, Clean case, Case with errors,
│   │                        # Open, Edit expected errors), case-window/ (Test run, and the read-only
│   │                        # case view of Results on the same frame), second-opinion/, import/
│   ├── help/
│   ├── components/          # Shared controls, tables, dialogs, the "what next" line, the
│   │                        # More menu, the JSON box with live problems, empty and error states
│   └── styles/              # tokens.css (single source of design tokens), base.css
└── main.tsx

examples/                    # Shipped with the site and used as test fixtures
├── demo/                    # test-project.json (the demo of "Load demo…", with its test run),
│                            # expected-results.json
├── files/                   # test-cases-example.csv, test-cases-example.json, case-example.json
└── metrics/                 # bias-example.json, bias-verdict-example.json (evaluated per
                             # case)

docs/
├── how-to-add-a-metric.md
└── schemas/                 # JSON Schema files generated from src/core/schemas

scripts/                     # Build helpers: JSON Schema generation, demo data generator

tests/
├── unit/                    # Core modules; ui/ holds component tests (simulated DOM)
├── contract/                # File formats, metric contract, examples and Help samples
├── integration/             # Whole flows through core + app state, without a browser
└── e2e/                     # Playwright (Chromium, Edge): quickstart scenarios, accessibility;
                             # an init script installs an in-memory save file

prototypes/                  # ui-prototype-v17 is the reference; never imported; deleted at parity
```

**Structure Decision**: one project. The boundary that matters is inside it: `src/core` must not
import from `src/ui`, `src/app` or `src/sources`, and must run under plain Node in tests
(Principle III). A lint rule and a test enforce the direction of imports. `examples/` is both the
demo data offered in the tool and the fixture set for tests (Principle IV).

## Implementation Order

A suggested order for `/speckit-tasks`; each slice is usable on its own. The first working slice
runs on the demo data, so the core value (reading replies and judging the judge) is proven before
any editing screen exists. Slices 1 to 8 are built and keep the names of their time (the
evaluation file, finalizing, Run); slice 9 replaces them (research.md, section 32).

1. **Foundation**: project setup, design tokens (black and red, light and dark), application
   shell with the four steps, the header with the unsaved-changes indicator, the More menu and
   **Load demo…** (no save button: **Save evaluation** is on Run), the "what next" line, schemas and file identity (`format`,
   `schema_version`), demo data files, removal of the answered prototypes.
2. **Read and judge on demo data (User Stories 1 and 6, part of 8 and 9)**: load and save an evaluation file,
   opening the first step with unfinished work and **Continue**,
   variables and prompt composition, reading JSON from a reply, error rules and findings, matching,
   automatic decisions, case status, measures, overall result, the three result views.
3. **Judge step (User Stories 2, 14)**: prompt, detected variables and the judged text, sample reply read as
   it changes with line and column for problems, finding text per list, rule editor with live
   preview, the two ready examples in **Load demo…**, save and load the test project (with the
   metric and thresholds).
4. **Test cases step (User Stories 3, 4, 5, 10, 11, 15)**: the collapsible **Error categories**
   section (uses per category, rename, remove refused with the reason), one table with **Open**,
   **Rename** and **Remove**, the test case window (**From JSON**, **Clean case**,
   **Case with errors** in three parts, the case view with **Show the issue** and the check
   line, the read-only **Open** with **Edit expected errors**), one case JSON
   check with line and column or field path, **Import test cases** (adding, also after
   finalizing) and **Export test cases**, feedback and test-size summary, finalize, and **Edit test
   cases** before the first reply.
5. **Run with decisions (User Stories 7, 8, 9)**: the two-column case window with Previous and
   Next, the always-visible reply box and "Paste reply" with the reset of the case,
   the judge summary and the multi-line model details, marks right after each reply, **Add
   finding** with optional category and difficulty and **Remove**, the **Second opinion** window
   (prompt, one box, preview, **Apply opinion**), **Approve**, the count of unsaved replies with
   reminders, **Save evaluation** and **Save evaluation as** on Run, and the complete Results
   views (with additional findings per category and difficulty): read-only, with the read-only
   case view, and the HTML report.
6. **Versions and audit (User Stories 12, 13)**: judge and test cases versions, the note when rules
   were corrected after replies, the cases added or corrected after the first reply, "Edit the
   judge and run again" (forgetting both files), running a loaded test project again with another
   LLM, recomputation on load.
7. **Judges evaluated per case (User Story 14)**: the counting mode, the per-case review, the
   case-level counters, measures, Error analysis and test size, the note when a correction switches
   the mode, the verdict example metric and its Help section.
8. **Finish**: Help review, accessibility and contrast pass, deployment workflow (only once Help is
   complete), removal of prototype v17 once the production tool covers its flows.
9. **One file and the start of the test run (T288, T289; User Stories 6, 11, 12)**, test first:
   - the test project schema version 2 with the optional `test_run` section, the upgrade of
     version 1, and the removal of the evaluation format, its reader, writer, schema, JSON Schema
     file and save target;
   - `withoutTestRun`, the load question and the remembered file of each answer;
   - **Start test run** with its summary, the disabled actions of Test run before it, and the lock
     notice of the Judge step with **Load test project…**;
   - one **Save test project** in the header, the trimmed More menu, **New test project**, one
     indicator rule and the reminder text;
   - the labels and the step name "Test run", **Open on Test run**, no **Run again with a new
     judge…** and no **Reopen test cases**;
   - the demo regenerated as one test project with its test run, and the end-to-end scenarios
     rewritten (quickstart V5, V9, V10, V11).
   The Help follows in the one pass of T225.
10. **UI redesign (FR-007, FR-055, FR-091 to FR-094; SC-033, SC-040 to SC-047)**, test first. The
    values come from research.md, section 33; the layout of each view from contracts/ui-flow.md,
    "Layout of each view". The redesign changes only how things look and where they sit. It changes no
    data, no file format and no schema, so `data-model.md` and `contracts/file-formats.md` stay as
    they are. It changes no action, label, order of actions, check, confirmation or result.

    **Gate (SC-040)**: every end-to-end test passes before the first step and after every step,
    with no change to what it checks. Three known tests check what the redesign changes on purpose.
    Each is rewritten first, in the step named, before the code changes:
    - `tests/e2e/v13-privacy-a11y.spec.ts`, "the accent is red …": checks the old colors. Step 1
      makes it check the forest green accent and the light and dark backgrounds.
    - `tests/e2e/v7-deciding.spec.ts`, line 152: waits until no `.fragment-strong` is left in the
      whole window. The passage in the case fields still clears, but the object in Judge reply now
      stays marked (Clarifications 2026-11-16). Step 5 limits the check to the case fields.
    - `tests/unit/ui/components.test.tsx`, "keeps two columns that scroll on their own": the case
      window now has one scroll area (FR-092). Step 4 makes it check that the columns have no
      scroll of their own.
    Any other e2e test that fails is a regression, not a test to adjust. Unit tests that name a
    CSS class may follow a renamed class; their assertions stay the same. A unit test may change an
    assertion only where an answer of the Clarifications of 2026-11-16 requires it (tasks T320 (c)
    and T337).

    The steps, in this order. Each step starts with its failing tests:

    1. **Tokens.** Tests: a new unit test `tests/unit/ui/tokens.test.ts` that reads
       `src/ui/styles/tokens.css` and computes every contrast pair of research.md 33.1 to 33.3 in the
       light, dark and navy blocks; a new unit test `tests/unit/ui/styles.test.ts` that finds any
       color, radius or shadow outside `tokens.css`, any margin, padding or gap not taken from the
       space scale, and any media query width other than 760 px; the rewritten accent test in
       `tests/e2e/v13-privacy-a11y.spec.ts`. Code: `src/ui/styles/tokens.css` (light, dark,
       `data-palette="navy"`, `--border-strong`, `--reply-*`, `--text-2xl`, `--content-max`,
       `--prose-max`, `--control-height`), `src/ui/styles/base.css` (type, headings, buttons,
       inputs, focus ring, status signs including "– Not run").
    2. **Layout and shell.** Tests: `tests/unit/ui/shell.test.tsx` (the order of the header row,
       the file name in the row), a new e2e `tests/e2e/redesign-layout.spec.ts` (SC-041: the width
       used at 1440 × 900 is more than 1280 px; no sideways page scroll at 1280, 768 and 360; one
       column below 760; the steps scroll sideways at 360). Code: `src/ui/styles/components.css`
       (`.app-main`, header, step bar, "what next" line, footer, `.table-scroll`, `.num`),
       `src/ui/components/shell/Header.tsx`, `FileMenu.tsx`, `SaveState.tsx`, `StepBar.tsx`,
       `NextBar.tsx`.
    3. **Views.** Tests: `tests/unit/ui/judge-step.test.tsx` (rules and preview in one area),
       `run-step.test.tsx` (the status word and sign of each row, "– Not run"),
       `results-views.test.tsx` (numbers in `.num`, the overall result at the largest size),
       `test-case-layout.test.tsx` (form, JSON editor, preview, expected errors in this order);
       e2e in `redesign-layout.spec.ts` (the preview is in view while a rule is edited at
       1280 × 720). Code: `components.css`, `src/ui/steps/judge/*.tsx` (`RulesSection`,
       `RulePreview`, `JudgeStep`), `src/ui/steps/cases/CasesStep.tsx`, `CasesTable.tsx`,
       `src/ui/steps/run/RunStep.tsx`, `src/ui/steps/results/*View.tsx`, `src/ui/components/JsonBox.tsx`
       (an editor that grows), `src/ui/windows/test-case/*` (the order of the window).
    4. **Case window.** Tests: `tests/unit/ui/run-case-layout.test.tsx` (the header items of
       FR-092 in their order; the fields in `.case-fields-others` and `.case-fields-judged`; the
       class `single` for one field), e2e in `redesign-layout.spec.ts` (SC-042: the header stays in
       view while the page of the window scrolls, at the four sizes; Alt + Left and Alt + Right;
       one column below 760 with the judged field last). Code: `src/ui/components/CaseWindowFrame.tsx`,
       `CasePart.tsx`, `src/ui/windows/case-window/CaseWindow.tsx`, `MarkedFields.tsx`,
       `ReadOnlyCaseView.tsx`, `components.css` (one scroll area; `.case-pane` loses its own scroll).
    5. **Judge reply.** Tests: `tests/unit/ui/reply-view.test.tsx` (SC-043: each marked object runs
       from its opening to its closing brace, with no label; SC-044: no mark on a text reply or on
       JSON that no rule read), `run-decide.test.tsx` or `case-highlights.test.tsx` (SC-045: the
       object pointed at stays strong after 5 seconds of fake time and loses it when another item
       is pointed at, on Close and on Next case; the passage in the fields still clears after
       about 2 seconds); e2e in `tests/e2e/v6-run.spec.ts` or `v7-deciding.spec.ts` only if a new
       check is added, never by changing an old one. Code: `ReplyView.tsx` (light background and
       2 px line), `CaseWindow.tsx` (the 2500 ms timer of `pointed` goes), `components.css`
       (`.reply-block`, `.reply-block.fragment-strong`).
    6. **Dialogs.** Tests: `tests/unit/ui/components.test.tsx` (the button order: "Cancel" first,
       the main action last, for each dialog that has both), e2e in `redesign-layout.spec.ts` (at
       360 × 640 the content of the large dialog scrolls and its buttons stay in view). Code:
       `src/ui/components/Dialog.tsx`, the dialogs that list their buttons
       (`StartTestRunDialog.tsx`, `AddFindingDialog.tsx`, `ExpectedErrorsDialog.tsx`,
       `SecondOpinionWindow.tsx`, `ImportWindow.tsx`, the replace warning), `components.css`.
    7. **Close.** The whole suite (lint, types, unit, build, e2e in Chrome) passes. SC-046: the demo
       and the examples give the same checks, statuses, decisions and Results numbers as before
       (the existing tests of V1, V9 and V12 already check them). SC-047: Tab reaches every control
       with a visible focus ring, and the contrast tests pass in both schemes. The manual check M4
       of quickstart.md is done once by the owner.

    **Help**: the redesign changes no file under `src/ui/help/`. The Help texts that describe the
    old look (for example the red accent, or a mark that fades) are rewritten in the one pass of
    T225 and T269, at the end, before any release.

## Complexity Tracking

No violations to justify.
