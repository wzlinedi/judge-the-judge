import type { CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { AddChoice } from './AddChoice';
import { InjectWindow } from './InjectWindow';
import { CaseReadOnly } from './CaseReadOnly';
import { CleanCaseView } from './CleanCaseView';
import { JsonCaseView } from './JsonCaseView';
import { caseToJson } from '../../../core/cases/case-json';

export type TestWindowView =
  | { view: 'choice' }
  | { view: 'paste'; text: string }
  | { view: 'clean' }
  | { view: 'inject' }
  | { view: 'open'; id: string }
  | { view: 'correct'; id: string };

export interface TestCaseWindowProps {
  state: AppState;
  view: TestWindowView;
  onView: (view: TestWindowView | null) => void;
  onApply: (edit: CaseEdit) => void;
}

/** The test case window (FR-038): one window, whose views follow one another. */
export function TestCaseWindow({ state, view, onView, onApply }: TestCaseWindowProps) {
  const close = () => onView(null);
  const choose = (choice: 'paste' | 'clean' | 'inject') => onView(choice === 'paste' ? { view: 'paste', text: '' } : { view: choice });
  switch (view.view) {
    case 'choice':
      return <AddChoice onChoose={choose} onClose={close} />;
    case 'inject':
      return <InjectWindow state={state} onApply={onApply} onClose={close} />;
    case 'paste':
      return <JsonCaseView key={view.text} state={state} mode="paste" initialText={view.text} onApply={onApply} onClose={close} />;
    case 'clean':
      return <CleanCaseView state={state} onApply={onApply} onClose={close} />;
    case 'open':
      return (
        <CaseReadOnly
          state={state}
          caseId={view.id}
          onNavigate={(id) => onView({ view: 'open', id })}
          onCorrect={(id) => onView({ view: 'correct', id })}
          onRecreate={() => onView({ view: 'paste', text: '' })}
          onClose={close}
        />
      );
    case 'correct': {
      const original = state.evaluation.dataset.cases.find((c) => c.id === view.id);
      if (!original) return null;
      return <JsonCaseView key={view.id} state={state} mode="correct" caseId={view.id} initialText={caseToJson(original)} onApply={onApply} onClose={close} />;
    }
  }
}
