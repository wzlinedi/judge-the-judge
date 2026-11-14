// "Import test cases" (FR-027 to FR-030): the panel, the summary and the choice to import or cancel.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts, type FakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const draft = (): AppState => {
  const e = sampleEvaluation();
  return { ...createState(), step: 'cases', evaluation: { ...e, dataset: { ...e.dataset, finalized: false }, replies: {}, decisions: {} } };
};
const csv = (rows: string) => `name,field:source_text,field:summary\n${rows}`;
const panel = () => screen.getByRole('dialog', { name: 'Import test cases…' });

function openPanel(ports: FakePorts = createFakePorts(), state: AppState = draft()) {
  render(<App ports={ports} env={env} initialState={state} />);
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Import test cases…' }));
  return ports;
}
async function choose(ports: FakePorts, file: { name: string; text: string; bytes?: Uint8Array }) {
  ports.opener.next = file;
  fireEvent.click(within(panel()).getByRole('button', { name: 'Choose file…' }));
  return within(panel()).findByText(/can be imported|Nothing can be imported/);
}

describe('the import panel', () => {
  it('opens from the File menu with Download example file explained behind Explain, and Choose file', () => {
    openPanel();
    expect(within(panel()).getByRole('button', { name: 'Download example file' })).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Explain' }));
    expect(within(panel()).getByText(/shows how to lay out clean test cases in a spreadsheet/)).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Choose file…' })).toBeTruthy();
  });

  it('Download example file saves a CSV with the variables of the current prompt', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = ((blob: Blob) => (created.push(blob), 'blob:x')) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    openPanel();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Download example file' }));
    expect(click).toHaveBeenCalled();
    expect(await created[0]!.text()).toContain('field:source_text');
    click.mockRestore();
  });

  it('Explain describes the columns of the file: name, field: and the doubled quote', () => {
    openPanel();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Explain' }));
    const text = panel().textContent ?? '';
    expect(text).toMatch(/One row is one test case/);
    expect(text).toMatch(/name.*can be left empty/);
    expect(text).toMatch(/field:source_text/);
    expect(text).toContain('A quote that is part of a text is written twice ("")');
  });

  it('Download example file says in the window that the file was saved, and under what name', () => {
    URL.createObjectURL = (() => 'blob:x') as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    openPanel();
    expect(within(panel()).queryByRole('status', { name: 'Example file' })).toBeNull();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Download example file' }));
    expect(within(panel()).getByRole('status', { name: 'Example file' }).textContent).toMatch(/Saved test-cases-example\.csv: look for it in your Downloads folder/);
    click.mockRestore();
  });

  it('a CSV with quotes that are not doubled gives one line per row with the fix, not the same line four times', async () => {
    const ports = openPanel();
    ports.opener.next = { name: 'cases.csv', text: csv('Anna,"He said "hi" there","S"\nBert,"Say "no" now","S"\n') };
    fireEvent.click(within(panel()).getByRole('button', { name: 'Choose file…' }));
    const alert = await within(panel()).findByRole('alert');
    expect(alert.textContent).toMatch(/Row 2 \(Anna\)/);
    expect(alert.textContent).toMatch(/Row 3 \(Bert\)/);
    expect(alert.textContent).toContain('twice');
    expect(alert.textContent?.match(/not doubled/g)).toHaveLength(2);
    expect(alert.textContent).not.toMatch(/Trailing quote/);
  });

  it('Cancel closes it without changing anything', () => {
    openPanel();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Import test cases…' })).toBeNull();
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });
});

