import { DemoData } from './sections/DemoData';
import { AddingCases } from './sections/AddingCases';
import { ErrorCategories } from './sections/ErrorCategories';
import { FinalizingHelp } from './sections/FinalizingHelp';
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

/** Help is a screen of the application (Principle VIII). Each phase adds the sections for what it builds. */
export function HelpStep() {
  return (
    <div class="help-step">
      <h2>Help</h2>
      <WhatTheToolDoes />
      <TestSize />
      <FourSteps />
      <Variables />
      <SampleReplyRules />
      <AddingCases />
      <ImportingCases />
      <ErrorCategories />
      <FinalizingHelp />
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
