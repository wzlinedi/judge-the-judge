// The second-opinion window (FR-063, SC-028).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { reviewEvaluation } from '../../../src/core/evaluation/results';
import { verificationPrompt } from '../../../src/core/generation/verification-prompt';
import { readEvaluation } from '../../../src/core/io/evaluation-file';
import type { Evaluation } from '../../../src/core/model';
import { CaseWindowHarness } from '../../helpers/case-window-harness';
import { accuracyMetric } from '../../helpers/fixtures';

const loaded = readEvaluation(readFileSync('examples/demo/evaluation.json', 'utf8'));
if (!loaded.ok) throw new Error('demo not readable');
const demo = loaded.value.evaluation;
const opinions = JSON.parse(readFileSync('examples/demo/opinions.json', 'utf8')) as Record<string, { opinion: unknown }>;
const opinionText = (id: string) => JSON.stringify(opinions[id]);

const openWindow = (caseId: string, start: Evaluation = demo) => {
  const seen: Evaluation[] = [];
  render(<CaseWindowHarness start={start} caseId={caseId} seen={(e) => seen.push(e)} />);
  fireEvent.click(within(screen.getByRole('dialog', { name: /^Case / })).getByRole('button', { name: 'Second opinion…' }));
  return seen;
};
const dialog = () => screen.getByRole('dialog', { name: 'Second opinion' });
const box = () => within(dialog()).getByRole('textbox', { name: 'Opinion of your LLM' }) as HTMLTextAreaElement;
const paste = (text: string) => fireEvent.input(box(), { target: { value: text } });
const apply = () => within(dialog()).getByRole('button', { name: 'Apply opinion' }) as HTMLButtonElement;
const caseWindow = () => screen.getByRole('dialog', { name: /^Case / });

