import { useState } from 'preact/hooks';
import type { ReviewedCase } from '../../../core/evaluation/results';
import { differenceNote, type Difference } from '../../../core/evaluation/recompute';
import { countingSwitchNote } from '../../../core/evaluation/counting-note';
import type { Results } from '../../../core/evaluation/results';
import type { TestProject } from '../../../core/model';
import { NextBar } from '../../components/shell/NextBar';
import { labels } from '../../labels';
import { useVersions } from '../run/useVersions';
import { CaseListView } from './CaseListView';
import { ErrorAnalysisView } from './ErrorAnalysisView';
import { SummaryView } from './SummaryView';

type View = 'summary' | 'analysis' | 'list';
const TABS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'summary', label: labels.summary },
  { id: 'analysis', label: labels.errorAnalysis },
  { id: 'list', label: labels.testCaseList },
];

export interface ResultsStepProps {
  results: Results;
  evaluation: TestProject;
  reviewed: ReviewedCase[];
  /** "Edit the judge and run again" (FR-074); the caller asks about unsaved work first. */
  /** Exports the HTML report (FR-072). */
  onExport: (() => void) | undefined;
  onThreshold: (measure: string, value: number) => void;
  onOpenCase: (caseId: string) => void;
  /** What recomputing the loaded file gave differently from what it stored (SC-003); empty when nothing differs. */
  differences?: readonly Difference[];
}

/** The Results step is read-only: nothing here changes a reply, decision, expected error, rule or mapping. Only the thresholds do (FR-065). Its main action is always Export HTML report (T267). */
export function ResultsStep({ results, evaluation, reviewed, onExport, onThreshold, onOpenCase, differences = [] }: ResultsStepProps) {
  const [view, setView] = useState<View>('summary');
  const versions = useVersions(evaluation);
  const c = results.counters;
  const total = c.cases_decided + c.cases_awaiting + c.cases_not_run;

  const action = { label: labels.exportHtmlReport, onClick: () => onExport?.(), disabled: onExport === undefined };

  const replyJudgeVersion = evaluation.testRun?.reply_judge_version;
  const corrected = versions.judge !== '' && replyJudgeVersion !== undefined && replyJudgeVersion !== versions.judge;
  const changed = (kind: 'added' | 'corrected') => evaluation.dataset.cases.filter((t) => t.changed_after_first_reply === kind);
  const added = changed('added');
  const fixed = changed('corrected');
  const named = (list: TestProject['dataset']['cases']) => list.map((t) => `case ${t.id} (${t.name})`).join(', ');
  const switchNote = countingSwitchNote(results);
  const mismatch = differenceNote(differences);
  const hasNotices = corrected || switchNote !== null || mismatch !== null || added.length > 0 || fixed.length > 0;

  return (
    <div class="results-step">
      <NextBar
        sentence={`${c.cases_decided} of ${total} cases decided${results.undecided > 0 ? ` · ${results.undecided} not decided yet` : ''}`}
        action={action}
      />
      {hasNotices ? (
        <section role="region" aria-label="Notices" class="notices">
          {corrected ? (
            <p class="notice warn">{`The rules were corrected after the replies were received (the error rules or the reply mapping changed). The judge version in force when the replies were received was ${replyJudgeVersion}; the current one is ${versions.judge}.`}</p>
          ) : null}
          {switchNote ? <p class="notice warn">{switchNote}</p> : null}
          {mismatch ? <p class="notice warn">{mismatch}</p> : null}
          {added.length > 0 ? <p class="notice">{`Cases added after the first reply: ${named(added)}.`}</p> : null}
          {fixed.length > 0 ? <p class="notice">{`Cases corrected after the first reply: ${named(fixed)}.`}</p> : null}
        </section>
      ) : null}
      <div role="tablist" aria-label="Views" class="tabs">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={view === tab.id} aria-controls={`panel-${tab.id}`} class={view === tab.id ? 'tab current' : 'tab'} onClick={() => setView(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
        {view === 'summary' ? (
          <SummaryView results={results} evaluation={evaluation} onThreshold={onThreshold} reviewed={reviewed} onOpenCase={onOpenCase} />
        ) : view === 'analysis' ? (
          <ErrorAnalysisView results={results} />
        ) : (
          <CaseListView reviewed={reviewed} onOpen={onOpenCase} />
        )}
      </div>
    </div>
  );
}
