// The action names of FR-008, used by every component. One key per name; no two keys share a label.
export const labels = {
  // More menu and header
  more: 'More',
  help: 'Help',
  loadTestProject: 'Load test project…',
  loadWithTestRun: 'Load with the test run',
  loadTestProjectOnly: 'Load the test project only',
  saveTestProject: 'Save test project',
  saveTestProjectAs: 'Save test project as…',
  importTestCases: 'Import test cases…',
  exportTestCases: 'Export test cases…',
  loadExample: 'Load demo…',
  loadMetricDefinition: 'Load metric definition…',
  startNewTestProject: 'New test project',
  saveTestProjectFirst: 'Save test project first',
  startNewEvaluation: 'New evaluation', // legacy, read by Help (T225)
  // Legacy: the one-file flow has no evaluation file. Help still reads these keys; they go with the Help update (T225).
  loadEvaluation: 'Load evaluation…',
  saveEvaluation: 'Save evaluation',
  saveEvaluationAs: 'Save evaluation as…',
  saveEvaluationFirst: 'Save evaluation first',
  discard: 'Discard',
  cancel: 'Cancel',
  // "What next" line
  continue: 'Continue',
  next: 'Next',
  nextTestCases: 'Next: Test cases',
  nextResults: 'Next: Results',
  explain: 'Explain',
  goToTestCases: 'Go to Test cases',
  // Browsing the test cases
  clearFilters: 'Clear search and filters',
  // Judge
  addRule: 'Add rule',
  addCondition: 'Add condition',
  remove: 'Remove',
  // Test cases
  /** No button has this label any more (T248). It stays only because the Help still quotes it (T225). */
  addCategory: 'Add categories',
  addOneCategory: 'Add category',
  rename: 'Rename',
  addTestCase: 'Add test case…',
  open: 'Open',
  /** No button has this label any more (T218). It stays only because the Help still quotes it; the Help update at the end removes both (T225). */
  clone: 'Clone',
  startTestRun: 'Start test run',
  // Old names kept only because Help (src/ui/help) still reads them; removed with the Help update (T225).
  finalizeTestCases: 'Finalize test cases…',
  editTestCases: 'Reopen test cases',
  editJudgeAndRunAgain: 'Run again with a new judge…',
  downloadExampleFile: 'Download example file',
  // Test case window
  pasteJson: 'From JSON',
  cleanCase: 'Clean case',
  caseWithInjectedErrors: 'Case with errors',
  addError: 'Add error',
  back: 'Back',
  copyPrompt: 'Copy prompt',
  showFullPrompt: 'Show prompt',
  showInText: 'Show the issue',
  saveCase: 'Save case',
  closeWithoutSaving: 'Close without saving',
  rebuildPrompt: 'Rebuild prompt',
  showJson: 'Show JSON',
  correctExpectedErrors: 'Edit expected errors',
  saveExpectedErrors: 'Save expected errors',
  previousTestCase: 'Previous case',
  nextTestCase: 'Next case',
  close: 'Close',
  // Run
  pasteReplyFromClipboard: 'Paste reply',
  saveReply: 'Save reply',
  changeReply: 'Change reply',
  saveAsTextAnyway: 'Keep as text',
  found: 'Found',
  issueMissed: 'Not found',
  issueFalsePositive: 'False positive',
  realError: 'Genuine error',
  ignore: 'Ignored',
  approve: 'Approve',
  noMoreFindings: 'No more findings',
  addFinding: 'Add finding…',
  secondOpinion: 'Second opinion…',
  applyOpinion: 'Apply opinion',
  // Results
  summary: 'Summary',
  errorAnalysis: 'Error analysis',
  testCaseList: 'Test case list',
  exportHtmlReport: 'Export HTML report…',
  loadCheckSettings: 'Load check settings…',
} as const;

export type LabelKey = keyof typeof labels;
