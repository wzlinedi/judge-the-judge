// Variables in the judge prompt (research.md, section 8; FR-010).

const VARIABLE = /\{\{([^{}]*)\}\}/g;

/** Names of every `{{name}}` in order of first appearance, without repeats. */
export function findVariables(prompt: string): string[] {
  const names: string[] = [];
  for (const match of prompt.matchAll(VARIABLE)) {
    const name = (match[1] ?? '').trim();
    if (name !== '' && !names.includes(name)) names.push(name);
  }
  return names;
}

export interface JudgedTextProposal {
  name: string | undefined;
  /** Said to the user when the proposal replaced a variable that left the prompt. */
  note?: string;
}

/** The variable to use as the judged text: the current one while it still exists, else the last. */
export function proposeJudgedText(variables: readonly string[], current: string | undefined): JudgedTextProposal {
  if (variables.length === 0) return { name: undefined };
  if (current !== undefined && current !== '' && variables.includes(current)) return { name: current };
  const last = variables[variables.length - 1] as string;
  if (current !== undefined && current !== '') {
    return { name: last, note: `The variable "${current}" is no longer in the prompt, so "${last}" is now the judged text.` };
  }
  return { name: last };
}
