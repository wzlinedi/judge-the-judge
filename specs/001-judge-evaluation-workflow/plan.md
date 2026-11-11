# Implementation Plan: Judge the Judge

**Branch**: `001-judge-evaluation-workflow` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-judge-evaluation-workflow/spec.md`

## Summary

Judge the Judge is a static, single-page web tool that tells a judge author whether an
LLM-as-judge prompt can be trusted. The user brings only the judge prompt. In the tool they build
test data (clean scenarios and variants with deliberately injected, recorded errors), copy the
composed prompts to their own LLM, paste the judge's replies back, and get a final answer (Works,
Does not work, Inconclusive) based on two measures: detection rate and false-alarm rate.

Technical approach: a TypeScript application built with Vite into plain static files. All
evaluation logic lives in a pure core library with no browser dependency (composition of prompts,
reading replies through a reply mapping, matching findings to expected errors, measures, final
answer, comparison, file formats). A thin Preact interface presents the four steps (Judge, Test
cases, Run, Results) plus Compare and Help. Nothing is stored between sessions and nothing leaves
the device: work is saved and restored only through files with versioned schemas.

## Technical Context

**Language/Version**: TypeScript (current stable, `strict` mode), compiled to ES2022

**Primary Dependencies**: Vite (build and dev server), Preact (interface), Zod (file schemas and
validation), Papa Parse (CSV reading), jsdiff (base-versus-variant differences). Exact versions are
pinned in the lockfile when the project is set up. See [research.md](./research.md) for why each
one is needed.

**Storage**: None. State lives in memory for the page session; users save and load JSON and CSV
files on their own device. No `localStorage`, cookies, or server.

**Testing**: Vitest for core logic, contract tests and component tests; Playwright with axe-core
for end-to-end and accessibility checks against the built site.

**Target Platform**: Static site for any static host (GitHub Pages first), used in the last two
versions of Chrome, Edge, Firefox and Safari, at phone and desktop widths.

**Project Type**: Single-project static web application (no backend).

**Performance Goals**: A 100-case dataset loads and shows its summary within seconds (SC-010); a
500-case dataset never blocks the interface for more than 2 seconds (SC-014); results recalculate
after a verdict change without visible delay.

**Constraints**: Works offline after load; no network requests with user data (enforced by a
Content Security Policy with `connect-src 'none'`); at most 500 cases per dataset and 100,000
characters per field; WCAG AA contrast, full keyboard operation, light and dark schemes; all text in
English.

**Scale/Scope**: One user, one judge and one dataset per evaluation; 75 functional requirements, 18
user stories; six screens (four steps, Compare, Help); nine file formats.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|---|---|---|
| I. Test-First | Every production module is preceded by failing tests; nothing is imported from `prototypes/`; prototype logic is re-derived from tests | PASS: core is a pure library tested with Vitest; tasks will pair each implementation task with a preceding test task; prototypes are reference only and are deleted once the production tool reaches parity |
| II. Static-First, Hosting-Ready | Builds to plain files; deployable from the first release; no secrets; manual stage 1 | PASS: Vite static build with relative paths, GitHub Pages workflow, no keys, the tool never calls an LLM (FR-002) |
| III. Separated Core and Pluggable Judge Source | Core independent of the interface; one interface for the source of judge outputs | PASS: `src/core` has no DOM access; `JudgeOutputSource` has two adapters (pasted single output, batch file or block), and a live LLM adapter can be added later without touching evaluation code |
| IV. Portable File-Based Data | Open formats with documented, versioned schemas and validating loaders; no hidden state; mock data | PASS: nine JSON or CSV formats, each with `format` and `schema_version`, defined once as schemas and published as JSON Schema; state is rebuilt only from files; a fixed mock set doubles as test fixtures |
| V. Transparent and Reproducible | Same inputs give the same results; each result records what produced it | PASS: evaluation functions are pure and deterministic; a result stores judge prompt and version, model note, dataset version, tool version, thresholds; on import the measures are recomputed and any difference is reported |
| VI. Extensible Metrics and Configurable Checks | One metric contract and registry; declarative definition files; checks in configuration; guide, example, contract tests | PASS: see [contracts/metric-and-checks.md](./contracts/metric-and-checks.md). Accuracy and Completeness are the two built-in definitions; others load from a file at run time. Thresholds come from a check configuration file. The minimum test size (30 errors, 10 clean cases) is also data in the bundled default configuration, but the spec fixes it, so a loaded configuration cannot change it |
| VII. Modern, Clear UI | One purpose and one next action per screen; shared design tokens; responsive, accessible, light and dark; designed empty and error states | PASS: four-step flow with one primary action each (FR-001); a single token stylesheet; axe-core checks in end-to-end tests |
| VIII. Living Help | Help inside the application, plain language, examples valid against the schemas | PASS: Help is a screen of the application; its examples are the same files that the contract tests validate, so they cannot drift |
| Constraints | English everywhere; simplest solution; no data to third parties | PASS: five runtime dependencies, each justified in research.md; a Content Security Policy blocks all outgoing connections |

**Result**: no violations. Complexity Tracking stays empty.

**Post-design re-check (after Phase 1)**: PASS. The data model and contracts introduce no server,
no stored state, and no code-carrying metric files. The technology stack chosen here is recorded in
the constitution since version 1.5.0.

## Project Structure

### Documentation (this feature)

```text
specs/001-judge-evaluation-workflow/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and their reasons
├── data-model.md        # Phase 1: entities, rules, state transitions
├── quickstart.md        # Phase 1: how to run and validate the tool
├── contracts/
│   ├── file-formats.md        # The nine file formats and the paste formats
│   ├── metric-and-checks.md   # Metric definition contract and check configuration
│   ├── core-api.md            # Public functions of the core library and the judge output source
│   └── ui-flow.md             # Screens, primary actions, gating, states
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── core/                    # Pure TypeScript, no DOM, no network
│   ├── model/               # Types for judge, dataset, scenario, verdict, result
│   ├── schemas/             # Zod schemas, plain-language error messages, schema versions
│   ├── io/                  # JSON and CSV reading and writing, one-line convention,
│   │                        # prompt batch, answer batch, result file, HTML report
│   ├── judge/               # Placeholders, prompt composition, reply mapping (read, propose)
│   ├── dataset/             # Validation, identifiers, content version, live feedback,
│   │                        # test-size summary, base-versus-variant check
│   ├── generation/          # Prompts for generating test data, verification prompt,
│   │                        # reading pasted scenarios and verification opinions
│   ├── evaluation/          # Matching, verdicts, counters, intervals, measures,
│   │                        # final answer, comparison
│   └── metrics/             # Metric contract, registry, operations, checks,
│       └── builtin/         # accuracy.json, completeness.json, checks.default.json
├── sources/                 # JudgeOutputSource adapters: pasted output, batch file or block
├── app/                     # Session state, actions, unsaved-work guard
├── ui/
│   ├── steps/               # judge/, cases/, run/, results/
│   ├── compare/
│   ├── help/
│   ├── components/          # Shared controls, tables, dialogs, empty and error states
│   └── styles/              # tokens.css (single source of design tokens), base.css
└── main.tsx

