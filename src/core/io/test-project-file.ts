// Reading and writing the test project file (file-formats.md, section 1; FR-020).
// The file holds the work that stays the same for every run: no replies, decisions, results or model details.
import { measureProblems } from './metric-file';
import type { Evaluation, MetricRef, ReadResult } from '../model';
import { extractJson } from '../judge/extract-json';
import { recognizeFields } from '../judge/fields';
import { validateRules } from '../judge/rules';
import { findVariables, proposeJudgedText } from '../judge/variables';
import { checkEnvelope } from '../schemas/common';
import { zodProblems } from '../schemas/messages';
import { EVALUATION_FORMAT } from '../schemas/evaluation';
import { cleanJudgeSet } from '../schemas/judge-set';
import { assignExpectedIds, ignoredFieldNote, storedCase } from '../schemas/test-case';
import { TEST_PROJECT_FORMAT, TEST_PROJECT_KEYS, TEST_PROJECT_SCHEMA_VERSION, testProjectSchema } from '../schemas/test-project';

export interface TestProjectMeta {
  toolVersion: string;
  /** The content version of the test cases, passed in: hashing is asynchronous. */
  testCasesVersion: string;
}

/** The parts of an evaluation a test project holds. */
export type TestProjectParts = Pick<Evaluation, 'judge_set' | 'dataset' | 'metric' | 'checks'>;

export function writeTestProject(parts: TestProjectParts, meta: TestProjectMeta): string {
  const file = {
    format: TEST_PROJECT_FORMAT,
    schema_version: TEST_PROJECT_SCHEMA_VERSION,
    tool_version: meta.toolVersion,
    judge_set: cleanJudgeSet(parts.judge_set),
    dataset: {
      name: parts.dataset.name,
      version: meta.testCasesVersion,
      finalized: parts.dataset.finalized,
      cases: parts.dataset.cases.map(storedCase),
    },
    metric: parts.metric,
    checks: parts.checks,
  };
  return JSON.stringify(file, null, 2) + '\n';
}

/**
 * `isMetricRegistered` lets the caller say which metrics it knows; the core knows none.
 * A metric that is not registered keeps its stored parameters and the user is told.
 */
export function readTestProject(text: string, isMetricRegistered: (id: string) => boolean = () => true): ReadResult<{ evaluation: Evaluation; toolVersion: string | undefined }> {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { ok: false, problems: [{ message: `The file is not readable JSON. ${extracted.message}`, line: extracted.line, column: extracted.column }] };
  }
  const raw = extracted.value;
  if (raw !== null && typeof raw === 'object' && (raw as Record<string, unknown>)['format'] === EVALUATION_FORMAT) {
    return { ok: false, problems: [{ message: 'This is an evaluation file. Use "Load evaluation…" to open it.', path: 'format' }] };
  }
  const envelope = checkEnvelope(raw, { format: TEST_PROJECT_FORMAT, schemaVersion: TEST_PROJECT_SCHEMA_VERSION, knownKeys: TEST_PROJECT_KEYS });
  if (!envelope.ok) return envelope;

  const parsed = testProjectSchema.safeParse(envelope.value);
  if (!parsed.success) return { ok: false, problems: zodProblems(parsed.error, envelope.value) };

  const definitionProblems = parsed.data.metric.definition ? measureProblems(parsed.data.metric.definition.measures, 'metric.definition.measures') : [];
  if (definitionProblems.length > 0) return { ok: false, problems: definitionProblems };

  const notes = [...envelope.notes];
  const rawChecks = envelope.value['checks'] as Record<string, unknown> | undefined;
  if (rawChecks && 'minimum_sample' in rawChecks) {
    notes.push('The minimum test size in the file was ignored: it is fixed at 30 expected errors and 10 clean cases.');
  }
  const fieldNote = ignoredFieldNote((envelope.value['dataset'] as { cases?: unknown } | undefined)?.cases);
  if (fieldNote) notes.push(fieldNote);

  const p = parsed.data;
  const judgeSet = { ...p.judge_set };
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

  if (p.metric.definition === undefined && !isMetricRegistered(p.metric.id)) {
    notes.push(`The metric "${p.metric.id}" is not registered in this tool. Its stored parameters are used.`);
  }

  const evaluation: Evaluation = {
    judge_set: judgeSet,
    dataset: { name: p.dataset.name, ...(p.dataset.version !== undefined ? { version: p.dataset.version } : {}), finalized: p.dataset.finalized, cases: assignExpectedIds(p.dataset.cases) },
    metric: p.metric as MetricRef,
    checks: p.checks,
    model_note: '',
    replies: {},
    decisions: {},
  };
  return { ok: true, notes, value: { evaluation, toolVersion: p.tool_version } };
}
