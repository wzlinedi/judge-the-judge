// T284: the list of expected errors under the JSON box of the test case window offers "Show the issue" (FR-085).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleProject } from '../../helpers/fixtures';
import { withoutTestRun } from '../../../src/core/cases/test-run';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const draft = (): AppState => {
  const e = sampleProject();
  return { ...createState(), step: 'cases', project: withoutTestRun(e) };
};
const win = () => screen.getByRole('dialog', { name: 'Test case' });
const answer = JSON.stringify({
  name: 'Anna with errors',
  fields: { source_text: 'Anna is a baker. She bought a second oven in 1998.', summary: 'Anna is a doctor. She bought a second oven in 2005.' },
  expected_errors: [
    { category: 'factual-error', fragment: 'Anna is a doctor', description: 'Profession changed', difficulty: 'obvious' },
    { category: 'wrong-number', description: 'Year changed, no fragment', difficulty: 'subtle' },
  ],
});
const open = (choice: 'From JSON' | 'Case with errors') => {
  render(<App ports={createFakePorts()} env={env} initialState={draft()} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Add test case…' })[0]!);
  fireEvent.click(within(win()).getByRole('button', { name: choice }));
  fireEvent.input(within(win()).getByLabelText('Case JSON'), { target: { value: answer } });
};

describe.each(['From JSON', 'Case with errors'] as const)('%s: Show the issue under the box (T284)', (choice) => {
  it('offers it for an error whose passage is in the case, and pressing it marks the passage', () => {
    Element.prototype.scrollIntoView = vi.fn();
    open(choice);
    const items = within(within(win()).getByRole('list', { name: 'Expected errors' })).getAllByRole('listitem');
    expect(within(items[0]!).getByRole('button', { name: 'Show the issue' })).toBeTruthy();
    expect(within(items[1]!).queryByRole('button', { name: 'Show the issue' })).toBeNull();
    expect(win().querySelectorAll('.marked-fields .fragment-strong')).toHaveLength(0);
    fireEvent.click(within(items[0]!).getByRole('button', { name: 'Show the issue' }));
    expect(win().querySelector('.marked-fields .fragment-strong')?.textContent).toContain('Anna is a doctor');
  });
});
