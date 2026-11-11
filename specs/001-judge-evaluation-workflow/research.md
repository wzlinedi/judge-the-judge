# Research: Judge the Judge

**Date**: 2026-11-11 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Each entry records a decision, why it was made, and what else was considered. The spec left the
technology stack, the confidence-interval method, the matching rule and the exact file layouts to
planning; they are settled here. No open questions remain.

## 1. Language and build

- **Decision**: TypeScript in strict mode, built with Vite into static files, with relative asset
  paths so the site works from any folder of any static host.
- **Rationale**: The constitution requires a static site with core logic that is testable without
  a browser. TypeScript catches data-shape mistakes at build time, which matters in a tool whose
  work is reading and writing nine file formats. Vite gives a fast local server and a plain static
  build with no configuration to maintain.
- **Alternatives considered**: Plain JavaScript in a single HTML file, as in the prototypes
  (144 KB, hard to test, no type checks, cannot separate core from interface); a full framework
  with a server part such as Next.js (breaks Static-First, far more than needed).

## 2. Interface library

- **Decision**: Preact with function components. Application state lives in one store in
  `src/app`; components only show state and send actions.
- **Rationale**: The tool has six screens, large tables with filters, forms with live validation
  and several dialogs. Hand-written DOM updates at this size are where the prototype became hard to
  change. Preact is about 4 KB, uses the most widely known component model, and escapes all text by
  default, which matters because the tool displays text pasted from an LLM.
- **Alternatives considered**: No library (cheapest at first, most expensive to maintain);
  React (same model, ten times the size, no benefit here); Svelte or Lit (fine technically, less
  common, so harder for a non-developer owner to get help with).

## 3. Schemas and validation

- **Decision**: Every file format is defined once as a Zod schema in `src/core/schemas`. The same
  schema validates loaded files, gives the TypeScript type, and is exported to JSON Schema files in
  `docs/schemas/` during the build. Validation errors are translated into plain sentences that name
  the place (row or scenario, field) and say what to fix.
- **Rationale**: Principle IV requires documented, versioned schemas and validating loaders. One
  source for type, validator and documentation removes the risk that they drift apart.
- **Alternatives considered**: Hand-written JSON Schema validated with Ajv (two sources of truth
  with the TypeScript types, and raw messages that still need translation); hand-written
  validation functions only (no machine-readable schema to publish).

## 4. CSV reading

- **Decision**: Papa Parse for reading CSV. Files are decoded as UTF-8 (with or without a byte
  order mark); if the bytes are not valid UTF-8 the tool retries as Windows-1250, tells the user
  which encoding was used, and shows the first rows so they can confirm Polish letters look right.
  Line endings of any convention are accepted. The CSV template is written as UTF-8 with a byte
  order mark so spreadsheet programs open it correctly.
- **Rationale**: Quotes, commas and line breaks inside cells are the classic sources of silent data
  damage (FR-019). A mature parser is safer than a custom one. Windows-1250 is the usual encoding of
  Polish spreadsheets saved without choosing UTF-8.
- **Alternatives considered**: A custom parser (small, but the edge cases are exactly what the spec
  lists as risks); accepting UTF-8 only (simplest, but fails on the most likely real-world file).

## 5. Base-versus-variant differences

- **Decision**: jsdiff, comparing word by word, for the side-by-side view and for the check that
  every changed place is covered by an expected error (FR-035).
- **Rationale**: Fields may hold up to 100,000 characters. A naive comparison is too slow at that
  size; jsdiff implements the standard efficient algorithm.
- **Alternatives considered**: Sentence-set comparison as in the prototype (fast, but cannot
  highlight the changed words and misses changes inside long sentences).

## 6. Testing

- **Decision**: Vitest for unit, contract and integration tests, all running in Node without a
  browser. Component tests use Vitest with a simulated DOM. Playwright runs the quickstart scenarios
  against the built site and checks accessibility with axe-core in light and dark schemes and at
  phone and desktop widths.
- **Rationale**: Principle I (tests first) and Principle III (core testable without a browser).
  Vitest shares Vite's configuration, so there is one toolchain. The mock data files are the
  fixtures, as Principle IV asks.
- **Alternatives considered**: Jest (separate configuration for TypeScript and modules); browser
  tests only (slow, and would not prove the core is independent of the interface).

## 7. Confidence intervals

- **Decision**: The Wilson score interval at 95% for every proportion (detection rate, false-alarm
  rate, per-label and per-difficulty rates). No interval is shown when the denominator is zero.
- **Rationale**: The spec fixes 95% and leaves the method to planning. Wilson behaves well for the
  small samples this tool works with (30 to 100 errors) and near 0% and 100%, where the simple
  textbook formula gives impossible ranges. It needs no library.
- **Limitation to document in Help (Principle V)**: errors inside the same test case are not fully
  independent, because one judge run covers all of them. The interval is therefore somewhat
  optimistic when cases carry many errors each; this is one more reason for the guidance of two or
  three errors per case.
