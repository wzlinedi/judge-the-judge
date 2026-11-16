// Reading and writing the test project file (file-formats.md, sections 1 and 5; FR-020, FR-073, FR-075).
// One file holds the whole work: the judge set, the error catalog, the test cases, the metric, the thresholds and,
// once the test run has started, the `test_run` section with the replies, decisions, model details and results.
import { measureProblems } from './metric-file';
import type { MetricRef, Problem, ReadResult, TestProject, TestRun } from '../model';
import { extractJson } from '../judge/extract-json';
import { recognizeFields } from '../judge/fields';
import { validateRules } from '../judge/rules';
import { findVariables, proposeJudgedText } from '../judge/variables';
import { resultsForFile, rulesCorrectedAfterReplies } from '../evaluation/recompute';
import { MINIMUM_SAMPLE, type Results } from '../evaluation/results';
import type { MinimumSample } from '../evaluation/overall';
import { checkEnvelope } from '../schemas/common';
import { zodProblems } from '../schemas/messages';
import { safeParseOwnKeys } from '../schemas/own-record';
import { cleanJudgeSet } from '../schemas/judge-set';
import { joinCategoryExamples } from '../cases/catalog';
import { assignExpectedIds, ignoredFieldNote, storedCase } from '../schemas/test-case';
import { TEST_PROJECT_FORMAT, TEST_PROJECT_KEYS, TEST_PROJECT_SCHEMA_VERSION, testProjectSchema } from '../schemas/test-project';

export interface TestProjectMeta {
  /** The date and time of the save, passed in: the core has no clock. */
  now: string;
  toolVersion: string;
  /** The versions are passed in: hashing is asynchronous. */
  judgeVersion: string;
  testCasesVersion: string;
}

/** What a loaded test run said about itself, to compare with the recomputed numbers on load (SC-003). */
export interface StoredTestRun {
  saved: string | undefined;
  judgeVersion: string | undefined;
  minimumSample: MinimumSample;
  /** The results as stored. */
  results: Record<string, unknown>;
}

export interface LoadedTestProject {
  project: TestProject;
  /** True when the file has a `test_run` section, so the load can ask its question (FR-076). */
  hasTestRun: boolean;
  toolVersion: string | undefined;
  testCasesVersion: string | undefined;
  /** Present exactly when the file has a test run. */
  stored: StoredTestRun | undefined;
}

export function writeTestProject(project: TestProject, results: Results | null, meta: TestProjectMeta): string {
  const run = project.testRun;
  const file = {
    format: TEST_PROJECT_FORMAT,
    schema_version: TEST_PROJECT_SCHEMA_VERSION,
    tool_version: meta.toolVersion,
    judge_set: cleanJudgeSet(project.judge_set),
    dataset: {
      name: project.dataset.name,
      version: meta.testCasesVersion,
      cases: project.dataset.cases.map(storedCase),
    },
    metric: project.metric,
    checks: project.checks,
    ...(run !== undefined
      ? {
          test_run: {
            saved: meta.now,
            judge_version: meta.judgeVersion,
            ...(run.reply_judge_version !== undefined ? { reply_judge_version: run.reply_judge_version } : {}),
            ...(run.reply_counted_per !== undefined ? { reply_counted_per: run.reply_counted_per } : {}),
            rules_corrected_after_replies: rulesCorrectedAfterReplies(run.reply_judge_version, meta.judgeVersion),
            model_note: run.model_note,
            replies: run.replies,
            decisions: run.decisions,
            minimum_sample: MINIMUM_SAMPLE,
            results: resultsForFile(results),
          },
        }
      : {}),
  };
  return JSON.stringify(file, null, 2) + '\n';
}

/** Two cases with one id, or two expected errors of a case with one id, are refused (code review R7; FR-076). */
function repeatedIds(cases: ReadonlyArray<{ id: string; expected_errors: ReadonlyArray<{ id?: string | undefined }> }>): Problem[] {
  const problems: Problem[] = [];
  const caseIds = new Set<string>();
  cases.forEach((c, i) => {
    if (caseIds.has(c.id)) problems.push({ message: `The case id "${c.id}" is used by more than one case. Each case needs its own id.`, path: `dataset.cases[${i}].id` });
    caseIds.add(c.id);
    const errorIds = new Set<string>();
    c.expected_errors.forEach((e, j) => {
      if (e.id === undefined) return;
      if (errorIds.has(e.id)) problems.push({ message: `The expected error id "${e.id}" is used twice in case "${c.id}". Each expected error needs its own id.`, path: `dataset.cases[${i}].expected_errors[${j}].id` });
      errorIds.add(e.id);
    });
  });
  return problems;
}

