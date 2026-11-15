// Decisions made by hand (data-model.md, CaseDecisions). Every function returns a new evaluation.
import type { AdditionalState, CaseDecisions, Evaluation, ExpectedState } from '../../core/model';

const empty = (): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '' });

function withCase(evaluation: Evaluation, caseId: string, change: (d: CaseDecisions) => CaseDecisions): Evaluation {
  const current = evaluation.decisions[caseId] ?? empty();
  return { ...evaluation, decisions: { ...evaluation.decisions, [caseId]: change(structuredClone(current)) } };
}

export function setExpectedMark(evaluation: Evaluation, caseId: string, expectedId: string, state: ExpectedState): Evaluation {
  return withCase(evaluation, caseId, (d) => {
    d.expected[expectedId] = { state, source: 'manual' };
    return d;
  });
}

export function setAdditionalMark(evaluation: Evaluation, caseId: string, key: string, state: AdditionalState): Evaluation {
  return withCase(evaluation, caseId, (d) => {
    const linked = d.additional[key]?.promoted_to;
    d.additional[key] = { state, source: 'manual', ...(linked !== undefined ? { promoted_to: linked } : {}) };
    return d;
  });
}

/** A finding added by hand or by an applied opinion; a change makes its source "manual". */
export function setAddedMark(evaluation: Evaluation, caseId: string, index: number, state: AdditionalState): Evaluation {
  return withCase(evaluation, caseId, (d) => {
    const finding = d.added_findings[index];
    if (finding) d.added_findings[index] = { ...finding, state, source: 'manual' };
    return d;
  });
}

export function approveCase(evaluation: Evaluation, caseId: string): Evaluation {
  return withCase(evaluation, caseId, (d) => ({ ...d, approved: true }));
}
