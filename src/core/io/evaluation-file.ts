// Reading and writing the evaluation file (file-formats.md, section 5; FR-072, FR-073, FR-075).
import type { Evaluation, ReadResult } from '../model';
import { extractJson } from '../judge/extract-json';
import { MINIMUM_SAMPLE, type Results } from '../evaluation/results';
import type { MinimumSample } from '../evaluation/overall';
import { checkEnvelope } from '../schemas/common';
import { zodProblems } from '../schemas/messages';
import { evaluationSchema, EVALUATION_FORMAT, EVALUATION_KEYS, EVALUATION_SCHEMA_VERSION, TEST_PROJECT_FORMAT } from '../schemas/evaluation';
import { cleanJudgeSet } from '../schemas/judge-set';
import { assignExpectedIds, ignoredFieldNote, storedCase } from '../schemas/test-case';

export interface EvaluationMeta {
  /** The date and time of the save, passed in: the core has no clock. */
  now: string;
  toolVersion: string;
  judgeVersion: string;
  testCasesVersion: string;
}

export interface LoadedEvaluation {
  evaluation: Evaluation;
  saved: string | undefined;
  toolVersion: string | undefined;
  judgeVersion: string | undefined;
  replyJudgeVersion: string | undefined;
  testCasesVersion: string | undefined;
  minimumSample: MinimumSample;
  /** The results as stored, to compare with the recomputed ones on load. */
  storedResults: Record<string, unknown>;
}

function resultsForFile(results: Results | null): Record<string, unknown> {
  if (!results || results.counters.cases_decided === 0) return {};
  const measures = Object.fromEntries(
    Object.entries(results.measures).map(([id, m]) => [id, { value: m.value, numerator: m.numerator ?? null, denominator: m.denominator ?? null, interval: m.interval }]),
  );
  return {
    evaluated_per: results.evaluated_per,
    counted_per_before_correction: results.counted_per_before_correction,
    counters: results.counters,
    measures,
    overall: results.overall,
    cases: results.cases,
  };
}

export function writeEvaluation(evaluation: Evaluation, results: Results | null, meta: EvaluationMeta): string {
  const corrected = evaluation.reply_judge_version !== undefined && evaluation.reply_judge_version !== meta.judgeVersion;
  const file = {
    format: EVALUATION_FORMAT,
    schema_version: EVALUATION_SCHEMA_VERSION,
    tool_version: meta.toolVersion,
    saved: meta.now,
    judge_set: cleanJudgeSet(evaluation.judge_set),
    judge_version: meta.judgeVersion,
    ...(evaluation.reply_judge_version !== undefined ? { reply_judge_version: evaluation.reply_judge_version } : {}),
    ...(evaluation.reply_counted_per !== undefined ? { reply_counted_per: evaluation.reply_counted_per } : {}),
    rules_corrected_after_replies: corrected,
    model_note: evaluation.model_note,
    metric: evaluation.metric,
    dataset: {
      name: evaluation.dataset.name,
      version: meta.testCasesVersion,
      finalized: evaluation.dataset.finalized,
      cases: evaluation.dataset.cases.map(storedCase),
    },
    replies: evaluation.replies,
    decisions: evaluation.decisions,
    checks: evaluation.checks,
    minimum_sample: MINIMUM_SAMPLE,
    results: resultsForFile(results),
  };
  return JSON.stringify(file, null, 2) + '\n';
}

export function readEvaluation(text: string): ReadResult<LoadedEvaluation> {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { ok: false, problems: [{ message: `The file is not readable JSON. ${extracted.message}`, line: extracted.line, column: extracted.column }] };
  }
  const raw = extracted.value;
  if (raw !== null && typeof raw === 'object' && (raw as Record<string, unknown>)['format'] === TEST_PROJECT_FORMAT) {
    return { ok: false, problems: [{ message: 'This is a test project file. Use "Load test project" to open it.', path: 'format' }] };
  }
  const envelope = checkEnvelope(raw, { format: EVALUATION_FORMAT, schemaVersion: EVALUATION_SCHEMA_VERSION, knownKeys: EVALUATION_KEYS });
  if (!envelope.ok) return envelope;

  const parsed = evaluationSchema.safeParse(envelope.value);
  if (!parsed.success) return { ok: false, problems: zodProblems(parsed.error, envelope.value) };

  const notes = [...envelope.notes];
  if ('proposals' in envelope.value) {
    notes.splice(0, notes.length, ...notes.filter((n) => !/proposals/.test(n)));
    notes.push('The old key "proposals" was ignored: an LLM opinion changes nothing until it is applied.');
  }
  const fieldNote = ignoredFieldNote((envelope.value['dataset'] as { cases?: unknown } | undefined)?.cases);
  if (fieldNote) notes.push(fieldNote);

  const p = parsed.data;
  const evaluation: Evaluation = {
    judge_set: p.judge_set,
    dataset: { name: p.dataset.name, ...(p.dataset.version !== undefined ? { version: p.dataset.version } : {}), finalized: p.dataset.finalized, cases: assignExpectedIds(p.dataset.cases) },
    metric: p.metric,
    checks: p.checks,
    model_note: p.model_note,
    replies: p.replies,
    decisions: p.decisions,
    ...(p.reply_judge_version !== undefined ? { reply_judge_version: p.reply_judge_version } : {}),
    ...(p.reply_counted_per !== undefined ? { reply_counted_per: p.reply_counted_per } : {}),
  };
  const stored = p.results !== null && typeof p.results === 'object' ? (p.results as Record<string, unknown>) : {};
  return {
    ok: true,
    notes,
    value: {
      evaluation,
      saved: p.saved,
      toolVersion: p.tool_version,
      judgeVersion: p.judge_version,
      replyJudgeVersion: p.reply_judge_version,
      testCasesVersion: p.dataset.version,
      minimumSample: p.minimum_sample ?? MINIMUM_SAMPLE,
      storedResults: stored,
    },
  };
}
