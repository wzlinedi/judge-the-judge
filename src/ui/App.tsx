import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import demoEvaluation from '../../examples/demo/evaluation.json?raw';
import { loadExample } from '../app/actions/evaluation';
import { startFromMetric, type JudgeEdit } from '../app/actions/judge';
import { continueWork, loadEvaluation, loadTestProject, saveEvaluation, saveEvaluationAs, saveTestProject, saveTestProjectAs, type FileEnv } from '../app/actions/files';
import { guardFor, installBeforeUnload, type GuardedAction } from '../app/guard';
import { metricFor } from '../app/metrics';
import { browserSupported, type BrowserEnv } from '../app/ports/browser';
import { createBrowserPorts } from '../app/ports';
import type { Ports } from '../app/ports/types';
import { nextAction, stepGate } from '../app/selectors';
import { createState, goToStep, startNewEvaluation, type AppState, type StepId } from '../app/store';
import { computeResults, reviewEvaluation } from '../core/evaluation/results';
import type { Evaluation, Problem } from '../core/model';
import { Dialog } from './components/Dialog';
import { ErrorMessage } from './components/ErrorMessage';
import type { FileAction } from './components/shell/FileMenu';
import { BrowserNotice } from './components/shell/BrowserNotice';
import { Footer } from './components/shell/Footer';
import { Header } from './components/shell/Header';
import { NextBar } from './components/shell/NextBar';
import { StepGate } from './components/shell/StepGate';
import { HelpStep } from './help/HelpStep';
import { labels } from './labels';
import { ResultsStep } from './steps/results/ResultsStep';
import { JudgeStep } from './steps/judge/JudgeStep';
import { RunStep } from './steps/run/RunStep';
import { CaseWindow } from './windows/case-window/CaseWindow';
import { LoadExampleWindow, type ExampleId } from './windows/load-example/LoadExampleWindow';

export interface AppProps {
  ports?: Ports;
  env?: BrowserEnv;
  initialState?: AppState;
  /** The clock and tool version for the files the page writes; the defaults are the real ones. */
  fileEnv?: FileEnv;
  /** File actions other than the ones the shell handles itself; wired by the steps that own them. */
  onFileAction?: (action: FileAction, state: AppState) => void;
}

const REAL_FILE_ENV: FileEnv = { now: () => new Date().toISOString(), toolVersion: __TOOL_VERSION__ };

export function App({ ports, env, initialState, fileEnv = REAL_FILE_ENV, onFileAction }: AppProps) {
  const browser = env ?? (globalThis as unknown as BrowserEnv);
  const [state, setState] = useState<AppState>(initialState ?? createState());
  const [showExamples, setShowExamples] = useState(false);
  const [pending, setPending] = useState<FileAction | null>(null);
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const [notice, setNotice] = useState('');
  const [problems, setProblems] = useState<Problem[]>([]);
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

  const say = (message: string | undefined) => {
    setProblems([]);
    setNotice(message ?? '');
  };

  const save = async (as: boolean, project = false): Promise<boolean> => {
    const action = project ? (as ? saveTestProjectAs : saveTestProject) : as ? saveEvaluationAs : saveEvaluation;
    const result = await action(stateRef.current, portsRef.current, fileEnv);
    setState(result.state);
    const done = project ? 'The test project was saved.' : 'The evaluation was saved.';
    say(result.message ?? (result.outcome === 'saved' ? done : result.outcome === 'cancelled' ? 'Nothing was saved.' : undefined));
    return result.outcome === 'saved';
  };

  const load = async (kind: 'evaluation' | 'project') => {
    const result = await (kind === 'evaluation' ? loadEvaluation : loadTestProject)(stateRef.current, portsRef.current, fileEnv);
    setState(result.state);
    if (result.outcome === 'invalid') {
      setNotice('');
      setProblems(result.problems ?? []);
    } else if (result.outcome === 'loaded') say(result.message);
  };

  const applyJudge = (result: JudgeEdit) => {
    setState(result.state);
    say(result.note);
  };

  const perform = (action: FileAction) => {
    if (action === 'load-example') setShowExamples(true);
    else if (action === 'start-new-evaluation') {
      setState((s) => startNewEvaluation(s, portsRef.current));
      say('Started a new evaluation.');
    } else if (action === 'load-evaluation') void load('evaluation');
    else if (action === 'load-test-project') void load('project');
    else if (action === 'save-test-project') void save(false, true);
    else if (action === 'save-test-project-as') void save(true, true);
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
      say('The demo was loaded.');
    } else {
      const metric = metricFor(example);
      setState((s) => startFromMetric(s, metric, portsRef.current));
      say(`${metric.name} was loaded as the start of a new test project.`);
    }
  };

  const windowOpen = state.step === 'run' && state.openCase !== null;
  const gate = stepGate(state, state.step);
  const next = nextAction(state, state.step, reviewed);
  const runAction = () => {
    if (next.action.openCase) setState((s) => ({ ...s, openCase: next.action.openCase ?? null }));
    else if (next.action.go) go(next.action.go);
  };
  const onResultsContinue = () => setState((s) => continueWork(s));

  return (
    <div class="app">
      <div class="app-page" inert={windowOpen}>
      {browserSupported(browser) ? null : <BrowserNotice />}
      <Header state={state} onGo={go} onFileAction={onFile} />
      <div role="status" class="notice-line" aria-live="polite">
        {notice}
      </div>
      <ErrorMessage problems={problems} title="The file was not loaded. Nothing has changed." />
      <main class="app-main">
        {state.step === 'help' ? (
          <HelpStep />
        ) : gate ? (
          <StepGate gate={gate} onGo={go} />
        ) : state.step === 'results' ? (
          <ResultsStep
            results={results}
            onContinue={onResultsContinue}
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
            ) : state.step === 'judge' ? (
              <JudgeStep state={state} onEdit={applyJudge} />
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
      <LoadExampleWindow open={showExamples} enabled={['accuracy', 'completeness', 'demo']} onChoose={chooseExample} onLoadMetric={() => setShowExamples(false)} onClose={() => setShowExamples(false)} />
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
