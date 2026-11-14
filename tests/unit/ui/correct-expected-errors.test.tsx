// FR-089: after finalizing, only the expected errors of a case without a reply can be corrected.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
/** Finalized; the clean case has a reply, the case with errors has none. */
const finalized = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, replies: { '1': e.replies['1']! }, decisions: {} } };
};
const show = (state = finalized()) => render(<App ports={createFakePorts()} env={env} initialState={state} />);
const open = (name: string) => fireEvent.click(within(screen.getAllByRole('row').find((r) => r.textContent?.includes(name)) as HTMLElement).getByRole('button', { name: 'Open' }));
const win = () => screen.getByRole('dialog', { name: 'Test case' });

describe('Correct expected errors', () => {
  it('opens the case view with the case JSON', () => {
    show();
    open('Anna + 2 errors');
    fireEvent.click(screen.getByRole('button', { name: 'Correct expected errors' }));
    expect(within(win()).getAllByRole('button', { name: 'Show in text' })).toHaveLength(2);
    expect(JSON.parse((within(win()).getByLabelText('Case JSON') as HTMLTextAreaElement).value).fields.summary).toContain('Anna is a doctor');
  });

  it('is not offered for a case with a reply, and the view says why', () => {
    show();
    open('Anna');
    const view = screen.getByRole('dialog', { name: /Anna/ });
    expect(within(view).queryByRole('button', { name: 'Correct expected errors' })).toBeNull();
    expect(within(view).getByText(/has a reply/)).toBeTruthy();
  });

  it('a change to the name or a field is a problem under the box and blocks Save case', () => {
    show();
    open('Anna + 2 errors');
    fireEvent.click(screen.getByRole('button', { name: 'Correct expected errors' }));
    const box = within(win()).getByLabelText('Case JSON') as HTMLTextAreaElement;
    const edited = JSON.parse(box.value);
    fireEvent.input(box, { target: { value: JSON.stringify({ ...edited, name: 'Another name' }) } });
    expect(within(win()).getByText(/name cannot change/i)).toBeTruthy();
    expect((within(win()).getByRole('button', { name: 'Save case' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saving changes only the expected errors, and marks the case "corrected after first reply" when replies exist', () => {
    show();
    open('Anna + 2 errors');
    fireEvent.click(screen.getByRole('button', { name: 'Correct expected errors' }));
    const box = within(win()).getByLabelText('Case JSON') as HTMLTextAreaElement;
    const edited = JSON.parse(box.value);
    edited.expected_errors[1].difficulty = 'obvious';
    fireEvent.input(box, { target: { value: JSON.stringify(edited) } });
    fireEvent.click(within(win()).getByRole('button', { name: 'Save case' }));
    expect(screen.queryByRole('dialog', { name: 'Test case' })).toBeNull();
    const row = screen.getAllByRole('row').find((r) => r.textContent?.includes('Anna + 2 errors'))!;
    expect(row.textContent).toMatch(/added after first reply/); // an added case stays "added"
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});