/**
 * `isMetricLoaded` lets the caller say which metrics it knows; the core knows none.
 * A metric that is not loaded keeps its stored parameters and the user is told.
 */
export function readTestProject(text: string, isMetricLoaded: (id: string) => boolean = () => true): ReadResult<LoadedTestProject> {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { ok: false, problems: [{ message: `The file is not readable JSON. ${extracted.message}`, line: extracted.line, column: extracted.column }] };
  }
  const envelope = checkEnvelope(extracted.value, { format: TEST_PROJECT_FORMAT, schemaVersion: TEST_PROJECT_SCHEMA_VERSION, knownKeys: TEST_PROJECT_KEYS });
  if (!envelope.ok) return envelope;

  const parsed = safeParseOwnKeys(testProjectSchema, envelope.value);
  if (!parsed.success) return { ok: false, problems: zodProblems(parsed.error, parsed.input) };

  const repeated = repeatedIds(parsed.data.dataset.cases);
  if (repeated.length > 0) return { ok: false, problems: repeated };

  const definitionProblems = parsed.data.metric.definition ? measureProblems(parsed.data.metric.definition.measures, 'metric.definition.measures') : [];
  if (definitionProblems.length > 0) return { ok: false, problems: definitionProblems };

  const notes = [...envelope.notes];
  if (envelope.value['schema_version'] === 1) {
    notes.push('This file uses schema version 1, from an earlier version of the tool. It was upgraded to version 2. The test run has not started, so the judge prompt can still change.');
  }
  if ('proposals' in envelope.value) {
    notes.push('The old key "proposals" was ignored: an LLM opinion changes nothing until it is applied.');
  }
  const rawChecks = envelope.value['checks'] as Record<string, unknown> | undefined;
  if (rawChecks && 'minimum_sample' in rawChecks) {
    notes.push('The minimum test size in the file was ignored: it is fixed at 30 expected errors and 10 clean cases.');
  }
  const fieldNote = ignoredFieldNote((envelope.value['dataset'] as { cases?: unknown } | undefined)?.cases);
  if (fieldNote) notes.push(fieldNote);

  const p = parsed.data;
  const judgeSet = { ...p.judge_set, error_catalog: joinCategoryExamples(p.judge_set.error_catalog) };
  const variables = findVariables(judgeSet.prompt);
  const proposal = proposeJudgedText(variables, judgeSet.judged_text);
  if (proposal.name !== undefined) {
    if (proposal.name !== judgeSet.judged_text) {
      notes.push(proposal.note ?? `The file names no judged text, so the last variable of the prompt, "${proposal.name}", is used.`);
    }
    judgeSet.judged_text = proposal.name;
  } else {
    delete judgeSet.judged_text;
  }

  if (judgeSet.error_rules.length > 0 && judgeSet.sample_reply !== undefined) {
    const recognized = recognizeFields(judgeSet.sample_reply);
    if (recognized.ok) {
      validateRules(judgeSet.error_rules, recognized).forEach((validation) => {
        if (!validation.usable) notes.push(`A rule is broken and does not count until it is fixed on the Judge step. ${validation.reason}`);
      });
    }
  }

  if (p.metric.definition === undefined && !isMetricLoaded(p.metric.id)) {
    notes.push(`The metric "${p.metric.id}" is not registered in this tool. Its stored parameters are used.`);
  }

  const run = p.test_run;
  const testRun: TestRun | undefined =
    run === undefined
      ? undefined
      : {
          model_note: run.model_note,
          replies: run.replies,
          decisions: run.decisions,
          ...(run.reply_judge_version !== undefined ? { reply_judge_version: run.reply_judge_version } : {}),
          ...(run.reply_counted_per !== undefined ? { reply_counted_per: run.reply_counted_per } : {}),
        };
  const project: TestProject = {
    judge_set: judgeSet,
    dataset: { name: p.dataset.name, ...(p.dataset.version !== undefined ? { version: p.dataset.version } : {}), cases: assignExpectedIds(p.dataset.cases) },
    metric: p.metric as MetricRef,
    checks: p.checks,
    ...(testRun !== undefined ? { testRun } : {}),
  };
  const stored: StoredTestRun | undefined =
    run === undefined
      ? undefined
      : {
          saved: run.saved,
          judgeVersion: run.judge_version,
          minimumSample: run.minimum_sample ?? MINIMUM_SAMPLE,
          results: run.results !== null && typeof run.results === 'object' ? (run.results as Record<string, unknown>) : {},
        };
  return { ok: true, notes, value: { project, hasTestRun: run !== undefined, toolVersion: p.tool_version, testCasesVersion: p.dataset.version, stored } };
}
