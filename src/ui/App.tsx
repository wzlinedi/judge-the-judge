import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import demoEvaluation from '../../examples/demo/evaluation.json?raw';
import { loadExample } from '../app/actions/evaluation';
import { changeThreshold, loadChecksFromFile } from '../app/actions/checks';
import { correctRules } from '../app/actions/decide';
import { exportReport } from '../app/actions/export';
import { modelDetailsEdit, pasteReplyFromClipboard, saveReply, type ReplyOutcome } from '../app/actions/replies';
import type { CaseEdit } from '../app/actions/cases';
import type { CatalogEdit } from '../app/actions/catalog';
import { loadMetricDefinition, replaceLoadedMetric, startFromMetric, type JudgeEdit } from '../app/actions/judge';
import { continueWork, loadEvaluation, loadTestProject, saveEvaluation, saveEvaluationAs, saveTestProject, saveTestProjectAs, type FileEnv } from '../app/actions/files';
import { guardFor, installBeforeUnload, type GuardedAction } from '../app/guard';
import { metricFor, sessionRegistry } from '../app/metrics';
import { browserSupported, type BrowserEnv } from '../app/ports/browser';
import { createBrowserPorts } from '../app/ports';
import type { Ports } from '../app/ports/types';
import { nextAction, stepGate, type NextIntent } from '../app/selectors';
import { editJudgeAndRunAgain } from '../app/actions/rerun';
import { editTestCases, finalize } from '../app/actions/finalize';
import { createState, goToStep, recomputeDifferences, startNewEvaluation, type AppState, type StepId } from '../app/store';
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
import { CasesStep } from './steps/cases/CasesStep';
import { FinalizeDialog } from './steps/cases/FinalizeDialog';
import { JudgeStep } from './steps/judge/JudgeStep';
import { RunStep } from './steps/run/RunStep';
import { CaseWindow } from './windows/case-window/CaseWindow';
import { ReadOnlyCaseView } from './windows/case-window/ReadOnlyCaseView';
import { TestCaseWindow, type TestWindowView } from './windows/test-case/TestCaseWindow';
import { ImportWindow } from './windows/import/ImportWindow';
import { applyImport, downloadExample, exportTestCases, prepareImport } from '../app/actions/test-cases-file';
import { download } from './components/download';
import { DEMO, LoadExampleWindow } from './windows/load-example/LoadExampleWindow';
import type { MetricDefinition } from '../core/metrics/types';

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
  const [pending, setPending] = useState<FileAction | 'edit-judge-and-run-again' | null>(null);
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const [notice, setNotice] = useState('');
  /** True when the message says that something was not done: it is shown as a refusal, with a word and a sign. */
  const [refused, setRefused] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState<boolean | undefined>(undefined);
  const [metricProblems, setMetricProblems] = useState<Problem[]>([]);
  const [pendingReplace, setPendingReplace] = useState<{ metric: MetricDefinition; message: string } | null>(null);
  const [metricsVersion, setMetricsVersion] = useState(0);
  const [testWindow, setTestWindow] = useState<TestWindowView | null>(null);
  const [importing, setImporting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [viewCase, setViewCase] = useState<string | null>(null);
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

  const say = (message: string | undefined, refusal = false) => {
    setProblems([]);
    setNotice(message ?? '');
    setRefused(refusal && message !== undefined);
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

  const applyCase = (edit: CaseEdit) => {
    setProblems([]);
    // an edit that changed nothing and has a note is a refusal
    say(edit.note, edit.state === stateRef.current);
    setState(edit.state);
  };

  const applyCatalog = (edit: CatalogEdit) => {
    setState(edit.state);
    say(edit.note);
  };

  const loadMetric = async () => {
    setPendingReplace(null);
    const result = await loadMetricDefinition(portsRef.current);
    if (result.outcome === 'invalid') setMetricProblems(result.problems);
    else if (result.outcome === 'exists') {
      setMetricProblems([]);
      setPendingReplace({ metric: result.metric, message: result.message });
    } else if (result.outcome === 'loaded') {
      setMetricProblems([]);
      setMetricsVersion((v) => v + 1);
      say(`The metric ${result.metric.name} was loaded. Choose it in the list to start from it.`);
    }
  };

  const applyJudge = (result: JudgeEdit) => {
    const corrected = correctRules(stateRef.current, result, metric);
    setState(corrected.state);
    say(corrected.note);
  };

  const applyReply = (outcome: ReplyOutcome): ReplyOutcome => {
    setState(outcome.state);
    return outcome;
  };
  const replyActions = {
    save: async (caseId: string, text: string, confirmed?: boolean) => applyReply(await saveReply(stateRef.current, caseId, text, { confirmed: confirmed === true })),
    paste: async (caseId: string) => applyReply(await pasteReplyFromClipboard(stateRef.current, caseId, portsRef.current)),
  };

  const exportHtml = async () => {
    const report = await exportReport(stateRef.current, fileEnv, metricFor(stateRef.current.evaluation.metric.id));
    download(report.fileName, report.html, 'text/html');
    say(report.message);
  };

  const loadChecks = async () => {
    const result = await loadChecksFromFile(stateRef.current, portsRef.current, metricFor(stateRef.current.evaluation.metric.id));
    setState(result.state);
    if (result.outcome === 'invalid') {
      setNotice('');
      setProblems(result.problems ?? []);
    } else if (result.outcome === 'loaded') say(result.message);
  };

  const exportCases = async () => {
    const result = await exportTestCases(stateRef.current, portsRef.current, fileEnv);
    say(result.message);
  };

  const rerun = () => {
    const result = editJudgeAndRunAgain(stateRef.current, portsRef.current);
    setState(result.state);
    say(result.note);
  };

  const perform = (action: FileAction | 'edit-judge-and-run-again') => {
    if (action === 'edit-judge-and-run-again') rerun();
    else if (action === 'load-example') setShowExamples(true);
    else if (action === 'start-new-evaluation') {
      setState((s) => startNewEvaluation(s, portsRef.current));
      say('Started a new evaluation.');
    } else if (action === 'load-evaluation') void load('evaluation');
    else if (action === 'load-test-project') void load('project');
    else if (action === 'save-test-project') void save(false, true);
    else if (action === 'save-test-project-as') void save(true, true);
    else if (action === 'import-test-cases') setImporting(true);
    else if (action === 'export-test-cases') void exportCases();
    else onFileAction?.(action, stateRef.current);
  };

  const onFile = (action: FileAction) => {
    const guard = guardFor(state, action as GuardedAction);
    if (guard) setPending(action);
    else perform(action);
  };

  const chooseExample = (example: string) => {
    setShowExamples(false);
    setMetricProblems([]);
    setPendingReplace(null);
    if (example === DEMO) {
      setState((s) => loadExample(s, demoEvaluation, portsRef.current, metricFor('accuracy')));
      say('The demo was loaded.');
    } else {
      const metric = metricFor(example);
      setState((s) => startFromMetric(s, metric, portsRef.current));
      say(`${metric.name} was loaded as the start of a new test project.`);
    }
  };

  const windowOpen = (state.step === 'run' && state.openCase !== null) || (state.step === 'results' && viewCase !== null) || testWindow !== null;
  const gate = stepGate(state, state.step);
  const next = nextAction(state, state.step, reviewed);
  const doIntent = (intent: NextIntent | undefined) => {
    if (intent === 'add') setTestWindow({ view: 'choice' });
    else if (intent === 'finalize') setFinalizing(true);
    else if (intent === 'edit-cases') {
      const result = editTestCases(stateRef.current);
      setState(result.state);
      say(result.note);
    }
  };
  const runAction = () => {
    if (next.action.openCase) setState((s) => ({ ...s, openCase: next.action.openCase ?? null }));
    else if (next.action.go) go(next.action.go);
    else doIntent(next.action.intent);
  };
  const confirmFinalize = () => {
    setFinalizing(false);
    const result = finalize(stateRef.current);
    setState(result.state);
    say(result.note);
  };
  const onRerun = () => {
    if (guardFor(state, 'edit-judge-and-run-again')) setPending('edit-judge-and-run-again');
    else rerun();
  };
  const onResultsContinue = () => setState((s) => continueWork(s));

  return (
    <div class="app">
      <div class="app-page" inert={windowOpen}>
      {browserSupported(browser) ? null : <BrowserNotice />}
      <Header state={state} onGo={go} onFileAction={onFile} />
      <div role="status" aria-label="Message" class={`notice-line${notice ? ' has-message' : ''}${refused ? ' refusal' : ''}`} aria-live="polite">
        {refused && notice ? (
          <>
            <span aria-hidden="true">✕ </span>
            <strong>Not done: </strong>
          </>
        ) : null}
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
            evaluation={state.evaluation}
            reviewed={reviewed}
            onContinue={onResultsContinue}
            onRerun={onRerun}
            onExport={() => void exportHtml()}
            onThreshold={(measure, value) => setState((s) => changeThreshold(s, measure, value))}
            onLoadChecks={() => void loadChecks()}
            onOpenCase={setViewCase}
            differences={recomputeDifferences(state)}
          />
        ) : (
          <>
            <NextBar sentence={next.sentence} detail={next.detail} note={next.note} action={{ label: next.action.label, disabled: next.action.disabled, onClick: runAction }} others={(next.others ?? []).map((o) => ({ label: o.label, disabled: o.disabled, onClick: () => doIntent(o.intent) }))} />
            {state.step === 'run' ? (
              <RunStep
                evaluation={state.evaluation}
                reviewed={reviewed}
                fileName={state.evaluationFile}
                repliesSinceSave={state.repliesSinceSave}
                onOpen={(id) => setState((s) => ({ ...s, openCase: id }))}
                onSave={() => void save(false)}
                onSaveAs={() => void save(true)}
                onModelDetails={(text) => setState((s) => modelDetailsEdit(s, text))}
              />
            ) : state.step === 'judge' ? (
              <JudgeStep state={state} onEdit={applyJudge} />
            ) : state.step === 'cases' ? (
              <CasesStep
                state={state}
                categoriesOpen={categoriesOpen ?? state.evaluation.dataset.cases.length === 0}
                onToggleCategories={() => setCategoriesOpen(!(categoriesOpen ?? state.evaluation.dataset.cases.length === 0))}
                onCatalogEdit={applyCatalog}
                onAdd={() => setTestWindow({ view: 'choice' })}
                onOpen={(id) => setTestWindow({ view: 'open', id })}
                onEdit={applyCase}
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
          reply={replyActions}
        />
      ) : null}
      {state.step === 'results' && viewCase ? (
        <ReadOnlyCaseView
          evaluation={state.evaluation}
          reviewed={reviewed}
          caseId={viewCase}
          onNavigate={setViewCase}
          onClose={() => setViewCase(null)}
          onOpenOnRun={(id) => {
            setViewCase(null);
            setState((s) => ({ ...s, step: 'run', openCase: id }));
          }}
        />
      ) : null}
      <FinalizeDialog open={finalizing} state={state} onConfirm={confirmFinalize} onClose={() => setFinalizing(false)} />
      {testWindow ? <TestCaseWindow state={state} view={testWindow} onView={setTestWindow} onApply={applyCase} /> : null}
      {importing ? (
        <ImportWindow
          open
          onChoose={() => prepareImport(stateRef.current, portsRef.current)}
          onDownloadExample={() => {
            const example = downloadExample(stateRef.current);
            download(example.fileName, example.text, 'text/csv');
            return { fileName: example.fileName, ...(example.note ? { note: example.note } : {}) };
          }}
          onImport={(prepared) => {
            setImporting(false);
            applyCase(applyImport(stateRef.current, prepared.plan));
          }}
          onClose={() => setImporting(false)}
        />
      ) : null}
      <LoadExampleWindow
        key={metricsVersion}
        open={showExamples}
        metrics={sessionRegistry().metrics.map((m) => ({ id: m.id, name: m.name, description: m.description }))}
        onChoose={chooseExample}
        onLoadMetric={() => void loadMetric()}
        onClose={() => {
          setShowExamples(false);
          setMetricProblems([]);
          setPendingReplace(null);
        }}
        problems={metricProblems}
        replace={
          pendingReplace
            ? {
                message: pendingReplace.message,
                onKeep: () => setPendingReplace(null),
                onReplace: () => {
                  if (replaceLoadedMetric(pendingReplace.metric)) {
                    setMetricsVersion((v) => v + 1);
                    say(`The metric ${pendingReplace.metric.name} was replaced.`);
                  }
                  setPendingReplace(null);
                },
              }
            : undefined
        }
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
