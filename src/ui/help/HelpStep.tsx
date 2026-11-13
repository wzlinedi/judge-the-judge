import { DemoData } from './sections/DemoData';
import { FourSteps } from './sections/FourSteps';
import { ReadingResults } from './sections/ReadingResults';
import { TestSize } from './sections/TestSize';
import { WhatTheToolDoes } from './sections/WhatTheToolDoes';

/** Help is a screen of the application (Principle VIII). Each phase adds the sections for what it builds. */
export function HelpStep() {
  return (
    <div class="help-step">
      <h2>Help</h2>
      <WhatTheToolDoes />
      <TestSize />
      <FourSteps />
      <DemoData />
      <ReadingResults />
    </div>
  );
}
