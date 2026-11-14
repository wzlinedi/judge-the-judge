import type { CaseEdit } from '../../../app/actions/cases';
import type { AppState } from '../../../app/store';
import { EmptyState } from '../../components/EmptyState';
import { labels } from '../../labels';
import { CasesTable } from './CasesTable';

export interface CasesStepProps {
  state: AppState;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onClone: (id: string) => void;
  onEdit: (edit: CaseEdit) => void;
}

/** The Test cases step: Add test case above one table of every case (FR-025, FR-087). */
export function CasesStep({ state, onAdd, onOpen, onClone, onEdit }: CasesStepProps) {
  const empty = state.evaluation.dataset.cases.length === 0;
  return (
    <div class="cases-step">
      <div class="list-head">
        <h2>Test cases</h2>
        <button type="button" onClick={onAdd}>
          {labels.addTestCase}
        </button>
      </div>
      {empty ? (
        <EmptyState title="There are no test cases yet">Add a test case, or import test cases from the File menu.</EmptyState>
      ) : (
        <CasesTable state={state} onOpen={onOpen} onClone={onClone} onEdit={onEdit} />
      )}
    </div>
  );
}
