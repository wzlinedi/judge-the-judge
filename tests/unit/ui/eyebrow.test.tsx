// T437 (FR-091, SC-049; research.md, 35.5): a small hidden label above the main sections of each step. The label is markup with aria-hidden, so
// the accessible names of the sections, headings and buttons stay as they were.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';
import { Eyebrow } from '../../../src/ui/components/Eyebrow';
import { JudgeStep } from '../../../src/ui/steps/judge/JudgeStep';
import { CasesStep } from '../../../src/ui/steps/cases/CasesStep';
import { RunStep } from '../../../src/ui/steps/run/RunStep';
import { ResultsStep } from '../../../src/ui/steps/results/ResultsStep';
import { createState, type AppState } from '../../../src/app/store';
import { computeResults, reviewEvaluation } from '../../../src/core/evaluation/results';
import { readTestProject } from '../../../src/core/io/test-project-file';
import type { TestProject } from '../../../src/core/model';
import { accuracyMetric, sampleProject, withRun } from '../../helpers/fixtures';

const LABELS = [
  'Step 01 / Instructions',
  'Step 01 / Sample output',
  'Step 01 / Detection logic',
  'Live preview',
  'Step 02 / Dataset',
  'Step 03 / Run progress',
  'Step 03 / Case queue',
  'Step 04 / Verdict',
  'Step 04 / Error analysis',
  'Step 04 / Case list',
];

const loaded = readTestProject(readFileSync('examples/demo/test-project.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const decisionsAfter = JSON.parse(readFileSync('examples/demo/expected-results.json', 'utf8')).decisions_after;
const decided: TestProject = withRun(loaded.value.project, { decisions: decisionsAfter });
const stateOf = (step: AppState['step'], project: TestProject): AppState => ({ ...createState(), step, project });

/** The label with this text: a <p class="eyebrow" aria-hidden="true">. */
function label(text: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('.eyebrow')].filter((e) => e.textContent === text);
  expect(found, `the label "${text}"`).toHaveLength(1);
  const element = found[0] as HTMLElement;
  expect(element.tagName).toBe('P');
  expect(element.getAttribute('aria-hidden')).toBe('true');
  return element;
}
/** The label comes right before the heading with this name, in the same parent. */
function rightBefore(text: string, heading: string) {
  const next = label(text).nextElementSibling as HTMLElement;
  expect(next?.tagName, `after "${text}"`).toBe('H2');
  expect(next.textContent).toBe(heading);
}
/** The label comes right before the .list-head that holds the heading. */
function beforeListHead(text: string, heading: string) {
  const next = label(text).nextElementSibling as HTMLElement;
  expect(next?.classList.contains('list-head'), `after "${text}"`).toBe(true);
  expect(next.querySelector('h2')?.textContent).toBe(heading);
}
/** The label is the first child of the view. */
function firstOf(text: string, view: string) {
  const element = label(text);
  expect(element.parentElement?.classList.contains(view), `"${text}" is in .${view}`).toBe(true);
  expect(element.parentElement?.firstElementChild).toBe(element);
}
/** No element with a role carries a label text in its accessible name or its own aria-label. */
function noLabelInNames() {
  for (const element of document.querySelectorAll<HTMLElement>('[role], section[aria-label], section[aria-labelledby], button, h2, table')) {
    const name = element.getAttribute('aria-label') ?? '';
    const by = element.getAttribute('aria-labelledby');
    const labelled = by ? by.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
    const own = element.tagName === 'H2' || element.tagName === 'BUTTON' ? (element.textContent ?? '') : '';
    for (const text of [...LABELS, 'Step 0']) expect(`${name} ${labelled} ${own}`, element.outerHTML.slice(0, 80)).not.toContain(text);
  }
}

describe('Eyebrow (research.md, 35.5)', () => {
  it('renders a paragraph with the class eyebrow, hidden from assistive technology, with its text', () => {
    render(<Eyebrow text="Step 01 / Instructions" />);
    label('Step 01 / Instructions');
  });
});

describe('the section labels of each step (SC-049)', () => {
  it('Judge: three labels before the headings of the sections, and "Live preview" before Preview', () => {
    render(<JudgeStep state={stateOf('judge', sampleProject())} onEdit={vi.fn()} />);
    rightBefore('Step 01 / Instructions', 'Prompt and variables');
    rightBefore('Step 01 / Sample output', 'Sample reply and fields');
    rightBefore('Step 01 / Detection logic', 'Error rules');
    rightBefore('Live preview', 'Preview');
    for (const name of ['Prompt and variables', 'Sample reply and fields', 'Error rules', 'Preview']) {
      expect(screen.getByRole('heading', { name, level: 2 })).toBeTruthy();
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    noLabelInNames();
  });

  it('Test cases: "Step 02 / Dataset" right before the head of the list', () => {
    render(<CasesStep state={stateOf('cases', sampleProject())} onAdd={vi.fn()} onOpen={vi.fn()} onEdit={vi.fn()} categoriesOpen={false} onToggleCategories={vi.fn()} onCatalogEdit={vi.fn()} />);
    beforeListHead('Step 02 / Dataset', 'Test cases');
    expect(screen.getByRole('heading', { name: 'Test cases', level: 2 })).toBeTruthy();
    noLabelInNames();
  });

  it('Test run: "Step 03 / Run progress" before Progress and "Step 03 / Case queue" before the head of the list of cases', () => {
    const evaluation = sampleProject();
    render(<RunStep evaluation={evaluation} reviewed={reviewEvaluation(evaluation, accuracyMetric)} repliesSinceSave={0} onOpen={vi.fn()} onAdd={vi.fn()} onModelDetails={vi.fn()} />);
    rightBefore('Step 03 / Run progress', 'Progress');
    beforeListHead('Step 03 / Case queue', 'Cases');
    expect(screen.getByRole('region', { name: 'Progress' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Cases' })).toBeTruthy();
    noLabelInNames();
  });

  it('Results: one label as the first child of each of the three views', () => {
    render(<ResultsStep evaluation={decided} reviewed={reviewEvaluation(decided, accuracyMetric)} results={computeResults(decided, accuracyMetric)} onExport={vi.fn()} onThreshold={vi.fn()} onOpenCase={vi.fn()} />);
    firstOf('Step 04 / Verdict', 'summary-view');
    expect(screen.getByRole('heading', { name: 'Summary', level: 2 })).toBeTruthy();
    noLabelInNames();
    fireEvent.click(screen.getByRole('tab', { name: 'Error analysis' }));
    firstOf('Step 04 / Error analysis', 'analysis-view');
    expect(screen.getByRole('heading', { name: 'Error analysis', level: 2 })).toBeTruthy();
    noLabelInNames();
    fireEvent.click(screen.getByRole('tab', { name: 'Test case list' }));
    firstOf('Step 04 / Case list', 'case-list-view');
    expect(screen.getByRole('heading', { name: 'Test case list', level: 2 })).toBeTruthy();
    noLabelInNames();
  });
});
