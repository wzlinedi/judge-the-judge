// A saved judge reply is read-only, formatted and marked; "Change reply" opens the box with Save reply and Cancel (T293, FR-055, FR-056).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakeClipboard, createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const withReplies = (): TestProject => {
  const e = sampleProject();
  const claims = [{ text: 'Anna is a doctor.', verdict: 'contradicted', reason: 'x' }, { text: 'Anna is a baker.', verdict: 'supported', reason: 'y' }, { text: 'She bought a second oven in 2005.', verdict: 'unsupported', reason: 'z' }];
  return withRun(e, { replies: { ...e.testRun!.replies, '2': { prompt: 'p2', reply: pretty({ claims }) }, '1': { prompt: 'p1', reply: 'plain text, not JSON' } }, decisions: {} });
};
const open = (caseId: string, evaluation: TestProject = withReplies(), ports = createFakePorts()) =>
  render(<App ports={ports} env={env} fileEnv={fileEnv} initialState={{ ...createState(), step: 'run', project: evaluation, openCase: caseId } as AppState} />);
const win = () => screen.getByRole('dialog', { name: /^Case / });
const left = () => win().querySelector('.reply-pane') as HTMLElement;
const right = () => win().querySelector('.decide-pane') as HTMLElement;
const textbox = () => within(win()).queryByRole('textbox', { name: 'Judge reply' }) as HTMLTextAreaElement | null;
const blocks = () => [...left().querySelectorAll<HTMLElement>('[data-finding-block]')];

describe('a saved reply that is JSON', () => {
  it('is shown read-only and formatted, not in a text box, with the findings highlighted by rule and number', () => {
    open('2');
    expect(textbox()).toBeNull();
    expect(left().textContent).toContain('"claims": [');
    expect(blocks()).toHaveLength(2);
    expect(blocks().map((b) => b.dataset['findingBlock'])).toEqual(['claims[]#1', 'claims[]#3']);
    expect(blocks()[0]!.textContent).toContain('F1');
    expect(blocks()[0]!.textContent).toContain('Contradicted or unsupported claim');
    expect(blocks()[0]!.textContent).toContain('Anna is a doctor.');
    expect(blocks()[1]!.textContent).toContain('F2');
    expect(blocks()[1]!.textContent).not.toContain('Anna is a baker.');
  });

  it('numbers the findings in the right column the same way', () => {
    open('2');
    const lines = [...right().querySelectorAll<HTMLElement>('[data-finding-line]')];
    expect(lines.map((l) => l.dataset['findingLine'])).toEqual(['claims[]#1', 'claims[]#3']);
    expect(lines[0]!.textContent).toContain('F1');
    expect(lines[1]!.textContent).toContain('F2');
  });

  it('pressing a finding on the right scrolls to and marks its block in the reply', () => {
    Element.prototype.scrollIntoView = vi.fn();
    open('2');
    expect(blocks().some((b) => b.classList.contains('fragment-strong'))).toBe(false);
    fireEvent.click(right().querySelector('[data-finding-line="claims[]#3"]') as HTMLElement);
    expect(blocks().filter((b) => b.classList.contains('fragment-strong')).map((b) => b.dataset['findingBlock'])).toEqual(['claims[]#3']);
  });

  it('pressing a highlighted block marks its finding on the right', () => {
    Element.prototype.scrollIntoView = vi.fn();
    open('2');
    fireEvent.click(blocks()[0]!);
    expect((right().querySelector('[data-finding-line="claims[]#1"]') as HTMLElement).classList.contains('pointed')).toBe(true);
    expect((right().querySelector('[data-finding-line="claims[]#3"]') as HTMLElement).classList.contains('pointed')).toBe(false);
  });
});

describe('a saved reply kept as text', () => {
  it('is shown read-only without highlights', () => {
    open('1');
    expect(textbox()).toBeNull();
    expect(left().textContent).toContain('plain text, not JSON');
    expect(blocks()).toHaveLength(0);
    expect(within(left()).getByRole('button', { name: 'Change reply' })).toBeTruthy();
  });
});

