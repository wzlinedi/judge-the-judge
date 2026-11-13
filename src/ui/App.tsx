import { useEffect, useRef, useState } from 'preact/hooks';
import { guardFor, installBeforeUnload } from '../app/guard';
import { browserSupported, type BrowserEnv } from '../app/ports/browser';
import { createBrowserPorts } from '../app/ports';
import type { Ports } from '../app/ports/types';
import { nextAction, stepGate } from '../app/selectors';
import { createState, goToStep, startNewEvaluation, type AppState, type StepId } from '../app/store';
import { BrowserNotice } from './components/shell/BrowserNotice';
import { Footer } from './components/shell/Footer';
import type { FileAction } from './components/shell/FileMenu';
import { Header } from './components/shell/Header';
import { NextBar } from './components/shell/NextBar';
import { StepGate } from './components/shell/StepGate';
import { Dialog } from './components/Dialog';
import { LoadExampleWindow } from './windows/load-example/LoadExampleWindow';
import { labels } from './labels';

export interface AppProps {
  ports?: Ports;
  env?: BrowserEnv;
  initialState?: AppState;
  /** File actions other than the ones the shell handles itself; wired by the steps that own them. */
  onFileAction?: (action: FileAction, state: AppState) => void;
}

export function App({ ports, env, initialState, onFileAction }: AppProps) {
  const browser = env ?? (globalThis as unknown as BrowserEnv);
  const [state, setState] = useState<AppState>(initialState ?? createState());
  const [showExamples, setShowExamples] = useState(false);
  const [pending, setPending] = useState<FileAction | null>(null);
  const portsRef = useRef<Ports>(ports ?? createBrowserPorts(browser, () => state.evaluation.dataset.name));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return installBeforeUnload(window, () => stateRef.current);
  }, []);

  const go = (step: StepId) => setState((s) => goToStep(s, step));

  const perform = (action: FileAction) => {
    if (action === 'load-example') setShowExamples(true);
    else if (action === 'start-new-evaluation') setState((s) => startNewEvaluation(s, portsRef.current));
    else onFileAction?.(action, stateRef.current);
  };

  const onFile = (action: FileAction) => {
    const guarded = action === 'start-new-evaluation' || action === 'load-example' || action === 'load-evaluation' || action === 'load-test-project';
    const guard = guarded ? guardFor(state, action) : null;
    if (guard) setPending(action);
    else perform(action);
  };

  const gate = stepGate(state, state.step);
  const next = nextAction(state);

  return (
    <div class="app">
      {browserSupported(browser) ? null : <BrowserNotice />}
      <Header state={state} onGo={go} onFileAction={onFile} />
      <main class="app-main">
        {state.step === 'help' ? (
          <section aria-label="Help">
            <h2>Help</h2>
            <p>Help explains each step with examples.</p>
          </section>
        ) : gate ? (
          <StepGate gate={gate} onGo={go} />
        ) : (
          <>
            <NextBar
              sentence={next.sentence}
              detail={next.detail}
              action={{ label: next.action.label, disabled: next.action.disabled, onClick: () => next.action.go && go(next.action.go) }}
            />
            <section class="step-content" aria-label={state.step} />
          </>
        )}
      </main>
      <Footer />
      <LoadExampleWindow
        open={showExamples}
        onChoose={() => setShowExamples(false)}
        onLoadMetric={() => setShowExamples(false)}
        onClose={() => setShowExamples(false)}
      />
      <Dialog
        open={pending !== null}
        title="Unsaved changes"
        onClose={() => setPending(null)}
        actions={
          <>
            <button type="button" onClick={() => setPending(null)}>
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                const action = pending;
                setPending(null);
                if (action) perform(action);
              }}
            >
              {labels.discard}
            </button>
            <button type="button" class="primary" onClick={() => setPending(null)}>
              {labels.saveEvaluationFirst}
            </button>
          </>
        }
      >
        <p>You have unsaved changes. What do you want to do with them?</p>
      </Dialog>
    </div>
  );
}
