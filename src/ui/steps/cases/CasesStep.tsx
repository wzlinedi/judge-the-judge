import type { CaseEdit } from '../../../app/actions/cases';
import type { CatalogEdit } from '../../../app/actions/catalog';
import type { AppState } from '../../../app/store';
import { EmptyState } from '../../components/EmptyState';
import { labels } from '../../labels';
import { testProjectFeedback } from '../../../core/cases/feedback';
import { CasesTable } from './CasesTable';
import { ErrorCategoriesSection } from './ErrorCategoriesSection';
import { TestProjectCard } from './TestProjectCard';
import { Eyebrow, EYEBROWS } from '../../components/Eyebrow';

export interface CasesStepProps {
  state: AppState;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onEdit: (edit: CaseEdit) => void;
  categoriesOpen: boolean;
  onToggleCategories: () => void;
  onCatalogEdit: (edit: CatalogEdit) => void;
}

/** The Test cases step: Add test case above one table of every case (FR-025, FR-087). */
export function CasesStep({ state, onAdd, onOpen, onEdit, categoriesOpen, onToggleCategories, onCatalogEdit }: CasesStepProps) {
  const empty = state.project.dataset.cases.length === 0;
  const full = testProjectFeedback(state.project).capacity.full;
  return (
    <div class="cases-step">
      <ErrorCategoriesSection state={state} open={categoriesOpen} onToggle={onToggleCategories} onEdit={onCatalogEdit} />
      <TestProjectCard state={state} />
      <Eyebrow text={EYEBROWS.dataset} />
      <div class="list-head">
        <h2>Test cases</h2>
        <button type="button" onClick={onAdd} disabled={full}>
          {labels.addTestCase}
        </button>
      </div>
      {empty ? (
        <EmptyState title="There are no test cases yet">Add a test case, or import test cases from the More menu. The fields of each case come from the judge prompt on the Judge step.</EmptyState>
      ) : (
        <CasesTable state={state} onOpen={onOpen} onEdit={onEdit} />
      )}
    </div>
  );
}