- **Alternatives considered**: Normal approximation (wrong at small samples); Clopper-Pearson
  (very conservative, needs special functions); bootstrap by case (handles the dependence, but is
  not deterministic without a fixed seed and is hard to explain in plain language).

## 8. Matching a finding to an expected error

The spec says a finding "points at" an expected fragment when the two share their key content after
ignoring letter case, spacing and rephrasing, and leaves the exact rule to planning.

- **Decision**: Compare the finding's text with the expected fragment and give one of three
  levels.
  1. Normalize both texts: Unicode normalization, lower case, punctuation replaced by spaces,
     runs of spaces collapsed.
  2. **Clear match** when one normalized text contains the other.
  3. Otherwise compare words longer than three characters: let *hits* be the number of such words
     of the fragment that also occur in the finding, and *share* be hits divided by the fragment's
     word count. **Clear match** when hits ≥ 2 and share ≥ 0.6. **Partial match** when hits ≥ 1 and
     share ≥ 0.3. Otherwise **no match**.
  4. A number in the fragment (digits) must also occur in the finding for a clear match; if the
     words match but the number does not, the level is partial.

  A finding is unexpected when it has no clear or partial match with any expected error of the
  case. When the reply mapping names a target field, only expected errors in that field are
  compared. The two thresholds (0.6 and 0.3) and the minimum word length are parameters of the
  metric definition, with these defaults.
- **Rationale**: This is the rule the last prototype used on the book-summary demo, plus the number
  check, which closes its one known weakness (a "wrong number" error matched by a finding about the
  same sentence with a different number). It is deterministic, explainable in two sentences, and
  works for Polish text without language-specific resources. Unclear cases go to the user, so a
  cautious rule costs a little manual work, never a wrong score.
- **Alternatives considered**: Exact quote only (fails for claim-based judges, which rephrase);
  edit distance (penalizes reordering, slow on long texts); word stemming or embeddings (need
  language resources or a model, which a static tool without an LLM cannot have).

## 9. Automatic verdicts and counting

- **Decision**: As in FR-060. Per case with a readable reply: Pass when every expected error has a
  clear match and there is no unexpected finding; Fail when no expected error has a clear or partial
  match and nothing is unclear; otherwise Awaiting verification with the reasons listed. The count
  of findings used for the false-alarm rate is the number of parts the mapping marks as problems;
  when a reply cannot be read, it is the number of expected errors the user marked as found plus the
  number of false alarms they confirmed.
- **False-alarm rate with no findings**: when the judge reported nothing in any case, the rate is
  shown as "not available" and the false-alarm threshold counts as met (there are no false alarms);
  the detection threshold then decides the final answer.
- **Rationale**: Keeps the per-finding definition of FR-063 usable for hand-verified cases without
  asking the user to count parts of a reply.

## 10. Reading the judge's reply

- **Decision**: The reply mapping holds: the path to the list of parts (empty when the reply is the
  list itself), the key of a part's text, optionally the key of its assessment with the values that
  mean a problem, optionally a category key, and optionally the field the findings point at. Before
  parsing, the tool removes Markdown code fences and any text before the first and after the last
  bracket of the JSON. Values are compared without regard to letter case; `true` and `false` are
  accepted as assessment values.
- **Proposing a mapping from one sample reply**: take the first list of objects found; the text key
  is a well-known name (`text`, `claim`, `statement`, `element`, `sentence`, `part`) or else the
  string key with the longest average value; the assessment key is a well-known name or else a key
  with at most four distinct values; the proposed problem values are those that read as negative
  (for example "unsupported", "contradicted", "missing", "no", "false"). The user sees which parts
  would become findings and confirms or corrects every choice.
- **Rationale**: LLMs often wrap JSON in fences or add a sentence around it; rejecting such replies
  would send every case to manual verification for no good reason.
- **Alternatives considered**: A full path language such as JSONPath (more power than any
  claim-based judge needs, and harder to explain in Help).

## 11. Versions and identity

- **Decision**: A dataset version is the first 12 hexadecimal characters of the SHA-256 hash of its
  canonical content (scenarios in order with identifier, name, base, fields and expected errors, and
  the error catalog; keys sorted; line endings normalized). The dataset name is not part of the
  version. A judge version is computed the same way from the prompt and the reply mapping. Hashing
  uses the Web Crypto API, which exists in browsers and in Node, so no library is needed.
- **Consequence**: Editing expected errors after finalizing (allowed by FR-050) changes the dataset
  version. Two results compared across such an edit show the "datasets differ" warning, which is
  correct, because the reference they were scored against differs.
- **Rationale**: Principle V and FR-023: identical content always gives the same version, on any
  machine.
- **Alternatives considered**: A counter or timestamp (not reproducible from the file); the short
  non-cryptographic hash of the prototype (collisions are plausible at six characters).

## 12. State and saving

- **Decision**: One in-memory state object per page session. No `localStorage`, `sessionStorage`,
  IndexedDB or cookies. A "work not exported" flag covers the dataset, outputs, verdicts and shelf;
  while it is set, leaving or reloading the page triggers the browser's standard warning. Exports
  are downloads created in the browser; loads use the file picker or drag and drop.
