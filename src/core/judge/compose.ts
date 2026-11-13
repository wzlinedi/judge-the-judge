// Prompt composition (research.md, section 8; FR-047): variables are replaced by the case's fields,
// field text is inserted literally and never scanned again, and nothing is added.
import type { TestCase } from '../model';

const VARIABLE = /\{\{([^{}]*)\}\}/g;

export interface ComposedPrompt {
  text: string;
  /** Variables the case has no field for; each became empty text. */
  missing: string[];
}

export function composePrompt(prompt: string, testCase: Pick<TestCase, 'fields'>): ComposedPrompt {
  const missing: string[] = [];
  const text = prompt.replace(VARIABLE, (whole, raw: string) => {
    const name = raw.trim();
    if (name === '') return whole;
    if (Object.hasOwn(testCase.fields, name)) return testCase.fields[name] as string;
    if (!missing.includes(name)) missing.push(name);
    return '';
  });
  return { text, missing };
}
