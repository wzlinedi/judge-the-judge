<!--
Sync Impact Report
- Version change: 1.0.0 → 1.4.0 (MINOR: new principles VI, VII, VIII added; principle IV
  expanded; 1.1.0–1.3.0 were never committed)
- Modified principles: IV (expanded with file-loading and mock-data rules)
- Added sections: Principle VI. Extensible Metrics and Configurable Checks;
  Principle VII. Modern, Impressive, and Clear UI;
  Principle VIII. Living Help Documentation (plus a Development Workflow bullet)
- Removed sections: none
- Follow-up TODOs: none. Technology stack intentionally left open; to be decided in the first
  /speckit-plan and recorded as a MINOR amendment if it should become binding.
- This comment is temporary review material and should be removed before commit.
-->
# Judge the Judge Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
All production code MUST be preceded by tests: tests are written, confirmed to fail, and only
then is the implementation written (Red-Green-Refactor).

- Prototypes are allowed only inside a dedicated `prototypes/` directory. Production code MUST
  NOT import from it.
- Moving prototype logic into production MUST start by writing tests for it; the prototype
  itself is never promoted as-is.
- Each prototype MUST state its question and be deleted or promoted once the question is answered.

Rationale: this project judges the reliability of other systems, so its own correctness must be
demonstrable. Prototypes keep exploration cheap without weakening that guarantee.

### II. Static-First, Hosting-Ready
The application MUST work as a static site with no server component: plain files that any static
host can serve. Features that require a backend are out of scope until a later amendment
explicitly allows them.

- The site MUST be deployable to public static hosting from the first release.
- Secrets (API keys, tokens) MUST NOT be stored in or shipped with client code.
- Stage 1 is manual: the user pastes inputs, copies prompts to an LLM-as-judge by hand, and
  pastes the results back for analysis.

Rationale: a static site is the cheapest, safest and simplest way to publish, and planning for
hosting from day one avoids a rewrite.

### III. Separated Core Logic and Pluggable Judge Source
Evaluation logic MUST be pure and independent of the user interface and of how judge outputs
are obtained.

- The source of judge results (manual paste, file import, future live LLM call) MUST sit behind
  one interface so sources are interchangeable without changing evaluation logic.
- Adding a live LLM connection later MUST NOT require rewriting scoring or analysis code.
- Core logic MUST be testable without a browser, a network, or a real LLM.

Rationale: the roadmap moves from manual copy-paste to live LLM calls; this boundary makes that
a new adapter rather than a redesign.

### IV. Portable File-Based Data
All inputs and results MUST be loadable from and exportable to plain files in open formats
(JSON or CSV).

- Every data format MUST have a documented, versioned schema, and loaders MUST validate input
  and report clear errors.
- Data stays on the user's machine unless the user explicitly exports or shares it.
- No hidden state: the app's state MUST be reconstructible from the files the user supplied.
- The user MUST be able to load everything the app needs (data, judge results, metric
  definitions, check configuration) from files, with no other setup step.
- The application MUST offer an option to generate mock data so it can be tried and tested
  without real data. Mock data MAY be a fixed, committed sample set; it does not need to be
  regenerated on each run, and the same mock files MUST be usable as test fixtures.

Rationale: file-based data supports reproducibility, easy sharing, and static hosting.

### V. Transparent and Reproducible Evaluation
Given the same input files, the evaluation MUST produce the same results.

- Every metric MUST be documented with its definition and its limitations.
- Each result MUST record what produced it: judge prompt, judge model identifier (when known),
  input data version, and tool version.
- Changes to metric definitions MUST be versioned and visible; results MUST NOT silently change.

Rationale: a tool that evaluates judges must itself be auditable and trustworthy.

### VI. Extensible Metrics and Configurable Checks
Metrics are data-driven plug-ins, not hard-coded features. Exactly two metrics are built in and
ship with the application. All further metrics MUST be loadable by the user from a file at
runtime, and adding one MUST NOT require changes to the core, the interface, or existing metrics.

- Every metric, built-in or loaded, MUST conform to one common metric contract and be registered
  in one central registry. Built-in metrics are registered at startup; file-based metrics are
  registered when the user loads their definition file.
- Metric definition files MUST be declarative (JSON or similar data format) with a documented,
  versioned schema. They MUST NOT contain or cause execution of arbitrary code. Metric logic
  MUST be expressed by combining operations the application provides.
