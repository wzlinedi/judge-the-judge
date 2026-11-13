import { useState } from 'preact/hooks';
import type { Results } from '../../../core/evaluation/results';
import { EmptyState } from '../../components/EmptyState';
import { NextBar } from '../../components/shell/NextBar';
import { labels } from '../../labels';
import { SummaryView } from './SummaryView';

type View = 'summary' | 'analysis' | 'list';
const TABS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'summary', label: labels.summary },
  { id: 'analysis', label: labels.errorAnalysis },
  { id: 'list', label: labels.testCaseList },
];

export interface ResultsStepProps {
  results: Results;
  onContinue: () => void;
  /** Exports the HTML report; not available until the report is built (User Story 9). */
  onExport: (() => void) | undefined;
}

export function ResultsStep({ results, onContinue, onExport }: ResultsStepProps) {
  const [view, setView] = useState<View>('summary');
  const c = results.counters;
  const total = c.cases_decided + c.cases_awaiting + c.cases_not_run;

  const action = results.provisional
    ? { label: labels.continue, onClick: onContinue }
    : { label: labels.exportHtmlReport, onClick: () => onExport?.(), disabled: onExport === undefined };

  return (
    <div class="results-step">
      <NextBar
        sentence={results.provisional ? 'The result is provisional: some cases are not decided yet.' : 'The result is final: every case is decided.'}
        detail={`${c.cases_decided} of ${total} cases decided`}
        action={action}
      />
      <div role="tablist" aria-label="Views" class="tabs">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={view === tab.id} aria-controls={`panel-${tab.id}`} class={view === tab.id ? 'tab current' : 'tab'} onClick={() => setView(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
        {view === 'summary' ? <SummaryView results={results} /> : <EmptyState title="Not available in this version yet">This view is built in a later step.</EmptyState>}
      </div>
    </div>
  );
}
