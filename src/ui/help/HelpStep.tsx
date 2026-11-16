import { DemoData } from './sections/DemoData';
import { AddingCases } from './sections/AddingCases';
import { ErrorCategories } from './sections/ErrorCategories';
import { StartingTheRun } from './sections/StartingTheRun';
import { FileFormats } from './sections/FileFormats';
import { Files } from './sections/Files';
import { ImportingCases } from './sections/ImportingCases';
import { FourSteps } from './sections/FourSteps';
import { MetricsAndChecks } from './sections/MetricsAndChecks';
import { MarkingAfterReplies } from './sections/MarkingAfterReplies';
import { ResultsHelp } from './sections/ResultsHelp';
import { Privacy } from './sections/Privacy';
import { VerdictJudges } from './sections/VerdictJudges';
import { WorkingByHand } from './sections/WorkingByHand';
import { SampleReplyRules } from './sections/SampleReplyRules';
import { ReadingResults } from './sections/ReadingResults';
import { TestSize } from './sections/TestSize';
import { Variables } from './sections/Variables';
import { WhatTheToolDoes } from './sections/WhatTheToolDoes';

/** The sections of Help in the order of the page: the list at the top links to each of them (T225). The titles are the headings of the sections; a test keeps the two in step. */
export const HELP_SECTIONS: ReadonlyArray<{ id: string; title: string }> = [
  { id: 'help-what', title: 'What the tool does' },
  { id: 'help-size', title: 'How big a test needs to be' },
  { id: 'help-steps', title: 'The four steps' },
  { id: 'help-variables', title: 'Variables and the judged text' },
  { id: 'help-rules', title: 'Sample reply, fields and error rules' },
  { id: 'help-cases', title: 'Adding test cases' },
  { id: 'help-import', title: 'Importing test cases from a file' },
  { id: 'help-categories', title: 'Error categories' },
  { id: 'help-start', title: 'Starting the test run' },
  { id: 'help-by-hand', title: 'Working by hand: copy, run, paste' },
  { id: 'help-paste', title: 'Pasting replies from the clipboard, and replacing a reply' },
  { id: 'help-marking', title: 'Marking after each reply: Add finding, Remove, the second opinion and Ignored' },
  { id: 'help-files', title: 'Files: the test project' },
  { id: 'help-formats', title: 'Files and their formats' },
  { id: 'help-privacy', title: 'Privacy and saving' },
  { id: 'help-demo', title: 'Examples and demo data' },
  { id: 'help-metrics', title: 'Metrics and check rules' },
  { id: 'help-results', title: 'Reading the results' },
  { id: 'help-verdict', title: 'Judges that give only a verdict (for example bias: yes or no)' },
  { id: 'help-overall', title: 'Overall result and thresholds' },
  { id: 'help-export', title: 'Exporting the report' },
];

/** Help is a screen of the application (Principle VIII). Each phase adds the sections for what it builds. */
export function HelpStep() {
  return (
    <div class="help-step">
      <h2>Help</h2>
      <nav aria-label="Help sections" class="help-toc">
        <ul>
          {HELP_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>
      <WhatTheToolDoes />
      <TestSize />
      <FourSteps />
      <Variables />
      <SampleReplyRules />
      <AddingCases />
      <ImportingCases />
      <ErrorCategories />
      <StartingTheRun />
      <WorkingByHand />
      <MarkingAfterReplies />
      <Files />
      <FileFormats />
      <Privacy />
      <DemoData />
      <MetricsAndChecks />
      <ReadingResults />
      <VerdictJudges />
      <ResultsHelp />
    </div>
  );
}
