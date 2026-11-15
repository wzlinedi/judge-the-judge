// "Open": a saved case read-only (FR-078, FR-086, SC-034, SC-036), the parts new in this phase.
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
const show = (state = draft()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const open = (name: string) => fireEvent.click(within(screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement).getByRole('button', { name: 'Open' }));
const view = () => screen.getByRole('dialog', { name: /Anna \+ 2 errors/ });

describe('the read-only view', () => {
  it('highlights nothing at first, and Show the issue highlights the error (T257)', () => {
    show();
    open('Anna + 2 errors');
    expect(view().querySelectorAll('[data-error]')).toHaveLength(2);
    expect(view().querySelectorAll('.marked-fields .fragment')).toHaveLength(0);
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(within(view()).getAllByRole('button', { name: 'Show the issue' })[0]!);
    expect(view().querySelector('.fragment-strong')?.textContent).toContain('Anna is a doctor');
  });

  it('shows both sides of an error, the source first, and Show the issue highlights both passages (T251)', () => {
    const state = draft();
    const cases = state.project.dataset.cases.map((c, i) => (i === 1 ? { ...c, expected_errors: c.expected_errors.map((x, n) => (n === 0 ? { ...x, source_fragment: 'Anna is a baker' } : x)) } : c));
    show({ ...state, project: { ...state.project, dataset: { ...state.project.dataset, cases } } });
    open('Anna + 2 errors');
    const [first, second] = within(within(view()).getByRole('list', { name: 'Expected errors' })).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect([...first.querySelectorAll('.error-side')].map((s) => `${s.querySelector('dt')?.textContent}: ${s.querySelector('dd')?.textContent}`)).toEqual(['source_text: “Anna is a baker”', 'summary: “Anna is a doctor”']);
    expect([...second.querySelectorAll('.error-side dt')].map((d) => d.textContent)).toEqual(['summary']);
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(within(first).getByRole('button', { name: 'Show the issue' }));
    const strong = [...view().querySelectorAll<HTMLElement>('.fragment-strong')];
    expect(strong.map((m) => m.closest<HTMLElement>('[data-field]')?.dataset['field']).sort()).toEqual(['source_text', 'summary']);
    expect(view().querySelector('[data-field="source_text"] mark[data-shown]')?.textContent).toBe('Anna is a baker');
  });

  it('shows no check line of text against list (T286)', () => {
    show();
    open('Anna + 2 errors');
    expect(within(view()).queryByText(/Text and list agree|changed place/)).toBeNull();
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

  it('has no Clone, no Show JSON and no Recreate: a similar case is made with Add test case › Case with errors (T218, T262)', () => {
    show();
    open('Anna + 2 errors');
    expect(within(view()).queryByRole('button', { name: 'Clone' })).toBeNull();
    expect(within(view()).queryByRole('button', { name: 'Show JSON' })).toBeNull();
    expect(within(view()).queryByRole('button', { name: /Recreate/ })).toBeNull();
  });
});
