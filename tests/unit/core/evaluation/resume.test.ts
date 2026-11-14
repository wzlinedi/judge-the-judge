// FR-073: the first step with unfinished work, and the case Continue opens.
import { describe, expect, it } from 'vitest';
import { resumePoint } from '../../../../src/core/evaluation/resume';
import { sampleEvaluation } from '../../../helpers/fixtures';
import type { Evaluation } from '../../../../src/core/model';

const withReplies = (keep: string[]): Evaluation => {
  const e = sampleEvaluation();
  e.decisions = {};
  e.replies = Object.fromEntries(Object.entries(e.replies).filter(([id]) => keep.includes(id)));
  return e;
};

describe('resumePoint', () => {
  it('is Judge when the prompt is empty', () => {
    const e = sampleEvaluation();
    e.judge_set.prompt = '  ';
    expect(resumePoint(e)).toMatchObject({ step: 'judge' });
  });

  it('is Test cases when the test cases are not finalized', () => {
    const e = sampleEvaluation();
    e.dataset.finalized = false;
    expect(resumePoint(e)).toMatchObject({ step: 'cases' });
  });

  it('is Run when a case has no reply, opening the first case not run', () => {
    const point = resumePoint(withReplies(['1']));
    expect(point).toMatchObject({ step: 'run', caseId: '2', decided: 1, total: 2 });
  });

  it('opens the first case awaiting verification before the first not run', () => {
    const e = withReplies(['2']);
    // a finding that matches no expected error: someone must decide it
    e.replies['2'] = { prompt: 'p2', reply: JSON.stringify({ claims: [{ text: 'Something entirely unrelated happens here', verdict: 'contradicted', reason: 'x' }] }) };
    const point = resumePoint(e);
    expect(point).toMatchObject({ step: 'run', caseId: '2' });
  });

  it('is Results when every case is decided', () => {
    const point = resumePoint(sampleEvaluation());
    expect(point).toMatchObject({ step: 'results', decided: 2, total: 2 });
    expect(point.caseId).toBeUndefined();
  });

  it('counts decided cases for the "what next" line', () => {
    expect(resumePoint(withReplies([]))).toMatchObject({ step: 'run', caseId: '1', decided: 0, total: 2 });
  });
});
