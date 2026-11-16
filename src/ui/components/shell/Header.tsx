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

/** One row: the tool name, the name of the test project, the save indicator (with the file name), then Save test project, More and Help; the steps are the second row (FR-092, T322). */
export function Header({ state, onGo, onFileAction }: HeaderProps) {
  return (
    <header class="app-header" role="banner">
      <div class="app-header-top">
        <h1 class="app-name">Judge the Judge</h1>
        <span class="project-name">{state.project.dataset.name}</span>
        <SaveState state={state} />
        <div class="header-actions">
          <button type="button" onClick={() => onFileAction('save-test-project')}>
            {labels.saveTestProject}
          </button>
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
