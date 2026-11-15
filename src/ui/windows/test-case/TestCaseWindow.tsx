import type { CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { AddChoice } from './AddChoice';
import { InjectWindow } from './InjectWindow';
import { CaseReadOnly } from './CaseReadOnly';
import { CleanCaseView } from './CleanCaseView';
import { JsonCaseView } from './JsonCaseView';

export type TestWindowView =
  | { view: 'choice' }
  | { view: 'paste'; text: string }
  | { view: 'clean' }
  | { view: 'inject' }
  | { view: 'open'; id: string };

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
      return <JsonCaseView key={view.text} state={state} initialText={view.text} onApply={onApply} onClose={close} />;
    case 'clean':
      return <CleanCaseView state={state} onApply={onApply} onClose={close} />;
    case 'open':
      return (
        <CaseReadOnly
          state={state}
          caseId={view.id}
          onNavigate={(id) => onView({ view: 'open', id })}
          onApply={onApply}
          onClose={close}
        />
      );
  }
}