- Loaded definitions MUST be validated against the contract; an invalid file MUST be rejected
  with a clear, human-readable error and MUST NOT affect already-registered metrics.
- Each metric MUST declare its own metadata: name, description, required inputs, output format,
  and its configurable parameters with defaults.
- Checks (pass/fail rules, thresholds, validations applied to metric results) MUST be defined in
  configuration files, not in code, and MUST be adjustable without modifying a metric's code.
  Invalid configuration MUST fail with a clear, human-readable error.
- The repository MUST contain a short "how to add a metric" guide and an example metric
  definition file, kept in sync with the schema, so a non-developer can write one with AI help.
- A shared contract test suite MUST run against every built-in metric and against the example
  definition file. Per Principle I, tests come first.

Rationale: the owner expects to add metrics over time. A single contract, registry, and
configuration-driven checks keep each addition small, safe, and repeatable.

### VII. Modern, Impressive, and Clear UI
The interface MUST look modern and polished enough to make a strong first impression, while
remaining simple and easy to read. Clarity always wins over decoration.

- Every screen MUST have one obvious primary purpose and one obvious next action. Results MUST
  be presented so a first-time user understands them without reading documentation.
- Visual polish (consistent spacing, typography, color, subtle motion) MUST come from a single
  shared set of design tokens or styles, not from per-screen one-off styling.
- Decoration and animation MUST NOT reduce readability, hide information, or slow down use.
- The UI MUST be responsive (usable on phone and desktop widths), meet WCAG AA color contrast,
  be fully keyboard-operable, and display correctly in both light and dark color schemes.
- Errors and empty states (for example, no data loaded yet) MUST be designed screens with a
  clear message and a suggested next step, not raw error output.

Rationale: the application will be shown publicly, and its value depends on people quickly
understanding evaluation results. A cohesive, clean design builds trust; simplicity keeps it usable.

### VIII. Living Help Documentation
All user-facing behavior MUST be documented in a "Help" section that is part of the application
itself (available on the published static site) and explains how to use the system.

- Help is written in English, in plain language for a non-technical reader, and MUST cover at
  least: loading data, loading metrics and check configuration, generating mock data, reading
  results, and the manual copy-paste judge workflow.
- Help MAY be written after the core features exist, but before the first public release it MUST
  be complete.
- Any change that alters user-visible behavior (a feature, metric, file format, schema, or
  setting) MUST update the matching Help content in the same change. A change is not done until
  Help reflects it.
- Help MUST stay consistent with the "how to add a metric" guide and the file schemas
  (Principles IV and VI); examples shown in Help MUST be valid against the current schemas.

Rationale: users, including the project owner, rely on Help to use the tool correctly. Stale
documentation is worse than none, so updating it is part of finishing every change.

## Constraints & Standards

- **Language**: all documentation, specifications, code comments, identifiers, and UI text MUST
  be written in English. Conversation with the project owner may happen in Polish.
- **Simplicity**: prefer the simplest solution that satisfies the current stage (YAGNI). Added
  complexity MUST be justified in the plan's complexity tracking.
- **Accessibility and privacy**: the published site MUST NOT send user data to any third party
  without explicit, visible user action.
- **Technology stack**: not yet fixed. It MUST satisfy Principles II and III and will be chosen
  during planning.

## Development Workflow

- Work follows the Spec Kit flow: specify → clarify → plan → tasks → implement.
- Every task that adds production behavior MUST include its test task before its implementation
  task.
- All tests MUST pass before a change is considered complete.
- A change that affects user-visible behavior is complete only when Help is updated
  (Principle VIII).
- Every plan MUST include a Constitution Check against the principles above, and any violation
  MUST be documented and justified.
- The project owner is a non-developer: technical decisions with product impact MUST be explained
  in plain language and offered to the owner as choices with a recommendation.

## Governance

This constitution supersedes other practices. Amendments require a written change with
rationale, approval from the project owner, and a note of any affected specs or plans.

- **Versioning**: semantic versioning. MAJOR for removing or redefining principles in a
  backward-incompatible way, MINOR for adding a principle or materially expanding guidance,
  PATCH for clarifications and wording fixes.
- **Compliance review**: every spec, plan, and implementation review MUST verify compliance
  with this constitution. Unjustified violations block completion.

**Version**: 1.4.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-08
