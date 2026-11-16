// A saved judge reply is read-only, formatted and marked; "Change reply" opens the box with Save reply and Cancel (T293, FR-055, FR-056).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakeClipboard, createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { ReplyView } from '../../../src/ui/windows/case-window/ReplyView';
import { sampleProject, withRun } from '../../helpers/fixtures';
import { expectCancelFirstMainLast } from '../../helpers/dialog-actions';

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
  it('is shown read-only and formatted, not in a text box, with a bar at the left of each finding, no label and no rule name (T311)', () => {
    open('2');
    expect(textbox()).toBeNull();
    expect(left().textContent).toContain('"claims": [');
    expect(blocks()).toHaveLength(2);
    expect(blocks().map((b) => b.dataset['findingBlock'])).toEqual(['claims[]#1', 'claims[]#3']);
    // a block covers whole lines, from the start of its first line to the end of its last, so the bar stands beside all of them
    expect(blocks()[0]!.textContent).toMatch(/^ {4}\{\n[\s\S]*\n {4}\},?\n$/);
    expect(blocks()[0]!.textContent).toContain('Anna is a doctor.');
    expect(blocks()[1]!.textContent).not.toContain('Anna is a baker.');
    for (const block of blocks()) {
      expect(block.querySelector('sup')).toBeNull();
      expect(block.textContent).not.toMatch(/\bF\d\b|Contradicted or unsupported claim/);
    }
    expect(left().textContent).not.toContain('Contradicted or unsupported claim');
  });

  it('"Show the issue" of an error that the judge found also marks that finding in the reply (T311)', () => {
    Element.prototype.scrollIntoView = vi.fn();
    open('2');
    expect(blocks().some((b) => b.classList.contains('fragment-strong'))).toBe(false);
    const card = right().querySelector('[data-finding-line="claims[]#1"]')!.closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Show the issue' }));
    expect(blocks().filter((b) => b.classList.contains('fragment-strong')).map((b) => b.dataset['findingBlock'])).toEqual(['claims[]#1']);
  });

  it('numbers the findings in the right column the same way', () => {
    open('2');
    const lines = [...right().querySelectorAll<HTMLElement>('[data-finding-line]')];
    expect(lines.map((l) => l.dataset['findingLine'])).toEqual(['claims[]#1', 'claims[]#3']);
    expect(lines[0]!.textContent).toContain('F1');
    expect(lines[1]!.textContent).toContain('F2');
  });

  it('a finding on the right is no button: it cannot be pressed to mark its block (owner trial 2026-11-16)', () => {
    Element.prototype.scrollIntoView = vi.fn();
    open('2');
    expect(right().querySelectorAll('[data-finding-line] button, button[data-finding-line]')).toHaveLength(0);
    fireEvent.click(right().querySelector('[data-finding-line="claims[]#3"]') as HTMLElement);
    expect(blocks().some((b) => b.classList.contains('fragment-strong'))).toBe(false);
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

// T334 (SC-033, SC-043, SC-044; research.md, 33.6): each finding marks its whole JSON object, with nothing added to the text of the reply
describe('the marked objects of a JSON reply (T334)', () => {
  const finding = (key: string) => ({ key, text: '', rules: ['r'] });
  const css = readFileSync('src/ui/styles/components.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => css.match(new RegExp(`(?:^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

  it('(a) a block starts at the line of the opening brace of its object and ends after the line of its closing brace', () => {
    open('2');
    const reply = left().querySelector('.reply-read')!.textContent ?? '';
    for (const block of blocks()) {
      const text = block.textContent ?? '';
      expect(text.split('\n')[0], 'the first line is the opening brace').toMatch(/^\s*\{$/);
      expect(text, 'the last line is the closing brace').toMatch(/\n\s*\},?\n$/);
      // the block is made of whole lines of the reply: it starts at the start of a line
      const at = reply.indexOf(text);
      expect(at).toBeGreaterThan(0);
      expect(reply[at - 1]).toBe('\n');
    }
  });

  it('(b) a block holds only the text of the reply: no F number, rule name, category or description', () => {
    open('2');
    const reply = withReplies().testRun!.replies['2']!.reply;
    expect(left().querySelector('.reply-read')!.textContent).toBe(reply);
    for (const block of blocks()) expect(reply).toContain(block.textContent ?? '');
  });

  it('(c) a reply kept as text has no block', () => {
    open('1');
    expect(left().querySelectorAll('.reply-block')).toHaveLength(0);
  });

  it('(d) an object that no rule read has no block', () => {
    open('2');
    expect(blocks().map((b) => b.textContent).join('')).not.toContain('Anna is a baker.');
    expect(left().querySelectorAll('.reply-block')).toHaveLength(2);
  });

  it('(e) a finding inside another marked object marks only the outer object', () => {
    const reply = pretty({ a: [{ b: [{ x: 1 }, { x: 2 }] }, { b: [] }] });
    const { container } = render(<ReplyView reply={reply} findings={[finding('a[].b[]#1.2'), finding('a[]#1')]} pointed={null} onPoint={() => {}} />);
    const marked = [...container.querySelectorAll<HTMLElement>('.reply-block')];
    expect(marked.map((b) => b.dataset['findingBlock'])).toEqual(['a[]#1']);
    expect(marked[0]!.textContent).toContain('"x": 2');
  });

  it('the light mark is a background and a 2 px line; the strong mark a stronger background and a 4 px accent line, in normal weight (research.md, 33.6)', () => {
    const light = rule('.reply-block');
    expect(light).toMatch(/background:\s*var\(--reply-bg\)/);
    expect(light).toMatch(/border-left:\s*2px solid var\(--reply-line\)/);
    const strong = rule('.reply-block.fragment-strong');
    expect(strong).toMatch(/background:\s*var\(--reply-strong-bg\)/);
    expect(strong).toMatch(/border-left:\s*4px solid var\(--accent\)/);
    expect(strong).toMatch(/outline:\s*none/);
    expect(strong).toMatch(/font-weight:\s*(normal|400)/);
  });

  it('the reply is not a Tab stop of its own, now that it does not scroll; each block still is', () => {
    open('2');
    const read = left().querySelector('.reply-read') as HTMLElement;
    expect(read.hasAttribute('tabindex')).toBe(false);
    expect(read.tabIndex).toBe(-1);
    for (const block of blocks()) expect(block.tabIndex).toBe(0);
  });
});

describe('the order of the buttons in the two reply questions (T337, FR-093)', () => {
  const change = () => fireEvent.click(within(left()).getByRole('button', { name: 'Change reply' }));
  const ask = (name: string) => screen.findByRole('dialog', { name });

  it('"Change the judge’s reply?": "Cancel", "Change reply", the last one primary', async () => {
    open('2');
    change();
    fireEvent.input(textbox()!, { target: { value: '{"claims": []}' } });
    fireEvent.click(within(left()).getByRole('button', { name: 'Save reply' }));
    expectCancelFirstMainLast(await ask('Change the judge’s reply?'), ['Cancel', 'Change reply']);
  });

  it('"Remove the judge’s reply?": "Cancel", "Remove reply", the last one primary', async () => {
    open('2');
    change();
    fireEvent.input(textbox()!, { target: { value: '' } });
    fireEvent.click(within(left()).getByRole('button', { name: 'Save reply' }));
    expectCancelFirstMainLast(await ask('Remove the judge’s reply?'), ['Cancel', 'Remove reply']);
  });
});
