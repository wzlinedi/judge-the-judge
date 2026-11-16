// Types of the core (data-model.md). No behavior here: only the shapes every module shares.

import type { MetricDetails } from '../metrics/types';

/** A problem found while reading user data: a plain sentence and where it is (FR-084). */
export interface Problem {
  message: string;
  /** Line and column in the whole text (1-based), for text that is not readable JSON. */
  line?: number;
  column?: number;
  /** Field path such as `fields.summary` or `expected_errors[2].description`. */
  path?: string;
}

/** What every reader returns: the value with notes, or the list of problems (FR-022). */
export type ReadResult<T> =
  | { ok: true; value: T; notes: string[] }
  | { ok: false; problems: Problem[] };

export type MatchMode = 'all' | 'any';

export type Comparison =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface Condition {
  field: string;
  comparison: Comparison;
  /** Required except for `is_empty` and `is_not_empty`. */
  value?: string;
}

export interface ErrorRule {
  name: string;
  match: MatchMode;
  conditions: Condition[];
  /** "Where the error is": the text field of the list item that shows where the error is. Absent: the field the reply mapping names for the rule's list. */
  finding_text?: string;
}

export interface Category {
  name: string;
  description?: string;
}

export interface ReplyMapping {
  /** list path -> field path holding the text a finding points at */
  finding_text: Record<string, string>;
}

export interface JudgeSet {
  prompt: string;
  judged_text?: string;
  sample_reply?: string;
  reply_mapping: ReplyMapping;
  error_rules: ErrorRule[];
  error_catalog: Category[];
}

export type Difficulty = 'obvious' | 'subtle';

export interface ExpectedError {
  id: string;
  description: string;
  category?: string;
  /** The exact words of the judged text that show the error. */
  fragment?: string;
  /** The exact words of another field (the source) that the error contradicts, shown beside the fragment (T250). */
  source_fragment?: string;
  difficulty?: Difficulty;
}

export type ChangedAfterFirstReply = 'added' | 'corrected';

export interface TestCase {
  id: string;
  name: string;
  base?: string;
  changed_after_first_reply?: ChangedAfterFirstReply;
  /** The prompt the case was made with ("Clean case", "Case with errors"); not part of the test cases version (T238). */
  generation_prompt?: string;
  fields: Record<string, string>;
  expected_errors: ExpectedError[];
}

/** The test cases of a project; stored under the key `dataset` of the test project file. */
export interface TestCases {
  name: string;
  version?: string;
  cases: TestCase[];
}

export type CaseJsonMode = 'paste' | 'clean' | 'inject' | 'correct';

export interface CaseJsonCheck {
  problems: Problem[];
  warnings: string[];
  notes: string[];
  kind?: 'Clean' | 'Injected errors';
  case?: Omit<TestCase, 'id'>;
}

export interface MetricParameters {
  match_clear_share: number;
  match_partial_share: number;
  match_min_word_length: number;
  [key: string]: number;
}

export interface MetricRef {
  id: string;
  parameters: Record<string, number>;
  /** The definition of a metric that is not built in; the file that holds it registers it when it is loaded (T243). */
  definition?: MetricDetails;
}

export interface CheckRule {
  measure: string;
  comparison: 'at_least' | 'at_most';
  value: number;
}

export interface CheckConfiguration {
  rules: CheckRule[];
}

export type CountingMode = 'per_expected_error' | 'per_case';

export interface Reply {
  /** The composed judge prompt at the moment the reply was saved. */
  prompt: string;
  reply: string;
}

export type DecisionSource = 'manual' | 'llm-approved';
export type ExpectedState = 'found' | 'missed' | 'ignored';
export type AdditionalState = 'real_error' | 'false_positive' | 'ignored';

export interface Decision<S extends string> {
  state: S;
  source: DecisionSource;
}

export interface AddedFinding {
  text: string;
  category?: string;
  difficulty?: Difficulty;
  from_opinion?: boolean;
  state: AdditionalState;
  source: DecisionSource;
}

export interface CaseDecisions {
  expected: Record<string, Decision<ExpectedState>>;
  additional: Record<string, Decision<AdditionalState>>;
  added_findings: AddedFinding[];
  approved: boolean;
  note: string;
}

export interface VerificationOpinion {
  id: string;
  /** The code of the list of items the prompt gave; another code is refused, a missing one is read as before (R8). */
  list?: string;
  expected: { index: number; found?: boolean; reason?: string; fragment?: string }[];
  additional: { index: number; real?: boolean; reason?: string; fragment?: string }[];
  new: {
    text: string;
    real: boolean;
    reason?: string;
    fragment?: string;
    category?: string;
    difficulty?: Difficulty;
  }[];
}

export interface CaseJsonCheckContext {
  mode: CaseJsonMode;
  variables: string[];
  judgedText: string | undefined;
  catalog: Category[];
  existingCases: TestCase[];
  base?: string;
  errorsToPrepare?: number;
  original?: TestCase;
  /** A name typed in the window; it replaces the name in the JSON. */
  name?: string;
}

/**
 * The replies of one judge version to the test cases, with every decision and the model details (data-model.md, TestRun).
 * It exists once "Start test run" was pressed, also before the first reply; its saved form is the `test_run` section.
 */
export interface TestRun {
  replies: Record<string, Reply>;
  decisions: Record<string, CaseDecisions>;
  model_note: string;
  reply_judge_version?: string;
  /** The way of counting when the first reply arrived, to name a switch caused by a later correction of the rules (FR-075). */
  reply_counted_per?: 'expected_error' | 'case';
  rules_corrected_after_replies?: boolean;
}

/**
 * The working session (data-model.md, TestProject): the judge set with the error catalog, the test cases, the metric, the
 * thresholds and, once the test run has started, the test run. "Started" means `testRun` is present. Save files are not part of it.
 */
export interface TestProject {
  judge_set: JudgeSet;
  dataset: TestCases;
  metric: MetricRef;
  checks: CheckConfiguration;
  testRun?: TestRun;
}
