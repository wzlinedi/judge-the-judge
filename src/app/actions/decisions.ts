// Decisions made by hand (data-model.md, CaseDecisions). Every function returns a new evaluation.
import { ownValue, setOwn, updateTestRun } from '../../core/cases/test-run';
import type { AdditionalState, CaseDecisions, TestProject, ExpectedState } from '../../core/model';

const empty = (): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '' });

function withCase(evaluation: TestProject, caseId: string, change: (d: CaseDecisions) => CaseDecisions): TestProject {
  return updateTestRun(evaluation, (run) => ({ ...run, decisions: { ...run.decisions, [caseId]: change(structuredClone(ownValue(run.decisions, caseId) ?? empty())) } }));
}

export function setExpectedMark(evaluation: TestProject, caseId: string, expectedId: string, state: ExpectedState): TestProject {
  return withCase(evaluation, caseId, (d) => {
    setOwn(d.expected, expectedId, { state, source: 'manual' });
    return d;
  });
}

export function setAdditionalMark(evaluation: TestProject, caseId: string, key: string, state: AdditionalState): TestProject {
  return withCase(evaluation, caseId, (d) => {
    setOwn(d.additional, key, { state, source: 'manual' });
    return d;
  });
}

/** A finding added by hand or by an applied opinion; a change makes its source "manual". */
export function setAddedMark(evaluation: TestProject, caseId: string, index: number, state: AdditionalState): TestProject {
  return withCase(evaluation, caseId, (d) => {
    const finding = d.added_findings[index];
    if (finding) d.added_findings[index] = { ...finding, state, source: 'manual' };
    return d;
  });
}

export function approveCase(evaluation: TestProject, caseId: string): TestProject {
  return withCase(evaluation, caseId, (d) => ({ ...d, approved: true }));
}
