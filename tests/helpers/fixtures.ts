import accuracy from '../../src/core/metrics/builtin/accuracy.json';
import checksDefault from '../../src/core/metrics/builtin/checks.default.json';
import type { Evaluation, JudgeSet } from '../../src/core/model';
import type { MetricDefinition } from '../../src/core/metrics/types';

export const accuracyMetric = accuracy as unknown as MetricDefinition;

export function accuracyJudgeSet(): JudgeSet {
  const { clean_base_cases: _unused, ...rest } = accuracyMetric.judge_set;
  return structuredClone(rest);
}

const reply = (claims: Array<[string, string]>) => JSON.stringify({ claims: claims.map(([text, verdict]) => ({ text, verdict, reason: 'because' })) });

/** A small finalized evaluation: one clean case, one case with two injected errors, both with replies. */
export function sampleEvaluation(): Evaluation {
  return {
    judge_set: accuracyJudgeSet(),
    dataset: {
      name: 'Book summaries',
      finalized: true,
      cases: [
        { id: '1', name: 'Anna', fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a baker. She bought a second oven in 1998.' }, expected_errors: [] },
        {
          id: '2',
          name: 'Anna + 2 errors',
          base: '1',
          changed_after_first_reply: 'added',
          fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a doctor. She bought a second oven in 2005.' },
          expected_errors: [
            { id: 'e1', description: 'Profession changed.', category: 'factual-error', fragment: 'Anna is a doctor', difficulty: 'obvious' },
            { id: 'e2', description: 'Year changed.', category: 'wrong-number', fragment: 'second oven in 2005', difficulty: 'subtle' },
          ],
        },
      ],
    },
    metric: { id: 'accuracy', parameters: { match_clear_share: 0.5, match_partial_share: 0.3, match_min_word_length: 4 } },
    checks: structuredClone({ rules: checksDefault.rules }) as Evaluation['checks'],
    model_note: 'model X\ntemperature 0',
    replies: {
      '1': { prompt: 'p1', reply: reply([['Anna is a baker.', 'supported']]) },
      '2': { prompt: 'p2', reply: '```json\n' + reply([['Anna is a doctor.', 'contradicted'], ['She bought a second oven in 2005.', 'unsupported']]) + '\n```' },
    },
    decisions: {
      '2': {
        expected: {},
        additional: {},
        added_findings: [
          { text: 'The oven was never bought', category: 'factual-error', difficulty: 'obvious', state: 'real_error', source: 'manual' },
          { text: 'Something the LLM saw', from_opinion: true, state: 'false_positive', source: 'llm-approved' },
        ],
        approved: true,
        note: 'checked by hand',
      },
    },
    reply_judge_version: 'aaaaaaaaaaaa',
  };
}
