import { useState } from 'preact/hooks';
import type { ReviewedCase } from '../../../core/evaluation/results';
import type { Results } from '../../../core/evaluation/results';
import type { Evaluation } from '../../../core/model';
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
  evaluation: Evaluation;
  reviewed: ReviewedCase[];
  onContinue: () => void;
  /** Exports the HTML report (FR-072). */
  onExport: (() => void) | undefined;
  onThreshold: (measure: string, value: number) => void;
  onLoadChecks: () => void;
  onOpenCase: (caseId: string) => void;
}

/** The Results step is read-only: nothing here changes a reply, decision, expected error, rule or mapping. Only the thresholds do (FR-065). */
export function ResultsStep({ results, evaluation, reviewed, onContinue, onExport, onThreshold, onLoadChecks, onOpenCase }: ResultsStepProps) {
  const [view, setView] = useState<View>('summary');
  const versions = useVersions(evaluation);
  const c = results.counters;
  const total = c.cases_decided + c.cases_awaiting + c.cases_not_run;

  const action = results.provisional
    ? { label: labels.continue, onClick: onContinue }
    : { label: labels.exportHtmlReport, onClick: () => onExport?.(), disabled: onExport === undefined };

  const corrected = versions.judge !== '' && evaluation.reply_judge_version !== undefined && evaluation.reply_judge_version !== versions.judge;
  const changed = (kind: 'added' | 'corrected') => evaluation.dataset.cases.filter((t) => t.changed_after_first_reply === kind);
  const added = changed('added');
  const fixed = changed('corrected');
  const named = (list: Evaluation['dataset']['cases']) => list.map((t) => `case ${t.id} (${t.name})`).join(', ');
  const hasNotices = corrected || added.length > 0 || fixed.length > 0;

  return (
    <div class="results-step">
      <NextBar
        sentence={results.provisional ? 'The result is provisional: some cases are not decided yet.' : 'The result is final: every case is decided.'}
        detail={`${c.cases_decided} of ${total} cases decided`}
        action={action}
      />
      {hasNotices ? (
        <section role="region" aria-label="Notices" class="notices">
          {corrected ? (
            <p class="notice warn">{`The rules were corrected after the replies were received (the error rules or the reply mapping changed). The judge version in force when the replies were received was ${evaluation.reply_judge_version}; the current one is ${versions.judge}.`}</p>
          ) : null}
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
          <SummaryView results={results} evaluation={evaluation} onThreshold={onThreshold} onLoadChecks={onLoadChecks} />
        ) : view === 'analysis' ? (
          <ErrorAnalysisView results={results} />
        ) : (
          <CaseListView reviewed={reviewed} onOpen={onOpenCase} />
        )}
      </div>
      <section role="region" aria-label="Report and next version" class="card report-card">
        <h2>Report and next version</h2>
        <p>
          {results.provisional
            ? 'The report can be exported at any time. While cases are not decided it is marked provisional.'
            : 'The result is final. Export the report with the button in the line above.'}
        </p>
        <p class="muted">The result as JSON is the evaluation file: press Save evaluation on the Run step.</p>
        {results.provisional ? (
          <div class="button-row">
            <button type="button" onClick={() => onExport?.()} disabled={onExport === undefined}>
              {labels.exportHtmlReport}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
