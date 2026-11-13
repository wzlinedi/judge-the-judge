import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import demoEvaluation from '../../examples/demo/evaluation.json?raw';
import { loadExample } from '../app/actions/evaluation';
import { guardFor, installBeforeUnload, type GuardedAction } from '../app/guard';
import { metricFor } from '../app/metrics';
import { browserSupported, type BrowserEnv } from '../app/ports/browser';
import { createBrowserPorts } from '../app/ports';
import type { Ports } from '../app/ports/types';
import { caseToContinue, nextAction, stepGate } from '../app/selectors';
import { createState, goToStep, saveEvaluation, saveEvaluationAs, startNewEvaluation, type AppState, type StepId } from '../app/store';
import { computeResults, reviewEvaluation } from '../core/evaluation/results';
import { testCasesVersion } from '../core/cases/version';
import { writeEvaluation } from '../core/io/evaluation-file';
import { judgeVersion } from '../core/judge/version';
import type { Evaluation } from '../core/model';
import { Dialog } from './components/Dialog';
import type { FileAction } from './components/shell/FileMenu';
import { BrowserNotice } from './components/shell/BrowserNotice';
import { Footer } from './components/shell/Footer';
import { Header } from './components/shell/Header';
import { NextBar } from './components/shell/NextBar';
import { StepGate } from './components/shell/StepGate';
import { HelpStep } from './help/HelpStep';
import { labels } from './labels';
import { ResultsStep } from './steps/results/ResultsStep';
import { RunStep } from './steps/run/RunStep';
import { CaseWindow } from './windows/case-window/CaseWindow';
import { LoadExampleWindow, type ExampleId } from './windows/load-example/LoadExampleWindow';

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
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const [notice, setNotice] = useState('');
  const portsRef = useRef<Ports>(ports ?? createBrowserPorts(browser, () => stateRef.current.evaluation.dataset.name));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return installBeforeUnload(window, () => stateRef.current);
  }, []);

  const metric = metricFor(state.evaluation.metric.id);
  const reviewed = useMemo(() => reviewEvaluation(state.evaluation, metric), [state.evaluation, metric]);
  const results = useMemo(() => computeResults(state.evaluation, metric), [state.evaluation, metric]);

  const go = (step: StepId) => setState((s) => goToStep(s, step));
  const change = (next: Evaluation) => setState((s) => ({ ...s, evaluation: next, unsaved: true }));

  const serialize = async (s: AppState) =>
    writeEvaluation(s.evaluation, computeResults(s.evaluation, metricFor(s.evaluation.metric.id)), {
      now: new Date().toISOString(),
      toolVersion: __TOOL_VERSION__,
      judgeVersion: await judgeVersion(s.evaluation.judge_set),
      testCasesVersion: await testCasesVersion(s.evaluation.dataset.cases),
    });

  const save = async (as: boolean): Promise<boolean> => {
    const result = await (as ? saveEvaluationAs : saveEvaluation)(stateRef.current, portsRef.current, serialize);
    setState(result.state);
    setNotice(result.message ?? (result.outcome === 'saved' ? 'The evaluation was saved.' : result.outcome === 'cancelled' ? 'Nothing was saved.' : ''));
    return result.outcome === 'saved';
  };

  const perform = (action: FileAction) => {
    if (action === 'load-example') setShowExamples(true);
    else if (action === 'start-new-evaluation') setState((s) => startNewEvaluation(s, portsRef.current));
    else onFileAction?.(action, stateRef.current);
  };

  const onFile = (action: FileAction) => {
    const guard = guardFor(state, action as GuardedAction);
    if (guard) setPending(action);
    else perform(action);
  };

  const chooseExample = (example: ExampleId) => {
    setShowExamples(false);
    if (example === 'demo') {
      setState((s) => loadExample(s, demoEvaluation, portsRef.current, metricFor('accuracy')));
      setNotice('The demo was loaded.');
    }
  };

  const windowOpen = state.step === 'run' && state.openCase !== null;
  const gate = stepGate(state, state.step);
  const next = nextAction(state, state.step, reviewed);
  const runAction = () => {
    if (next.action.openCase) setState((s) => ({ ...s, openCase: next.action.openCase ?? null }));
    else if (next.action.go) go(next.action.go);
  };

  return (
    <div class="app">
      <div class="app-page" inert={windowOpen}>
      {browserSupported(browser) ? null : <BrowserNotice />}
      <Header state={state} onGo={go} onFileAction={onFile} />
      <div role="status" class="notice-line" aria-live="polite">
        {notice}
      </div>
      <main class="app-main">
        {state.step === 'help' ? (
          <HelpStep />
        ) : gate ? (
          <StepGate gate={gate} onGo={go} />
        ) : state.step === 'results' ? (
          <ResultsStep
            results={results}
            onContinue={() => setState((s) => ({ ...s, step: 'run', openCase: caseToContinue(reviewed) ?? null }))}
            onExport={undefined}
          />
        ) : (
          <>
            <NextBar sentence={next.sentence} detail={next.detail} action={{ label: next.action.label, disabled: next.action.disabled, onClick: runAction }} />
            {state.step === 'run' ? (
              <RunStep
                evaluation={state.evaluation}
                reviewed={reviewed}
                fileName={state.evaluationFile}
                repliesSinceSave={state.repliesSinceSave}
                onOpen={(id) => setState((s) => ({ ...s, openCase: id }))}
                onSave={() => void save(false)}
                onSaveAs={() => void save(true)}
              />
            ) : (
              <section class="step-content" aria-label={state.step} />
            )}
          </>
        )}
      </main>
      <Footer />
      </div>
      {windowOpen && state.openCase ? (
        <CaseWindow
          evaluation={state.evaluation}
          reviewed={reviewed}
          caseId={state.openCase}
          onChange={change}
          onNavigate={(id) => setState((s) => ({ ...s, openCase: id }))}
          onClose={() => setState((s) => ({ ...s, openCase: null }))}
          onlyAwaiting={onlyAwaiting}
          onOnlyAwaitingChange={setOnlyAwaiting}
          saveBar={{ fileName: state.evaluationFile, repliesSinceSave: state.repliesSinceSave, onSave: () => void save(false), onSaveAs: () => void save(true) }}
        />
      ) : null}
      <LoadExampleWindow open={showExamples} enabled={['demo']} onChoose={chooseExample} onLoadMetric={() => setShowExamples(false)} onClose={() => setShowExamples(false)} />
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
            <button
              type="button"
              class="primary"
              onClick={async () => {
                const action = pending;
                if (action && (await save(false))) {
                  setPending(null);
                  perform(action);
                }
              }}
            >
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
