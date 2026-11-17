import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import demoProject from '../../examples/demo/test-project.json?raw';
import { loadExample } from '../app/actions/demo';
import { changeThreshold } from '../app/actions/checks';
import { correctRules } from '../app/actions/decide';
import { exportReport } from '../app/actions/export';
import { modelDetailsEdit, pasteReplyFromClipboard, saveReply, type ReplyOutcome } from '../app/actions/replies';
import type { CaseEdit } from '../app/actions/cases';
import type { CatalogEdit } from '../app/actions/catalog';
import type { JudgeEdit } from '../app/actions/judge';
import { finishLoad, loadTestProject, saveTestProject, saveTestProjectAs, type FileEnv, type PendingLoad } from '../app/actions/files';
import { guardFor, installBeforeUnload, replaceQuestion, type GuardedAction, type ReplaceQuestion } from '../app/guard';
import { metricFor } from '../app/metrics';
import { browserSupported, type BrowserEnv } from '../app/ports/browser';
import { createBrowserPorts } from '../app/ports';
import type { Ports } from '../app/ports/types';
import { nextAction, stepGate, type NextIntent } from '../app/selectors';
import { startTestRun } from '../app/actions/start';
import { createState, goToStep, recomputeDifferences, startNewTestProject, type AppState, type StepId } from '../app/store';
import { computeResults, reviewEvaluation } from '../core/evaluation/results';
import type { TestProject, Problem } from '../core/model';
import { Dialog } from './components/Dialog';
import { ErrorBoundary, ErrorPanel } from './components/ErrorPanel';
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
import { StartTestRunDialog } from './steps/cases/StartTestRunDialog';
import { JudgeStep } from './steps/judge/JudgeStep';
import { RunStep } from './steps/run/RunStep';
import { CaseWindow } from './windows/case-window/CaseWindow';
import { ReadOnlyCaseView } from './windows/case-window/ReadOnlyCaseView';
import { TestCaseWindow, type TestWindowView } from './windows/test-case/TestCaseWindow';
import { ImportWindow } from './windows/import/ImportWindow';
import { applyImport, downloadExample, exportTestCases, prepareImport } from '../app/actions/test-cases-file';
import { download } from './components/download';

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
  const [pending, setPending] = useState<FileAction | null>(null);
  const [replacing, setReplacing] = useState<{ action: FileAction; question: ReplaceQuestion } | null>(null);
  const [onlyAwaiting, setOnlyAwaiting] = useState(false);
  const [notice, setNotice] = useState('');
  /** True when the message says that something was not done: it is shown as a refusal, with a word and a sign. */
  const [refused, setRefused] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState<boolean | undefined>(undefined);
  const [testWindow, setTestWindow] = useState<TestWindowView | null>(null);
  const [importing, setImporting] = useState(false);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  /** A file that holds a test run, waiting for the choice "Load with the test run" or "Load the test project only". */
  const [loadQuestion, setLoadQuestion] = useState<PendingLoad | null>(null);
  const [viewCase, setViewCase] = useState<string | null>(null);
  const portsRef = useRef<Ports>(ports ?? createBrowserPorts(browser, () => stateRef.current.project.dataset.name));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return installBeforeUnload(window, () => stateRef.current);
  }, []);

  const metric = metricFor(state.project.metric.id);
  // computed here, above the ErrorBoundary: a throw is caught and shows the same panel, never a blank page (Constitution IX, T411)
  const computed = useMemo(() => {
    try {
      return { reviewed: reviewEvaluation(state.project, metric), results: computeResults(state.project, metric) };
    } catch (error) {
      return { error };
    }
  }, [state.project, metric]);

  const go = (step: StepId) => setState((s) => goToStep(s, step));
  const change = (next: TestProject) => setState((s) => ({ ...s, project: next, unsaved: true }));

  const say = (message: string | undefined, refusal = false) => {
    setProblems([]);
    setNotice(message ?? '');
    setRefused(refusal && message !== undefined);
  };

  const save = async (as: boolean): Promise<{ saved: boolean; message: string | undefined }> => {
    const action = as ? saveTestProjectAs : saveTestProject;
    const result = await action(stateRef.current, portsRef.current, fileEnv);
    // the work may have changed while the file was written: apply only what the save changed (R1)
    setState((current) => (result.apply ? result.apply(current) : current));
    const message = result.message ?? (result.outcome === 'saved' ? 'The test project was saved.' : result.outcome === 'cancelled' ? 'Nothing was saved.' : undefined);
    say(message, result.outcome === 'too_large');
    return { saved: result.outcome === 'saved', message };
  };

  const show = (result: Awaited<ReturnType<typeof loadTestProject>>) => {
    setState(result.state);
    if (result.outcome === 'invalid') {
      setNotice('');
      setProblems(result.problems ?? []);
    } else if (result.outcome === 'loaded') say(result.message);
    else if (result.outcome === 'needs_choice') setLoadQuestion(result.pending ?? null);
  };

  const load = async () => show(await loadTestProject(stateRef.current, portsRef.current, fileEnv));

  const answerLoad = async (choice: 'with' | 'only') => {
    const pending = loadQuestion;
    setLoadQuestion(null);
    if (pending) show(await finishLoad(stateRef.current, portsRef.current, pending, choice));
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

  const applyJudge = (result: JudgeEdit) => {
    const corrected = correctRules(stateRef.current, result, metric);
    setState(corrected.state);
    say(corrected.note);
  };

  const applyReply = (outcome: ReplyOutcome): ReplyOutcome => {
    // the user may have moved or edited while the clipboard or the hash was awaited: apply only the change of the case (R2)
    setState((current) => (outcome.apply ? outcome.apply(current) : current));
    return outcome;
  };
  const replyActions = {
    save: async (caseId: string, text: string, confirmed?: boolean) => applyReply(await saveReply(stateRef.current, caseId, text, { confirmed: confirmed === true })),
    paste: async (caseId: string, confirmed?: boolean) => applyReply(await pasteReplyFromClipboard(stateRef.current, caseId, portsRef.current, { confirmed: confirmed === true })),
  };

  const exportHtml = async () => {
    const report = await exportReport(stateRef.current, fileEnv, metricFor(stateRef.current.project.metric.id));
    download(report.fileName, report.html, 'text/html');
    say(report.message);
  };

  const exportCases = async () => {
    const result = await exportTestCases(stateRef.current, portsRef.current, fileEnv);
    say(result.message);
  };

  const perform = (action: FileAction) => {
    if (action === 'load-example') loadDemo();
    else if (action === 'start-new-evaluation') {
      setState((s) => startNewTestProject(s, portsRef.current));
      say('Started a new test project.');
    } else if (action === 'load-test-project') void load();
    else if (action === 'save-test-project') void save(false);
    else if (action === 'save-test-project-as') void save(true);
    else if (action === 'import-test-cases') setImporting(true);
    else if (action === 'export-test-cases') void exportCases();
    else onFileAction?.(action, stateRef.current);
  };

  const onFile = (action: FileAction) => {
    const guard = guardFor(state, action as GuardedAction);
    if (guard) setPending(action);
    else {
      const question = replaceQuestion(state, action as GuardedAction);
      if (question) setReplacing({ action, question });
      else perform(action);
    }
  };

  const loadDemo = () => {
    setState((s) => loadExample(s, demoProject, portsRef.current));
    say('The demo was loaded. It opens on the Judge step.');
  };

  if ('error' in computed) {
    return (
      <div class="app">
        <ErrorPanel error={computed.error} onSave={async () => (await save(true)).message} />
      </div>
    );
  }
  const { reviewed, results } = computed;

  const windowOpen = (state.step === 'run' && state.openCase !== null) || (state.step === 'results' && viewCase !== null) || testWindow !== null;
  const gate = stepGate(state, state.step);
  const next = nextAction(state, state.step, reviewed);
  const doIntent = (intent: NextIntent | undefined) => {
    if (intent === 'start') setStartDialogOpen(true);
  };
  const runAction = () => {
    if (next.action.openCase) setState((s) => ({ ...s, openCase: next.action.openCase ?? null }));
    else if (next.action.go) go(next.action.go);
    else doIntent(next.action.intent);
  };
  const confirmStart = () => {
    setStartDialogOpen(false);
    const result = startTestRun(stateRef.current);
    setState(result.state);
    say(result.note);
  };

  return (
    <div class="app">
      <ErrorBoundary onSave={async () => (await save(true)).message}>
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
            evaluation={state.project}
            reviewed={reviewed}
            onExport={() => void exportHtml()}
            onThreshold={(measure, value) => setState((s) => changeThreshold(s, measure, value))}
            onOpenCase={setViewCase}
            differences={recomputeDifferences(state)}
          />
        ) : (
          <>
            <NextBar sentence={next.sentence} detail={next.detail} note={next.note} action={{ label: next.action.label, disabled: next.action.disabled, onClick: runAction }} />
            {state.step === 'run' ? (
              <RunStep
                evaluation={state.project}
                reviewed={reviewed}
                repliesSinceSave={state.repliesSinceSave}
                onOpen={(id) => setState((s) => ({ ...s, openCase: id }))}
                onAdd={() => setTestWindow({ view: 'choice' })}
                onModelDetails={(text) => setState((s) => modelDetailsEdit(s, text))}
              />
            ) : state.step === 'judge' ? (
              <JudgeStep state={state} onEdit={applyJudge} onLoad={() => onFile('load-test-project')} />
            ) : state.step === 'cases' ? (
              <CasesStep
                state={state}
                categoriesOpen={categoriesOpen ?? state.project.dataset.cases.length === 0}
                onToggleCategories={() => setCategoriesOpen(!(categoriesOpen ?? state.project.dataset.cases.length === 0))}
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
          evaluation={state.project}
          reviewed={reviewed}
          caseId={state.openCase}
          onChange={change}
          onNavigate={(id) => setState((s) => ({ ...s, openCase: id }))}
          onClose={() => setState((s) => ({ ...s, openCase: null }))}
          onlyAwaiting={onlyAwaiting}
          onOnlyAwaitingChange={setOnlyAwaiting}
          repliesSinceSave={state.repliesSinceSave}
          reply={replyActions}
        />
      ) : null}
      {state.step === 'results' && viewCase ? (
        <ReadOnlyCaseView
          evaluation={state.project}
          reviewed={reviewed}
          caseId={viewCase}
          onNavigate={setViewCase}
          onClose={() => setViewCase(null)}
          onOpenOnTestRun={(id) => {
            setViewCase(null);
            setState((s) => ({ ...s, step: 'run', openCase: id }));
          }}
        />
      ) : null}
      <StartTestRunDialog open={startDialogOpen} state={state} onConfirm={confirmStart} onClose={() => setStartDialogOpen(false)} />
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
      <Dialog
        open={loadQuestion !== null}
        title="Load test project"
        onClose={() => setLoadQuestion(null)}
        actions={
          <>
            <button type="button" onClick={() => setLoadQuestion(null)}>
              {labels.cancel}
            </button>
            <button type="button" onClick={() => void answerLoad('only')}>
              {labels.loadTestProjectOnly}
            </button>
            <button type="button" class="primary" onClick={() => void answerLoad('with')}>
              {labels.loadWithTestRun}
            </button>
          </>
        }
      >
        <p>{`${loadQuestion?.fileName ?? 'This file'} holds a test run. Load it with the test run, or load the test project only: the same test cases and judge for a new test run?`}</p>
      </Dialog>
      <Dialog
        open={replacing !== null}
        title={replacing?.question.title ?? 'Replace the current work?'}
        onClose={() => setReplacing(null)}
        actions={
          <>
            <button type="button" onClick={() => setReplacing(null)}>
              {labels.cancel}
            </button>
            <button
              type="button"
              class="primary"
              onClick={() => {
                const action = replacing?.action;
                setReplacing(null);
                if (action) perform(action);
              }}
            >
              {replacing?.question.confirm}
            </button>
          </>
        }
      >
        <p>{replacing?.question.text}</p>
      </Dialog>
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
                if (action && (await save(false)).saved) {
                  setPending(null);
                  perform(action);
                }
              }}
            >
              {labels.saveTestProjectFirst}
            </button>
          </>
        }
      >
        <p>You have unsaved changes. What do you want to do with them?</p>
      </Dialog>
      </ErrorBoundary>
    </div>
  );
}