describe('Change reply, Save reply and Cancel', () => {
  const change = () => fireEvent.click(within(left()).getByRole('button', { name: 'Change reply' }));
  const dialog = (name: string) => screen.findByRole('dialog', { name });

  it('opens the box with the saved text, Save reply and Cancel; typing saves nothing', () => {
    open('2');
    change();
    expect(textbox()!.value).toBe(pretty({ claims: JSON.parse(withReplies().testRun!.replies['2']!.reply).claims }));
    expect(within(left()).getByRole('button', { name: 'Save reply' })).toBeTruthy();
    fireEvent.input(textbox()!, { target: { value: '{"claims": []}' } });
    expect(screen.queryByRole('dialog', { name: 'Change the judge’s reply?' })).toBeNull();
    expect(within(win()).getByText('0 not saved')).toBeTruthy();
  });

  it('Cancel drops the edits and shows the saved reply again', () => {
    open('2');
    change();
    fireEvent.input(textbox()!, { target: { value: 'something else' } });
    fireEvent.click(within(left()).getByRole('button', { name: 'Cancel' }));
    expect(textbox()).toBeNull();
    expect(blocks()).toHaveLength(2);
    change();
    expect(textbox()!.value).toContain('"claims"');
  });

  it('Save reply asks first, names the marks that are lost, and after Change reply saves and returns to the read-only view', async () => {
    const e = withReplies();
    e.testRun!.decisions = { '2': { expected: { e1: { state: 'found', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' } } as NonNullable<TestProject['testRun']>['decisions'];
    open('2', e);
    change();
    fireEvent.input(textbox()!, { target: { value: '{"claims":[{"text":"x","verdict":"unsupported","reason":"r"}]}' } });
    fireEvent.click(within(left()).getByRole('button', { name: 'Save reply' }));
    const ask = await dialog('Change the judge’s reply?');
    expect(ask.textContent).toMatch(/The 1 mark you set .* is removed/);
    fireEvent.click(within(ask).getByRole('button', { name: 'Change reply' }));
    await waitFor(() => expect(textbox()).toBeNull());
    expect(within(win()).getByText('1 not saved')).toBeTruthy();
    expect(left().textContent).toContain('"text": "x"');
    expect(blocks()).toHaveLength(1);
  });

  it('Save reply with the text unchanged asks nothing and returns to the read-only view', () => {
    open('2');
    change();
    fireEvent.click(within(left()).getByRole('button', { name: 'Save reply' }));
    expect(screen.queryByRole('dialog', { name: 'Change the judge’s reply?' })).toBeNull();
    expect(textbox()).toBeNull();
  });

  it('an emptied box removes the reply when Save reply is pressed, after asking (T291)', async () => {
    open('2');
    change();
    fireEvent.input(textbox()!, { target: { value: '' } });
    expect(screen.queryByRole('dialog', { name: 'Remove the judge’s reply?' })).toBeNull();
    fireEvent.click(within(left()).getByRole('button', { name: 'Save reply' }));
    const ask = await dialog('Remove the judge’s reply?');
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(textbox()).not.toBeNull();
    fireEvent.click(within(left()).getByRole('button', { name: 'Save reply' }));
    fireEvent.click(within(await dialog('Remove the judge’s reply?')).getByRole('button', { name: 'Remove reply' }));
    await waitFor(() => expect(textbox()!.value).toBe(''));
    expect(within(win()).getAllByText(/Not run/).length).toBeGreaterThan(0);
  });

  it('Paste reply over a saved reply asks the same question, then saves at once and shows the read-only view', async () => {
    const ports = createFakePorts();
    ports.clipboard = createFakeClipboard('{"claims":[{"text":"y","verdict":"unsupported","reason":"r"}]}');
    open('2', withReplies(), ports);
    fireEvent.click(within(left()).getByRole('button', { name: 'Paste reply' }));
    fireEvent.click(within(await dialog('Change the judge’s reply?')).getByRole('button', { name: 'Change reply' }));
    await waitFor(() => expect(left().textContent).toContain('"text": "y"'));
    expect(textbox()).toBeNull();
  });
});

describe('a case without a reply', () => {
  it('keeps the box, saves a readable JSON as soon as it is in the box, and then shows the read-only view', async () => {
    const e = withReplies();
    delete e.testRun!.replies['2'];
    open('2', e);
    expect(textbox()).not.toBeNull();
    expect(within(left()).queryByRole('button', { name: 'Change reply' })).toBeNull();
    fireEvent.input(textbox()!, { target: { value: '{"claims":[]}' } });
    await waitFor(() => expect(textbox()).toBeNull());
    expect(left().textContent).toContain('"claims": []');
  });
});
