import type { AppState, StepId } from '../../../app/store';
import { labels } from '../../labels';
import { FileMenu, type FileAction } from './FileMenu';
import { SaveState } from './SaveState';
import { StepBar } from './StepBar';

export interface HeaderProps {
  state: AppState;
  onGo: (step: StepId) => void;
  onFileAction: (action: FileAction) => void;
}

/** The two save buttons are always here, each with the name of its file under it; "Save … as…" and the loads are in the More menu, and Help stands beside it (FR-076, T242, T246). */
export function Header({ state, onGo, onFileAction }: HeaderProps) {
  return (
    <header class="app-header" role="banner">
      <div class="app-header-top">
        <h1 class="app-name">Judge the Judge</h1>
        <SaveState state={state} />
        <div class="header-actions">
          <SaveButton label={labels.saveTestProject} file={state.testProjectFile} onClick={() => onFileAction('save-test-project')} />
          <SaveButton label={labels.saveEvaluation} file={state.evaluationFile} onClick={() => onFileAction('save-evaluation')} />
          <FileMenu onAction={onFileAction} />
          <button type="button" class={`help-button${state.step === 'help' ? ' current' : ''}`} aria-current={state.step === 'help' ? 'page' : undefined} onClick={() => onGo('help')}>
            {labels.help}
          </button>
        </div>
      </div>
      <StepBar current={state.step} onGo={onGo} />
    </header>
  );
}

function SaveButton({ label, file, onClick }: { label: string; file: string | null; onClick: () => void }) {
  return (
    <div class="save-button">
      <button type="button" onClick={onClick}>
        {label}
      </button>
      <span class="file-name muted">{file ?? 'no file yet'}</span>
    </div>
  );
}
