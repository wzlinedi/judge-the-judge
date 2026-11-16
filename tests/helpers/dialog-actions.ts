import { expect } from 'vitest';

/** The buttons of the bar at the bottom of a dialog, in the order the user sees them. */
export const dialogButtons = (dialog: HTMLElement): HTMLButtonElement[] =>
  Array.from(dialog.querySelectorAll<HTMLButtonElement>('.dialog-actions button'));

/**
 * FR-093, T337: the buttons start with the way out ("Cancel", "Close" or "Keep editing") and end with the main action,
 * which is the only `primary`. `names` is the order that the dialog must have.
 */
export function expectCancelFirstMainLast(dialog: HTMLElement, names: string[]): void {
  const buttons = dialogButtons(dialog);
  expect(buttons.map((b) => b.textContent)).toEqual(names);
  expect(buttons.filter((b) => b.classList.contains('primary'))).toEqual([buttons[buttons.length - 1]]);
}
