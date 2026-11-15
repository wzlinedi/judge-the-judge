import { describe, expect, it } from 'vitest';
import { baseCasesOf, injectPrompt, newDraft, promptOf, startFrom } from '../../../src/app/actions/test-case-window';
import { createState, type AppState } from '../../../src/app/store';
import { sampleEvaluation } from '../../helpers/fixtures';

const state = (): AppState => {
  const e = sampleEvaluation();
  const cases = [
    ...e.dataset.cases,
    { id: '3', name: 'No base + 1 error', fields: { source_text: 'x', summary: 'y' }, expected_errors: [{ id: 'e1', description: 'Made up.', category: 'brand-new' }] },
  ];
  return { ...createState(), evaluation: { ...e, dataset: { ...e.dataset, cases } } };
};

describe('Case with errors can start from any case (T262)', () => {
  it('offers the clean cases and the cases with errors', () => {
    const { clean, withErrors } = baseCasesOf(state());
    expect(clean.map((c) => c.id)).toEqual(['1']);
    expect(withErrors.map((c) => c.id)).toEqual(['2', '3']);
  });

  it('a clean case is the base, and the errors to prepare stay', () => {
    const s = state();
    const draft = { ...newDraft(s), rows: [{ id: 1, category: 'wrong-number', isNew: false, difficulty: 'subtle' as const, description: 'mine' }] };
    expect(startFrom(s, draft, '1')).toEqual({ ...draft, from: '1', base: '1' });
  });

  it('a case with errors copies its errors into the table and uses its own base as the base text', () => {
    const next = startFrom(state(), newDraft(state()), '2');
    expect(next.from).toBe('2');
    expect(next.base).toBe('1');
    expect(next.rows.map(({ category, isNew, difficulty, description }) => ({ category, isNew, difficulty, description }))).toEqual([
      { category: 'factual-error', isNew: false, difficulty: 'obvious', description: 'Profession changed.' },
      { category: 'wrong-number', isNew: false, difficulty: 'subtle', description: 'Year changed.' },
    ]);
    expect(new Set(next.rows.map((r) => r.id)).size).toBe(2);
  });

  it('a case with errors and no base gives no base text; an error without a difficulty is left to the LLM, a category not in the catalog is new', () => {
    const next = startFrom(state(), newDraft(state()), '3');
    expect(next.base).toBe('');
    expect(next.rows).toEqual([{ id: 1, category: 'brand-new', isNew: true, difficulty: 'llm', description: 'Made up.' }]);
  });

  it('None goes back to no base and keeps the rows', () => {
    const s = state();
    const copied = startFrom(s, newDraft(s), '2');
    expect(startFrom(s, copied, '')).toEqual({ ...copied, from: '', base: '' });
  });
});

describe('the prompt can be edited (T262)', () => {
  it('is rebuilt from the parts until it is edited, then the edit is kept whatever the parts are', () => {
    const s = state();
    const draft = newDraft(s);
    expect(promptOf(s, draft)).toBe(injectPrompt(s, draft));
    const edited = { ...startFrom(s, draft, '2'), prompt: 'my own words' };
    expect(promptOf(s, edited)).toBe('my own words');
    expect(promptOf(s, startFrom(s, edited, '1'))).toBe('my own words');
    const { prompt: _gone, ...rebuilt } = edited;
    expect(promptOf(s, rebuilt)).toBe(injectPrompt(s, rebuilt));
  });
});