describe('the second-opinion window', () => {
  it('is the standard large dialog, with Cancel and Apply opinion in the bar at the bottom (T247)', () => {
    openWindow('14');
    expect(dialog().classList.contains('dialog-wide')).toBe(true);
    expect(within(dialog().querySelector('.dialog-actions') as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Apply opinion']);
  });

  it('opens a dialog for that case with the line saying what is checked, the prompt with Copy prompt and one box', () => {
    openWindow('17');
    expect(within(dialog()).getByText('The LLM checks 3 expected errors and 1 additional finding of this case.')).toBeTruthy();
    const reviewed = reviewEvaluation(demo, accuracyMetric).find((r) => r.testCase.id === '17')!;
    const prompt = within(dialog()).getByRole('textbox', { name: 'Verification prompt' }) as HTMLTextAreaElement;
    expect(prompt.readOnly).toBe(true);
    expect(prompt.value).toBe(verificationPrompt(demo, reviewed));
    expect(within(dialog()).getByRole('button', { name: 'Copy prompt' })).toBeTruthy();
    expect(within(dialog()).getAllByRole('textbox').filter((t) => !(t as HTMLTextAreaElement).readOnly)).toHaveLength(1);
  });

  it('has Apply opinion and Cancel, and Apply is disabled while the box is empty', () => {
    openWindow('17');
    expect(apply().disabled).toBe(true);
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('previews each change, with the reason and the fragment, before anything is applied', () => {
    const seen = openWindow('17');
    paste(opinionText('17'));
    const preview = within(dialog()).getByRole('list', { name: 'What will change' });
    expect(preview.textContent).toContain('E2 undecided → Missed');
    expect(preview.textContent).toContain('No finding is about the number of dwarves.');
    expect(preview.textContent).toContain('join twelve dwarves');
    expect(preview.textContent).toContain('A1 undecided → False positive');
    expect(preview.textContent).toContain('Gandalf does persuade Bilbo');
    expect(apply().disabled).toBe(false);
    expect(seen).toEqual([]);
  });

  it('names the items the opinion does not answer, and gives an undecided one the fixed reason', () => {
    openWindow('17');
    paste(opinionText('17'));
    const text = within(dialog()).getByRole('list', { name: 'No answer' }).textContent ?? '';
    expect(text).toContain('E1');
    expect(text).toContain('E3');
    paste(JSON.stringify({ opinion: { id: '17', expected: [{ index: 1, found: true }], additional: [] } }));
    expect(within(dialog()).getByRole('list', { name: 'No answer' }).textContent).toContain('The LLM opinion gave no answer for this item');
  });

  it('names a change that replaces a mark set by hand', () => {
    const e = structuredClone(demo);
    e.decisions['17'] = { expected: { e2: { state: 'found', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' };
    openWindow('17', e);
    paste(opinionText('17'));
    const preview = within(dialog()).getByRole('list', { name: 'What will change' }).textContent ?? '';
    expect(preview).toContain('E2 Found → Missed');
    expect(preview).toContain('replaces a mark set by hand');
  });

  it('shows an answer that agrees as "no change" and a new finding as "+ new finding"', () => {
    const e = structuredClone(demo);
    e.decisions['17'] = { expected: { e2: { state: 'missed', source: 'manual' } }, additional: {}, added_findings: [], approved: false, note: '' };
    openWindow('17', e);
    paste(JSON.stringify({ opinion: { id: '17', expected: [{ index: 2, found: false }], additional: [], new: [{ text: 'Bilbo is a hobbit', real: true, category: 'factual-error', difficulty: 'subtle' }] } }));
    const preview = within(dialog()).getByRole('list', { name: 'What will change' }).textContent ?? '';
    expect(preview).toContain('E2 Missed — no change');
    expect(preview).toContain('+ new finding “Bilbo is a hobbit” → Real error');
    expect(preview).toContain('factual-error');
  });

  it('applies the opinion: the window closes and the marks show the source "LLM opinion, approved by the user"', () => {
    const seen = openWindow('17');
    paste(opinionText('17'));
    fireEvent.click(apply());
    expect(screen.queryByRole('dialog', { name: 'Second opinion' })).toBeNull();
    const last = seen.at(-1)!;
    expect(last.decisions['17']?.expected['e2']).toEqual({ state: 'missed', source: 'llm-approved' });
    expect(last.decisions['17']?.approved).toBe(true);
    const e2 = caseWindow().querySelector('[data-expected="e2"]') as HTMLElement;
    expect(e2.textContent).toContain('LLM opinion, approved by the user');
  });

  it('adds a new finding with its category as a finding with Remove', () => {
    openWindow('14');
    paste(JSON.stringify({ opinion: { id: '14', expected: [], additional: [], new: [{ text: 'A thing the reply says', real: true, category: 'Brand New', difficulty: 'obvious' }] } }));
    fireEvent.click(apply());
    const added = caseWindow().querySelector('[data-additional="added#1"]') as HTMLElement;
    expect(added.textContent).toContain('A thing the reply says');
    expect(added.textContent).toContain('brand-new');
    expect(within(added).getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('refuses an opinion for another case with the reason, keeps the text and cannot be applied', () => {
    const seen = openWindow('17');
    paste(opinionText('3'));
    expect(within(dialog()).getByText(/This opinion is for case 3, but this is case 17/)).toBeTruthy();
    expect(apply().disabled).toBe(true);
    expect(box().value).toBe(opinionText('3'));
    expect(seen).toEqual([]);
  });

  it('shows the line and column of a text that is not readable JSON, and cannot be applied', () => {
    openWindow('17');
    paste('{\n  "opinion": {\n    "id": "17",,\n  }\n}');
    expect(within(dialog()).getByText(/Line 3, column/)).toBeTruthy();
    expect(apply().disabled).toBe(true);
  });

  it('refuses a list of several opinions', () => {
    openWindow('17');
    paste(JSON.stringify([opinions['17']!.opinion, opinions['3']!.opinion]));
    expect(within(dialog()).getByText(/one case at a time/)).toBeTruthy();
    expect(apply().disabled).toBe(true);
  });

  it('says so when the opinion classifies none of the items, names the reason per item and cannot be applied', () => {
    openWindow('17');
    paste(JSON.stringify({ opinion: { id: '17', expected: [{ index: 7, found: true }], additional: [{ index: 1, reason: 'unsure' }] } }));
    expect(within(dialog()).getByText('The opinion classifies none of the 4 items of this case. Nothing will change.')).toBeTruthy();
    expect(within(dialog()).getByRole('list', { name: 'No answer' }).querySelectorAll('li')).toHaveLength(4);
    expect(apply().disabled).toBe(true);
  });

  it('changes nothing on Cancel', () => {
    const seen = openWindow('17');
    paste(opinionText('17'));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Second opinion' })).toBeNull();
    expect(seen).toEqual([]);
  });
});
