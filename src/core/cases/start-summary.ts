// What the user sees before the test run starts, and whether starting it is allowed (FR-052).
// Warnings never stop the start: they say what the result will not be able to tell, and the user decides.
import { composePrompt } from '../judge/compose';
import { readabilityWarnings } from '../judge/readability';
import type { TestProject } from '../model';
import { testProjectFeedback, type TestProjectFeedback } from './feedback';

export interface StartSummary {
  /** False only when there is nothing to finalize: no test cases, or an empty judge prompt. */
  allowed: boolean;
  /** One plain sentence saying why finalizing is refused and what to do. */
  refusal?: string;
  /** Counts, balance and the test size against the minimums. */
  feedback: TestProjectFeedback;
  warnings: string[];
}

function list(ids: readonly string[]): string {
  return ids.length <= 2 ? ids.join(' and ') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/** One warning for each variable that some cases have no field for: the cases are named together. */
function missingFieldWarnings(evaluation: Pick<TestProject, 'dataset' | 'judge_set'>): string[] {
  const byVariable = new Map<string, string[]>();
  for (const testCase of evaluation.dataset.cases) {
    for (const variable of composePrompt(evaluation.judge_set.prompt, testCase).missing) {
      byVariable.set(variable, [...(byVariable.get(variable) ?? []), testCase.id]);
    }
  }
  return [...byVariable.entries()].map(([variable, ids]) => `${ids.length === 1 ? 'Case' : 'Cases'} ${list(ids)} ${ids.length === 1 ? 'has' : 'have'} no field for the variable "${variable}"; it will be empty in the prompt.`);
}

export function startSummary(evaluation: Pick<TestProject, 'dataset' | 'judge_set' | 'testRun'>): StartSummary {
  const feedback = testProjectFeedback(evaluation);
  const warnings = [...feedback.warnings, ...readabilityWarnings(evaluation.judge_set), ...missingFieldWarnings(evaluation)];
  if (!feedback.size.errors.met || !feedback.size.clean.met) warnings.push(feedback.size.sentence);
  const unique = [...new Set(warnings)];

  if (evaluation.dataset.cases.length === 0) {
    return { allowed: false, refusal: 'There are no test cases to run. Add a test case, or import test cases from the File menu.', feedback, warnings: unique };
  }
  if (evaluation.judge_set.prompt.trim() === '') {
    return { allowed: false, refusal: 'The judge prompt is empty. Write it on the Judge step, then start the test run.', feedback, warnings: unique };
  }
  return { allowed: true, feedback, warnings: unique };
}
