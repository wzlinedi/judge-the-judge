// The automatic result for one case (research.md, sections 10 and 11; FR-061).
import type { CountingMode, TestCase } from '../model';
import type { Finding, FindingsResult } from '../judge/findings';
import { matchLevel, type MatchParameters } from './match';

export interface ExpectedReview {
  id: string;
  state: 'found' | 'missed' | 'undecided';
  /** Keys of findings that clearly match. */
  clear: string[];
  /** Keys of findings that only partly match. */
  partial: string[];
  reason?: string;
}

export interface CaseReview {
  readable: boolean;
  needsApproval: boolean;
  expected: ExpectedReview[];
  /** Findings that match no expected error, or have no text. Never decided automatically. */
  additional: Finding[];
  /** Findings with only partial matches: they wait with the expected errors they resemble. */
  partialOnly: Finding[];
  unknown: string[];
  reason?: string;
}

export function reviewCase(
  testCase: Pick<TestCase, 'expected_errors'>,
  result: FindingsResult,
  parameters: Partial<MatchParameters>,
  mode: CountingMode = 'per_expected_error',
): CaseReview {
  if (mode === 'per_case') throw new Error('Reviewing a case per case is added with the judges evaluated per case.');

  if (!result.readable) {
    const reason = `The reply could not be read: ${result.reason ?? 'unknown reason'}`;
    return {
      readable: false,
      needsApproval: true,
      expected: testCase.expected_errors.map((e) => ({ id: e.id, state: 'undecided' as const, clear: [], partial: [], reason })),
      additional: [],
      partialOnly: [],
      unknown: [],
      reason,
    };
  }

  const level = new Map<string, Map<string, 'clear' | 'partial'>>(); // finding key -> expected id -> level
  for (const finding of result.findings) {
    const perError = new Map<string, 'clear' | 'partial'>();
    if (finding.text !== '') {
      for (const error of testCase.expected_errors) {
        if (!error.fragment) continue;
        const l = matchLevel(finding.text, error.fragment, parameters);
        if (l !== 'none') perError.set(error.id, l);
      }
    }
    level.set(finding.key, perError);
  }

  const hasClear = (key: string) => [...(level.get(key)?.values() ?? [])].includes('clear');
  const additional = result.findings.filter((f) => (level.get(f.key)?.size ?? 0) === 0);
  const partialOnly = result.findings.filter((f) => (level.get(f.key)?.size ?? 0) > 0 && !hasClear(f.key));

  const expected: ExpectedReview[] = testCase.expected_errors.map((error) => {
    const clear = result.findings.filter((f) => level.get(f.key)?.get(error.id) === 'clear').map((f) => f.key);
    const partial = result.findings.filter((f) => level.get(f.key)?.get(error.id) === 'partial').map((f) => f.key);
    if (clear.length > 0) return { id: error.id, state: 'found', clear, partial };
    if (!error.fragment) {
      return { id: error.id, state: 'undecided', clear, partial, reason: 'This expected error has no fragment to match, so decide it by hand.' };
    }
    if (partial.length > 0) {
      return { id: error.id, state: 'undecided', clear, partial, reason: 'A finding only partly matches this fragment, so decide it by hand.' };
    }
    if (result.unknown.length > 0) {
      return { id: error.id, state: 'undecided', clear, partial, reason: `A rule could not be checked because the reply has no usable ${result.unknown.join(', ')}, so decide it by hand.` };
    }
    if (additional.length > 0) {
      return { id: error.id, state: 'undecided', clear, partial, reason: 'The judge reported findings that match no expected error; one of them may be this error in other words.' };
    }
    return { id: error.id, state: 'missed', clear, partial };
  });

  return { readable: true, needsApproval: false, expected, additional, partialOnly, unknown: result.unknown };
}
