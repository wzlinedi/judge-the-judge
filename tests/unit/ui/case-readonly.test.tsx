// "Open": a saved case read-only (FR-078, FR-086, SC-034, SC-036), the parts new in this phase.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const draft = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {} } };
};
const show = (state = draft()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const open = (name: string) => fireEvent.click(within(screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement).getByRole('button', { name: 'Open' }));
const view = () => screen.getByRole('dialog', { name: /Anna \+ 2 errors/ });

describe('the read-only view', () => {
  it('numbers and highlights the expected errors and offers Show the issue for each', () => {
    show();
    open('Anna + 2 errors');
    expect(view().querySelectorAll('mark[data-error]')).toHaveLength(2);
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(within(view()).getAllByRole('button', { name: 'Show the issue' })[0]!);
    expect(view().querySelector('mark.fragment-strong')?.textContent).toContain('Anna is a doctor');
  });

  it('shows the check line for a case with a base', () => {
    show();
    open('Anna + 2 errors');
    expect(within(view()).getByText('Text and list agree')).toBeTruthy();
  });

  it('has no control that edits the case: only read-only boxes', () => {
    show();
    open('Anna + 2 errors');
    const editable = within(view()).queryAllByRole('textbox').filter((t) => !(t as HTMLTextAreaElement).readOnly);
    expect(editable).toHaveLength(0);
    for (const name of ['Modify', 'Edit by hand', 'Describe errors again', 'Compare with base', 'Use selected text as fragment']) {
      expect(within(view()).queryByRole('button', { name })).toBeNull();
    }
  });

  it('has no Clone and no Show JSON: a copy is made with Recreate the test case or Export test cases (T218, T238)', () => {
    show();
    open('Anna + 2 errors');
    expect(within(view()).queryByRole('button', { name: 'Clone' })).toBeNull();
    expect(within(view()).queryByRole('button', { name: 'Show JSON' })).toBeNull();
    expect(within(view()).getByRole('button', { name: 'Recreate the test case' })).toBeTruthy();
  });
});