- **Rationale**: FR-004 and the privacy constraint: user scenarios may be sensitive, and "nothing is
  remembered" is easy to explain and to verify.
- **Alternatives considered**: Automatic local saving (convenient, but contradicts FR-004 and makes
  hidden state, against Principle IV).

## 13. Privacy and safety of displayed text

- **Decision**: A Content Security Policy in the page: scripts, styles, fonts and images only from
  the site itself, and `connect-src 'none'`, so the page cannot send data anywhere even by mistake.
  System fonts only; no analytics; no third-party requests. All user and LLM text is rendered as
  text, never as HTML; the HTML report builder escapes every value and contains no scripts.
- **Rationale**: The tool displays text pasted from an LLM and files received from others. Treating
  it as untrusted prevents script injection through a dataset or report. The policy turns the
  privacy promise (SC-006) into something the browser enforces.

## 14. Metrics as data (Principle VI)

- **Decision**: A **metric definition** is a declarative JSON file describing one kind of judge
  evaluation: its name, description and limitations, the fields it needs, a starter judge prompt
  with its reply mapping, a starter error catalog, matching parameters, and a list of **measures**
  built from operations the tool provides (ratio of two counters, complement, harmonic mean, each
  optionally with an interval). Accuracy and Completeness are two such files bundled with the tool
  and registered at start; they are what the two "Populate" starters use. A user-loaded definition
  is validated, registered, and appears as a further starter. **Checks** (thresholds on measures)
  live in a separate check configuration file; the bundled default holds detection ≥ 80% and false
  alarms ≤ 10% plus the fixed minimum test size.
- **Scope note**: Measures can only combine counters the tool already produces (expected errors,
  found, findings, false alarms, cases, clean cases, and their per-label and per-difficulty
  splits). Measures that need other inputs, such as agreement with human ratings or stability
  across repeated runs, are not expressible in this version; the guide says so. This satisfies
  SC-005 for measures over existing counters and keeps arbitrary code out of definition files.
- **Rationale**: Satisfies Principle VI without building a general formula engine, and fits the
  owner's decision that the judge is only a prompt plus its reply mapping while the error catalog
  belongs to the dataset: a starter fills both, and they are saved separately afterwards.
- **Alternatives considered**: Hard-coding the two metrics (violates Principle VI); a general
  expression language in definition files (powerful, but a parser and evaluator to maintain, and
  much harder for a non-developer to write correctly).

## 15. Pasted answers from the user's LLM

- **Decision**: One paste area on the Test cases step accepts (a) scenario JSON: an object with a
  `scenarios` list, a bare list, or a single scenario, with or without code fences; or (b) lines in
  the one-line convention, which add expected errors to the scenario currently selected. Everything
  pasted goes through the same validation and review as a file import; nothing is added before the
  user accepts it, and rejected text stays in the box.
- **Rationale**: FR-033 and FR-034; one path for files and pasted text means one set of rules and
  one set of tests.

## 16. Reports

- **Decision**: The HTML report is one self-contained file: inline styles, no scripts, no external
  resources. It opens with the summary (final answer, thresholds, test size, measures, per-label and
  per-difficulty breakdown), then the case table, then full details per case in collapsible
  sections that are expanded when printing. A print stylesheet gives clean PDF output from the
  browser.
- **Rationale**: FR-069: readable without the tool, by someone who only receives the file.

## 17. Hosting and tool version

- **Decision**: GitHub Pages, deployed by a GitHub Actions workflow that runs all tests, builds,
  and publishes the `dist` folder. The tool version comes from `package.json`, is shown in the
  footer and Help, and is written into every result file and report.
- **Rationale**: Principle II (deployable from the first release) and Principle V (each result
  records the tool version). The repository already has a GitHub remote.
- **Alternatives considered**: Other static hosts (equally possible later, since the build is plain
  files with relative paths).

## 18. Prototypes

- **Decision**: The three prototypes in `prototypes/` stay as visual and behavioral reference
  during implementation and are deleted when the production tool covers their flows. No code is
  copied from them; behavior taken from them (matching rule, mapping proposal, measures) is first
  written as tests.
- **Rationale**: Principle I.

## 19. Mock data

- **Decision**: A fixed, committed mock set in `examples/mock/`: one judge (the Accuracy starter),
  one dataset of 20 scenarios (10 clean book-summary scenarios and 10 variants with 3 injected
  errors each, half obvious and half subtle), one answer batch, and the expected result. The set
  meets the fixed minimum test size, so the mock run ends in a real final answer, and it includes at
  least one missed error, one false alarm, one rephrased finding (partial match) and one reply that
  cannot be read, so every status and message appears in the demo.
- **Rationale**: Principle IV and SC-001. The earlier prototype had to lower the minimum to 8 and 4
  for its demo; that is no longer possible, because the minimum is fixed.

## 20. Local prerequisites

- **Finding**: Node.js is not installed on the development machine. Implementation needs a current
  long-term-support release of Node.js (which includes npm). This is a setup step, not a design
  question; it is listed in [quickstart.md](./quickstart.md).
