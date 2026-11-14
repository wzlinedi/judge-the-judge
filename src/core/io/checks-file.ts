// Reading a check configuration file (metric-and-checks.md, section 2; FR-069). Nothing is applied here:
// an invalid file is described and the rules in use stay as they are.
import type { CheckConfiguration, Problem, ReadResult } from '../model';
import { extractJson } from '../judge/extract-json';
import { MINIMUM_SAMPLE } from '../evaluation/results';
import { checkEnvelope } from '../schemas/common';
import { CHECKS_FORMAT, CHECKS_KEYS, CHECKS_SCHEMA_VERSION } from '../schemas/checks';

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

export function readChecks(text: string, knownMeasures: readonly string[]): ReadResult<CheckConfiguration> {
  const extracted = extractJson(text);
  if (!extracted.ok) {
    return { ok: false, problems: [{ message: `The file is not readable JSON. ${extracted.message}`, line: extracted.line, column: extracted.column }] };
  }
  const envelope = checkEnvelope(extracted.value, { format: CHECKS_FORMAT, schemaVersion: CHECKS_SCHEMA_VERSION, knownKeys: CHECKS_KEYS });
  if (!envelope.ok) return envelope;

  const raw = envelope.value['rules'];
  if (!Array.isArray(raw)) return { ok: false, problems: [{ message: 'The file has no list of "rules".', path: 'rules' }] };
  if (raw.length === 0) return { ok: false, problems: [{ message: 'The list of rules is empty. A check configuration needs at least one rule.', path: 'rules' }] };

  const problems: Problem[] = [];
  const rules: CheckConfiguration['rules'] = [];
  const seen = new Set<string>();
  raw.forEach((entry, i) => {
    const at = `rules[${i}]`;
    if (!isObject(entry)) {
      problems.push({ message: 'A rule must be an object with a measure, a comparison and a value.', path: at });
      return;
    }
    const measure = entry['measure'];
    if (typeof measure !== 'string' || !knownMeasures.includes(measure)) {
      problems.push({ message: `Unknown measure "${String(measure ?? '')}". Known measures: ${knownMeasures.join(', ')}.`, path: `${at}.measure` });
    } else if (seen.has(measure)) {
      problems.push({ message: `The measure "${measure}" has a rule twice; give it one rule.`, path: `${at}.measure` });
    } else seen.add(measure);
    const comparison = entry['comparison'];
    if (comparison !== 'at_least' && comparison !== 'at_most') {
      problems.push({ message: `Unknown comparison "${String(comparison ?? '')}". Use "at_least" or "at_most".`, path: `${at}.comparison` });
    }
    const value = entry['value'];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      problems.push({ message: 'The value must be a number from 0 to 1, for example 0.8 for 80%.', path: `${at}.value` });
    }
    if (problems.length === 0 && typeof measure === 'string' && (comparison === 'at_least' || comparison === 'at_most') && typeof value === 'number') {
      rules.push({ measure, comparison, value });
    }
  });
  if (problems.length > 0) return { ok: false, problems };

  const notes = [...envelope.notes];
  if ('minimum_sample' in envelope.value) {
    notes.push(`The minimum test size is fixed at ${MINIMUM_SAMPLE.expected_errors} injected errors and ${MINIMUM_SAMPLE.clean_cases} clean cases, so the value in the file was ignored.`);
  }
  return { ok: true, value: { rules }, notes };
}
