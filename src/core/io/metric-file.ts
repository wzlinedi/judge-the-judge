// Reading a metric definition file (metric-and-checks.md, section 1; Principle VI). Nothing is registered here:
// an invalid file is described and changes nothing.
import { joinCategoryExamples } from '../cases/catalog';
import { findVariables } from '../judge/variables';
import { extractJson } from '../judge/extract-json';
import { recognizeFields } from '../judge/fields';
import { validateRules } from '../judge/rules';
import type { Problem, ReadResult } from '../model';
import { COUNTER_NAMES } from '../metrics/operations';
import type { MetricDefinition } from '../metrics/types';
import { checkEnvelope } from '../schemas/common';
import { zodProblems } from '../schemas/messages';
import { METRIC_FORMAT, METRIC_KEYS, METRIC_SCHEMA_VERSION, metricSchema } from '../schemas/metric';

const REQUIRED = ['detection_rate', 'false_positive_rate'];

type MeasureLike = { id: string; operation: string; numerator?: string | undefined; denominator?: string | undefined; of?: string | undefined; interval?: string | undefined };

/** The problems of the measures of a definition, in a metric file or inside a test project (T243). */
export function measureProblems(measures: readonly MeasureLike[], prefix: string): Problem[] {
  const problems: Problem[] = [];
  const ids = new Set<string>();
  measures.forEach((m, i) => {
    const at = `${prefix}[${i}]`;
    if (ids.has(m.id)) problems.push({ message: `The measure id "${m.id}" is used twice; ids must be unique.`, path: `${at}.id` });
    ids.add(m.id);
    if (m.operation !== 'ratio' && m.operation !== 'complement') {
      problems.push({ message: `Unknown operation "${m.operation}". This tool knows "ratio" and "complement".`, path: `${at}.operation` });
      return;
    }
    if (m.operation === 'ratio') {
      for (const key of ['numerator', 'denominator'] as const) {
        const counter = m[key];
        if (counter === undefined || !(COUNTER_NAMES as readonly string[]).includes(counter)) {
          problems.push({ message: `Unknown counter "${counter ?? ''}". Known counters: ${COUNTER_NAMES.join(', ')}.`, path: `${at}.${key}` });
        }
      }
    }
    if (m.interval !== undefined && (m.interval !== 'wilson95' || m.operation !== 'ratio')) {
      problems.push({ message: 'An interval can only be "wilson95" on a "ratio".', path: `${at}.interval` });
    }
  });
  measures.forEach((m, i) => {
    if (m.operation === 'complement' && (m.of === undefined || !ids.has(m.of))) {
      problems.push({ message: `The measure "${m.id}" is the complement of "${m.of ?? ''}", which is not a measure of this file.`, path: `${prefix}[${i}].of` });
    }
  });
  for (const required of REQUIRED) {
    if (!ids.has(required)) problems.push({ message: `The measure "${required}" is required: the overall result rests on it.`, path: prefix });
  }
  return problems;
}

export function readMetric(text: string): ReadResult<MetricDefinition> {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { ok: false, problems: [{ message: `The file is not readable JSON. ${extracted.message}`, line: extracted.line, column: extracted.column }] };
  }
  const envelope = checkEnvelope(extracted.value, { format: METRIC_FORMAT, schemaVersion: METRIC_SCHEMA_VERSION, knownKeys: METRIC_KEYS });
  if (!envelope.ok) return envelope;
  const parsed = metricSchema.safeParse(envelope.value);
  if (!parsed.success) return { ok: false, problems: zodProblems(parsed.error, envelope.value) };

  const metric = parsed.data;
  const problems: Problem[] = [];
  const set = metric.judge_set;
  const variables = findVariables(set.prompt);

  problems.push(...measureProblems(metric.measures, 'measures'));

  // judge set
  if (set.judged_text !== undefined && !variables.includes(set.judged_text)) {
    problems.push({ message: `The judged_text "${set.judged_text}" is not a variable of the prompt.`, path: 'judge_set.judged_text' });
  }
  const recognized = set.sample_reply === undefined ? null : recognizeFields(set.sample_reply);
  if (set.error_rules.length > 0) {
    if (recognized === null || !recognized.ok) {
      problems.push({ message: 'The rules need a readable sample_reply to check their fields against.', path: 'judge_set.sample_reply' });
    } else {
      validateRules(set.error_rules, recognized).forEach((validation, i) => {
        if (!validation.usable) problems.push({ message: validation.reason, path: `judge_set.error_rules[${i}]` });
      });
    }
  }
  set.clean_base_cases.forEach((c, i) => {
    for (const variable of variables) {
      if ((c.fields[variable] ?? '').trim() === '') problems.push({ message: `The clean case "${c.name}" has no text for the variable "${variable}".`, path: `judge_set.clean_base_cases[${i}].fields.${variable}` });
    }
    if (c.expected_errors.length > 0) problems.push({ message: `The clean case "${c.name}" must have no expected_errors.`, path: `judge_set.clean_base_cases[${i}].expected_errors` });
  });

  if (problems.length > 0) return { ok: false, problems };
  const definition: MetricDefinition = {
    format: METRIC_FORMAT,
    schema_version: METRIC_SCHEMA_VERSION,
    id: metric.id,
    name: metric.name,
    description: metric.description,
    limitations: metric.limitations,
    output_format: metric.output_format,
    judge_set: {
      prompt: set.prompt,
      ...(set.judged_text !== undefined ? { judged_text: set.judged_text } : {}),
      ...(set.sample_reply !== undefined ? { sample_reply: set.sample_reply } : {}),
      reply_mapping: set.reply_mapping,
      error_rules: set.error_rules,
      error_catalog: joinCategoryExamples(set.error_catalog),
      clean_base_cases: set.clean_base_cases.map((c) => ({ name: c.name, fields: c.fields, expected_errors: [] })),
    },
    parameters: metric.parameters,
    measures: metric.measures as MetricDefinition['measures'],
  };
  return { ok: true, notes: envelope.notes, value: definition };
}