describe('the summary', () => {
  it('shows the counts of clean cases and cases with injected errors', async () => {
    const ports = openPanel();
    const file = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [
      { name: 'Clean', fields: { source_text: 'S', summary: 'T' }, expected_errors: [] },
      { name: 'Injected', fields: { source_text: 'S', summary: 'T2' }, expected_errors: [{ description: 'd', category: 'factual-error', fragment: 'T2' }] },
    ] };
    await choose(ports, { name: 'cases.json', text: JSON.stringify(file) });
    expect(within(panel()).getByText(/2 test cases can be imported/)).toBeTruthy();
    expect(within(panel()).getByText(/1 clean, 1 with injected errors/)).toBeTruthy();
  });

  it('warns about a new category that is not written in lower case with dashes, and still adds it as it is', async () => {
    const ports = openPanel();
    const file = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [
      { name: 'Injected', fields: { source_text: 'S', summary: 'T2' }, expected_errors: [{ description: 'd', category: 'Tone Shift', fragment: 'T2' }, { description: 'e', category: 'ok-name', fragment: 'T2' }] },
    ] };
    await choose(ports, { name: 'cases.json', text: JSON.stringify(file) });
    const note = within(panel()).getByText(/not written|are not:/);
    expect(note.textContent).toContain('Tone Shift');
    expect(note.textContent).not.toContain('ok-name');
  });

  it('lists an invalid row with its position and reason, and imports only the valid rows', async () => {
    const ports = openPanel();
    await choose(ports, { name: 'cases.csv', text: csv('Anna 2,S,T\nBad,,\nDora,D,E\n') });
    const invalid = within(panel()).getByRole('list', { name: 'Invalid rows' });
    expect(invalid.textContent).toMatch(/Row 3/);
    expect(invalid.textContent).toMatch(/no text/i);
    expect(within(panel()).getByText(/2 test cases can be imported/)).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Import test cases…' }));
    expect(screen.queryByRole('dialog', { name: 'Import test cases…' })).toBeNull();
    expect(screen.getByText('Dora')).toBeTruthy();
    expect(screen.getByText('Anna 2')).toBeTruthy();
    expect(screen.getByText('Anna + 2 errors')).toBeTruthy(); // the cases already there are kept
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('names fields that match no variable, variables with no field, ignored columns and the encoding', async () => {
    const ports = openPanel();
    await choose(ports, { name: 'c.csv', text: 'name,id,field:source_text,field:other\nA,1,S,X\n', bytes: new Uint8Array([...new TextEncoder().encode('name,id,field:source_text,field:other\nA,1,S,Xÿ\n')].map((b) => b)) });
    const text = panel().textContent ?? '';
    expect(text).toMatch(/other/);
    expect(text).toMatch(/summary/);
    expect(text).toMatch(/Ignored columns: id/);
  });

  it('says it read a file that is not UTF-8 as Windows-1250', async () => {
    const ports = openPanel();
    const bytes = new Uint8Array([...new TextEncoder().encode('name,field:source_text,field:summary\nZ,'), 0xbf, 0xf3, ...new TextEncoder().encode(',B\n')]);
    await choose(ports, { name: 'c.csv', text: '', bytes });
    expect(within(panel()).getByText(/Windows-1250/)).toBeTruthy();
  });

  it('names a category that is not in the catalog and adds it only when the import is confirmed', async () => {
    const ports = openPanel();
    const file = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [{ name: 'N', fields: { source_text: 'S', summary: 'Tone' }, expected_errors: [{ description: 'd', category: 'tone-shift', fragment: 'Tone' }] }] };
    await choose(ports, { name: 'c.json', text: JSON.stringify(file) });
    expect(within(panel()).getByText(/tone-shift/)).toBeTruthy();
    expect(within(panel()).getByText(/Importing adds them to the catalog/)).toBeTruthy();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Added to the catalog/)).toBeNull();
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('says how many identifiers were replaced and which names are used twice', async () => {
    const ports = openPanel();
    const file = { format: 'judge-the-judge-test-cases', schema_version: 1, cases: [{ id: '1', name: 'Anna', fields: { source_text: 'S', summary: 'T' }, expected_errors: [] }] };
    await choose(ports, { name: 'c.json', text: JSON.stringify(file) });
    expect(within(panel()).getByText(/1 identifier was already used and got a new one/)).toBeTruthy();
    expect(within(panel()).getByText(/also used by another case: Anna/)).toBeTruthy();
  });

  it('a file that cannot be read says so with its place, and nothing changes', async () => {
    const ports = openPanel();
    ports.opener.next = { name: 'x.json', text: '{ "format": ' };
    fireEvent.click(within(panel()).getByRole('button', { name: 'Choose file…' }));
    expect(await within(panel()).findByText(/Line 1, column/)).toBeTruthy();
    expect(within(panel()).getByText(/Nothing has changed/)).toBeTruthy();
    expect(within(panel()).queryByRole('button', { name: 'Import test cases…' })).toBeNull();
  });

  it('Import test cases is disabled while no case is valid', async () => {
    const ports = openPanel();
    await choose(ports, { name: 'c.csv', text: csv('Bad,,\n') });
    expect(within(panel()).getByText(/Nothing can be imported/)).toBeTruthy();
    expect((within(panel()).getByRole('button', { name: 'Import test cases…' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Cancel after reading a file changes nothing', async () => {
    const ports = openPanel();
    await choose(ports, { name: 'c.csv', text: csv('Dora,D,E\n') });
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Dora')).toBeNull();
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });
});

describe('Export test cases', () => {
  it('asks for a file name each time and keeps the unsaved indicator as it was', async () => {
    const ports = createFakePorts();
    render(<App ports={ports} env={env} initialState={draft()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export test cases…' }));
    expect(await screen.findByText(/Exported 2 test cases/)).toBeTruthy();
    expect(ports.exportTarget.asked).toBe(1);
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });
});
