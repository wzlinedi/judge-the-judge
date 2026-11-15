// Deciding after a reply: the actions of the list of items beyond the marks (FR-062, FR-063, FR-053).
// Every function returns a new evaluation, or for a correction of the judge a new state with one sentence.
import { addCategories, normalizeCategoryName } from '../../core/cases/catalog';
import { applyOpinion, type OpinionPlan } from '../../core/evaluation/opinions';
import { dropPromotion } from '../../core/evaluation/promotion';
import { reviewEvaluation } from '../../core/evaluation/results';
import type { CaseDecisions, Difficulty, Evaluation } from '../../core/model';
import type { MetricDefinition } from '../../core/metrics/types';
import type { AppState } from '../store';
import type { JudgeEdit } from './judge';

const empty = (): CaseDecisions => ({ expected: {}, additional: {}, added_findings: [], approved: false, note: '' });

function withDecisions(evaluation: Evaluation, caseId: string, change: (d: CaseDecisions) => CaseDecisions): Evaluation {
  const current = evaluation.decisions[caseId] ?? empty();
  return { ...evaluation, decisions: { ...evaluation.decisions, [caseId]: change(structuredClone(current)) } };
}

/** A category named in a finding joins the catalog when it is new (FR-062). */
function withCategory(evaluation: Evaluation, name: string | undefined): { evaluation: Evaluation; category?: string } {
  const category = name === undefined ? '' : normalizeCategoryName(name);
  if (category === '') return { evaluation };
  const added = addCategories(evaluation.judge_set.error_catalog, [{ name: category }]);
  const next = added.added.length > 0 ? { ...evaluation, judge_set: { ...evaluation.judge_set, error_catalog: added.catalog } } : evaluation;
  return { evaluation: next, category };
}

export interface NewFinding {
  text: string;
  category?: string;
  difficulty?: Difficulty;
}

/**
 * "Add finding": a finding the user adds by hand, with an optional category and difficulty. It starts as a real error
 * (the user changes the mark with one click) and is the only kind of finding that has "Remove".
 */
export function addFinding(evaluation: Evaluation, caseId: string, finding: NewFinding): Evaluation {
  const text = finding.text.trim();
  if (text === '') return evaluation;
  const joined = withCategory(evaluation, finding.category);
  return withDecisions(joined.evaluation, caseId, (d) => {
    d.added_findings.push({
      text,
      ...(joined.category ? { category: joined.category } : {}),
      ...(finding.difficulty ? { difficulty: finding.difficulty } : {}),
      state: 'real_error',
      source: 'manual',
    });
    return d;
  });
}

/** "Remove": only a finding added by hand or by an opinion can be removed, with its mark. */
export function removeFinding(evaluation: Evaluation, caseId: string, index: number): Evaluation {
  if (!evaluation.decisions[caseId]?.added_findings[index]) return evaluation;
  // a finding that made an expected error takes it with it (T253)
  return withDecisions(dropPromotion(evaluation, caseId, index), caseId, (d) => {
    d.added_findings.splice(index, 1);
    return d;
  });
}

/** "Apply opinion": the user's approval of everything the preview showed. New categories join the catalog. */
export function applyOpinionTo(evaluation: Evaluation, caseId: string, plan: OpinionPlan): Evaluation {
  if (!plan.canApply) return evaluation;
  let next = evaluation;
  const newFindings = plan.newFindings.map((n) => {
    const joined = withCategory(next, n.category);
    next = joined.evaluation;
    const { category: _old, ...rest } = n;
    return joined.category ? { ...rest, category: joined.category } : rest;
  });
  const decisions = applyOpinion(next.decisions[caseId], { ...plan, newFindings });
  return { ...next, decisions: { ...next.decisions, [caseId]: decisions } };
}

/** Decisions that point at something that no longer exists, as "case 3 (claims[]#2)". */
function orphanList(evaluation: Evaluation, metric: MetricDefinition | undefined): string[] {
  const found: string[] = [];
  for (const r of reviewEvaluation(evaluation, metric)) {
    const orphans = r.effective?.orphans;
    if (!orphans) continue;
    for (const id of orphans.expected) found.push(`case ${r.testCase.id} (expected error ${id})`);
    for (const key of orphans.additional) found.push(`case ${r.testCase.id} (${key})`);
  }
  return found;
}

/**
 * A correction of the rules or the reply mapping after replies (FR-053, FR-075): the automatic marks are computed again
 * by the next read, decisions are kept, and the decisions that no longer match any item are named in one sentence.
 */
export function correctRules(before: AppState, edit: JudgeEdit, metric: MetricDefinition | undefined): JudgeEdit {
  if (edit.state === before || Object.keys(edit.state.evaluation.replies).length === 0) return edit;
  const known = new Set(orphanList(before.evaluation, metric));
  const fresh = orphanList(edit.state.evaluation, metric).filter((o) => !known.has(o));
  if (fresh.length === 0) return edit;
  const sentence = `${fresh.length} ${fresh.length === 1 ? 'decision no longer matches' : 'decisions no longer match'} any item and ${fresh.length === 1 ? 'is' : 'are'} left out: ${fresh.join(', ')}.`;
  return { ...edit, note: edit.note ? `${edit.note} ${sentence}` : sentence };
}
