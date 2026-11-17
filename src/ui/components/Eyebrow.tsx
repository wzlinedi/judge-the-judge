/**
 * The small label above a main section of a step (FR-091; research.md, 35.5). It is decoration: `aria-hidden` keeps it out of the
 * accessibility tree, so the name of the section and its heading stay the same (SC-049). The texts are not action names, so they are
 * not in labels.ts.
 */
export const EYEBROWS = {
  instructions: 'Step 01 / Instructions',
  sampleOutput: 'Step 01 / Sample output',
  detectionLogic: 'Step 01 / Detection logic',
  livePreview: 'Live preview',
  dataset: 'Step 02 / Dataset',
  runProgress: 'Step 03 / Run progress',
  caseQueue: 'Step 03 / Case queue',
  verdict: 'Step 04 / Verdict',
  errorAnalysis: 'Step 04 / Error analysis',
  caseList: 'Step 04 / Case list',
} as const;

export function Eyebrow({ text }: { text: string }) {
  return (
    <p class="eyebrow" aria-hidden="true">
      {text}
    </p>
  );
}
