import { DemoData } from './sections/DemoData';
import { Files } from './sections/Files';
import { FourSteps } from './sections/FourSteps';
import { Privacy } from './sections/Privacy';
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
      <Files />
      <Privacy />
      <DemoData />
      <ReadingResults />
    </div>
  );
}