examples/                    # Shipped with the site and used as test fixtures
├── mock/                    # judge, dataset, answers, expected result
├── templates/               # dataset-template.csv, dataset-template.json
└── metrics/                 # example metric definition, example check configuration

docs/
├── how-to-add-a-metric.md
└── schemas/                 # JSON Schema files generated from src/core/schemas

tests/
├── unit/                    # Core modules
├── contract/                # File formats, metric contract, examples and Help samples
├── integration/             # Whole flows through core + app state, without a browser
└── e2e/                     # Playwright: quickstart scenarios, accessibility

prototypes/                  # Existing throwaway prototypes; never imported; deleted at parity
```

**Structure Decision**: one project. The boundary that matters is inside it: `src/core` must not
import from `src/ui`, `src/app` or `src/sources`, and must run under plain Node in tests
(Principle III). A lint rule and a test enforce the direction of imports. `examples/` is both the
mock data offered in the tool and the fixture set for tests (Principle IV).

## Implementation Order

A suggested order for `/speckit-tasks`; each slice is usable on its own.

1. **Foundation**: project setup, design tokens, application shell with the four steps, schemas
   and file identity (`format`, `schema_version`), mock data files.
2. **Core evaluation (User Stories 1, 2, 3, 11)**: judge and placeholders, prompt composition,
   reply mapping, matching, verdicts, measures, final answer, results screen with mock data.
3. **Building the dataset by hand (User Stories 4, 5, 7, 12, 13)**: editor, generation prompts and
   paste area, review with base-versus-variant check, feedback and test-size summary, save, load,
   finalize.
4. **Whole datasets and batches (User Stories 6, 8, 9, 10, 14, 18)**: CSV and JSON import with
   summary, templates, prompt batch, answer batch, browsing.
5. **Results depth and trust (User Stories 15, 16)**: verification prompt and opinions, result file,
   HTML report, shelf, comparison, "change the judge, keep the cases".
6. **Extensibility and finish (User Story 17)**: metric definition and check configuration files,
   how-to guide, Help content, accessibility pass, deployment workflow, removal of prototypes.

## Complexity Tracking

No violations to justify.
