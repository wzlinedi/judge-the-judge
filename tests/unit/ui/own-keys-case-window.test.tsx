// A case id may be a built-in JavaScript name (S1, Constitution IX); the case window reads its reply draft by own key only (T389).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../../../src/ui/App';
import { createFakePorts } from '../../../src/app/ports/fakes';
import { createState, type AppState } from '../../../src/app/store';
import type { TestProject } from '../../../src/core/model';
import { sampleProject, withRun } from '../../helpers/fixtures';

const env = { showSaveFilePicker: vi.fn(), navigator: { clipboard: { readText: vi.fn() } } };
const fileEnv = { now: () => '2026-01-01T00:00:00.000Z', toolVersion: 'test' };

function projectWithFirstId(id: string): TestProject {
  const base = sampleProject();
  const cases = base.dataset.cases.map((c, i) => (i === 0 ? { ...c, id } : c));
  return withRun({ ...base, dataset: { ...base.dataset, cases } }, { replies: {}, decisions: {}, reply_judge_version: undefined });
}

const open = (project: TestProject, caseId: string) =>
  render(<App ports={createFakePorts()} env={env} fileEnv={fileEnv} initialState={{ ...createState(), step: 'run', project, openCase: caseId } as AppState} />);
const win = () => screen.getByRole('dialog', { name: /^Case / });
const box = () => within(win()).getByRole('textbox', { name: 'Judge reply' }) as HTMLTextAreaElement;

describe('the reply box of a case whose id is a built-in JavaScript name', () => {
  it.each(['plain-id', 'constructor', 'toString', 'hasOwnProperty'])('%s: the box starts empty and keeps what is typed', (id) => {
    open(projectWithFirstId(id), id);
    expect(box().value).toBe('');
    fireEvent.input(box(), { target: { value: 'not json yet' } });
    expect(box().value).toBe('not json yet');
  });
});
