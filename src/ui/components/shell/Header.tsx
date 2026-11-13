import type { AppState, StepId } from '../../../app/store';
import { FileMenu, type FileAction } from './FileMenu';
import { SaveState } from './SaveState';
import { StepBar } from './StepBar';

export interface HeaderProps {
  state: AppState;
  onGo: (step: StepId) => void;
  onFileAction: (action: FileAction) => void;
}

/** The header holds no save button: file actions are in the File menu (FR-076). */
export function Header({ state, onGo, onFileAction }: HeaderProps) {
  return (
    <header class="app-header" role="banner">
      <div class="app-header-top">
        <h1 class="app-name">Judge the Judge</h1>
        <SaveState state={state} />
        <FileMenu onAction={onFileAction} testProjectFile={state.testProjectFile} />
      </div>
      <StepBar current={state.step} onGo={onGo} />
    </header>
  );
}
